import type { ElementType, SVGProps } from 'react';

export type TransactionStatus = 'Pending' | 'Completed' | 'Cancelled' | 'In Transit';

// This interface will be used for data stored in localStorage
export interface StoredTransaction {
  id: string;
  date: string; // ISO string
  fruitType: string;
  importer: string;
  exporter: string;
  amount: number;
  currency: string;
  quantity: number;
  unit: 'kg' | 'ton' | 'box' | 'pallet';
  status: TransactionStatus;
  notes?: string;
}

// This interface can be used by components, including dynamic FruitIcon
export interface Transaction extends StoredTransaction {
  FruitIcon?: ElementType<SVGProps<SVGSVGElement>>;
}
