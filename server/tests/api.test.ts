import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { Socket } from 'node:net';
import { RestaurantStore } from '../db.js';
import { createApp } from '../app.js';

interface TestResponse {
  status: number;
  json: <T>() => T;
}

function invokeApp(
  app: ReturnType<typeof createApp>,
  method: string,
  url: string,
  body?: unknown,
  headers: Record<string, string> = {}
): Promise<TestResponse> {
  return new Promise((resolve, reject) => {
    const socket = new Socket();
    const req = new http.IncomingMessage(socket);
    req.method = method;
    req.url = url;
    const payload = body !== undefined ? Buffer.from(JSON.stringify(body), 'utf8') : Buffer.alloc(0);
    req.headers = {
      host: 'localhost:3000',
      'content-type': 'application/json',
      'content-length': String(payload.length),
      ...Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v])),
    };

    const res = new http.ServerResponse(req);
    const chunks: Buffer[] = [];
    const origWrite = res.write.bind(res);
    const origEnd = res.end.bind(res);

    res.write = ((chunk: unknown, ...rest: unknown[]) => {
      if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
      return (origWrite as (...args: unknown[]) => boolean)(chunk, ...rest);
    }) as typeof res.write;

    res.end = ((chunk?: unknown, ...rest: unknown[]) => {
      if (chunk && typeof chunk !== 'function') {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
      }
      const raw = Buffer.concat(chunks).toString('utf8');
      resolve({
        status: res.statusCode,
        json: <T>() => JSON.parse(raw) as T,
      });
      return (origEnd as (...args: unknown[]) => typeof res)(chunk, ...rest);
    }) as typeof res.end;

    res.on('error', reject);
    (app as unknown as (req: http.IncomingMessage, res: http.ServerResponse) => void)(req, res);

    if (payload.length > 0) {
      req.push(payload);
    }
    req.push(null);
  });
}

describe('HTTP API end-to-end routes', () => {
  it('completes Diner -> Kitchen -> Waiter -> Manager workflow over Express routes', async () => {
    const store = new RestaurantStore(':memory:');
    const app = createApp(store);

    const bootRes = await invokeApp(app, 'GET', '/api/bootstrap');
    assert.equal(bootRes.status, 200);
    const boot = bootRes.json<{
      menu: Array<{ id: string }>;
      tables: Array<{ id: string }>;
    }>();
    assert.ok(boot.menu.length > 0);
    assert.ok(boot.tables.some((t) => t.id === 'T1'));

    // 1. Diner places order with Khalti (pay after served)
    const orderRes = await invokeApp(app, 'POST', '/api/orders', {
      tableId: 'T1',
      paymentMethod: 'khalti',
      items: [{ menuItemId: boot.menu[0].id, quantity: 1 }],
    });
    assert.equal(orderRes.status, 201);
    const order = orderRes.json<{ id: string; status: string }>();
    assert.equal(order.status, 'pending');

    // 2. Kitchen logs in with 1234 and starts a 30s timer
    const kLogin = await invokeApp(app, 'POST', '/api/auth/login', {
      role: 'kitchen',
      pin: '1234',
      deviceId: 'K1',
      deviceName: 'Kitchen Tab',
    });
    assert.equal(kLogin.status, 200);

    const timerRes = await invokeApp(app, 'POST', `/api/orders/${order.id}/timer`, {
      durationSeconds: 30,
    });
    assert.equal(timerRes.status, 200);
    assert.equal(timerRes.json<{ status: string }>().status, 'preparing');

    // 3. Kitchen marks order ready, Waiter logs in (2222), serves, and marks paid
    const readyRes = await invokeApp(app, 'POST', `/api/orders/${order.id}/ready`, {});
    assert.equal(readyRes.status, 200);

    const wLogin = await invokeApp(app, 'POST', '/api/auth/login', {
      role: 'waiter',
      pin: '2222',
      deviceId: 'W1',
      deviceName: 'Waiter Phone',
    });
    assert.equal(wLogin.status, 200);

    const serveRes = await invokeApp(app, 'POST', `/api/orders/${order.id}/serve`);
    assert.equal(serveRes.status, 200);
    assert.equal(serveRes.json<{ status: string }>().status, 'served');

    const payRes = await invokeApp(app, 'POST', `/api/orders/${order.id}/pay`, {});
    assert.equal(payRes.status, 200);

    // 4. Manager logs in (0000), checks sales, changes password, checks QR generation
    const mLogin = await invokeApp(app, 'POST', '/api/auth/login', {
      role: 'manager',
      pin: '0000',
      deviceId: 'M1',
      deviceName: 'Manager PC',
    });
    assert.equal(mLogin.status, 200);

    const salesRes = await invokeApp(app, 'GET', '/api/manager/sales', undefined, { 'x-device-id': 'M1' });
    assert.equal(salesRes.status, 200);
    const sales = salesRes.json<{ summary: { totalOrders: number; paidRevenue: number } }>();
    assert.equal(sales.summary.totalOrders, 1);
    assert.ok(sales.summary.paidRevenue > 0);

    const qrRes = await invokeApp(app, 'GET', '/api/tables/T1/qr');
    assert.equal(qrRes.status, 200);
    const qr = qrRes.json<{ dataUrl: string }>();
    assert.ok(qr.dataUrl.startsWith('data:image/png;base64,'));
  });
});
