import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import QRCode from 'qrcode';
import { RestaurantStore } from './db.js';
import { realtimeHub } from './realtime.js';
import type { PaymentMethod, Role } from '../shared/types.js';

const VALID_ROLES = new Set<Role>(['kitchen', 'waiter', 'manager']);
const VALID_PAYMENTS = new Set<PaymentMethod>(['cash', 'esewa', 'khalti']);

export function createApp(store: RestaurantStore) {
  const app = express();
  app.use(express.json());

  const broadcastOrders = () => {
    realtimeHub.broadcast({
      type: 'orders_changed',
      data: {
        orders: store.getOrders(),
        serverTime: new Date().toISOString(),
      },
    });
  };

  const requireManager = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const deviceId = String(req.header('x-device-id') ?? '');
    if (!deviceId) {
      res.status(401).json({ error: 'Manager device session required' });
      return;
    }
    const check = store.verifyDeviceSession('manager', deviceId);
    if (!check.authorized) {
      res.status(401).json({ error: 'Manager authorization expired or revoked' });
      return;
    }
    next();
  };

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, serverTime: new Date().toISOString() });
  });

  app.get('/api/bootstrap', (_req, res) => {
    store.processExpiredTimers();
    res.json({
      menu: store.getMenu(),
      tables: store.getTables(),
      orders: store.getOrders(),
      serverTime: new Date().toISOString(),
    });
  });

  app.get('/api/stream', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    store.processExpiredTimers();
    const snapshot = {
      menu: store.getMenu(),
      tables: store.getTables(),
      orders: store.getOrders(),
      serverTime: new Date().toISOString(),
    };
    res.write(`event: snapshot\ndata: ${JSON.stringify(snapshot)}\n\n`);

    const unsubscribe = realtimeHub.addClient(res);
    const heartbeat = setInterval(() => {
      if (!res.writableEnded) {
        res.write(`: heartbeat ${Date.now()}\n\n`);
      }
    }, 20000);

    req.on('close', () => {
      clearInterval(heartbeat);
      unsubscribe();
    });
  });

  // ---- Customer & Order Lifecycle ----
  app.post('/api/orders', (req, res) => {
    try {
      const { tableId, customerNote, paymentMethod, items } = req.body ?? {};
      if (!tableId || typeof tableId !== 'string') {
        res.status(400).json({ error: 'Please select a valid table' });
        return;
      }
      if (!VALID_PAYMENTS.has(paymentMethod)) {
        res.status(400).json({ error: 'Payment method must be cash, esewa, or khalti' });
        return;
      }
      const order = store.createOrder({ tableId, customerNote, paymentMethod, items });
      broadcastOrders();
      res.status(201).json(order);
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to create order' });
    }
  });

  app.post('/api/orders/:id/timer', (req, res) => {
    try {
      const { itemId = null, durationSeconds } = req.body ?? {};
      const duration = Number(durationSeconds);
      if (!Number.isFinite(duration) || duration <= 0) {
        res.status(400).json({ error: 'durationSeconds must be a positive number' });
        return;
      }
      const updated = store.startItemTimer(req.params.id, itemId, duration);
      broadcastOrders();
      res.json(updated);
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to start timer' });
    }
  });

  app.post('/api/orders/:id/ready', (req, res) => {
    try {
      const { itemId = null } = req.body ?? {};
      const updated = store.markItemReady(req.params.id, itemId);
      broadcastOrders();
      res.json(updated);
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to mark ready' });
    }
  });

  app.post('/api/orders/:id/serve', (req, res) => {
    try {
      const updated = store.markOrderServed(req.params.id);
      broadcastOrders();
      res.json(updated);
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to mark served' });
    }
  });

  app.post('/api/orders/:id/pay', (req, res) => {
    try {
      const { paymentMethod } = req.body ?? {};
      if (paymentMethod !== undefined && !VALID_PAYMENTS.has(paymentMethod)) {
        res.status(400).json({ error: 'Invalid payment method' });
        return;
      }
      const updated = store.markOrderPaid(req.params.id, paymentMethod);
      broadcastOrders();
      res.json(updated);
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to mark paid' });
    }
  });

  // ---- Auth & Device Role Verification ----
  app.post('/api/auth/login', (req, res) => {
    const { role, pin, deviceId, deviceName } = req.body ?? {};
    if (!VALID_ROLES.has(role)) {
      res.status(400).json({ error: 'Invalid role' });
      return;
    }
    if (typeof pin !== 'string' || !pin.trim()) {
      res.status(400).json({ error: 'Password/PIN is required' });
      return;
    }
    const session = store.loginDevice(role, pin, String(deviceId || ''), String(deviceName || ''));
    if (!session) {
      res.status(401).json({ error: 'Incorrect password for this role' });
      return;
    }
    res.json({
      authorized: true,
      session,
    });
  });

  app.get('/api/auth/verify', (req, res) => {
    const role = String(req.query.role ?? '') as Role;
    const deviceId = String(req.query.deviceId ?? '');
    const versionParam = req.query.passwordVersion !== undefined ? Number(req.query.passwordVersion) : undefined;
    if (!VALID_ROLES.has(role) || !deviceId) {
      res.status(400).json({ authorized: false, error: 'Missing role or deviceId' });
      return;
    }
    const result = store.verifyDeviceSession(role, deviceId, Number.isFinite(versionParam) ? versionParam : undefined);
    res.json(result);
  });

  // ---- Manager Console APIs ----
  app.get('/api/manager/security', requireManager, (_req, res) => {
    res.json({
      policies: store.getRolePolicies(),
      devices: store.getDeviceSessions(),
    });
  });

  app.put('/api/manager/roles/:role/password', requireManager, (req, res) => {
    const role = req.params.role as Role;
    if (!VALID_ROLES.has(role)) {
      res.status(400).json({ error: 'Invalid role' });
      return;
    }
    try {
      const { pin } = req.body ?? {};
      const updated = store.updateRolePassword(role, String(pin ?? ''));
      realtimeHub.broadcast({
        type: 'auth_changed',
        data: {
          role,
          passwordVersion: updated.passwordVersion,
        },
      });
      res.json({
        policy: updated,
        devices: store.getDeviceSessions(),
      });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to update password' });
    }
  });

  app.post('/api/manager/devices', requireManager, (req, res) => {
    try {
      const { deviceId, deviceName, role } = req.body ?? {};
      if (!VALID_ROLES.has(role)) {
        res.status(400).json({ error: 'Invalid role' });
        return;
      }
      const session = store.assignRoleToDevice(String(deviceId ?? ''), String(deviceName ?? ''), role);
      realtimeHub.broadcast({
        type: 'auth_changed',
        data: { role },
      });
      res.status(201).json(session);
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to add device role' });
    }
  });

  app.delete('/api/manager/devices/:sessionId', requireManager, (req, res) => {
    const removed = store.revokeDeviceSession(String(req.params.sessionId));
    if (!removed) {
      res.status(404).json({ error: 'Device session not found' });
      return;
    }
    realtimeHub.broadcast({
      type: 'auth_changed',
      data: {
        role: removed.role,
        revokedDeviceIds: [removed.deviceId],
      },
    });
    res.json({ removed });
  });

  app.get('/api/manager/sales', requireManager, (_req, res) => {
    res.json({
      summary: store.getSalesSummary(),
      orders: store.getOrders(),
    });
  });

  app.post('/api/manager/menu', requireManager, (req, res) => {
    try {
      const item = store.upsertMenuItem(req.body ?? {});
      realtimeHub.broadcast({
        type: 'menu_changed',
        data: { menu: store.getMenu() },
      });
      res.status(201).json(item);
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to save menu item' });
    }
  });

  app.delete('/api/manager/menu/:id', requireManager, (req, res) => {
    const ok = store.deleteMenuItem(String(req.params.id));
    if (!ok) {
      res.status(404).json({ error: 'Menu item not found' });
      return;
    }
    realtimeHub.broadcast({
      type: 'menu_changed',
      data: { menu: store.getMenu() },
    });
    res.json({ ok: true });
  });

  app.post('/api/manager/tables', requireManager, (req, res) => {
    try {
      const table = store.upsertTable(req.body ?? {});
      realtimeHub.broadcast({
        type: 'tables_changed',
        data: { tables: store.getTables() },
      });
      res.status(201).json(table);
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to save table' });
    }
  });

  app.delete('/api/manager/tables/:id', requireManager, (req, res) => {
    const ok = store.deleteTable(String(req.params.id));
    if (!ok) {
      res.status(404).json({ error: 'Table not found' });
      return;
    }
    realtimeHub.broadcast({
      type: 'tables_changed',
      data: { tables: store.getTables() },
    });
    res.json({ ok: true });
  });

  // ---- QR Code Generator for Tables ----
  app.get('/api/tables/:id/qr', async (req, res) => {
    const tableId = String(req.params.id);
    const origin =
      typeof req.query.origin === 'string' && req.query.origin.trim()
        ? req.query.origin.trim().replace(/\/$/, '')
        : `${req.protocol}://${req.get('host')}`;
    const targetUrl = `${origin}/?table=${encodeURIComponent(tableId)}`;
    try {
      const dataUrl = await QRCode.toDataURL(targetUrl, {
        width: 280,
        margin: 2,
        color: {
          dark: '#111111',
          light: '#FFFFFF',
        },
      });
      res.json({ tableId, url: targetUrl, dataUrl });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'QR generation failed' });
    }
  });

  // ---- Static Frontend (production build) ----
  const distDir = path.resolve(process.cwd(), 'dist');
  if (fs.existsSync(distDir)) {
    app.use(express.static(distDir));
    app.get(/^(?!\/api).*/, (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  return app;
}
