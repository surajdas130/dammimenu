import { useMemo, useState } from 'react';
import {
  ShoppingBag,
  Plus,
  Minus,
  Search,
  MapPin,
  Flame,
  Leaf,
  Sparkles,
  CheckCircle2,
  Clock,
  UtensilsCrossed,
  Wallet,
  Banknote,
  Smartphone,
  X,
  ChevronRight,
} from 'lucide-react';
import type { MenuItem, Order, PaymentMethod, RestaurantTable } from '@shared/types';
import { api, formatCurrency } from '@/lib/api';
import { CountdownBadge } from '@/components/CountdownBadge';

interface DinerViewProps {
  menu: MenuItem[];
  tables: RestaurantTable[];
  orders: Order[];
  nowMs: number;
  selectedTableId: string;
  onSelectTable: (tableId: string) => void;
}

interface CartLine {
  menuItem: MenuItem;
  quantity: number;
  notes: string;
}

const PAYMENT_OPTIONS: Array<{
  id: PaymentMethod;
  label: string;
  sublabel: string;
  badgeClass: string;
}> = [
  {
    id: 'cash',
    label: 'Cash',
    sublabel: 'Pay cash at table after served',
    badgeClass: 'bg-neutral-900 text-white',
  },
  {
    id: 'esewa',
    label: 'eSewa',
    sublabel: 'Digital wallet after served',
    badgeClass: 'bg-emerald-600 text-white',
  },
  {
    id: 'khalti',
    label: 'Khalti',
    sublabel: 'Digital wallet after served',
    badgeClass: 'bg-purple-700 text-white',
  },
];

