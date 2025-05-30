
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
  stockQuantity: number;
  category?: string;
  imageUrl?: string;
  producedDate?: Timestamp;
  producedArea?: string;
  producedByOrganization?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// Data structure for products used in components (with JS Date)
export interface Product extends Omit<StoredProduct, 'createdAt' | 'updatedAt' | 'producedDate'> {
  producedDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// For form data, all fields that can be edited should be potentially present.
export interface ProductFormData {
  id?: string; // Present when editing
  name: string;
  description: string;
  price: number;
  unit: ProductUnit;
  stockQuantity?: number;
  category?: string;
  imageUrl?: string;
  producedDate: Date; // Required in form
  producedArea: string; // Required in form
  producedByOrganization: string; // Required in form
}
