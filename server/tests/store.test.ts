import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { RestaurantStore } from '../db.js';

describe('RestaurantStore end-to-end lifecycle & security', () => {
  it('supports QR order placement, chef timer, auto-ready expiry, serving, payment, and sales stats', () => {
    const store = new RestaurantStore(':memory:');
    const menu = store.getMenu();
    assert.ok(menu.length >= 6);

    const order = store.createOrder({
      tableId: 'T1',
      paymentMethod: 'esewa',
      customerNote: 'Extra chili sauce',
      items: [
        { menuItemId: menu[0].id, quantity: 2 },
        { menuItemId: menu[1].id, quantity: 1 },
      ],
    });

    assert.equal(order.status, 'pending');
    assert.equal(order.paymentStatus, 'pending');
    assert.equal(order.paymentMethod, 'esewa');

    // Chef starts a 10-second timer for the whole table order
    const cooking = store.startItemTimer(order.id, null, 10);
    assert.equal(cooking.status, 'preparing');
    assert.ok(cooking.items.every((i) => i.itemStatus === 'preparing' && i.timerEndsAt !== null));

    // Simulate clock moving 15 seconds forward -> expired timers auto-ready
    const future = new Date(Date.now() + 15000);
    const changed = store.processExpiredTimers(future);
    assert.equal(changed, true);

    const readyOrder = store.getOrderById(order.id)!;
    assert.equal(readyOrder.status, 'ready');
    assert.ok(readyOrder.items.every((i) => i.itemStatus === 'ready'));

    // Waiter marks order served, then collects eSewa payment
    const served = store.markOrderServed(order.id);
    assert.equal(served.status, 'served');
    assert.ok(served.servedAt);

    const paid = store.markOrderPaid(order.id);
    assert.equal(paid.paymentStatus, 'paid');
    assert.ok(paid.paidAt);

    // Sales summary reflects order
    const sales = store.getSalesSummary();
    assert.equal(sales.totalOrders, 1);
    assert.equal(sales.servedOrders, 1);
    assert.equal(sales.paidRevenue, order.totalAmount);
    assert.equal(sales.byPaymentMethod.esewa.count, 1);
  });

  it('supports role password changes and device role addition/removal', () => {
    const store = new RestaurantStore(':memory:');

    // Default kitchen login works with 1234
    const badLogin = store.loginDevice('kitchen', '9999', 'DEV-1', 'Kitchen Tab');
    assert.equal(badLogin, null);

    const okLogin = store.loginDevice('kitchen', '1234', 'DEV-1', 'Kitchen Tab');
    assert.ok(okLogin);
    assert.equal(store.verifyDeviceSession('kitchen', 'DEV-1').authorized, true);

    // Manager changes kitchen password -> old session invalidated
    store.updateRolePassword('kitchen', '5678');
    assert.equal(store.verifyDeviceSession('kitchen', 'DEV-1').authorized, false);

    // New password works
    const relogin = store.loginDevice('kitchen', '5678', 'DEV-1', 'Kitchen Tab');
    assert.ok(relogin);
    assert.equal(store.verifyDeviceSession('kitchen', 'DEV-1').authorized, true);

    // Manager assigns waiter role to DEV-2, then revokes it
    const assigned = store.assignRoleToDevice('DEV-2', 'Waiter Phone', 'waiter');
    assert.equal(store.verifyDeviceSession('waiter', 'DEV-2').authorized, true);

    store.revokeDeviceSession(assigned.id);
    assert.equal(store.verifyDeviceSession('waiter', 'DEV-2').authorized, false);
  });
});
