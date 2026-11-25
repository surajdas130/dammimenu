import { useMemo, useState } from 'react';
import { BellRing, CheckCircle2, Clock, CreditCard, LogOut, Utensils, Wallet } from 'lucide-react';
import type { Order, PaymentMethod, RestaurantTable } from '@shared/types';
import { api, formatCurrency } from '@/lib/api';
import { CountdownBadge } from '@/components/CountdownBadge';
import type { StoredRoleAuth } from '@/lib/device';

interface WaiterViewProps {
  tables: RestaurantTable[];
  orders: Order[];
  nowMs: number;
  auth: StoredRoleAuth;
  onLogout: () => void;
}

export function WaiterView({ tables, orders, nowMs, auth, onLogout }: WaiterViewProps) {
  const [busyOrderId, setBusyOrderId] = useState<string | null>(null);
  const [selectedPayMethod, setSelectedPayMethod] = useState<Record<string, PaymentMethod>>({});

  const readyOrders = useMemo(() => orders.filter((o) => o.status === 'ready'), [orders]);
  const cookingOrders = useMemo(
    () => orders.filter((o) => o.status === 'pending' || o.status === 'preparing'),
    [orders]
  );
  const awaitingPaymentOrders = useMemo(
    () => orders.filter((o) => o.status === 'served' && o.paymentStatus === 'pending'),
    [orders]
  );

  const handleServe = async (orderId: string) => {
    setBusyOrderId(orderId);
    try {
      await api.markServed(orderId);
    } finally {
      setBusyOrderId(null);
    }
  };

  const handleCollectPayment = async (order: Order) => {
    setBusyOrderId(order.id);
    try {
      const method = selectedPayMethod[order.id] ?? order.paymentMethod;
      await api.markPaid(order.id, method);
    } finally {
      setBusyOrderId(null);
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="flex flex-col gap-4 rounded-3xl bg-neutral-950 p-6 text-white shadow-lg sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-red-400">
            <Utensils className="h-4 w-4" />
            Server / Waiter Station • {auth.deviceName}
          </div>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight">Service & Pickup Dashboard</h1>
          <p className="mt-1 text-xs text-neutral-400">
            Track live kitchen timers, pick up ready dishes, mark orders served, and settle post-meal payments.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 rounded-2xl bg-white/10 px-4 py-2 text-xs font-bold">
            <span className="text-red-400">{readyOrders.length} Ready Pickup</span>
            <span>•</span>
            <span>{cookingOrders.length} In Kitchen</span>
            <span>•</span>
            <span>{awaitingPaymentOrders.length} Pay Due</span>
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

      {/* 1. Ready for Pickup */}
      <section className="mt-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-extrabold text-neutral-900">
            <BellRing className={`h-5 w-5 ${readyOrders.length > 0 ? 'text-red-600' : 'text-neutral-400'}`} />
            Ready for Pickup & Serving ({readyOrders.length})
          </h2>
        </div>

        {readyOrders.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-neutral-300 bg-white p-8 text-center text-sm font-medium text-neutral-500">
            No dishes waiting at the pass right now.
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {readyOrders.map((order) => (
              <div
                key={order.id}
                className="flex flex-col justify-between rounded-3xl border-2 border-red-600 bg-white p-5 shadow-md pulse-crimson"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="rounded-xl bg-red-600 px-3 py-1 text-sm font-extrabold text-white">
                      {order.tableLabel}
                    </span>
                    <span className="text-xs font-bold text-neutral-500">Order #{order.orderNumber}</span>
                  </div>

                  <div className="mt-3 space-y-1.5">
                    {order.items.map((item) => (
                      <div key={item.id} className="flex items-center justify-between text-sm">
                        <span className="font-bold text-neutral-900">
                          {item.quantity}× {item.name}
                        </span>
                        <span className="rounded-full bg-neutral-900 px-2 py-0.5 text-[10px] font-bold text-white">
                          Ready
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-4 border-t border-neutral-100 pt-3">
                  <div className="mb-2 flex items-center justify-between text-xs text-neutral-600">
                    <span>Payment on serve:</span>
                    <span className="font-extrabold uppercase text-neutral-900">
                      {order.paymentMethod} • {formatCurrency(order.totalAmount)}
                    </span>
                  </div>
                  <button
                    type="button"
                    disabled={busyOrderId === order.id}
                    onClick={() => handleServe(order.id)}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-neutral-950 py-3 text-xs font-extrabold text-white hover:bg-red-600 transition cursor-pointer"
                  >
                    <CheckCircle2 className="h-4 w-4 text-red-400" />
                    Deliver & Mark Order Served
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 2. Cooking / Waiting on Kitchen Timers */}
      <section className="mt-8">
        <h2 className="mb-3 flex items-center gap-2 text-lg font-extrabold text-neutral-900">
          <Clock className="h-5 w-5 text-red-600" />
          Preparing in Kitchen — Live Wait Timers ({cookingOrders.length})
        </h2>

        {cookingOrders.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-neutral-300 bg-white p-8 text-center text-sm font-medium text-neutral-500">
            No active orders currently cooking.
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {cookingOrders.map((order) => (
              <div key={order.id} className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-xs">
                <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
                  <div className="flex items-center gap-2.5">
                    <span className="rounded-xl bg-neutral-900 px-3 py-1 text-xs font-extrabold text-white">
                      {order.tableLabel}
                    </span>
                    <span className="text-sm font-extrabold text-neutral-900">Order #{order.orderNumber}</span>
                  </div>
                  <span className="rounded-full bg-red-50 px-2.5 py-1 text-[11px] font-bold uppercase text-red-700">
                    {order.status === 'pending' ? 'Awaiting Chef Timer' : 'Cooking'}
                  </span>
                </div>

                <div className="mt-3 space-y-2.5">
                  {order.items.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between gap-2 rounded-xl bg-neutral-50 px-3 py-2"
                    >
                      <span className="text-sm font-bold text-neutral-900">
                        {item.quantity}× {item.name}
                      </span>
                      <CountdownBadge
                        timerStartedAt={item.timerStartedAt}
                        timerEndsAt={item.timerEndsAt}
                        nowMs={nowMs}
                        status={item.itemStatus}
                        compact
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 3. Served — Awaiting Payment Collection */}
      <section className="mt-8">
        <h2 className="mb-3 flex items-center gap-2 text-lg font-extrabold text-neutral-900">
          <Wallet className="h-5 w-5 text-red-600" />
          Served — Collect Payment ({awaitingPaymentOrders.length})
        </h2>

        {awaitingPaymentOrders.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-neutral-300 bg-white p-8 text-center text-sm font-medium text-neutral-500">
            All served orders have been settled.
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {awaitingPaymentOrders.map((order) => {
              const chosenMethod = selectedPayMethod[order.id] ?? order.paymentMethod;
              return (
                <div key={order.id} className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="rounded-xl bg-neutral-900 px-3 py-1 text-xs font-extrabold text-white">
                      {order.tableLabel}
                    </span>
                    <span className="text-sm font-extrabold text-red-600">{formatCurrency(order.totalAmount)}</span>
                  </div>
                  <div className="mt-2 text-xs font-semibold text-neutral-500">
                    Order #{order.orderNumber} • Served at{' '}
                    {order.servedAt
                      ? new Date(order.servedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                      : '—'}
                  </div>

                  <div className="mt-3">
                    <label className="mb-1 block text-[11px] font-bold uppercase text-neutral-500">
                      Confirm Payment Method
                    </label>
                    <select
                      value={chosenMethod}
                      onChange={(e) =>
                        setSelectedPayMethod((p) => ({
                          ...p,
                          [order.id]: e.target.value as PaymentMethod,
                        }))
                      }
                      className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs font-bold text-neutral-900"
                    >
                      <option value="cash">Cash</option>
                      <option value="esewa">eSewa</option>
                      <option value="khalti">Khalti</option>
                    </select>
                  </div>

                  <button
                    type="button"
                    disabled={busyOrderId === order.id}
                    onClick={() => handleCollectPayment(order)}
                    className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl bg-red-600 py-2.5 text-xs font-extrabold text-white hover:bg-red-700 transition cursor-pointer"
                  >
                    <CreditCard className="h-4 w-4" />
                    Mark Payment Received
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* 4. Floor Table Status Overview */}
      <section className="mt-8">
        <h2 className="mb-3 text-lg font-extrabold text-neutral-900">Floor Tables Status</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {tables.map((t) => {
            const activeForTable = orders.find(
              (o) => o.tableId === t.id && (o.status !== 'served' || o.paymentStatus === 'pending')
            );
            return (
              <div
                key={t.id}
                className={`rounded-2xl border p-4 ${
                  activeForTable?.status === 'ready'
                    ? 'border-red-600 bg-red-50'
                    : activeForTable
                    ? 'border-neutral-900 bg-white'
                    : 'border-neutral-200 bg-white'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-extrabold text-neutral-900">{t.label}</span>
                  <span className="text-[11px] font-semibold text-neutral-500">{t.zone}</span>
                </div>
                <div className="mt-2 text-xs font-bold">
                  {!activeForTable && <span className="text-neutral-400">Available</span>}
                  {activeForTable?.status === 'pending' && <span className="text-red-600">Order Received</span>}
                  {activeForTable?.status === 'preparing' && <span className="text-neutral-900">Cooking</span>}
                  {activeForTable?.status === 'ready' && <span className="text-red-700">READY FOR PICKUP</span>}
                  {activeForTable?.status === 'served' && (
                    <span className="text-neutral-700">Served (Pay Due)</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
