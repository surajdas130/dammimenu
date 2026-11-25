import { useEffect, useRef, useState } from 'react';
import type { BootstrapState, MenuItem, Order, RestaurantTable, Role } from '@shared/types';
import { api } from '@/lib/api';

interface AuthChangedPayload {
  role?: Role;
  passwordVersion?: number;
  revokedDeviceIds?: string[];
}

export function useRestaurantLive(onAuthChanged?: (payload: AuthChangedPayload) => void) {
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const clockOffsetRef = useRef(0);
  const authCallbackRef = useRef(onAuthChanged);

  useEffect(() => {
    authCallbackRef.current = onAuthChanged;
  }, [onAuthChanged]);

  useEffect(() => {
    let active = true;

    const syncClock = (serverTime?: string) => {
      if (!serverTime) return;
      const serverMs = new Date(serverTime).getTime();
      if (Number.isFinite(serverMs)) {
        clockOffsetRef.current = serverMs - Date.now();
      }
    };

    api
      .bootstrap()
      .then((data) => {
        if (!active) return;
        setMenu(data.menu);
        setTables(data.tables);
        setOrders(data.orders);
        syncClock(data.serverTime);
        setLoading(false);
      })
      .catch(() => {
        if (active) setLoading(false);
      });

    const es = new EventSource('/api/stream');

    es.onopen = () => {
      if (active) setConnected(true);
    };
    es.onerror = () => {
      if (active) setConnected(false);
    };

    es.addEventListener('snapshot', (ev) => {
      if (!active) return;
      const data = JSON.parse((ev as MessageEvent).data) as BootstrapState;
      setMenu(data.menu);
      setTables(data.tables);
      setOrders(data.orders);
      syncClock(data.serverTime);
      setConnected(true);
      setLoading(false);
    });

    es.addEventListener('orders_changed', (ev) => {
      if (!active) return;
      const data = JSON.parse((ev as MessageEvent).data) as { orders: Order[]; serverTime: string };
      setOrders(data.orders);
      syncClock(data.serverTime);
    });

    es.addEventListener('menu_changed', (ev) => {
      if (!active) return;
      const data = JSON.parse((ev as MessageEvent).data) as { menu: MenuItem[] };
      setMenu(data.menu);
    });

    es.addEventListener('tables_changed', (ev) => {
      if (!active) return;
      const data = JSON.parse((ev as MessageEvent).data) as { tables: RestaurantTable[] };
      setTables(data.tables);
    });

    es.addEventListener('auth_changed', (ev) => {
      if (!active) return;
      const payload = JSON.parse((ev as MessageEvent).data) as AuthChangedPayload;
      authCallbackRef.current?.(payload);
    });

    const tick = setInterval(() => {
      setNowMs(Date.now() + clockOffsetRef.current);
    }, 1000);

    return () => {
      active = false;
      clearInterval(tick);
      es.close();
    };
  }, []);

  return {
    menu,
    tables,
    orders,
    loading,
    connected,
    nowMs,
  };
}
