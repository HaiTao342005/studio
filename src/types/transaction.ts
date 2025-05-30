
import type { ElementType, SVGProps } from 'react';
import type { Timestamp } from 'firebase/firestore';

export type OrderStatus =
  | 'Pending'
  | 'Awaiting Supplier Confirmation'
  | 'Awaiting Transporter Assignment'
  | 'Awaiting Payment'
  | 'Paid'
  | 'Ready for Pickup'
  | 'Shipped'
  | 'Delivered'
  | 'Receipt Confirmed'
  | 'Cancelled';

export type OrderShipmentStatus = 'Ready for Pickup' | 'In Transit' | 'Out for Delivery' | 'Delivered' | 'Delivery Failed' | 'Shipment Cancelled';

export interface StoredOrder {
  id: string;
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
  transporterId?: string | null;
  transporterName?: string | null;
  shipmentStatus?: OrderShipmentStatus;
  podSubmitted?: boolean;
  podNotes?: string;
  paymentTransactionHash?: string;
  pickupAddress?: string;
  deliveryAddress?: string;
  predictedDeliveryDate?: Timestamp; // New field
}

export interface Order extends Omit<StoredOrder, 'orderDate'> {
  date: Date; // This might be legacy, ensure orderDate is primary
  FruitIcon?: ElementType<SVGProps<SVGSVGElement>>;
}