export function DinerView({
  menu,
  tables,
  orders,
  nowMs,
  selectedTableId,
  onSelectTable,
}: DinerViewProps) {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [vegOnly, setVegOnly] = useState(false);
  const [cart, setCart] = useState<Record<string, CartLine>>({});
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [customerNote, setCustomerNote] = useState('');
  const [cartOpen, setCartOpen] = useState(false);
  const [tablePickerOpen, setTablePickerOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const selectedTable = useMemo(
    () => tables.find((t) => t.id.toLowerCase() === selectedTableId.toLowerCase()) ?? null,
    [tables, selectedTableId]
  );

  const categories = useMemo(() => {
    const cats = Array.from(new Set(menu.map((m) => m.category)));
    return ['All', ...cats];
  }, [menu]);

  const filteredMenu = useMemo(() => {
    return menu.filter((item) => {
      if (!item.available) return false;
      if (activeCategory !== 'All' && item.category !== activeCategory) return false;
      if (vegOnly && !item.isVeg) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        return item.name.toLowerCase().includes(q) || item.description.toLowerCase().includes(q);
      }
      return true;
    });
  }, [menu, activeCategory, vegOnly, search]);

  const cartLines = useMemo(() => Object.values(cart), [cart]);
  const totalItems = useMemo(() => cartLines.reduce((sum, l) => sum + l.quantity, 0), [cartLines]);
  const cartTotal = useMemo(
    () => cartLines.reduce((sum, l) => sum + l.menuItem.price * l.quantity, 0),
    [cartLines]
  );

  const tableOrders = useMemo(() => {
    if (!selectedTable) return [];
    return orders.filter((o) => o.tableId === selectedTable.id);
  }, [orders, selectedTable]);

  const activeTableOrders = useMemo(
    () => tableOrders.filter((o) => o.status !== 'served' || o.paymentStatus === 'pending'),
    [tableOrders]
  );

  const updateCartQty = (item: MenuItem, delta: number) => {
    setCart((prev) => {
      const existing = prev[item.id];
      const nextQty = (existing?.quantity ?? 0) + delta;
      if (nextQty <= 0) {
        const copy = { ...prev };
        delete copy[item.id];
        return copy;
      }
      return {
        ...prev,
        [item.id]: {
          menuItem: item,
          quantity: nextQty,
          notes: existing?.notes ?? '',
        },
      };
    });
  };

  const updateCartNote = (itemId: string, notes: string) => {
    setCart((prev) => {
      const existing = prev[itemId];
      if (!existing) return prev;
      return {
        ...prev,
        [itemId]: { ...existing, notes },
      };
    });
  };

  const handlePlaceOrder = async () => {
    if (!selectedTable) {
      setTablePickerOpen(true);
      setFeedback({ type: 'error', text: 'Please select your table before placing the order.' });
      return;
    }
    if (cartLines.length === 0) return;

    setSubmitting(true);
    setFeedback(null);
    try {
      const created = await api.createOrder({
        tableId: selectedTable.id,
        customerNote: customerNote.trim() || undefined,
        paymentMethod,
        items: cartLines.map((l) => ({
          menuItemId: l.menuItem.id,
          quantity: l.quantity,
          notes: l.notes.trim() || undefined,
        })),
      });
      setCart({});
      setCustomerNote('');
      setCartOpen(false);
      setFeedback({
        type: 'success',
        text: `Order #${created.orderNumber} sent to the kitchen! Payment (${created.paymentMethod.toUpperCase()}) will be collected after served.`,
      });
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to place order',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 pb-28 pt-5 sm:px-6 lg:px-8">
      {/* Hero / Table Header */}
      <div className="relative overflow-hidden rounded-3xl bg-neutral-950 px-6 py-6 text-white shadow-xl sm:px-8">
        <div className="absolute -right-10 -top-10 h-44 w-44 rounded-full bg-red-600/25 blur-2xl" />
        <div className="relative flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-red-600 px-3 py-1 text-xs font-bold uppercase tracking-wider text-white">
              <Sparkles className="h-3.5 w-3.5" />
              QR Table Dining
            </div>
            <h1 className="mt-3 text-2xl font-extrabold tracking-tight sm:text-3xl">
              {selectedTable ? `Welcome to ${selectedTable.label}` : 'Select Your Table to Order'}
            </h1>
            <p className="mt-1 text-sm text-neutral-300">
              Browse the menu, choose Cash, eSewa, or Khalti, and track your live kitchen timer — pay only after your food is served.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setTablePickerOpen(true)}
              className="inline-flex items-center gap-2 rounded-2xl border border-white/15 bg-white/10 px-4 py-2.5 text-sm font-bold text-white backdrop-blur-xs hover:bg-white/20 transition cursor-pointer"
            >
              <MapPin className="h-4 w-4 text-red-400" />
              {selectedTable ? `${selectedTable.label} (${selectedTable.zone})` : 'Choose Table'}
            </button>
            {totalItems > 0 && (
              <button
                type="button"
                onClick={() => setCartOpen(true)}
                className="inline-flex items-center gap-2 rounded-2xl bg-red-600 px-4 py-2.5 text-sm font-bold text-white shadow-lg hover:bg-red-700 transition cursor-pointer"
              >
                <ShoppingBag className="h-4 w-4" />
                {totalItems} item{totalItems > 1 ? 's' : ''} • {formatCurrency(cartTotal)}
              </button>
            )}
          </div>
        </div>
      </div>

      {feedback && (
        <div
          className={`mt-4 flex items-center justify-between rounded-2xl border px-4 py-3 text-sm font-semibold ${
            feedback.type === 'success'
              ? 'border-neutral-900 bg-neutral-900 text-white'
              : 'border-red-300 bg-red-50 text-red-800'
          }`}
        >
          <span className="flex items-center gap-2">
            {feedback.type === 'success' && <CheckCircle2 className="h-4 w-4 text-red-500 shrink-0" />}
            {feedback.text}
          </span>
          <button type="button" onClick={() => setFeedback(null)} className="ml-3 opacity-70 hover:opacity-100">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Live Table Order Tracker */}
      {activeTableOrders.length > 0 && (
        <section className="mt-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-lg font-extrabold text-neutral-900">
              <Clock className="h-5 w-5 text-red-600" />
              Live Order Status — {selectedTable?.label}
            </h2>
            <span className="text-xs font-semibold text-neutral-500">Auto-updating live</span>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {activeTableOrders.map((order) => {
              const steps = [
                { key: 'pending', label: 'Received' },
                { key: 'preparing', label: 'Cooking' },
                { key: 'ready', label: 'Ready' },
                { key: 'served', label: 'Served' },
              ];
              const activeIdx = steps.findIndex((s) => s.key === order.status);

              return (
                <div
                  key={order.id}
                  className={`rounded-2xl border bg-white p-5 shadow-sm transition ${
                    order.status === 'ready'
                      ? 'border-red-600 ring-2 ring-red-600/20'
                      : 'border-neutral-200'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-100 pb-3">
                    <div>
                      <span className="text-xs font-bold uppercase tracking-wider text-neutral-400">
                        Order #{order.orderNumber}
                      </span>
                      <div className="mt-0.5 flex items-center gap-2">
                        <span className="text-base font-extrabold text-neutral-900">
                          {order.status === 'pending' && 'Waiting for Kitchen Timer'}
                          {order.status === 'preparing' && 'Chef is Preparing Your Meal'}
                          {order.status === 'ready' && 'Ready! Waiter Bringing to Table'}
                          {order.status === 'served' && 'Served — Enjoy Your Meal!'}
                        </span>
                      </div>
                    </div>

                    <div className="text-right">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold uppercase ${
                          order.paymentStatus === 'paid'
                            ? 'bg-neutral-900 text-white'
                            : 'bg-red-50 text-red-700 border border-red-200'
                        }`}
                      >
                        {order.paymentMethod.toUpperCase()} •{' '}
                        {order.paymentStatus === 'paid' ? 'Paid' : 'Pay After Served'}
                      </span>
                      <div className="mt-1 text-sm font-extrabold text-neutral-900">
                        {formatCurrency(order.totalAmount)}
                      </div>
                    </div>
                  </div>

                  {/* Progress Stepper */}
                  <div className="my-4 grid grid-cols-4 gap-1.5">
                    {steps.map((step, idx) => {
                      const done = idx <= activeIdx;
                      return (
                        <div key={step.key} className="flex flex-col gap-1">
                          <div
                            className={`h-2 rounded-full transition-colors ${
                              done
                                ? idx === activeIdx && order.status !== 'served'
                                  ? 'bg-red-600'
                                  : 'bg-neutral-900'
                                : 'bg-neutral-200'
                            }`}
                          />
                          <span
                            className={`text-[11px] font-bold ${
                              done ? 'text-neutral-900' : 'text-neutral-400'
                            }`}
                          >
                            {step.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Items & Individual Timers */}
                  <div className="space-y-2.5">
                    {order.items.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between gap-3 rounded-xl bg-neutral-50 px-3 py-2"
                      >
                        <div>
                          <div className="text-sm font-bold text-neutral-900">
                            {item.quantity}× {item.name}
                          </div>
                          {item.notes && (
                            <div className="text-xs text-neutral-500">Note: {item.notes}</div>
                          )}
                        </div>
                        <CountdownBadge
                          timerStartedAt={item.timerStartedAt}
                          timerEndsAt={item.timerEndsAt}
                          nowMs={nowMs}
                          status={item.itemStatus}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Search & Category Controls */}
      <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search dishes, momos, burgers, drinks..."
            className="w-full rounded-2xl border border-neutral-200 bg-white py-2.5 pl-10 pr-4 text-sm font-medium text-neutral-900 shadow-xs focus:border-red-600 focus:outline-none"
          />
        </div>

        <button
          type="button"
          onClick={() => setVegOnly((v) => !v)}
          className={`inline-flex items-center gap-2 self-start rounded-2xl border px-4 py-2.5 text-xs font-bold transition cursor-pointer ${
            vegOnly
              ? 'border-neutral-900 bg-neutral-900 text-white'
              : 'border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300'
          }`}
        >
          <Leaf className="h-3.5 w-3.5 text-emerald-500" />
          Veg Only
        </button>
      </div>

      {/* Category Pills */}
      <div className="mt-4 flex gap-2 overflow-x-auto pb-2">
        {categories.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setActiveCategory(cat)}
            className={`shrink-0 rounded-full px-4 py-2 text-xs font-bold transition cursor-pointer ${
              activeCategory === cat
                ? 'bg-red-600 text-white shadow-sm'
                : 'bg-white text-neutral-700 border border-neutral-200 hover:border-red-300'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Main Content Grid: Menu + Desktop Cart Sidebar */}
      <div className="mt-6 grid gap-6 lg:grid-cols-12">
        <div className="lg:col-span-8">
          {filteredMenu.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-neutral-300 bg-white p-12 text-center">
              <UtensilsCrossed className="mx-auto h-8 w-8 text-neutral-400" />
              <p className="mt-2 text-sm font-bold text-neutral-700">No matching dishes available</p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {filteredMenu.map((item) => {
                const qty = cart[item.id]?.quantity ?? 0;
                return (
                  <div
                    key={item.id}
                    className={`flex flex-col justify-between rounded-2xl border bg-white p-4 shadow-xs transition hover:shadow-md ${
                      qty > 0 ? 'border-red-500 ring-1 ring-red-500/20' : 'border-neutral-200'
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-red-50 text-2xl">
                            {item.icon}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span
                                className={`h-2.5 w-2.5 rounded-full ${
                                  item.isVeg ? 'bg-emerald-600' : 'bg-red-600'
                                }`}
                                title={item.isVeg ? 'Vegetarian' : 'Non-Vegetarian'}
                              />
                              <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">
                                {item.category}
                              </span>
                            </div>
                            <h3 className="text-base font-extrabold text-neutral-900">{item.name}</h3>
                          </div>
                        </div>
                        <span className="shrink-0 text-base font-extrabold text-red-600">
                          {formatCurrency(item.price)}
                        </span>
                      </div>

                      <p className="mt-2.5 text-xs leading-relaxed text-neutral-600">{item.description}</p>

                      <div className="mt-3 flex flex-wrap items-center gap-1.5">
                        {item.isPopular && (
                          <span className="rounded-full bg-neutral-900 px-2 py-0.5 text-[10px] font-bold text-white">
                            Popular
                          </span>
                        )}
                        {item.isSpicy && (
                          <span className="inline-flex items-center gap-0.5 rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-700">
                            <Flame className="h-3 w-3" /> Spicy
                          </span>
                        )}
                        <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-semibold text-neutral-600">
                          ~{item.prepEstimateMin}m prep
                        </span>
                      </div>
                    </div>

                    <div className="mt-4 flex items-center justify-between border-t border-neutral-100 pt-3">
                      {qty === 0 ? (
                        <button
                          type="button"
                          onClick={() => updateCartQty(item, 1)}
                          className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-neutral-900 px-3 py-2 text-xs font-bold text-white hover:bg-red-600 transition cursor-pointer"
                        >
                          <Plus className="h-4 w-4" />
                          Add to Order
                        </button>
                      ) : (
                        <div className="flex w-full items-center justify-between rounded-xl bg-red-50 px-2 py-1">
                          <button
                            type="button"
                            onClick={() => updateCartQty(item, -1)}
                            className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-neutral-900 shadow-xs hover:bg-neutral-100 cursor-pointer"
                          >
                            <Minus className="h-4 w-4" />
                          </button>
                          <span className="text-sm font-extrabold text-red-700">{qty} in order</span>
                          <button
                            type="button"
                            onClick={() => updateCartQty(item, 1)}
                            className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-600 text-white shadow-xs hover:bg-red-700 cursor-pointer"
                          >
                            <Plus className="h-4 w-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Desktop Order Cart Panel */}
        <aside className="hidden lg:col-span-4 lg:block">
          <div className="sticky top-20 rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm">
            <CartPanelContent
              selectedTable={selectedTable}
              tables={tables}
              onSelectTable={onSelectTable}
              cartLines={cartLines}
              cartTotal={cartTotal}
              paymentMethod={paymentMethod}
              setPaymentMethod={setPaymentMethod}
              customerNote={customerNote}
              setCustomerNote={setCustomerNote}
              updateCartQty={updateCartQty}
              updateCartNote={updateCartNote}
              onSubmit={handlePlaceOrder}
              submitting={submitting}
            />
          </div>
        </aside>
      </div>

      {/* Mobile Sticky Bottom Cart Bar */}
      {totalItems > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-neutral-200 bg-white/95 p-3 backdrop-blur-md lg:hidden">
          <button
            type="button"
            onClick={() => setCartOpen(true)}
            className="mx-auto flex w-full max-w-lg items-center justify-between rounded-2xl bg-red-600 px-5 py-3.5 text-white shadow-lg"
          >
            <div className="flex items-center gap-2.5">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-neutral-950 text-xs font-extrabold">
                {totalItems}
              </span>
              <span className="text-sm font-bold">Review & Place Order</span>
            </div>
            <span className="flex items-center gap-1 text-sm font-extrabold">
              {formatCurrency(cartTotal)}
              <ChevronRight className="h-4 w-4" />
            </span>
          </button>
        </div>
      )}

      {/* Mobile Cart Drawer */}
      {cartOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-xs lg:hidden">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white p-5">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-lg font-extrabold text-neutral-900">Your Table Order</h3>
              <button
                type="button"
                onClick={() => setCartOpen(false)}
                className="rounded-full bg-neutral-100 p-2 text-neutral-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <CartPanelContent
              selectedTable={selectedTable}
              tables={tables}
              onSelectTable={onSelectTable}
              cartLines={cartLines}
              cartTotal={cartTotal}
              paymentMethod={paymentMethod}
              setPaymentMethod={setPaymentMethod}
              customerNote={customerNote}
              setCustomerNote={setCustomerNote}
              updateCartQty={updateCartQty}
              updateCartNote={updateCartNote}
              onSubmit={handlePlaceOrder}
              submitting={submitting}
            />
          </div>
        </div>
      )}

      {/* Table Selector Modal */}
      {tablePickerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-extrabold text-neutral-900">Choose Your Table</h3>
              <button
                type="button"
                onClick={() => setTablePickerOpen(false)}
                className="rounded-full bg-neutral-100 p-2 text-neutral-600 hover:bg-neutral-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-1 text-xs text-neutral-500">
              Tables scanned via QR code open pre-selected automatically, or pick yours below.
            </p>
            <div className="mt-4 grid grid-cols-2 gap-2.5">
              {tables.map((t) => {
                const active = selectedTable?.id === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      onSelectTable(t.id);
                      setTablePickerOpen(false);
                    }}
                    className={`rounded-2xl border p-3 text-left transition cursor-pointer ${
                      active
                        ? 'border-red-600 bg-red-600 text-white'
                        : 'border-neutral-200 bg-neutral-50 text-neutral-900 hover:border-red-300'
                    }`}
                  >
                    <div className="text-sm font-extrabold">{t.label}</div>
                    <div className={`text-xs ${active ? 'text-red-100' : 'text-neutral-500'}`}>
                      {t.zone} • {t.seats} seats
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface CartPanelProps {
  selectedTable: RestaurantTable | null;
  tables: RestaurantTable[];
  onSelectTable: (tableId: string) => void;
  cartLines: CartLine[];
  cartTotal: number;
  paymentMethod: PaymentMethod;
  setPaymentMethod: (m: PaymentMethod) => void;
  customerNote: string;
  setCustomerNote: (n: string) => void;
  updateCartQty: (item: MenuItem, delta: number) => void;
  updateCartNote: (itemId: string, notes: string) => void;
  onSubmit: () => void;
  submitting: boolean;
}

function CartPanelContent({
  selectedTable,
  tables,
  onSelectTable,
  cartLines,
  cartTotal,
  paymentMethod,
  setPaymentMethod,
  customerNote,
  setCustomerNote,
  updateCartQty,
  updateCartNote,
  onSubmit,
  submitting,
}: CartPanelProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
        <div className="flex items-center gap-2">
          <ShoppingBag className="h-5 w-5 text-red-600" />
          <h3 className="text-base font-extrabold text-neutral-900">Your Order</h3>
        </div>
        <select
          value={selectedTable?.id ?? ''}
          onChange={(e) => onSelectTable(e.target.value)}
          className="rounded-xl border border-neutral-200 bg-neutral-50 px-2.5 py-1.5 text-xs font-bold text-neutral-900 focus:border-red-600 focus:outline-none"
        >
          <option value="" disabled>
            Select Table
          </option>
          {tables.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label} ({t.zone})
            </option>
          ))}
        </select>
      </div>

      {cartLines.length === 0 ? (
        <div className="py-10 text-center">
          <p className="text-sm font-bold text-neutral-700">Your tray is empty</p>
          <p className="mt-1 text-xs text-neutral-500">Tap any dish on the menu to add it.</p>
        </div>
      ) : (
        <>
          <div className="max-h-64 space-y-3 overflow-y-auto pr-1">
            {cartLines.map(({ menuItem, quantity, notes }) => (
              <div key={menuItem.id} className="rounded-2xl border border-neutral-100 bg-neutral-50 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="text-sm font-bold text-neutral-900">{menuItem.name}</div>
                    <div className="text-xs font-semibold text-neutral-500">
                      {formatCurrency(menuItem.price)} × {quantity} ={' '}
                      <span className="text-neutral-900">{formatCurrency(menuItem.price * quantity)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => updateCartQty(menuItem, -1)}
                      className="flex h-7 w-7 items-center justify-center rounded-lg border border-neutral-200 bg-white text-neutral-800 cursor-pointer"
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                    <span className="w-5 text-center text-xs font-extrabold">{quantity}</span>
                    <button
                      type="button"
                      onClick={() => updateCartQty(menuItem, 1)}
                      className="flex h-7 w-7 items-center justify-center rounded-lg bg-neutral-900 text-white cursor-pointer"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => updateCartNote(menuItem.id, e.target.value)}
                  placeholder="Optional note (e.g. extra spicy, no onion)"
                  className="mt-2 w-full rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-xs text-neutral-800 placeholder:text-neutral-400 focus:border-red-500 focus:outline-none"
                />
              </div>
            ))}
          </div>

          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-neutral-500">
              Kitchen Note (Optional)
            </label>
            <input
              type="text"
              value={customerNote}
              onChange={(e) => setCustomerNote(e.target.value)}
              placeholder="Allergies or serving preference..."
              className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs text-neutral-900 focus:border-red-600 focus:bg-white focus:outline-none"
            />
          </div>

          {/* Payment Method Selection */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-neutral-500">
                Payment Method
              </span>
              <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-700">
                Pay After Served
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {PAYMENT_OPTIONS.map((opt) => {
                const selected = paymentMethod === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setPaymentMethod(opt.id)}
                    className={`flex flex-col items-center rounded-2xl border p-2.5 text-center transition cursor-pointer ${
                      selected
                        ? 'border-red-600 bg-red-50/70 ring-1 ring-red-600'
                        : 'border-neutral-200 bg-white hover:border-neutral-300'
                    }`}
                  >
                    <span className={`rounded-lg px-2 py-0.5 text-[10px] font-extrabold ${opt.badgeClass}`}>
                      {opt.id === 'cash' && <Banknote className="mr-1 inline h-3 w-3" />}
                      {opt.id === 'esewa' && <Smartphone className="mr-1 inline h-3 w-3" />}
                      {opt.id === 'khalti' && <Wallet className="mr-1 inline h-3 w-3" />}
                      {opt.label}
                    </span>
                    <span className="mt-1 text-[10px] leading-tight text-neutral-500">After served</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-2xl bg-neutral-950 p-4 text-white">
            <div className="flex items-center justify-between text-xs text-neutral-300">
              <span>Total Payable After Served</span>
              <span className="font-bold uppercase">{paymentMethod}</span>
            </div>
            <div className="mt-1 flex items-center justify-between">
              <span className="text-sm font-bold">Order Total</span>
              <span className="text-xl font-extrabold text-red-400">{formatCurrency(cartTotal)}</span>
            </div>
            <button
              type="button"
              disabled={submitting}
              onClick={onSubmit}
              className="mt-3 w-full rounded-xl bg-red-600 py-3 text-sm font-extrabold text-white shadow-md hover:bg-red-700 disabled:opacity-60 transition cursor-pointer"
            >
              {submitting ? 'Sending to Kitchen...' : 'Place Order Now'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
