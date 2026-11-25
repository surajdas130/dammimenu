import { useCallback, useEffect, useState } from 'react';
import { ChefHat, QrCode, Shield, Utensils, Wifi, WifiOff } from 'lucide-react';
import type { Role } from '@shared/types';
import { useRestaurantLive } from '@/hooks/useRestaurantLive';
import { api } from '@/lib/api';
import { clearRoleAuth, getOrCreateDeviceId, getRoleAuth, type StoredRoleAuth } from '@/lib/device';
import { RoleGate } from '@/components/RoleGate';
import { DinerView } from '@/views/DinerView';
import { KitchenView } from '@/views/KitchenView';
import { WaiterView } from '@/views/WaiterView';
import { ManagerView } from '@/views/ManagerView';

type AppTab = 'diner' | Role;

export function App() {
  const [activeTab, setActiveTab] = useState<AppTab>(() => {
    const params = new URLSearchParams(window.location.search);
    const viewParam = params.get('view');
    if (viewParam === 'kitchen' || viewParam === 'waiter' || viewParam === 'manager') {
      return viewParam;
    }
    return 'diner';
  });

  const [selectedTableId, setSelectedTableId] = useState<string>(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get('table');
    if (!t) return 'T1';
    const clean = t.trim().toUpperCase();
    return /^\d+$/.test(clean) ? `T${clean}` : clean;
  });

  const [roleAuths, setRoleAuths] = useState<Partial<Record<Role, StoredRoleAuth>>>(() => ({
    kitchen: getRoleAuth('kitchen') ?? undefined,
    waiter: getRoleAuth('waiter') ?? undefined,
    manager: getRoleAuth('manager') ?? undefined,
  }));

  const verifyRoleSession = useCallback(async (role: Role) => {
    const stored = getRoleAuth(role);
    if (!stored) {
      setRoleAuths((prev) => ({ ...prev, [role]: undefined }));
      return;
    }
    try {
      const res = await api.verifySession(role, stored.deviceId, stored.passwordVersion);
      if (!res.authorized) {
        clearRoleAuth(role);
        setRoleAuths((prev) => ({ ...prev, [role]: undefined }));
      }
    } catch {
      // Ignore transient offline error
    }
  }, []);

  const handleAuthChanged = useCallback(
    (payload: { role?: Role; passwordVersion?: number; revokedDeviceIds?: string[] }) => {
      const myDeviceId = getOrCreateDeviceId();
      if (payload.revokedDeviceIds?.includes(myDeviceId) && payload.role) {
        clearRoleAuth(payload.role);
        setRoleAuths((prev) => ({ ...prev, [payload.role!]: undefined }));
        return;
      }
      if (payload.role) {
        void verifyRoleSession(payload.role);
      } else {
        (['kitchen', 'waiter', 'manager'] as Role[]).forEach((r) => void verifyRoleSession(r));
      }
    },
    [verifyRoleSession]
  );

  const { menu, tables, orders, loading, connected, nowMs } = useRestaurantLive(handleAuthChanged);

  // Verify stored role session whenever switching to a staff dashboard
  useEffect(() => {
    if (activeTab === 'kitchen' || activeTab === 'waiter' || activeTab === 'manager') {
      void verifyRoleSession(activeTab);
    }
  }, [activeTab, verifyRoleSession]);

  const handleSelectTable = (tableId: string) => {
    setSelectedTableId(tableId);
    const url = new URL(window.location.href);
    url.searchParams.set('table', tableId);
    window.history.replaceState({}, '', url.toString());
  };

  const handleLogout = (role: Role) => {
    clearRoleAuth(role);
    setRoleAuths((prev) => ({ ...prev, [role]: undefined }));
  };

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900">
      {/* Global Coherent Top Navigation Bar (Black + Crimson + White) */}
      <header className="sticky top-0 z-40 border-b border-neutral-800 bg-neutral-950 text-white shadow-md">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-600 font-black text-white shadow-sm">
              CT
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base font-extrabold tracking-tight">CrimsonTable</span>
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                    connected ? 'bg-white/10 text-emerald-400' : 'bg-red-900/60 text-red-300'
                  }`}
                >
                  {connected ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
                  {connected ? 'Live' : 'Syncing'}
                </span>
              </div>
              <p className="hidden text-[11px] text-neutral-400 sm:block">
                QR Dining • Kitchen KDS • Waiter Service • Manager CMS
              </p>
            </div>
          </div>

          <nav className="flex flex-wrap items-center gap-1.5">
            {[
              { id: 'diner', label: 'Diner Menu', icon: QrCode },
              { id: 'kitchen', label: 'Kitchen', icon: ChefHat },
              { id: 'waiter', label: 'Waiter', icon: Utensils },
              { id: 'manager', label: 'Manager', icon: Shield },
            ].map((item) => {
              const Icon = item.icon;
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id as AppTab)}
                  className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-extrabold transition cursor-pointer ${
                    active
                      ? 'bg-red-600 text-white shadow-sm'
                      : 'bg-white/5 text-neutral-300 hover:bg-white/15 hover:text-white'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {item.label}
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      {loading ? (
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="rounded-2xl border border-neutral-200 bg-white px-6 py-4 text-sm font-bold text-neutral-700 shadow-xs">
            Loading restaurant system...
          </div>
        </div>
      ) : (
        <main>
          {activeTab === 'diner' && (
            <DinerView
              menu={menu}
              tables={tables}
              orders={orders}
              nowMs={nowMs}
              selectedTableId={selectedTableId}
              onSelectTable={handleSelectTable}
            />
          )}

          {activeTab === 'kitchen' &&
            (roleAuths.kitchen ? (
              <KitchenView
                orders={orders}
                nowMs={nowMs}
                auth={roleAuths.kitchen}
                onLogout={() => handleLogout('kitchen')}
              />
            ) : (
              <RoleGate
                role="kitchen"
                title="Chef / Kitchen Display"
                subtitle="Enter the Kitchen password to view table tickets and start preparation timers."
                defaultDeviceLabel="Kitchen Screen #1"
                onAuthenticated={(auth) => setRoleAuths((p) => ({ ...p, kitchen: auth }))}
              />
            ))}

          {activeTab === 'waiter' &&
            (roleAuths.waiter ? (
              <WaiterView
                tables={tables}
                orders={orders}
                nowMs={nowMs}
                auth={roleAuths.waiter}
                onLogout={() => handleLogout('waiter')}
              />
            ) : (
              <RoleGate
                role="waiter"
                title="Server / Waiter Dashboard"
                subtitle="Enter the Waiter password to track timers, serve ready orders, and collect payments."
                defaultDeviceLabel="Waiter Handheld #1"
                onAuthenticated={(auth) => setRoleAuths((p) => ({ ...p, waiter: auth }))}
              />
            ))}

          {activeTab === 'manager' &&
            (roleAuths.manager ? (
              <ManagerView
                menu={menu}
                tables={tables}
                orders={orders}
                nowMs={nowMs}
                auth={roleAuths.manager}
                onLogout={() => handleLogout('manager')}
              />
            ) : (
              <RoleGate
                role="manager"
                title="Manager Console"
                subtitle="Enter the Manager password to view sales analytics, manage device roles, and update the CMS."
                defaultDeviceLabel="Manager Desk"
                onAuthenticated={(auth) => setRoleAuths((p) => ({ ...p, manager: auth }))}
              />
            ))}
        </main>
      )}
    </div>
  );
}
export default App;
