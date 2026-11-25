import type {
  BootstrapState,
  DeviceSession,
  MenuItem,
  Order,
  PaymentMethod,
  RestaurantTable,
  Role,
  RolePolicyInfo,
  SalesSummary,
} from '@shared/types';
import { getOrCreateDeviceId } from './device';

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'x-device-id': getOrCreateDeviceId(),
      ...(options?.headers ?? {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data as T;
}

export const api = {
  bootstrap: () => request<BootstrapState>('/api/bootstrap'),

  createOrder: (payload: {
    tableId: string;
    customerNote?: string;
    paymentMethod: PaymentMethod;
    items: Array<{ menuItemId: string; quantity: number; notes?: string }>;
  }) =>
    request<Order>('/api/orders', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  startTimer: (orderId: string, durationSeconds: number, itemId: string | null = null) =>
    request<Order>(`/api/orders/${orderId}/timer`, {
      method: 'POST',
      body: JSON.stringify({ durationSeconds, itemId }),
    }),

  markReady: (orderId: string, itemId: string | null = null) =>
    request<Order>(`/api/orders/${orderId}/ready`, {
      method: 'POST',
      body: JSON.stringify({ itemId }),
    }),

  markServed: (orderId: string) =>
    request<Order>(`/api/orders/${orderId}/serve`, {
      method: 'POST',
    }),

  markPaid: (orderId: string, paymentMethod?: PaymentMethod) =>
    request<Order>(`/api/orders/${orderId}/pay`, {
      method: 'POST',
      body: JSON.stringify({ paymentMethod }),
    }),

  login: (payload: { role: Role; pin: string; deviceId: string; deviceName: string }) =>
    request<{ authorized: boolean; session: DeviceSession }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  verifySession: (role: Role, deviceId: string, passwordVersion?: number) => {
    const params = new URLSearchParams({ role, deviceId });
    if (passwordVersion !== undefined) params.set('passwordVersion', String(passwordVersion));
    return request<{ authorized: boolean; currentVersion: number; session?: DeviceSession }>(
      `/api/auth/verify?${params.toString()}`
    );
  },

  getManagerSecurity: () =>
    request<{ policies: RolePolicyInfo[]; devices: DeviceSession[] }>('/api/manager/security'),

  updateRolePassword: (role: Role, pin: string) =>
    request<{ policy: RolePolicyInfo; devices: DeviceSession[] }>(`/api/manager/roles/${role}/password`, {
      method: 'PUT',
      body: JSON.stringify({ pin }),
    }),

  assignDeviceRole: (payload: { deviceId: string; deviceName: string; role: Role }) =>
    request<DeviceSession>('/api/manager/devices', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  revokeDeviceRole: (sessionId: string) =>
    request<{ removed: DeviceSession }>(`/api/manager/devices/${sessionId}`, {
      method: 'DELETE',
    }),

  getSales: () => request<{ summary: SalesSummary; orders: Order[] }>('/api/manager/sales'),

  saveMenuItem: (item: Omit<MenuItem, 'id'> & { id?: string }) =>
    request<MenuItem>('/api/manager/menu', {
      method: 'POST',
      body: JSON.stringify(item),
    }),

  deleteMenuItem: (id: string) =>
    request<{ ok: boolean }>(`/api/manager/menu/${id}`, {
      method: 'DELETE',
    }),

  saveTable: (table: RestaurantTable) =>
    request<RestaurantTable>('/api/manager/tables', {
      method: 'POST',
      body: JSON.stringify(table),
    }),

  deleteTable: (id: string) =>
    request<{ ok: boolean }>(`/api/manager/tables/${id}`, {
      method: 'DELETE',
    }),

  getTableQr: (tableId: string, origin: string) =>
    request<{ tableId: string; url: string; dataUrl: string }>(
      `/api/tables/${encodeURIComponent(tableId)}/qr?origin=${encodeURIComponent(origin)}`
    ),
};

export function formatCurrency(amount: number): string {
  return `Rs. ${amount.toLocaleString('en-NP')}`;
}
