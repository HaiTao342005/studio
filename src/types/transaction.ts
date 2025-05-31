
import type { ElementType, SVGProps } from 'react';
import type { Timestamp } from 'firebase/firestore';

export type OrderStatus =
  | 'Pending'
  | 'Awaiting Supplier Confirmation'
  | 'Awaiting Transporter Assignment'
  | 'Awaiting Payment'
  | 'Paid' // Signifies funds are in simulated escrow
  | 'Ready for Pickup'
  | 'Shipped'
  | 'Delivered'
  | 'Receipt Confirmed' // Customer has confirmed, pending payout/finalization
  | 'Completed' // Order successfully completed and payouts simulated
  | 'Cancelled'
  | 'Disputed';

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
  predictedDeliveryDate?: Timestamp;

  // Customer Assessment Fields
  supplierRating?: number;
  supplierFeedback?: string;
  transporterRating?: number;
  transporterFeedback?: string;
  assessmentSubmitted?: boolean;

  // Escrow and Payout Simulation Fields
  estimatedTransporterFee?: number;
  supplierPayoutAmount?: number;
  transporterPayoutAmount?: number;
  payoutTimestamp?: Timestamp;
  refundTimestamp?: Timestamp;
}

// This Order type might be legacy or used for specific UI transformations.
// Ensure it aligns with StoredOrder or is used consciously.
export interface Order extends Omit<StoredOrder, 'orderDate' | 'predictedDeliveryDate' | 'createdAt' | 'updatedAt' | 'payoutTimestamp' | 'refundTimestamp'> {
  date: Date; // This seems to be a client-side transformed date
  FruitIcon?: ElementType<SVGProps<SVGSVGElement>>;
  predictedDeliveryDate?: Date; // Client-side transformed
  payoutTimestamp?: Date;
  refundTimestamp?: Date;
  createdAt?: Date; // Client-side transformed
  updatedAt?: Date; // Client-side transformed
}
