
import type { ElementType, SVGProps } from 'react';
import type { Timestamp } from 'firebase/firestore';

export type OrderStatus = 'Pending' | 'Awaiting Payment' | 'Paid' | 'Shipped' | 'Delivered' | 'Cancelled';
export type OrderShipmentStatus = 'Ready for Pickup' | 'In Transit' | 'Out for Delivery' | 'Delivered' | 'Delivery Failed' | 'Shipment Cancelled';

// This interface will be used for data stored in Firestore
export interface StoredOrder {
  id: string; // Firestore document ID
  orderDate: Timestamp; // Renamed from 'date' for clarity
  productId: string;
  productName: string;
  supplierId: string;
  supplierName: string;
  customerId: string;
  customerName: string;
  quantity: number;
  unit: 'kg' | 'ton' | 'box' | 'pallet' | 'item'; // Added 'item' from product type
  pricePerUnit: number;
  totalAmount: number; // Renamed from 'amount' for clarity
  currency: string;
  status: OrderStatus;
  notes?: string;
  // Transporter specific fields
  transporterId?: string;
  transporterName?: string; // Denormalized for easier display
  shipmentStatus?: OrderShipmentStatus;
  podSubmitted?: boolean;
  podNotes?: string;
  // Any other fields that are directly stored
}

// This interface can be used by components, including dynamic FruitIcon and JS Date objects
// 'date' here refers to the JS Date object for component use, derived from 'orderDate'
export interface Order extends Omit<StoredOrder, 'orderDate'> {
  date: Date; // JS Date object for component use
  FruitIcon?: ElementType<SVGProps<SVGSVGElement>>;
}
