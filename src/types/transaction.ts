import type { ElementType, SVGProps } from 'react';

export type OrderStatus = 'Pending' | 'Awaiting Payment' | 'Paid' | 'Shipped' | 'Delivered' | 'Cancelled';

// This interface will be used for data stored in localStorage
// Renamed from StoredTransaction to StoredOrder
export interface StoredOrder {
  id: string;
  date: string; // ISO string
  fruitType: string;
  customer: string; // Changed from importer
  supplier: string; // Changed from exporter
  amount: number;
  currency: string;
  quantity: number;
  unit: 'kg' | 'ton' | 'box' | 'pallet';
  status: OrderStatus; // Changed from TransactionStatus
  notes?: string;
}

// This interface can be used by components, including dynamic FruitIcon
// Renamed from Transaction to Order
export interface Order extends StoredOrder {
  FruitIcon?: ElementType<SVGProps<SVGSVGElement>>;
}
