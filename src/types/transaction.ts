import type { ElementType, SVGProps } from 'react';

export type TransactionStatus = 'Pending' | 'Completed' | 'Cancelled' | 'In Transit';

export interface Transaction {
  id: string;
  date: string; // ISO string or formatted date string
  fruitType: string;
  importer: string;
  exporter: string;
  amount: number; // USD
  currency: string;
  quantity: number;
  unit: 'kg' | 'ton' | 'box' | 'pallet';
  status: TransactionStatus;
  FruitIcon?: ElementType<SVGProps<SVGSVGElement>>; // Optional: specific icon for the fruit
}
