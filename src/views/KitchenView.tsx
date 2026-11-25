import { useMemo, useState } from 'react';
import { ChefHat, Clock, CheckCheck, Flame, LogOut, Play } from 'lucide-react';
import type { Order } from '@shared/types';
import { api } from '@/lib/api';
import { CountdownBadge } from '@/components/CountdownBadge';
import type { StoredRoleAuth } from '@/lib/device';

interface KitchenViewProps {
  orders: Order[];
  nowMs: number;
  auth: StoredRoleAuth;
  onLogout: () => void;
}

const TIMER_PRESETS = [
  { label: '30s', seconds: 30 },
  { label: '5m', seconds: 5 * 60 },
  { label: '10m', seconds: 10 * 60 },
  { label: '15m', seconds: 15 * 60 },
  { label: '20m', seconds: 20 * 60 },
];

export function KitchenView({ orders, nowMs, auth, onLogout }: KitchenViewProps) {
  const [customMinutes, setCustomMinutes] = useState<Record<string, string>>({});
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [filter, setFilter] = useState<'active' | 'ready' | 'all'>('active');

  const kitchenOrders = useMemo(() => {
    const activeList = orders.filter((o) => o.status !== 'served');
    if (filter === 'active') return activeList.filter((o) => o.status === 'pending' || o.status === 'preparing');
    if (filter === 'ready') return activeList.filter((o) => o.status === 'ready');
    return activeList;
  }, [orders, filter]);

  const counts = useMemo(() => {
    const active = orders.filter((o) => o.status !== 'served');
    return {
      pending: active.filter((o) => o.status === 'pending').length,
      preparing: active.filter((o) => o.status === 'preparing').length,
      ready: active.filter((o) => o.status === 'ready').length,
    };
  }, [orders]);

  const triggerTimer = async (orderId: string, itemId: string | null, seconds: number) => {
    const key = `${orderId}_${itemId ?? 'all'}`;
    setBusyKey(key);
    try {
      await api.startTimer(orderId, seconds, itemId);
    } finally {
      setBusyKey(null);
    }
  };

  const triggerReady = async (orderId: string, itemId: string | null) => {
    const key = `ready_${orderId}_${itemId ?? 'all'}`;
    setBusyKey(key);
    try {
      await api.markReady(orderId, itemId);
    } finally {
      setBusyKey(null);
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="flex flex-col gap-4 rounded-3xl bg-neutral-950 p-6 text-white shadow-lg sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-red-400">
            <ChefHat className="h-4 w-4" />
            Chef Kitchen Display • {auth.deviceName}
          </div>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight">Kitchen Ticket & Timer Board</h1>
          <p className="mt-1 text-xs text-neutral-400">
            Set cooking timers per item or per table — timers sync immediately to Waiter & Customer screens.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 rounded-2xl bg-white/10 px-4 py-2 text-xs font-bold">
            <span className="text-red-400">{counts.pending} New</span>
            <span>•</span>
            <span>{counts.preparing} Cooking</span>
            <span>•</span>
            <span className="text-emerald-400">{counts.ready} Ready</span>
          </div>
          <button
            type="button"
            onClick={onLogout}
            className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-xs font-bold text-white hover:bg-red-600 transition cursor-pointer"
          >
            <LogOut className="h-3.5 w-3.5" />
            Lock
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="mt-5 flex flex-wrap gap-2">
        {[
          { id: 'active', label: `Active Queue (${counts.pending + counts.preparing})` },
          { id: 'ready', label: `Ready for Waiter (${counts.ready})` },
          { id: 'all', label: `All Open (${counts.pending + counts.preparing + counts.ready})` },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setFilter(tab.id as typeof filter)}
            className={`rounded-full px-4 py-2 text-xs font-bold transition cursor-pointer ${
              filter === tab.id
                ? 'bg-red-600 text-white'
                : 'border border-neutral-200 bg-white text-neutral-700 hover:border-red-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tickets Grid */}
      {kitchenOrders.length === 0 ? (
        <div className="mt-8 rounded-3xl border border-dashed border-neutral-300 bg-white p-14 text-center">
          <ChefHat className="mx-auto h-10 w-10 text-neutral-300" />
          <p className="mt-3 text-base font-extrabold text-neutral-800">No kitchen tickets in this view</p>
          <p className="mt-1 text-xs text-neutral-500">New customer QR orders will appear here instantly.</p>
        </div>
      ) : (
        <div className="mt-6 grid gap-5 lg:grid-cols-2">
          {kitchenOrders.map((order) => {
            const isNew = order.status === 'pending';
            const isReady = order.status === 'ready';
            const orderCustomVal = customMinutes[order.id] ?? '';

            return (
              <div
                key={order.id}
                className={`overflow-hidden rounded-3xl border-2 bg-white shadow-sm transition ${
                  isNew
                    ? 'border-red-600'
                    : isReady
                    ? 'border-neutral-900'
                    : 'border-neutral-200'
                }`}
              >
                {/* Ticket Header */}
                <div
                  className={`flex flex-wrap items-center justify-between gap-2 px-5 py-4 text-white ${
                    isNew ? 'bg-red-600' : isReady ? 'bg-neutral-950' : 'bg-neutral-900'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="rounded-xl bg-white px-3 py-1 text-sm font-extrabold text-neutral-950">
                      {order.tableLabel}
                    </span>
                    <div>
                      <div className="text-sm font-extrabold">Order #{order.orderNumber}</div>
                      <div className="text-[11px] opacity-80">
                        {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} •{' '}
                        {order.paymentMethod.toUpperCase()}
                      </div>
                    </div>
                  </div>

                  <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-extrabold uppercase tracking-wider">
                    {order.status === 'pending' && 'New Ticket'}
                    {order.status === 'preparing' && 'Cooking'}
                    {order.status === 'ready' && 'Ready for Waiter'}
                  </span>
                </div>

                {order.customerNote && (
                  <div className="border-b border-red-100 bg-red-50 px-5 py-2.5 text-xs font-bold text-red-800">
                    Table Note: {order.customerNote}
                  </div>
                )}

                {/* Quick Table-Wide Timer Controls */}
                {!isReady && (
                  <div className="border-b border-neutral-100 bg-neutral-50 px-5 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-neutral-700">
                        <Clock className="h-3.5 w-3.5 text-red-600" />
                        Set Timer for Entire Table:
                      </span>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {TIMER_PRESETS.map((preset) => (
                          <button
                            key={preset.label}
                            type="button"
                            disabled={busyKey === `${order.id}_all`}
                            onClick={() => triggerTimer(order.id, null, preset.seconds)}
                            className="rounded-lg border border-neutral-300 bg-white px-2.5 py-1 text-xs font-bold text-neutral-900 hover:border-red-600 hover:bg-red-600 hover:text-white transition cursor-pointer"
                          >
                            {preset.label}
                          </button>
                        ))}
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            min={1}
                            max={120}
                            value={orderCustomVal}
                            onChange={(e) => setCustomMinutes((p) => ({ ...p, [order.id]: e.target.value }))}
                            placeholder="min"
                            className="w-14 rounded-lg border border-neutral-300 bg-white px-2 py-1 text-xs font-bold text-neutral-900 focus:border-red-600 focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const mins = Number(orderCustomVal);
                              if (mins > 0) {
                                void triggerTimer(order.id, null, mins * 60);
                                setCustomMinutes((p) => ({ ...p, [order.id]: '' }));
                              }
                            }}
                            className="inline-flex items-center gap-1 rounded-lg bg-neutral-900 px-2.5 py-1 text-xs font-bold text-white hover:bg-red-600 cursor-pointer"
                          >
                            <Play className="h-3 w-3" /> Start
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Per-Item Rows */}
                <div className="divide-y divide-neutral-100 p-5">
                  {order.items.map((item) => {
                    const itemKey = `${order.id}_${item.id}`;
                    const itemCustomVal = customMinutes[itemKey] ?? '';
                    return (
                      <div key={item.id} className="py-3 first:pt-0 last:pb-0">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="flex h-6 min-w-6 items-center justify-center rounded-md bg-neutral-900 px-1.5 text-xs font-extrabold text-white">
                                {item.quantity}×
                              </span>
                              <span className="text-sm font-extrabold text-neutral-900">{item.name}</span>
                            </div>
                            {item.notes && (
                              <div className="mt-1 text-xs font-semibold text-red-700">Note: {item.notes}</div>
                            )}
                          </div>

                          <CountdownBadge
                            timerStartedAt={item.timerStartedAt}
                            timerEndsAt={item.timerEndsAt}
                            nowMs={nowMs}
                            status={item.itemStatus}
                          />
                        </div>

                        {item.itemStatus !== 'ready' && (
                          <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
                            <div className="flex flex-wrap items-center gap-1.5">
                              {TIMER_PRESETS.slice(0, 4).map((preset) => (
                                <button
                                  key={preset.label}
                                  type="button"
                                  disabled={busyKey === itemKey}
                                  onClick={() => triggerTimer(order.id, item.id, preset.seconds)}
                                  className="rounded-lg bg-neutral-100 px-2 py-1 text-[11px] font-bold text-neutral-800 hover:bg-red-600 hover:text-white transition cursor-pointer"
                                >
                                  {preset.label}
                                </button>
                              ))}
                              <input
                                type="number"
                                min={1}
                                max={120}
                                value={itemCustomVal}
                                onChange={(e) => setCustomMinutes((p) => ({ ...p, [itemKey]: e.target.value }))}
                                placeholder="min"
                                className="w-12 rounded-lg border border-neutral-200 px-1.5 py-1 text-[11px] font-bold"
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  const mins = Number(itemCustomVal);
                                  if (mins > 0) {
                                    void triggerTimer(order.id, item.id, mins * 60);
                                    setCustomMinutes((p) => ({ ...p, [itemKey]: '' }));
                                  }
                                }}
                                className="rounded-lg bg-neutral-800 px-2 py-1 text-[11px] font-bold text-white hover:bg-red-600 cursor-pointer"
                              >
                                Set
                              </button>
                            </div>

                            <button
                              type="button"
                              onClick={() => triggerReady(order.id, item.id)}
                              className="inline-flex items-center gap-1 rounded-lg border border-neutral-900 px-2.5 py-1 text-[11px] font-bold text-neutral-900 hover:bg-neutral-900 hover:text-white transition cursor-pointer"
                            >
                              <CheckCheck className="h-3.5 w-3.5" />
                              Item Ready
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Footer Action */}
                {!isReady && (
                  <div className="border-t border-neutral-100 bg-neutral-50 px-5 py-3">
                    <button
                      type="button"
                      disabled={busyKey === `ready_${order.id}_all`}
                      onClick={() => triggerReady(order.id, null)}
                      className="flex w-full items-center justify-center gap-2 rounded-xl bg-neutral-950 py-2.5 text-xs font-extrabold text-white hover:bg-red-600 transition cursor-pointer"
                    >
                      <Flame className="h-4 w-4 text-red-400" />
                      Mark Entire Order Ready for Waiter
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
