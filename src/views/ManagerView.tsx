import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  CheckCircle2,
  Download,
  Eye,
  EyeOff,
  KeyRound,
  LayoutGrid,
  LogOut,
  Plus,
  QrCode,
  Shield,
  Trash2,
  UtensilsCrossed,
  X,
} from 'lucide-react';
import type {
  DeviceSession,
  MenuItem,
  Order,
  RestaurantTable,
  Role,
  RolePolicyInfo,
  SalesSummary,
} from '@shared/types';
import { api, formatCurrency } from '@/lib/api';
import { CountdownBadge } from '@/components/CountdownBadge';
import type { StoredRoleAuth } from '@/lib/device';

interface ManagerViewProps {
  menu: MenuItem[];
  tables: RestaurantTable[];
  orders: Order[];
  nowMs: number;
  auth: StoredRoleAuth;
  onLogout: () => void;
}

type ManagerTab = 'floor' | 'sales' | 'security' | 'cms';

export function ManagerView({ menu, tables, orders, nowMs, auth, onLogout }: ManagerViewProps) {
  const [tab, setTab] = useState<ManagerTab>('floor');
  const [salesData, setSalesData] = useState<{ summary: SalesSummary; orders: Order[] } | null>(null);
  const [policies, setPolicies] = useState<RolePolicyInfo[]>([]);
  const [devices, setDevices] = useState<DeviceSession[]>([]);
  const [banner, setBanner] = useState<{ type: 'ok' | 'err'; msg: string } | null>(null);

  // Password form state
  const [pinInputs, setPinInputs] = useState<Record<Role, string>>({
    kitchen: '',
    waiter: '',
    manager: '',
  });
  const [showPins, setShowPins] = useState(false);

  // Add device role form
  const [newDeviceId, setNewDeviceId] = useState('');
  const [newDeviceName, setNewDeviceName] = useState('');
  const [newDeviceRole, setNewDeviceRole] = useState<Role>('kitchen');

  // Sales filters
  const [salesSearch, setSalesSearch] = useState('');
  const [salesPayFilter, setSalesPayFilter] = useState<'all' | 'cash' | 'esewa' | 'khalti'>('all');
  const [salesStatusFilter, setSalesStatusFilter] = useState<'all' | 'paid' | 'pending'>('all');

  // CMS Menu form
  const [menuForm, setMenuForm] = useState({
    name: '',
    category: 'Mains',
    price: '450',
    description: '',
    prepEstimateMin: '12',
    icon: '🍽️',
    isVeg: false,
    isSpicy: false,
    isPopular: false,
  });

  // CMS Table form + QR modal
  const [tableForm, setTableForm] = useState({ id: '', label: '', seats: '4', zone: 'Main Hall' });
  const [qrModal, setQrModal] = useState<{ tableId: string; url: string; dataUrl: string } | null>(null);

  const loadManagerData = useCallback(async () => {
    try {
      const [salesRes, secRes] = await Promise.all([api.getSales(), api.getManagerSecurity()]);
      setSalesData(salesRes);
      setPolicies(secRes.policies);
      setDevices(secRes.devices);
    } catch (err) {
      setBanner({ type: 'err', msg: err instanceof Error ? err.message : 'Failed to load manager data' });
    }
  }, []);

  useEffect(() => {
    void loadManagerData();
  }, [loadManagerData, orders.length]);

  const notify = (type: 'ok' | 'err', msg: string) => {
    setBanner({ type, msg });
  };

  const handlePasswordUpdate = async (role: Role) => {
    const newPin = pinInputs[role].trim();
    if (newPin.length < 3) {
      notify('err', 'Password must be at least 3 characters.');
      return;
    }
    try {
      const res = await api.updateRolePassword(role, newPin);
      setPolicies((prev) => prev.map((p) => (p.role === role ? res.policy : p)));
      setDevices(res.devices);
      setPinInputs((p) => ({ ...p, [role]: '' }));
      notify(
        'ok',
        `${role.toUpperCase()} password updated to "${newPin}". Previous ${role} device sessions have been logged out.`
      );
      if (role === 'manager') {
        // Current manager session was bumped; prompt re-verify
        onLogout();
      }
    } catch (err) {
      notify('err', err instanceof Error ? err.message : 'Failed to update password');
    }
  };

  const handleAssignDevice = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.assignDeviceRole({
        deviceId: newDeviceId.trim(),
        deviceName: newDeviceName.trim() || `${newDeviceRole.toUpperCase()} Device`,
        role: newDeviceRole,
      });
      setNewDeviceId('');
      setNewDeviceName('');
      await loadManagerData();
      notify('ok', `Added ${newDeviceRole.toUpperCase()} role to device.`);
    } catch (err) {
      notify('err', err instanceof Error ? err.message : 'Failed to assign device role');
    }
  };

  const handleRevokeDevice = async (session: DeviceSession) => {
    try {
      await api.revokeDeviceRole(session.id);
      await loadManagerData();
      notify('ok', `Removed ${session.role.toUpperCase()} role from ${session.deviceName} (${session.deviceId}).`);
    } catch (err) {
      notify('err', err instanceof Error ? err.message : 'Failed to revoke device');
    }
  };

  const handleAddMenuItem = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.saveMenuItem({
        name: menuForm.name,
        category: menuForm.category,
        price: Number(menuForm.price),
        description: menuForm.description || 'Freshly prepared signature dish.',
        prepEstimateMin: Number(menuForm.prepEstimateMin) || 10,
        icon: menuForm.icon || '🍽️',
        isVeg: menuForm.isVeg,
        isSpicy: menuForm.isSpicy,
        isPopular: menuForm.isPopular,
        available: true,
      });
      setMenuForm((f) => ({ ...f, name: '', description: '' }));
      notify('ok', 'Menu item saved and synced to all Diner QR menus.');
    } catch (err) {
      notify('err', err instanceof Error ? err.message : 'Failed to save menu item');
    }
  };

  const handleToggleItemAvailability = async (item: MenuItem) => {
    try {
      await api.saveMenuItem({ ...item, available: !item.available });
    } catch (err) {
      notify('err', err instanceof Error ? err.message : 'Failed to update item');
    }
  };

  const handleAddTable = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.saveTable({
        id: tableForm.id.trim().toUpperCase(),
        label: tableForm.label.trim() || `Table ${tableForm.id.trim().toUpperCase()}`,
        seats: Number(tableForm.seats) || 4,
        zone: tableForm.zone.trim() || 'Main Hall',
      });
      setTableForm({ id: '', label: '', seats: '4', zone: 'Main Hall' });
      notify('ok', 'Table added & QR route ready.');
    } catch (err) {
      notify('err', err instanceof Error ? err.message : 'Failed to save table');
    }
  };

  const openQrPreview = async (tableId: string) => {
    try {
      const qr = await api.getTableQr(tableId, window.location.origin);
      setQrModal(qr);
    } catch (err) {
      notify('err', err instanceof Error ? err.message : 'Failed to generate QR');
    }
  };

  const filteredSalesOrders = useMemo(() => {
    const list = salesData?.orders ?? orders;
    return list.filter((o) => {
      if (salesPayFilter !== 'all' && o.paymentMethod !== salesPayFilter) return false;
      if (salesStatusFilter !== 'all' && o.paymentStatus !== salesStatusFilter) return false;
      if (salesSearch.trim()) {
        const q = salesSearch.toLowerCase();
        return (
          String(o.orderNumber).includes(q) ||
          o.tableLabel.toLowerCase().includes(q) ||
          o.items.some((i) => i.name.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [salesData, orders, salesPayFilter, salesStatusFilter, salesSearch]);

  const exportCsv = () => {
    const headers = ['Order #', 'Table', 'Status', 'Payment Method', 'Payment Status', 'Total (NPR)', 'Created At', 'Items'];
    const rows = filteredSalesOrders.map((o) => [
      `#${o.orderNumber}`,
      o.tableLabel,
      o.status,
      o.paymentMethod,
      o.paymentStatus,
      String(o.totalAmount),
      o.createdAt,
      o.items.map((i) => `${i.quantity}x ${i.name}`).join('; '),
    ]);
    const csv = [headers, ...rows]
      .map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `crimsontable-sales-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const summary = salesData?.summary;

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="flex flex-col gap-4 rounded-3xl bg-neutral-950 p-6 text-white shadow-lg sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-red-400">
            <Shield className="h-4 w-4" />
            Manager Control Center • {auth.deviceName}
          </div>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight">Operations, Sales & Device Roles</h1>
          <p className="mt-1 text-xs text-neutral-400">
            Monitor live orders & timers, review recorded sales, manage kitchen/waiter device passwords, and configure menu & table QRs.
          </p>
        </div>

        <button
          type="button"
          onClick={onLogout}
          className="inline-flex items-center gap-1.5 self-start rounded-xl border border-white/15 bg-white/10 px-3.5 py-2 text-xs font-bold text-white hover:bg-red-600 transition cursor-pointer"
        >
          <LogOut className="h-3.5 w-3.5" />
          Lock Manager
        </button>
      </div>

      {/* Sub-Navigation Tabs */}
      <div className="mt-5 flex flex-wrap gap-2">
        {[
          { id: 'floor', label: 'Live Floor & Orders', icon: LayoutGrid },
          { id: 'sales', label: 'Recorded Sales & Stats', icon: BarChart3 },
          { id: 'security', label: 'Device Roles & Passwords', icon: KeyRound },
          { id: 'cms', label: 'Menu & Table QR CMS', icon: UtensilsCrossed },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setTab(item.id as ManagerTab);
                if (item.id === 'sales' || item.id === 'security') void loadManagerData();
              }}
              className={`inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 text-xs font-extrabold transition cursor-pointer ${
                tab === item.id
                  ? 'bg-red-600 text-white shadow-sm'
                  : 'border border-neutral-200 bg-white text-neutral-700 hover:border-red-300'
              }`}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </button>
          );
        })}
      </div>

      {banner && (
        <div
          className={`mt-4 flex items-center justify-between rounded-2xl border px-4 py-3 text-xs font-bold ${
            banner.type === 'ok'
              ? 'border-neutral-900 bg-neutral-900 text-white'
              : 'border-red-300 bg-red-50 text-red-800'
          }`}
        >
          <span>{banner.msg}</span>
          <button type="button" onClick={() => setBanner(null)} className="ml-3 opacity-70 hover:opacity-100">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* TAB 1: LIVE FLOOR */}
      {tab === 'floor' && (
        <div className="mt-6 space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Active Orders" value={String(orders.filter((o) => o.status !== 'served').length)} accent />
            <StatCard label="Cooking Now" value={String(orders.filter((o) => o.status === 'preparing').length)} />
            <StatCard label="Ready at Pass" value={String(orders.filter((o) => o.status === 'ready').length)} />
            <StatCard
              label="Pending Payment"
              value={formatCurrency(
                orders.filter((o) => o.paymentStatus === 'pending').reduce((s, o) => s + o.totalAmount, 0)
              )}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {orders.length === 0 ? (
              <div className="col-span-full rounded-2xl border border-dashed border-neutral-300 bg-white p-12 text-center text-sm font-semibold text-neutral-500">
                No orders placed yet. Try placing an order from the Diner QR Menu tab!
              </div>
            ) : (
              orders.slice(0, 12).map((order) => (
                <div key={order.id} className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-100 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="rounded-xl bg-neutral-950 px-3 py-1 text-xs font-extrabold text-white">
                        {order.tableLabel}
                      </span>
                      <span className="text-sm font-extrabold text-neutral-900">Order #{order.orderNumber}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[11px] font-extrabold uppercase ${
                          order.status === 'ready'
                            ? 'bg-red-600 text-white'
                            : order.status === 'served'
                            ? 'bg-neutral-900 text-white'
                            : 'bg-neutral-100 text-neutral-700'
                        }`}
                      >
                        {order.status}
                      </span>
                      <span className="text-sm font-extrabold text-red-600">{formatCurrency(order.totalAmount)}</span>
                    </div>
                  </div>

                  <div className="mt-3 space-y-2">
                    {order.items.map((item) => (
                      <div key={item.id} className="flex items-center justify-between text-xs">
                        <span className="font-bold text-neutral-800">
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

                  <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-neutral-100 pt-3">
                    <span className="text-xs font-bold uppercase text-neutral-500">
                      {order.paymentMethod} • {order.paymentStatus === 'paid' ? 'Paid' : 'Unpaid (Pay after served)'}
                    </span>
                    <div className="flex gap-2">
                      {order.status !== 'served' && (
                        <button
                          type="button"
                          onClick={() => api.markServed(order.id)}
                          className="rounded-lg bg-neutral-900 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-red-600 cursor-pointer"
                        >
                          Mark Served
                        </button>
                      )}
                      {order.paymentStatus !== 'paid' && (
                        <button
                          type="button"
                          onClick={() => api.markPaid(order.id)}
                          className="rounded-lg bg-red-600 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-red-700 cursor-pointer"
                        >
                          Confirm Paid
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* TAB 2: RECORDED SALES & STATS */}
      {tab === 'sales' && summary && (
        <div className="mt-6 space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <StatCard label="Gross Sales" value={formatCurrency(summary.grossRevenue)} accent />
            <StatCard label="Collected (Paid)" value={formatCurrency(summary.paidRevenue)} />
            <StatCard label="Pending Collection" value={formatCurrency(summary.pendingRevenue)} />
            <StatCard label="Total Orders" value={`${summary.totalOrders} (${summary.servedOrders} served)`} />
            <StatCard label="Avg Order Value" value={formatCurrency(summary.averageOrderValue)} />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Payment Breakdown */}
            <div className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-xs">
              <h3 className="text-base font-extrabold text-neutral-900">Payment Method Breakdown</h3>
              <p className="text-xs text-neutral-500">Cash vs eSewa vs Khalti volume across all recorded orders</p>

              <div className="mt-5 space-y-4">
                {(['cash', 'esewa', 'khalti'] as const).map((method) => {
                  const data = summary.byPaymentMethod[method];
                  const pct = summary.grossRevenue > 0 ? Math.round((data.amount / summary.grossRevenue) * 100) : 0;
                  return (
                    <div key={method}>
                      <div className="flex items-center justify-between text-xs font-bold">
                        <span className="uppercase text-neutral-900">
                          {method} ({data.count} orders)
                        </span>
                        <span className="text-neutral-900">
                          {formatCurrency(data.amount)} ({pct}%)
                        </span>
                      </div>
                      <div className="mt-1.5 h-2.5 w-full overflow-hidden rounded-full bg-neutral-100">
                        <div
                          className={`h-full rounded-full ${
                            method === 'cash'
                              ? 'bg-neutral-900'
                              : method === 'esewa'
                              ? 'bg-emerald-600'
                              : 'bg-purple-700'
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <div className="mt-1 text-[11px] text-neutral-500">
                        Paid collected: {formatCurrency(data.paidAmount)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Top Selling Items */}
            <div className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-xs">
              <h3 className="text-base font-extrabold text-neutral-900">Top Selling Dishes</h3>
              <p className="text-xs text-neutral-500">Ranked by units ordered</p>

              {summary.topItems.length === 0 ? (
                <p className="mt-8 text-center text-xs text-neutral-400">No items ordered yet.</p>
              ) : (
                <div className="mt-4 space-y-3">
                  {summary.topItems.map((item, idx) => (
                    <div key={item.name} className="flex items-center justify-between rounded-xl bg-neutral-50 px-3.5 py-2.5">
                      <div className="flex items-center gap-3">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-neutral-900 text-[11px] font-extrabold text-white">
                          {idx + 1}
                        </span>
                        <span className="text-xs font-bold text-neutral-900">{item.name}</span>
                      </div>
                      <div className="text-right text-xs">
                        <span className="font-extrabold text-red-600">{item.quantity} sold</span>
                        <span className="ml-2 text-neutral-500">{formatCurrency(item.revenue)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Recorded Sales Ledger */}
          <div className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-xs">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-base font-extrabold text-neutral-900">Recorded Sales Ledger</h3>
                <p className="text-xs text-neutral-500">Complete audit log of every order, method, and settlement</p>
              </div>
              <button
                type="button"
                onClick={exportCsv}
                className="inline-flex items-center gap-1.5 rounded-xl bg-neutral-950 px-3.5 py-2 text-xs font-bold text-white hover:bg-red-600 transition cursor-pointer"
              >
                <Download className="h-3.5 w-3.5" />
                Export CSV
              </button>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <input
                type="text"
                value={salesSearch}
                onChange={(e) => setSalesSearch(e.target.value)}
                placeholder="Search order #, table, or dish..."
                className="rounded-xl border border-neutral-200 px-3 py-1.5 text-xs font-medium focus:border-red-600 focus:outline-none"
              />
              <select
                value={salesPayFilter}
                onChange={(e) => setSalesPayFilter(e.target.value as typeof salesPayFilter)}
                className="rounded-xl border border-neutral-200 px-3 py-1.5 text-xs font-bold"
              >
                <option value="all">All Payment Methods</option>
                <option value="cash">Cash</option>
                <option value="esewa">eSewa</option>
                <option value="khalti">Khalti</option>
              </select>
              <select
                value={salesStatusFilter}
                onChange={(e) => setSalesStatusFilter(e.target.value as typeof salesStatusFilter)}
                className="rounded-xl border border-neutral-200 px-3 py-1.5 text-xs font-bold"
              >
                <option value="all">All Payment Status</option>
                <option value="paid">Paid</option>
                <option value="pending">Pending</option>
              </select>
            </div>

            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-neutral-200 text-neutral-500">
                    <th className="py-2.5 pr-4 font-bold">Order</th>
                    <th className="py-2.5 pr-4 font-bold">Table</th>
                    <th className="py-2.5 pr-4 font-bold">Items</th>
                    <th className="py-2.5 pr-4 font-bold">Stage</th>
                    <th className="py-2.5 pr-4 font-bold">Method</th>
                    <th className="py-2.5 pr-4 font-bold">Payment</th>
                    <th className="py-2.5 text-right font-bold">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {filteredSalesOrders.map((o) => (
                    <tr key={o.id} className="hover:bg-neutral-50">
                      <td className="py-3 pr-4 font-extrabold text-neutral-900">#{o.orderNumber}</td>
                      <td className="py-3 pr-4 font-bold">{o.tableLabel}</td>
                      <td className="py-3 pr-4 text-neutral-600">
                        {o.items.map((i) => `${i.quantity}× ${i.name}`).join(', ')}
                      </td>
                      <td className="py-3 pr-4 uppercase font-bold">{o.status}</td>
                      <td className="py-3 pr-4 uppercase font-bold">{o.paymentMethod}</td>
                      <td className="py-3 pr-4">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase ${
                            o.paymentStatus === 'paid'
                              ? 'bg-neutral-900 text-white'
                              : 'bg-red-50 text-red-700'
                          }`}
                        >
                          {o.paymentStatus}
                        </span>
                      </td>
                      <td className="py-3 text-right font-extrabold text-neutral-900">
                        {formatCurrency(o.totalAmount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: DEVICE ROLES & PASSWORDS */}
      {tab === 'security' && (
        <div className="mt-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-extrabold text-neutral-900">Role Dashboard Passwords</h2>
              <p className="text-xs text-neutral-500">
                Changing a role password immediately invalidates older device logins for that dashboard.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowPins((s) => !s)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-xs font-bold text-neutral-800 hover:bg-neutral-100 cursor-pointer"
            >
              {showPins ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              {showPins ? 'Hide Passwords' : 'Show Current Passwords'}
            </button>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {policies.map((policy) => (
              <div key={policy.role} className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="rounded-xl bg-neutral-950 px-3 py-1 text-xs font-extrabold uppercase text-white">
                    {policy.role} Dashboard
                  </span>
                  <span className="text-[11px] font-bold text-neutral-400">v{policy.passwordVersion}</span>
                </div>

                <div className="mt-4 rounded-xl bg-neutral-50 px-3.5 py-2.5">
                  <div className="text-[11px] font-bold uppercase text-neutral-500">Current PIN / Password</div>
                  <div className="mt-0.5 font-mono text-lg font-extrabold tracking-widest text-red-600">
                    {showPins ? policy.pin : '••••'}
                  </div>
                </div>

                <div className="mt-4 flex gap-2">
                  <input
                    type="text"
                    value={pinInputs[policy.role]}
                    onChange={(e) => setPinInputs((p) => ({ ...p, [policy.role]: e.target.value }))}
                    placeholder="New password / PIN"
                    className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-xs font-bold focus:border-red-600 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => handlePasswordUpdate(policy.role)}
                    className="shrink-0 rounded-xl bg-red-600 px-3.5 py-2 text-xs font-extrabold text-white hover:bg-red-700 cursor-pointer"
                  >
                    Update
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Add Role to Device + Active Devices Table */}
          <div className="grid gap-6 lg:grid-cols-12">
            <form
              onSubmit={handleAssignDevice}
              className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-xs lg:col-span-4 space-y-3"
            >
              <h3 className="text-base font-extrabold text-neutral-900">Add Role to Device</h3>
              <p className="text-xs text-neutral-500">
                Pre-authorize or assign a Kitchen, Waiter, or Manager role to a specific Device ID.
              </p>

              <div>
                <label className="mb-1 block text-xs font-bold text-neutral-600">Device ID</label>
                <input
                  type="text"
                  required
                  value={newDeviceId}
                  onChange={(e) => setNewDeviceId(e.target.value)}
                  placeholder="e.g. DEV-ABC123"
                  className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-xs font-mono font-bold focus:border-red-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-neutral-600">Device Label</label>
                <input
                  type="text"
                  value={newDeviceName}
                  onChange={(e) => setNewDeviceName(e.target.value)}
                  placeholder="e.g. Kitchen Pass iPad"
                  className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-xs font-medium focus:border-red-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-neutral-600">Assign Role</label>
                <select
                  value={newDeviceRole}
                  onChange={(e) => setNewDeviceRole(e.target.value as Role)}
                  className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-xs font-bold"
                >
                  <option value="kitchen">Kitchen (Chef)</option>
                  <option value="waiter">Waiter (Server)</option>
                  <option value="manager">Manager</option>
                </select>
              </div>

              <button
                type="submit"
                className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-neutral-950 py-2.5 text-xs font-extrabold text-white hover:bg-red-600 transition cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                Assign Role to Device
              </button>
            </form>

            <div className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-xs lg:col-span-8">
              <h3 className="text-base font-extrabold text-neutral-900">Registered Device Sessions</h3>
              <p className="text-xs text-neutral-500">
                Remove a role from any device at any time — it will lock immediately.
              </p>

              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-neutral-200 text-neutral-500">
                      <th className="py-2 pr-3 font-bold">Device</th>
                      <th className="py-2 pr-3 font-bold">Device ID</th>
                      <th className="py-2 pr-3 font-bold">Role</th>
                      <th className="py-2 pr-3 font-bold">Status</th>
                      <th className="py-2 text-right font-bold">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {devices.map((dev) => (
                      <tr key={dev.id}>
                        <td className="py-2.5 pr-3 font-bold text-neutral-900">{dev.deviceName}</td>
                        <td className="py-2.5 pr-3 font-mono text-neutral-600">{dev.deviceId}</td>
                        <td className="py-2.5 pr-3 uppercase font-extrabold">{dev.role}</td>
                        <td className="py-2.5 pr-3">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase ${
                              dev.active ? 'bg-neutral-900 text-white' : 'bg-red-50 text-red-700'
                            }`}
                          >
                            {dev.active ? `Active v${dev.passwordVersion}` : 'Revoked / Old PIN'}
                          </span>
                        </td>
                        <td className="py-2.5 text-right">
                          <button
                            type="button"
                            onClick={() => handleRevokeDevice(dev)}
                            className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1 text-[11px] font-bold text-red-700 hover:bg-red-600 hover:text-white transition cursor-pointer"
                          >
                            <Trash2 className="h-3 w-3" />
                            Remove Role
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: MENU & TABLE QR CMS */}
      {tab === 'cms' && (
        <div className="mt-6 space-y-8">
          {/* Table QR Management */}
          <div className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-xs">
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <h3 className="text-lg font-extrabold text-neutral-900">Tables & Printable QR Codes</h3>
                <p className="text-xs text-neutral-500">
                  Customers scan a table QR with their phone camera to open the ordering site pre-linked to their table.
                </p>
              </div>
              <form onSubmit={handleAddTable} className="flex flex-wrap gap-2">
                <input
                  type="text"
                  required
                  value={tableForm.id}
                  onChange={(e) => setTableForm((f) => ({ ...f, id: e.target.value }))}
                  placeholder="ID (e.g. T9)"
                  className="w-24 rounded-xl border border-neutral-200 px-3 py-2 text-xs font-bold uppercase"
                />
                <input
                  type="text"
                  value={tableForm.label}
                  onChange={(e) => setTableForm((f) => ({ ...f, label: e.target.value }))}
                  placeholder="Label (Table 9)"
                  className="w-32 rounded-xl border border-neutral-200 px-3 py-2 text-xs font-medium"
                />
                <input
                  type="text"
                  value={tableForm.zone}
                  onChange={(e) => setTableForm((f) => ({ ...f, zone: e.target.value }))}
                  placeholder="Zone"
                  className="w-28 rounded-xl border border-neutral-200 px-3 py-2 text-xs font-medium"
                />
                <button
                  type="submit"
                  className="rounded-xl bg-red-600 px-4 py-2 text-xs font-extrabold text-white hover:bg-red-700 cursor-pointer"
                >
                  + Add Table
                </button>
              </form>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {tables.map((t) => (
                <div key={t.id} className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-extrabold text-neutral-900">{t.label}</span>
                    <span className="font-mono text-[11px] font-bold text-neutral-500">{t.id}</span>
                  </div>
                  <div className="mt-0.5 text-xs text-neutral-500">
                    {t.zone} • {t.seats} seats
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => openQrPreview(t.id)}
                      className="flex flex-1 items-center justify-center gap-1 rounded-xl bg-neutral-950 py-1.5 text-[11px] font-bold text-white hover:bg-red-600 cursor-pointer"
                    >
                      <QrCode className="h-3.5 w-3.5" />
                      Show QR
                    </button>
                    <button
                      type="button"
                      onClick={() => api.deleteTable(t.id)}
                      className="rounded-xl border border-neutral-200 bg-white p-1.5 text-neutral-500 hover:text-red-600 cursor-pointer"
                      title="Delete table"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Menu CMS */}
          <div className="grid gap-6 lg:grid-cols-12">
            <form
              onSubmit={handleAddMenuItem}
              className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-xs lg:col-span-4 space-y-3"
            >
              <h3 className="text-base font-extrabold text-neutral-900">Add Menu Dish</h3>
              <input
                type="text"
                required
                value={menuForm.name}
                onChange={(e) => setMenuForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Dish name"
                className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-xs font-bold"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  required
                  value={menuForm.category}
                  onChange={(e) => setMenuForm((f) => ({ ...f, category: e.target.value }))}
                  placeholder="Category"
                  className="rounded-xl border border-neutral-200 px-3 py-2 text-xs font-medium"
                />
                <input
                  type="number"
                  required
                  value={menuForm.price}
                  onChange={(e) => setMenuForm((f) => ({ ...f, price: e.target.value }))}
                  placeholder="Price (Rs.)"
                  className="rounded-xl border border-neutral-200 px-3 py-2 text-xs font-bold"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  value={menuForm.icon}
                  onChange={(e) => setMenuForm((f) => ({ ...f, icon: e.target.value }))}
                  placeholder="Emoji icon"
                  className="rounded-xl border border-neutral-200 px-3 py-2 text-xs"
                />
                <input
                  type="number"
                  value={menuForm.prepEstimateMin}
                  onChange={(e) => setMenuForm((f) => ({ ...f, prepEstimateMin: e.target.value }))}
                  placeholder="Prep min"
                  className="rounded-xl border border-neutral-200 px-3 py-2 text-xs"
                />
              </div>
              <textarea
                rows={2}
                value={menuForm.description}
                onChange={(e) => setMenuForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Appetizing description..."
                className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-xs"
              />
              <div className="flex flex-wrap gap-3 text-xs font-semibold">
                <label className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={menuForm.isVeg}
                    onChange={(e) => setMenuForm((f) => ({ ...f, isVeg: e.target.checked }))}
                  />
                  Veg
                </label>
                <label className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={menuForm.isSpicy}
                    onChange={(e) => setMenuForm((f) => ({ ...f, isSpicy: e.target.checked }))}
                  />
                  Spicy
                </label>
                <label className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={menuForm.isPopular}
                    onChange={(e) => setMenuForm((f) => ({ ...f, isPopular: e.target.checked }))}
                  />
                  Popular
                </label>
              </div>
              <button
                type="submit"
                className="w-full rounded-xl bg-red-600 py-2.5 text-xs font-extrabold text-white hover:bg-red-700 cursor-pointer"
              >
                Save Dish to Menu
              </button>
            </form>

            <div className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-xs lg:col-span-8">
              <h3 className="text-base font-extrabold text-neutral-900">Live Menu Catalog ({menu.length} items)</h3>
              <div className="mt-4 divide-y divide-neutral-100">
                {menu.map((item) => (
                  <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{item.icon}</span>
                      <div>
                        <div className="text-sm font-bold text-neutral-900">{item.name}</div>
                        <div className="text-xs text-neutral-500">
                          {item.category} • {formatCurrency(item.price)}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleToggleItemAvailability(item)}
                        className={`rounded-lg px-2.5 py-1 text-[11px] font-bold cursor-pointer ${
                          item.available
                            ? 'bg-neutral-900 text-white'
                            : 'bg-neutral-200 text-neutral-600'
                        }`}
                      >
                        {item.available ? 'Available' : 'Sold Out'}
                      </button>
                      <button
                        type="button"
                        onClick={() => api.deleteMenuItem(item.id)}
                        className="rounded-lg border border-red-200 p-1.5 text-red-600 hover:bg-red-600 hover:text-white cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* QR Code Modal */}
      {qrModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 text-center shadow-2xl">
            <div className="flex items-center justify-between">
              <span className="rounded-xl bg-red-600 px-3 py-1 text-xs font-extrabold text-white">
                Table {qrModal.tableId} QR
              </span>
              <button
                type="button"
                onClick={() => setQrModal(null)}
                className="rounded-full bg-neutral-100 p-1.5 text-neutral-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <img
              src={qrModal.dataUrl}
              alt={`QR code for ${qrModal.tableId}`}
              className="mx-auto my-4 h-56 w-56 rounded-2xl border border-neutral-200 p-2"
            />
            <p className="break-all rounded-xl bg-neutral-100 px-3 py-2 font-mono text-[11px] text-neutral-700">
              {qrModal.url}
            </p>
            <a
              href={qrModal.url}
              target="_blank"
              rel="noreferrer"
              className="mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-neutral-950 py-2.5 text-xs font-extrabold text-white hover:bg-red-600"
            >
              <CheckCircle2 className="h-4 w-4 text-red-400" />
              Open Diner Link
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div
      className={`rounded-2xl border p-4 shadow-xs ${
        accent ? 'border-red-600 bg-red-600 text-white' : 'border-neutral-200 bg-white text-neutral-900'
      }`}
    >
      <div className={`text-[11px] font-bold uppercase tracking-wider ${accent ? 'text-red-100' : 'text-neutral-500'}`}>
        {label}
      </div>
      <div className="mt-1 text-xl font-extrabold tabular-nums">{value}</div>
    </div>
  );
}
