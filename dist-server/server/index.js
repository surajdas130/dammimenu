import { RestaurantStore } from './db.js';
import { createApp } from './app.js';
import { realtimeHub } from './realtime.js';
const PORT = Number(process.env.PORT ?? 3000);
const store = new RestaurantStore();
const app = createApp(store);
// Background ticker to auto-complete expired kitchen timers every second
const timerTicker = setInterval(() => {
    const changed = store.processExpiredTimers();
    if (changed) {
        realtimeHub.broadcast({
            type: 'orders_changed',
            data: {
                orders: store.getOrders(),
                serverTime: new Date().toISOString(),
            },
        });
    }
}, 1000);
const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`CrimsonTable server listening on http://localhost:${PORT}`);
});
process.on('SIGINT', () => {
    clearInterval(timerTicker);
    server.close();
    process.exit(0);
});
