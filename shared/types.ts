export type Role = 'kitchen' | 'waiter' | 'manager';

export type PaymentMethod = 'cash' | 'esewa' | 'khalti';

export type PaymentStatus = 'pending' | 'paid';

export type OrderStatus = 'pending' | 'preparing' | 'ready' | 'served';

export type ItemStatus = 'pending' | 'preparing' | 'ready';

export interface MenuItem {
  id: string;
  name: string;
  category: string;
  price: number;
  description: string;
  isVeg: boolean;
  isSpicy: boolean;
  isPopular: boolean;
  available: boolean;
  prepEstimateMin: number;
  icon: string;
}

export interface RestaurantTable {
  id: string;
  label: string;
  seats: number;
  zone: string;
}

export interface OrderItem {
  id: string;
  orderId: string;
  menuItemId: string;
  name: string;
  unitPrice: number;
  quantity: number;
  notes?: string;
  timerDurationSec: number | null;
  timerStartedAt: string | null;
  timerEndsAt: string | null;
  itemStatus: ItemStatus;
}

export interface Order {
  id: string;
  orderNumber: number;
  tableId: string;
  tableLabel: string;
  customerNote?: string;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  status: OrderStatus;
  totalAmount: number;
  items: OrderItem[];
  createdAt: string;
  updatedAt: string;
  servedAt: string | null;
  paidAt: string | null;
}

export interface RolePolicyInfo {
  role: Role;
  pin: string;
  passwordVersion: number;
  updatedAt: string;
}

export interface DeviceSession {
  id: string;
  deviceId: string;
  deviceName: string;
  role: Role;
  passwordVersion: number;
  active: boolean;
  lastSeenAt: string;
  createdAt: string;
}

export interface SalesSummary {
  totalOrders: number;
  servedOrders: number;
  activeOrders: number;
  grossRevenue: number;
  paidRevenue: number;
  pendingRevenue: number;
  averageOrderValue: number;
  byPaymentMethod: Record<
    PaymentMethod,
    {
      count: number;
      amount: number;
      paidAmount: number;
    }
  >;
  topItems: Array<{
    name: string;
    quantity: number;
    revenue: number;
  }>;
  hourlyRevenue: Array<{
    hour: string;
    revenue: number;
    orders: number;
  }>;
}

export interface BootstrapState {
  menu: MenuItem[];
  tables: RestaurantTable[];
  orders: Order[];
  serverTime: string;
}

export type RealtimeEvent =
  | { type: 'snapshot'; data: BootstrapState }
  | { type: 'orders_changed'; data: { orders: Order[]; serverTime: string } }
  | { type: 'menu_changed'; data: { menu: MenuItem[] } }
  | { type: 'tables_changed'; data: { tables: RestaurantTable[] } }
  | {
      type: 'auth_changed';
      data: {
        role?: Role;
        passwordVersion?: number;
        revokedDeviceIds?: string[];
      };
    };
