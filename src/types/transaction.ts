
import type { ElementType, SVGProps } from 'react';
import type { Timestamp } from 'firebase/firestore';

export type OrderStatus = 'Pending' | 'Awaiting Payment' | 'Paid' | 'Shipped' | 'Delivered' | 'Cancelled';

// This interface will be used for data stored in Firestore
export interface StoredOrder {
  id: string; // Firestore document ID
  date: Timestamp; // Firestore Timestamp for transactionDate
  fruitType: string;
  customer: string;
  supplier: string;
  amount: number;
  currency: string;
  quantity: number;
  unit: 'kg' | 'ton' | 'box' | 'pallet';
  status: OrderStatus;
  notes?: string;
  // Any other fields that are directly stored
}

// This interface can be used by components, including dynamic FruitIcon and JS Date objects
export interface Order extends Omit<StoredOrder, 'date'> {
  date: Date; // JS Date object for component use
  FruitIcon?: ElementType<SVGProps<SVGSVGElement>>;
}
