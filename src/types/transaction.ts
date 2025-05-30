
import type { ElementType, SVGProps } from 'react';
import type { Timestamp } from 'firebase/firestore';

export type OrderStatus =
  | 'Pending'
  | 'Awaiting Supplier Confirmation' // New
  | 'Awaiting Transporter Assignment' // New
  | 'Awaiting Payment' // Still relevant for direct payments or if auto-payment fails
  | 'Paid'
  | 'Ready for Pickup' // Now set by supplier after assigning transporter
  | 'Shipped'
  | 'Delivered'
  | 'Receipt Confirmed' // New
  | 'Cancelled';

export type OrderShipmentStatus = 'Ready for Pickup' | 'In Transit' | 'Out for Delivery' | 'Delivered' | 'Delivery Failed' | 'Shipment Cancelled';

// This interface will be used for data stored in Firestore
export interface StoredOrder {
  id: string; // Firestore document ID
  orderDate: Timestamp;
  productId: string;
  productName: string;
  supplierId: string;
  supplierName: string;
  customerId: string;
  customerName: string;
  quantity: number;
  unit: 'kg' | 'ton' | 'box' | 'pallet' | 'item';
  pricePerUnit: number;
  totalAmount: number;
  currency: string;
  status: OrderStatus;
  notes?: string;
  // Transporter specific fields
  transporterId?: string;
  transporterName?: string;
  shipmentStatus?: OrderShipmentStatus;
  podSubmitted?: boolean;
  podNotes?: string;
  paymentTransactionHash?: string; // For Metamask tx
  // Any other fields that are directly stored
}

// This interface can be used by components, including dynamic FruitIcon and JS Date objects
export interface Order extends Omit<StoredOrder, 'orderDate'> {
  date: Date; // JS Date object for component use
  FruitIcon?: ElementType<SVGProps<SVGSVGElement>>;
}
