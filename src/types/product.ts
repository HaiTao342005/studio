
import type { Timestamp } from 'firebase/firestore';

export type ProductUnit = 'kg' | 'box' | 'pallet' | 'item';

// Data structure for products stored in Firestore
export interface StoredProduct {
  id: string; // Firestore document ID
  supplierId: string;
  name: string;
  description: string;
  price: number;
  unit: ProductUnit;
  stockQuantity: number; // Added stock quantity
  category?: string;
  imageUrl?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// Data structure for products used in components (with JS Date)
export interface Product extends Omit<StoredProduct, 'createdAt' | 'updatedAt'> {
  createdAt: Date;
  updatedAt: Date;
}
