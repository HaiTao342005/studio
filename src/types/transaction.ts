
import type { ElementType, SVGProps } from 'react';
import type { Timestamp } from 'firebase/firestore';

export type OrderStatus =
  | 'Pending' // Initial state before supplier action
  | 'Awaiting Supplier Confirmation' // Customer placed initial order
  // | 'Awaiting Transporter Assignment' // Supplier confirmed, needs transporter (legacy or alternative flow)
  | 'AwaitingOnChainCreation' // Supplier finalized, ready to be created on smart contract
  | 'AwaitingOnChainFunding' // Order created on smart contract, awaiting customer's ETH deposit
  | 'FundedOnChain' // Customer has successfully funded the order on the smart contract
  | 'Shipped' // Goods are in transit (can overlap with FundedOnChain)
  | 'Delivered' // Goods delivered (shipment status), awaiting customer on-chain confirmation
  | 'CompletedOnChain' // Customer confirmed delivery on-chain, contract handled payouts
  | 'Cancelled' // Order cancelled (off-chain)
  | 'DisputedOnChain'; // Order disputed on the smart contract

// Keep existing OrderShipmentStatus as it's for transporter UI updates
export type OrderShipmentStatus = 'Ready for Pickup' | 'In Transit' | 'Out for Delivery' | 'Delivered' | 'Delivery Failed' | 'Shipment Cancelled';

export interface StoredOrder {
  id: string; // Firestore document ID, will be hashed for smart contract orderId
  orderDate: Timestamp;
  productId: string;
  productName: string;
  supplierId: string; // Firestore user ID
  supplierName: string;
  supplierEthereumAddress?: string; // Ethereum address of supplier
  customerId: string; // Firestore user ID
  customerName: string;
  customerEthereumAddress?: string; // Ethereum address of customer
  quantity: number;
  unit: 'kg' | 'ton' | 'box' | 'pallet' | 'item';
  pricePerUnit: number;
  totalAmount: number; // Initial product total (productAmount in SC)
  finalTotalAmount?: number; // Product total + shipping (totalAmount in SC)
  estimatedTransporterFee?: number; // (shippingFee in SC)
  currency: string;
  status: OrderStatus;
  notes?: string;
  transporterId?: string | null; // Firestore user ID
  transporterName?: string | null;
  transporterEthereumAddress?: string | null; // Ethereum address of transporter
  shipmentStatus?: OrderShipmentStatus;
  podSubmitted?: boolean;
  podNotes?: string;
  paymentTransactionHash?: string; // Hash of the fundOrder transaction
  pickupAddress?: string;
  deliveryAddress?: string;
  predictedDeliveryDate?: Timestamp;

  // Customer Assessment Fields
  supplierRating?: number;
  supplierFeedback?: string;
  transporterRating?: number;
  transporterFeedback?: string;
  assessmentSubmitted?: boolean;

  // Fields related to on-chain payout and contract state
  contractOrderId?: string; // bytes32 version of id, stored for reference
  contractCreationTxHash?: string; // Hash of the createOrder transaction
  contractConfirmationTxHash?: string; // Hash of the confirmDelivery transaction
  // Payouts are handled by the contract, individual tx hashes for payouts might be from events
  supplierPayoutAmount?: number; // For record, matches productAmount in SC
  transporterPayoutAmount?: number; // For record, matches shippingFee in SC
  payoutTimestamp?: Timestamp; // When confirmDelivery was successfully mined and payouts initiated by contract
  refundTimestamp?: Timestamp; // If a dispute is resolved with a refund
}

export interface Order extends Omit<StoredOrder, 'orderDate' | 'predictedDeliveryDate' | 'payoutTimestamp' | 'refundTimestamp'> {
  date: Date; // This might be redundant if orderDate is always Timestamp and converted in components
  orderDate: Date; // Ensuring components use Date object
  FruitIcon?: ElementType<SVGProps<SVGSVGElement>>;
  predictedDeliveryDate?: Date;
  payoutTimestamp?: Date;
  refundTimestamp?: Date;
}
