import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
export class RestaurantStore {
    db;
    constructor(dbPath) {
        const resolvedPath = dbPath ?? path.resolve(process.cwd(), 'data', 'restaurant.db');
        if (resolvedPath !== ':memory:') {
            fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });
        }
        this.db = new DatabaseSync(resolvedPath);
        this.db.exec('PRAGMA journal_mode = WAL;');
        this.db.exec('PRAGMA foreign_keys = ON;');
        this.initSchema();
        this.seedDefaults();
    }
    initSchema() {
        this.db.exec(`
      CREATE TABLE IF NOT EXISTS menu_items (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        category TEXT NOT NULL,
        price REAL NOT NULL,
        description TEXT NOT NULL,
        is_veg INTEGER NOT NULL DEFAULT 0,
        is_spicy INTEGER NOT NULL DEFAULT 0,
        is_popular INTEGER NOT NULL DEFAULT 0,
        available INTEGER NOT NULL DEFAULT 1,
        prep_estimate_min INTEGER NOT NULL DEFAULT 10,
        icon TEXT NOT NULL DEFAULT '🍽️'
      );

      CREATE TABLE IF NOT EXISTS restaurant_tables (
        id TEXT PRIMARY KEY,
        label TEXT NOT NULL,
        seats INTEGER NOT NULL DEFAULT 4,
        zone TEXT NOT NULL DEFAULT 'Main Hall'
      );

      CREATE TABLE IF NOT EXISTS orders (
        id TEXT PRIMARY KEY,
        order_number INTEGER NOT NULL UNIQUE,
        table_id TEXT NOT NULL,
        table_label TEXT NOT NULL,
        customer_note TEXT,
        payment_method TEXT NOT NULL,
        payment_status TEXT NOT NULL DEFAULT 'pending',
        status TEXT NOT NULL DEFAULT 'pending',
        total_amount REAL NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        served_at TEXT,
        paid_at TEXT
      );

      CREATE TABLE IF NOT EXISTS order_items (
        id TEXT PRIMARY KEY,
        order_id TEXT NOT NULL,
        menu_item_id TEXT NOT NULL,
        name TEXT NOT NULL,
        unit_price REAL NOT NULL,
        quantity INTEGER NOT NULL,
        notes TEXT,
        timer_duration_sec INTEGER,
        timer_started_at TEXT,
        timer_ends_at TEXT,
        item_status TEXT NOT NULL DEFAULT 'pending',
        FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS role_policies (
        role TEXT PRIMARY KEY,
        pin TEXT NOT NULL,
        password_version INTEGER NOT NULL DEFAULT 1,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS device_sessions (
        id TEXT PRIMARY KEY,
        device_id TEXT NOT NULL,
        device_name TEXT NOT NULL,
        role TEXT NOT NULL,
        password_version INTEGER NOT NULL,
        active INTEGER NOT NULL DEFAULT 1,
        last_seen_at TEXT NOT NULL,
        created_at TEXT NOT NULL,
        UNIQUE(device_id, role)
      );
    `);
    }
    seedDefaults() {
        const now = new Date().toISOString();
        const roleCount = this.db.prepare('SELECT COUNT(*) as c FROM role_policies').get().c;
        if (roleCount === 0) {
            const insertRole = this.db.prepare('INSERT INTO role_policies (role, pin, password_version, updated_at) VALUES (?, ?, 1, ?)');
            insertRole.run('kitchen', '1234', now);
            insertRole.run('waiter', '2222', now);
            insertRole.run('manager', '0000', now);
        }
        const tableCount = this.db.prepare('SELECT COUNT(*) as c FROM restaurant_tables').get().c;
        if (tableCount === 0) {
            const insertTable = this.db.prepare('INSERT INTO restaurant_tables (id, label, seats, zone) VALUES (?, ?, ?, ?)');
            const defaultTables = [
                ['T1', 'Table 1', 2, 'Window'],
                ['T2', 'Table 2', 4, 'Main Hall'],
                ['T3', 'Table 3', 4, 'Main Hall'],
                ['T4', 'Table 4', 6, 'Family Booth'],
                ['T5', 'Table 5', 4, 'Main Hall'],
                ['T6', 'Table 6', 2, 'Patio'],
                ['T7', 'Table 7', 6, 'Patio'],
                ['T8', 'Table 8', 8, 'VIP Lounge'],
            ];
            for (const row of defaultTables) {
                insertTable.run(...row);
            }
        }
        const menuCount = this.db.prepare('SELECT COUNT(*) as c FROM menu_items').get().c;
        if (menuCount === 0) {
            const insertMenu = this.db.prepare(`
        INSERT INTO menu_items (
          id, name, category, price, description, is_veg, is_spicy, is_popular, available, prep_estimate_min, icon
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
            const items = [
                ['m1', 'Crimson Chili Momo', 'Starters', 320, 'Steamed dumplings tossed in house roasted garlic & red chili glaze.', 0, 1, 1, 1, 10, '🥟'],
                ['m2', 'Crispy Corn & Pepper', 'Starters', 280, 'Golden sweet corn kernels wok-tossed with crushed black pepper and scallions.', 1, 1, 0, 1, 8, '🌽'],
                ['m3', 'Truffle Garlic Fries', 'Starters', 260, 'Hand-cut crispy fries dusted with parmesan, parsley, and garlic oil.', 1, 0, 1, 1, 7, '🍟'],
                ['m4', 'Wood-Fired Margherita', 'Mains', 680, 'San Marzano tomato base, fresh mozzarella, basil leaves, olive oil.', 1, 0, 1, 1, 14, '🍕'],
                ['m5', 'Smoked Pepperoni Pizza', 'Mains', 820, 'Crispy double pepperoni, aged cheddar-mozzarella blend, hot honey drizzle.', 0, 1, 1, 1, 15, '🍕'],
                ['m6', 'Charcoal Smash Burger', 'Burgers & Grill', 540, 'Double seared patty, caramelized onions, smoky red mayo, brioche bun.', 0, 0, 1, 1, 12, '🍔'],
                ['m7', 'Spicy Paneer Tikka Wrap', 'Burgers & Grill', 420, 'Char-grilled cottage cheese, mint chutney, pickled red onions in warm flatbread.', 1, 1, 0, 1, 10, '🌯'],
                ['m8', 'Szechuan Hakka Noodles', 'Momo & Bowls', 390, 'Wok-seared noodles with crunchy veggies, dark soy, and fiery chili oil.', 1, 1, 0, 1, 11, '🍜'],
                ['m9', 'Signature Chicken Thakali', 'Momo & Bowls', 580, 'Traditional platter with steamed rice, black lentils, herb chicken curry & achar.', 0, 1, 1, 1, 15, '🍛'],
                ['m10', 'Blood Orange Iced Tea', 'Drinks', 210, 'Freshly brewed Ceylon black tea shaken with blood orange & mint.', 1, 0, 1, 1, 4, '🍹'],
                ['m11', 'Himalayan Masala Chai', 'Drinks', 140, 'Slow-simmered spiced milk tea with cardamom, ginger, and cinnamon.', 1, 0, 0, 1, 5, '☕'],
                ['m12', 'Warm Molten Lava Cake', 'Desserts', 360, 'Rich dark chocolate cake with a flowing center and vanilla bean scoop.', 1, 0, 1, 1, 9, '🍫'],
            ];
            for (const item of items) {
                insertMenu.run(...item);
            }
        }
    }
    // ---- Menu ----
    getMenu() {
        const rows = this.db.prepare('SELECT * FROM menu_items ORDER BY category, name').all();
        return rows.map((r) => ({
            id: String(r.id),
            name: String(r.name),
            category: String(r.category),
            price: Number(r.price),
            description: String(r.description),
            isVeg: Boolean(r.is_veg),
            isSpicy: Boolean(r.is_spicy),
            isPopular: Boolean(r.is_popular),
            available: Boolean(r.available),
            prepEstimateMin: Number(r.prep_estimate_min),
            icon: String(r.icon),
        }));
    }
    upsertMenuItem(item) {
        const id = item.id && item.id.trim() ? item.id.trim() : `m_${crypto.randomUUID().slice(0, 8)}`;
        this.db
            .prepare(`
        INSERT INTO menu_items (id, name, category, price, description, is_veg, is_spicy, is_popular, available, prep_estimate_min, icon)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          name = excluded.name,
          category = excluded.category,
          price = excluded.price,
          description = excluded.description,
          is_veg = excluded.is_veg,
          is_spicy = excluded.is_spicy,
          is_popular = excluded.is_popular,
          available = excluded.available,
          prep_estimate_min = excluded.prep_estimate_min,
          icon = excluded.icon
      `)
            .run(id, item.name.trim(), item.category.trim(), Number(item.price), item.description.trim(), item.isVeg ? 1 : 0, item.isSpicy ? 1 : 0, item.isPopular ? 1 : 0, item.available ? 1 : 0, Number(item.prepEstimateMin) || 10, item.icon || '🍽️');
        return this.getMenu().find((m) => m.id === id);
    }
    deleteMenuItem(id) {
        const res = this.db.prepare('DELETE FROM menu_items WHERE id = ?').run(id);
        return res.changes > 0;
    }
    // ---- Tables ----
    getTables() {
        const rows = this.db
            .prepare('SELECT * FROM restaurant_tables ORDER BY LENGTH(id), id')
            .all();
        return rows.map((r) => ({
            id: String(r.id),
            label: String(r.label),
            seats: Number(r.seats),
            zone: String(r.zone),
        }));
    }
    upsertTable(table) {
        const id = table.id.trim().toUpperCase();
        this.db
            .prepare(`
        INSERT INTO restaurant_tables (id, label, seats, zone)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          label = excluded.label,
          seats = excluded.seats,
          zone = excluded.zone
      `)
            .run(id, table.label.trim(), Number(table.seats) || 4, table.zone.trim() || 'Main Hall');
        return this.getTables().find((t) => t.id === id);
    }
    deleteTable(id) {
        const res = this.db.prepare('DELETE FROM restaurant_tables WHERE id = ?').run(id);
        return res.changes > 0;
    }
    // ---- Orders ----
    getOrders() {
        const orderRows = this.db
            .prepare('SELECT * FROM orders ORDER BY order_number DESC')
            .all();
        const itemRows = this.db.prepare('SELECT * FROM order_items').all();
        const itemsByOrder = new Map();
        for (const r of itemRows) {
            const orderId = String(r.order_id);
            const list = itemsByOrder.get(orderId) ?? [];
            list.push({
                id: String(r.id),
                orderId,
                menuItemId: String(r.menu_item_id),
                name: String(r.name),
                unitPrice: Number(r.unit_price),
                quantity: Number(r.quantity),
                notes: r.notes ? String(r.notes) : undefined,
                timerDurationSec: r.timer_duration_sec !== null ? Number(r.timer_duration_sec) : null,
                timerStartedAt: r.timer_started_at ? String(r.timer_started_at) : null,
                timerEndsAt: r.timer_ends_at ? String(r.timer_ends_at) : null,
                itemStatus: String(r.item_status),
            });
            itemsByOrder.set(orderId, list);
        }
        return orderRows.map((r) => ({
            id: String(r.id),
            orderNumber: Number(r.order_number),
            tableId: String(r.table_id),
            tableLabel: String(r.table_label),
            customerNote: r.customer_note ? String(r.customer_note) : undefined,
            paymentMethod: String(r.payment_method),
            paymentStatus: String(r.payment_status),
            status: String(r.status),
            totalAmount: Number(r.total_amount),
            items: itemsByOrder.get(String(r.id)) ?? [],
            createdAt: String(r.created_at),
            updatedAt: String(r.updated_at),
            servedAt: r.served_at ? String(r.served_at) : null,
            paidAt: r.paid_at ? String(r.paid_at) : null,
        }));
    }
    getOrderById(id) {
        return this.getOrders().find((o) => o.id === id) ?? null;
    }
    createOrder(input) {
        const tables = this.getTables();
        const table = tables.find((t) => t.id.toLowerCase() === input.tableId.trim().toLowerCase());
        if (!table) {
            throw new Error(`Unknown table: ${input.tableId}`);
        }
        if (!input.items || input.items.length === 0) {
            throw new Error('Order must contain at least one item');
        }
        const menuMap = new Map(this.getMenu().map((m) => [m.id, m]));
        const resolvedItems = [];
        let totalAmount = 0;
        for (const line of input.items) {
            const menuItem = menuMap.get(line.menuItemId);
            if (!menuItem || !menuItem.available) {
                throw new Error(`Menu item unavailable: ${line.menuItemId}`);
            }
            const qty = Math.max(1, Math.floor(line.quantity));
            totalAmount += menuItem.price * qty;
            resolvedItems.push({
                id: `oi_${crypto.randomUUID().slice(0, 10)}`,
                menuItemId: menuItem.id,
                name: menuItem.name,
                unitPrice: menuItem.price,
                quantity: qty,
                notes: line.notes?.trim() || undefined,
            });
        }
        const maxNumRow = this.db.prepare('SELECT COALESCE(MAX(order_number), 100) as maxNum FROM orders').get();
        const nextOrderNumber = Number(maxNumRow.maxNum) + 1;
        const orderId = `ord_${crypto.randomUUID().slice(0, 10)}`;
        const now = new Date().toISOString();
        this.db.exec('BEGIN');
        try {
            this.db
                .prepare(`
          INSERT INTO orders (
            id, order_number, table_id, table_label, customer_note,
            payment_method, payment_status, status, total_amount, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, 'pending', 'pending', ?, ?, ?)
        `)
                .run(orderId, nextOrderNumber, table.id, table.label, input.customerNote?.trim() || null, input.paymentMethod, totalAmount, now, now);
            const insertItem = this.db.prepare(`
        INSERT INTO order_items (
          id, order_id, menu_item_id, name, unit_price, quantity, notes, item_status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')
      `);
            for (const item of resolvedItems) {
                insertItem.run(item.id, orderId, item.menuItemId, item.name, item.unitPrice, item.quantity, item.notes ?? null);
            }
            this.db.exec('COMMIT');
        }
        catch (err) {
            this.db.exec('ROLLBACK');
            throw err;
        }
        return this.getOrderById(orderId);
    }
    startItemTimer(orderId, itemId, durationSeconds) {
        const order = this.getOrderById(orderId);
        if (!order)
            throw new Error('Order not found');
        if (order.status === 'served')
            throw new Error('Order is already served');
        const safeDuration = Math.max(5, Math.min(7200, Math.round(durationSeconds)));
        const now = new Date();
        const endsAt = new Date(now.getTime() + safeDuration * 1000).toISOString();
        const startedAt = now.toISOString();
        if (itemId) {
            const exists = order.items.some((i) => i.id === itemId);
            if (!exists)
                throw new Error('Order item not found');
            this.db
                .prepare(`
          UPDATE order_items
          SET timer_duration_sec = ?, timer_started_at = ?, timer_ends_at = ?, item_status = 'preparing'
          WHERE id = ? AND order_id = ?
        `)
                .run(safeDuration, startedAt, endsAt, itemId, orderId);
        }
        else {
            this.db
                .prepare(`
          UPDATE order_items
          SET timer_duration_sec = ?, timer_started_at = ?, timer_ends_at = ?, item_status = 'preparing'
          WHERE order_id = ? AND item_status != 'ready'
        `)
                .run(safeDuration, startedAt, endsAt, orderId);
        }
        this.recomputeOrderStatus(orderId, startedAt);
        return this.getOrderById(orderId);
    }
    markItemReady(orderId, itemId) {
        const order = this.getOrderById(orderId);
        if (!order)
            throw new Error('Order not found');
        if (order.status === 'served')
            throw new Error('Order is already served');
        const now = new Date().toISOString();
        if (itemId) {
            this.db
                .prepare(`
          UPDATE order_items
          SET item_status = 'ready', timer_ends_at = COALESCE(timer_ends_at, ?)
          WHERE id = ? AND order_id = ?
        `)
                .run(now, itemId, orderId);
        }
        else {
            this.db
                .prepare(`
          UPDATE order_items
          SET item_status = 'ready', timer_ends_at = COALESCE(timer_ends_at, ?)
          WHERE order_id = ?
        `)
                .run(now, orderId);
        }
        this.recomputeOrderStatus(orderId, now);
        return this.getOrderById(orderId);
    }
    recomputeOrderStatus(orderId, nowIso) {
        const items = this.db
            .prepare('SELECT item_status FROM order_items WHERE order_id = ?')
            .all(orderId);
        if (items.length === 0)
            return;
        let nextStatus = 'pending';
        if (items.every((i) => i.item_status === 'ready')) {
            nextStatus = 'ready';
        }
        else if (items.some((i) => i.item_status === 'preparing' || i.item_status === 'ready')) {
            nextStatus = 'preparing';
        }
        this.db
            .prepare("UPDATE orders SET status = ?, updated_at = ? WHERE id = ? AND status != 'served'")
            .run(nextStatus, nowIso, orderId);
    }
    markOrderServed(orderId) {
        const order = this.getOrderById(orderId);
        if (!order)
            throw new Error('Order not found');
        const now = new Date().toISOString();
        this.db.prepare("UPDATE order_items SET item_status = 'ready' WHERE order_id = ?").run(orderId);
        this.db
            .prepare("UPDATE orders SET status = 'served', served_at = COALESCE(served_at, ?), updated_at = ? WHERE id = ?")
            .run(now, now, orderId);
        return this.getOrderById(orderId);
    }
    markOrderPaid(orderId, paymentMethod) {
        const order = this.getOrderById(orderId);
        if (!order)
            throw new Error('Order not found');
        const now = new Date().toISOString();
        const method = paymentMethod ?? order.paymentMethod;
        this.db
            .prepare("UPDATE orders SET payment_status = 'paid', payment_method = ?, paid_at = COALESCE(paid_at, ?), updated_at = ? WHERE id = ?")
            .run(method, now, now, orderId);
        return this.getOrderById(orderId);
    }
    // Periodic tick: transitions any expired preparing timers to ready
    processExpiredTimers(nowDate = new Date()) {
        const nowIso = nowDate.toISOString();
        const expired = this.db
            .prepare(`
        SELECT DISTINCT oi.order_id
        FROM order_items oi
        JOIN orders o ON o.id = oi.order_id
        WHERE oi.item_status = 'preparing'
          AND oi.timer_ends_at IS NOT NULL
          AND oi.timer_ends_at <= ?
          AND o.status != 'served'
      `)
            .all(nowIso);
        if (expired.length === 0)
            return false;
        this.db
            .prepare(`
        UPDATE order_items
        SET item_status = 'ready'
        WHERE item_status = 'preparing'
          AND timer_ends_at IS NOT NULL
          AND timer_ends_at <= ?
      `)
            .run(nowIso);
        for (const row of expired) {
            this.recomputeOrderStatus(row.order_id, nowIso);
        }
        return true;
    }
    // ---- Auth & Device Role Management ----
    getRolePolicies() {
        const rows = this.db.prepare('SELECT * FROM role_policies ORDER BY role').all();
        return rows.map((r) => ({
            role: String(r.role),
            pin: String(r.pin),
            passwordVersion: Number(r.password_version),
            updatedAt: String(r.updated_at),
        }));
    }
    getDeviceSessions() {
        const rows = this.db
            .prepare('SELECT * FROM device_sessions ORDER BY last_seen_at DESC')
            .all();
        return rows.map((r) => ({
            id: String(r.id),
            deviceId: String(r.device_id),
            deviceName: String(r.device_name),
            role: String(r.role),
            passwordVersion: Number(r.password_version),
            active: Boolean(r.active),
            lastSeenAt: String(r.last_seen_at),
            createdAt: String(r.created_at),
        }));
    }
    loginDevice(role, pin, deviceId, deviceName) {
        const policy = this.db
            .prepare('SELECT * FROM role_policies WHERE role = ?')
            .get(role);
        if (!policy || policy.pin !== pin.trim()) {
            return null;
        }
        const now = new Date().toISOString();
        const id = `dev_${crypto.randomUUID().slice(0, 8)}`;
        const cleanDeviceId = deviceId.trim() || `browser_${crypto.randomUUID().slice(0, 8)}`;
        const cleanName = deviceName.trim() || `${role.toUpperCase()} Screen`;
        this.db
            .prepare(`
        INSERT INTO device_sessions (id, device_id, device_name, role, password_version, active, last_seen_at, created_at)
        VALUES (?, ?, ?, ?, ?, 1, ?, ?)
        ON CONFLICT(device_id, role) DO UPDATE SET
          device_name = excluded.device_name,
          password_version = excluded.password_version,
          active = 1,
          last_seen_at = excluded.last_seen_at
      `)
            .run(id, cleanDeviceId, cleanName, role, policy.password_version, now, now);
        return this.getDeviceSessions().find((d) => d.deviceId === cleanDeviceId && d.role === role);
    }
    verifyDeviceSession(role, deviceId, passwordVersion) {
        const policy = this.db
            .prepare('SELECT password_version FROM role_policies WHERE role = ?')
            .get(role);
        if (!policy) {
            return { authorized: false, currentVersion: 0 };
        }
        const session = this.getDeviceSessions().find((d) => d.deviceId === deviceId && d.role === role);
        if (!session || !session.active || session.passwordVersion !== policy.password_version) {
            return { authorized: false, currentVersion: policy.password_version };
        }
        if (passwordVersion !== undefined && passwordVersion !== policy.password_version) {
            return { authorized: false, currentVersion: policy.password_version };
        }
        this.db
            .prepare('UPDATE device_sessions SET last_seen_at = ? WHERE id = ?')
            .run(new Date().toISOString(), session.id);
        return { authorized: true, currentVersion: policy.password_version, session };
    }
    updateRolePassword(role, newPin) {
        const cleanPin = newPin.trim();
        if (cleanPin.length < 3) {
            throw new Error('Password/PIN must be at least 3 characters');
        }
        const now = new Date().toISOString();
        this.db
            .prepare(`
        UPDATE role_policies
        SET pin = ?, password_version = password_version + 1, updated_at = ?
        WHERE role = ?
      `)
            .run(cleanPin, now, role);
        // Deactivate sessions from older password versions so devices must re-enter new password
        const policy = this.getRolePolicies().find((p) => p.role === role);
        this.db
            .prepare('UPDATE device_sessions SET active = 0 WHERE role = ? AND password_version < ?')
            .run(role, policy.passwordVersion);
        return policy;
    }
    assignRoleToDevice(deviceId, deviceName, role) {
        const policy = this.getRolePolicies().find((p) => p.role === role);
        if (!policy)
            throw new Error('Invalid role');
        const now = new Date().toISOString();
        const id = `dev_${crypto.randomUUID().slice(0, 8)}`;
        const cleanDeviceId = deviceId.trim();
        if (!cleanDeviceId)
            throw new Error('Device ID is required');
        const cleanName = deviceName.trim() || `${role.toUpperCase()} Device`;
        this.db
            .prepare(`
        INSERT INTO device_sessions (id, device_id, device_name, role, password_version, active, last_seen_at, created_at)
        VALUES (?, ?, ?, ?, ?, 1, ?, ?)
        ON CONFLICT(device_id, role) DO UPDATE SET
          device_name = excluded.device_name,
          password_version = excluded.password_version,
          active = 1,
          last_seen_at = excluded.last_seen_at
      `)
            .run(id, cleanDeviceId, cleanName, role, policy.passwordVersion, now, now);
        return this.getDeviceSessions().find((d) => d.deviceId === cleanDeviceId && d.role === role);
    }
    revokeDeviceSession(sessionId) {
        const existing = this.getDeviceSessions().find((d) => d.id === sessionId);
        if (!existing)
            return null;
        this.db.prepare('DELETE FROM device_sessions WHERE id = ?').run(sessionId);
        return existing;
    }
    // ---- Sales Analytics ----
    getSalesSummary() {
        const orders = this.getOrders();
        const byPaymentMethod = {
            cash: { count: 0, amount: 0, paidAmount: 0 },
            esewa: { count: 0, amount: 0, paidAmount: 0 },
            khalti: { count: 0, amount: 0, paidAmount: 0 },
        };
        let grossRevenue = 0;
        let paidRevenue = 0;
        let pendingRevenue = 0;
        let servedOrders = 0;
        let activeOrders = 0;
        const itemStats = new Map();
        const hourlyMap = new Map();
        for (const order of orders) {
            grossRevenue += order.totalAmount;
            if (order.paymentStatus === 'paid') {
                paidRevenue += order.totalAmount;
            }
            else {
                pendingRevenue += order.totalAmount;
            }
            if (order.status === 'served') {
                servedOrders += 1;
            }
            else {
                activeOrders += 1;
            }
            const pm = byPaymentMethod[order.paymentMethod];
            if (pm) {
                pm.count += 1;
                pm.amount += order.totalAmount;
                if (order.paymentStatus === 'paid') {
                    pm.paidAmount += order.totalAmount;
                }
            }
            for (const item of order.items) {
                const prev = itemStats.get(item.name) ?? { name: item.name, quantity: 0, revenue: 0 };
                prev.quantity += item.quantity;
                prev.revenue += item.unitPrice * item.quantity;
                itemStats.set(item.name, prev);
            }
            const dt = new Date(order.createdAt);
            const hourLabel = `${String(dt.getHours()).padStart(2, '0')}:00`;
            const hr = hourlyMap.get(hourLabel) ?? { hour: hourLabel, revenue: 0, orders: 0 };
            hr.revenue += order.totalAmount;
            hr.orders += 1;
            hourlyMap.set(hourLabel, hr);
        }
        const topItems = Array.from(itemStats.values())
            .sort((a, b) => b.quantity - a.quantity || b.revenue - a.revenue)
            .slice(0, 8);
        const hourlyRevenue = Array.from(hourlyMap.values()).sort((a, b) => a.hour.localeCompare(b.hour));
        return {
            totalOrders: orders.length,
            servedOrders,
            activeOrders,
            grossRevenue,
            paidRevenue,
            pendingRevenue,
            averageOrderValue: orders.length > 0 ? Math.round(grossRevenue / orders.length) : 0,
            byPaymentMethod,
            topItems,
            hourlyRevenue,
        };
    }
}
