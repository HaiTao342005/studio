
"use client";

import { useState, useEffect, type SVGProps, type ElementType, useCallback } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Trash2, Wallet, Loader2, Eye, ThumbsUp, Truck, AlertTriangle, ThumbsDown, Star, CheckCircle, Ban, Edit, Info, Hash, KeyRound, CircleDollarSign, Send, Zap, FileSignature } from 'lucide-react'; // Added Zap, FileSignature
import type { OrderStatus, StoredOrder, OrderShipmentStatus } from '@/types/transaction';
import { AppleIcon, BananaIcon, OrangeIcon, GrapeIcon, MangoIcon, FruitIcon } from '@/components/icons/FruitIcons';
import { format } from 'date-fns';
import { useToast } from "@/hooks/use-toast";
import { db } from '@/lib/firebase/config';
import {
  collection,
  onSnapshot,
  query,
  doc,
  deleteDoc,
  updateDoc,
  Timestamp,
  where,
  orderBy,
  getDoc,
  runTransaction,
  serverTimestamp
} from 'firebase/firestore';
import { useAuth, type User as AuthUser, type UserShippingRates } from '@/contexts/AuthContext';
import { calculateDistance, type CalculateDistanceOutput } from '@/ai/flows/calculate-distance-flow';
// Removed simulatePayout as contract will handle payouts
import { getEscrowContract, convertToBytes32, getSignerAndProvider } from '@/lib/ethersService'; // NEW
import { ethers } from 'ethers'; // NEW


const GANACHE_RECIPIENT_ADDRESS = process.env.NEXT_PUBLIC_ESCROW_CONTRACT_ADDRESS || "0xYOUR_ESCROW_CONTRACT_ADDRESS_HERE"; // Will be contract address
const FALLBACK_SIMULATED_ETH_USD_PRICE = 3000; // Updated fallback

// Helper function to calculate tiered shipping price (remains the same)
const calculateTieredShippingPrice = (distanceKm: number, rates?: UserShippingRates): number | null => {
  if (!rates || rates.tier1_0_100_km_price === undefined || rates.tier2_101_500_km_price_per_km === undefined || rates.tier3_501_1000_km_price_per_km === undefined) {
    return null;
  }
  const { tier1_0_100_km_price, tier2_101_500_km_price_per_km, tier3_501_1000_km_price_per_km } = rates;

  if (distanceKm <= 0) return 0;
  if (distanceKm <= 100) return tier1_0_100_km_price;

  let price = tier1_0_100_km_price;
  if (distanceKm <= 500) {
    price += (distanceKm - 100) * tier2_101_500_km_price_per_km;
    return price;
  }

  price += (400) * tier2_101_500_km_price_per_km;
  if (distanceKm <= 1000) {
    price += (distanceKm - 500) * tier3_501_1000_km_price_per_km;
    return price;
  }

  price += (500) * tier3_501_1000_km_price_per_km;
  price += (distanceKm - 1000) * tier3_501_1000_km_price_per_km;
  return price;
};


const getStatusBadgeVariant = (status: OrderStatus | OrderShipmentStatus): "default" | "secondary" | "destructive" | "outline" => {
  switch (status) {
    case 'Paid': case 'Delivered': case 'Receipt Confirmed': case 'CompletedOnChain': case 'FundedOnChain': return 'default'; // Adjusted
    case 'Shipped': case 'Ready for Pickup': case 'In Transit': case 'Out for Delivery': return 'secondary';
    case 'Awaiting Supplier Confirmation': case 'Awaiting Transporter Assignment': case 'AwaitingOnChainCreation': case 'AwaitingOnChainFunding': case 'Pending': return 'outline'; // Adjusted
    case 'Cancelled': case 'Delivery Failed': case 'Shipment Cancelled': case 'DisputedOnChain': return 'destructive'; // Adjusted
    default: return 'secondary';
  }
};

const getFruitIcon = (fruitTypeInput?: string): ElementType<SVGProps<SVGSVGElement>> => {
  const fruitType = fruitTypeInput || "";
  const lowerFruitType = fruitType.toLowerCase();
  if (lowerFruitType.includes('apple')) return AppleIcon;
  if (lowerFruitType.includes('banana')) return BananaIcon;
  if (lowerFruitType.includes('orange')) return OrangeIcon;
  if (lowerFruitType.includes('grape')) return GrapeIcon;
  if (lowerFruitType.includes('mango')) return MangoIcon;
  return FruitIcon;
};

interface TransactionHistoryTableProps {
  initialOrders?: StoredOrder[];
  isCustomerView?: boolean;
}

export function TransactionHistoryTable({ initialOrders, isCustomerView = false }: TransactionHistoryTableProps) {
  const [orders, setOrders] = useState<StoredOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionOrderId, setActionOrderId] = useState<string | null>(null); // Generic loading state for any action
  
  const [isAssignTransporterDialogOpen, setIsAssignTransporterDialogOpen] = useState(false);
  const [currentOrderToAssign, setCurrentOrderToAssign] = useState<StoredOrder | null>(null);
  const [selectedTransporter, setSelectedTransporter] = useState<string | null>(null);

  const [isAssessmentDialogOpen, setIsAssessmentDialogOpen] = useState(false);
  const [currentOrderForAssessment, setCurrentOrderForAssessment] = useState<StoredOrder | null>(null);
  const [supplierRating, setSupplierRating] = useState('');
  const [supplierFeedback, setSupplierFeedback] = useState('');
  const [transporterRating, setTransporterRating] = useState('');
  const [transporterFeedback, setTransporterFeedback] = useState('');
  const [isSubmittingAssessment, setIsSubmittingAssessment] = useState(false);

  const { toast } = useToast();
  const { user, allUsersList } = useAuth();

  const availableTransporters = allUsersList.filter(u =>
    u.role === 'transporter' &&
    u.isApproved &&
    !u.isSuspended &&
    u.shippingRates &&
    typeof u.shippingRates.tier1_0_100_km_price === 'number' &&
    typeof u.shippingRates.tier2_101_500_km_price_per_km === 'number' &&
    typeof u.shippingRates.tier3_501_1000_km_price_per_km === 'number' &&
    u.ethereumAddress // Transporter must have an Ethereum address for payouts
  );

  useEffect(() => {
    if (isCustomerView && initialOrders) {
      const mappedOrders: StoredOrder[] = initialOrders.map(order => ({
        ...order,
        FruitIcon: getFruitIcon(order.productName || (order as any).fruitType),
      }));
      mappedOrders.sort((a, b) => {
        const dateA = (a.orderDate as Timestamp)?.toMillis() || 0;
        const dateB = (b.orderDate as Timestamp)?.toMillis() || 0;
        return dateB - dateA;
      });
      setOrders(mappedOrders);
      setIsLoading(false);
      return;
    }

    if (!user || !user.id) {
      setOrders([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    let ordersQuery;
    const currentRole = user.role;

    if (currentRole === 'supplier') {
      ordersQuery = query(
        collection(db, "orders"),
        where("supplierId", "==", user.id)
      );
    } else if (currentRole === 'manager') {
      ordersQuery = query(collection(db, "orders"), orderBy("orderDate", "desc"));
    } else {
      if (isCustomerView) {
         ordersQuery = query(
          collection(db, "orders"),
          where("customerId", "==", user.id),
          orderBy("orderDate", "desc") 
        );
      } else {
        setOrders([]);
        setIsLoading(false);
        return;
      }
    }

    const unsubscribe = onSnapshot(ordersQuery, (querySnapshot) => {
      const fetchedOrders: StoredOrder[] = [];
      querySnapshot.forEach((docSnapshot) => {
        const data = docSnapshot.data() as Omit<StoredOrder, 'id'>;
        fetchedOrders.push({
          ...data,
          id: docSnapshot.id,
          FruitIcon: getFruitIcon(data.productName || (data as any).fruitType),
        });
      });
      
      if (currentRole === 'supplier' || (isCustomerView && !initialOrders)) { 
        fetchedOrders.sort((a, b) => {
            const dateA = (a.orderDate as Timestamp)?.toMillis() || 0;
            const dateB = (b.orderDate as Timestamp)?.toMillis() || 0;
            return dateB - dateA;
        });
      }
      setOrders(fetchedOrders);
      setIsLoading(false);
    }, (error) => {
      console.error(`Error fetching orders for role ${currentRole || (isCustomerView ? 'customer' : 'unknown')}:`, error);
      toast({
        title: "Firestore Query Error",
        description: `Failed to fetch orders: ${error.message}. Check console for index requirements.`,
        variant: "destructive",
        duration: 15000,
      });
      setIsLoading(false);
      setOrders([]);
    });

    return () => unsubscribe();
  }, [user, isCustomerView, initialOrders, toast]);


  const handleDeleteOrder = async (orderId: string) => {
    if (user?.isSuspended) {
      toast({ title: "Action Denied", description: "Your account is suspended.", variant: "destructive" });
      return;
    }
    if (user?.role === 'customer') {
        toast({ title: "Action Not Allowed", description: "Customers cannot delete orders.", variant: "destructive"});
        return;
    }
    if (!confirm("Are you sure you want to delete this order? This action cannot be undone.")) {
      return;
    }
    try {
      await deleteDoc(doc(db, "orders", orderId));
      toast({ title: "Order Deleted", description: "The order has been removed." });
    } catch (error) {
      toast({ title: "Error Deleting Order", description: (error as Error).message, variant: "destructive" });
    }
  };

  const fetchEthPrice = async (): Promise<number> => {
    toast({ title: "Fetching ETH Price...", description: "Getting latest ETH to USD rate." });
    try {
      const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd');
      if (!response.ok) throw new Error(`CoinGecko API: ${response.status}`);
      const data = await response.json();
      const price = data?.ethereum?.usd;
      if (typeof price !== 'number') throw new Error("Invalid price format.");
      toast({ title: "ETH Price Fetched", description: `1 ETH = $${price.toFixed(2)} USD` });
      return price;
    } catch (error) {
      toast({ title: "Price Error", description: `Using fallback rate. Error: ${(error as Error).message}`, variant: "destructive", duration: 7000 });
      return FALLBACK_SIMULATED_ETH_USD_PRICE;
    }
  };

  const handleCreateOrderOnChain = useCallback(async (orderToAssign: StoredOrder, selectedTransporterId: string) => {
    setActionOrderId(orderToAssign.id);
    const supplier = allUsersList.find(u => u.id === orderToAssign.supplierId);
    const customer = allUsersList.find(u => u.id === orderToAssign.customerId);
    const transporter = allUsersList.find(u => u.id === selectedTransporterId);

    if (!supplier?.ethereumAddress || !customer?.ethereumAddress || !transporter?.ethereumAddress) {
        toast({ title: "Address Missing", description: "Customer, Supplier, or Transporter Ethereum address is missing in their profile. Cannot create order on chain.", variant: "destructive", duration: 7000 });
        setActionOrderId(null);
        return false;
    }
    if (!transporter.shippingRates) { // Should be caught by availableTransporters filter, but double check
        toast({ title: "Transporter Rates Missing", description: `${transporter.name} has not set shipping rates.`, variant: "destructive"});
        setActionOrderId(null);
        return false;
    }

    let calculatedTransporterFee: number | null = null;
    let finalTotalOrderAmount = orderToAssign.totalAmount; // product cost

    try {
      const distanceInput = { 
          originAddress: supplier.address || 'Supplier Address Not Set', 
          destinationAddress: customer.address || 'Customer Address Not Set',
          orderCreationDate: (orderToAssign.orderDate as Timestamp).toDate().toISOString() 
      };
      const distanceInfo = await calculateDistance(distanceInput);
      if (distanceInfo.distanceKm !== undefined) {
        calculatedTransporterFee = calculateTieredShippingPrice(distanceInfo.distanceKm, transporter.shippingRates);
        if (calculatedTransporterFee !== null) {
          finalTotalOrderAmount = orderToAssign.totalAmount + calculatedTransporterFee;
        } else {
           toast({title: "Transporter Rates Error", description: `${transporter.name} has incomplete shipping rates. Using product total for now.`, variant: "outline", duration: 8000});
        }
      } else {
        toast({title: "Distance Error", description: `Could not estimate distance for fee calculation. ${distanceInfo.note || ''} Using product total.`, variant: "outline"});
      }
    } catch (err) {
      toast({title: "Distance/Fee Calc Error", description: "Could not estimate shipping fee. Using product total.", variant: "outline"});
    }
    
    const productAmountBigInt = ethers.parseEther((orderToAssign.totalAmount / FALLBACK_SIMULATED_ETH_USD_PRICE).toFixed(18)); // Approximate
    const shippingFeeBigInt = ethers.parseEther(((calculatedTransporterFee ?? 0) / FALLBACK_SIMULATED_ETH_USD_PRICE).toFixed(18)); // Approximate

    try {
        const contract = await getEscrowContract();
        const orderIdBytes32 = convertToBytes32(orderToAssign.id);

        toast({ title: "Creating Order On-Chain...", description: "Please confirm in Metamask.", duration: 10000});
        const tx = await contract.createOrder(
            orderIdBytes32,
            customer.ethereumAddress,
            supplier.ethereumAddress,
            transporter.ethereumAddress,
            productAmountBigInt, // productAmount on contract
            shippingFeeBigInt,   // shippingFee on contract
            ethers.ZeroAddress // For ETH payments
        );
        await tx.wait();
        toast({ title: "Order Created On-Chain!", description: `Smart contract order ID: ${orderIdBytes32.substring(0,10)}... Tx: ${tx.hash.substring(0,10)}...`});

        const orderRef = doc(db, "orders", orderToAssign.id);
        await updateDoc(orderRef, {
            transporterId: selectedTransporterId,
            transporterName: transporter.name,
            transporterEthereumAddress: transporter.ethereumAddress,
            supplierEthereumAddress: supplier.ethereumAddress,
            customerEthereumAddress: customer.ethereumAddress,
            status: 'AwaitingOnChainFunding' as OrderStatus,
            shipmentStatus: 'Ready for Pickup' as OrderShipmentStatus,
            pickupAddress: supplier.address || 'N/A',
            deliveryAddress: customer.address || 'N/A',
            estimatedTransporterFee: calculatedTransporterFee ?? 0,
            finalTotalAmount: finalTotalOrderAmount,
            contractOrderId: orderIdBytes32,
            // predictedDeliveryDate: (updated via distance calc before this)
        });
        setIsAssignTransporterDialogOpen(false);
        return true;
    } catch (error: any) {
        console.error("Error creating order on chain:", error);
        toast({ title: "Smart Contract Error", description: `Could not create order on chain: ${error.message || 'Unknown error'}`, variant: "destructive" });
        return false;
    } finally {
        setActionOrderId(null);
    }
  }, [allUsersList, toast]);


  const handlePayWithMetamaskOnChain = useCallback(async (orderId: string): Promise<boolean> => {
    const orderToPay = orders.find(o => o.id === orderId);
    if (!orderToPay || !orderToPay.contractOrderId || !orderToPay.finalTotalAmount) {
      toast({ title: "Error", description: "Order details missing for on-chain payment.", variant: "destructive" });
      return false;
    }
    if (orderToPay.status !== 'AwaitingOnChainFunding') {
      toast({ title: "Payment Error", description: `Order is not awaiting funding. Status: ${orderToPay.status}`, variant: "destructive" });
      return false;
    }

    setActionOrderId(orderId);
    const currentEthUsdPrice = await fetchEthPrice();
    const ethAmount = parseFloat((orderToPay.finalTotalAmount / currentEthUsdPrice).toFixed(18));
    const amountInWei = ethers.parseEther(ethAmount.toString());

    toast({ title: "Initiating On-Chain Payment", description: `Order: ${orderToPay.finalTotalAmount.toFixed(2)} USD. Sending: ${ethAmount.toFixed(6)} ETH. Confirm in Metamask.`, duration: 10000 });

    try {
      const contract = await getEscrowContract();
      const tx = await contract.fundOrder(orderToPay.contractOrderId, { value: amountInWei });
      toast({ title: "Transaction Submitted", description: `Tx Hash: ${tx.hash.substring(0,10)}... Waiting for confirmation.` });
      await tx.wait();

      const orderRef = doc(db, "orders", orderId);
      await updateDoc(orderRef, {
        status: 'FundedOnChain' as OrderStatus,
        paymentTransactionHash: tx.hash
      });
      toast({ title: "Payment Confirmed On-Chain!", description: `Order funded in smart contract. Tx: ${tx.hash.substring(0,10)}...`, variant: "default" });

      if (orderToPay.productId && orderToPay.quantity > 0) {
        const productRef = doc(db, "products", orderToPay.productId);
        await runTransaction(db, async (transaction) => {
          const productDoc = await transaction.get(productRef);
          if (!productDoc.exists()) throw new Error("Product not found for stock update.");
          const newStock = Math.max(0, (productDoc.data().stockQuantity || 0) - orderToPay.quantity);
          transaction.update(productRef, { stockQuantity: newStock });
        });
        toast({ title: "Stock Updated", description: `Stock for ${orderToPay.productName} reduced.` });
      }
      return true;
    } catch (error: any) {
      console.error("Error funding order on chain:", error);
      toast({ title: "Smart Contract Error", description: `Metamask payment failed: ${error.message || 'Unknown error'}`, variant: "destructive" });
      return false;
    } finally {
      setActionOrderId(null);
    }
  }, [orders, toast]);


  const handleOpenAssignTransporterDialog = (order: StoredOrder) => {
    if (user?.isSuspended) {
      toast({ title: "Action Denied", description: "Your account is suspended.", variant: "destructive" });
      return;
    }
    setCurrentOrderToAssign(order);
    setSelectedTransporter(null);
    setIsAssignTransporterDialogOpen(true);
  };

  const handleConfirmAssignTransporter = async () => {
      if (!currentOrderToAssign || !selectedTransporter) return;
      await handleCreateOrderOnChain(currentOrderToAssign, selectedTransporter);
  };


  const handleCustomerConfirmReceiptOnChain = async (orderId: string) => {
    setActionOrderId(orderId);
    const order = orders.find(o => o.id === orderId);
    if (!order || !order.contractOrderId) {
       toast({ title: "Error", description: "Order contract details not found.", variant: "destructive" });
       setActionOrderId(null);
       return;
    }
    if (order.status !== 'FundedOnChain' && order.status !== 'Delivered' && order.status !== 'Shipped') { // Delivered is local shipment status
         toast({ title: "Action Error", description: `Order must be funded on-chain and delivered. Current status: ${order.status}`, variant: "destructive" });
         setActionOrderId(null);
         return;
    }

    toast({ title: "Confirming Delivery On-Chain...", description: "Please confirm in Metamask.", duration: 10000 });
    try {
      const contract = await getEscrowContract();
      const tx = await contract.confirmDelivery(order.contractOrderId);
      toast({ title: "Confirmation Submitted", description: `Tx Hash: ${tx.hash.substring(0,10)}... Waiting for on-chain processing.` });
      await tx.wait();
      
      const orderRef = doc(db, "orders", orderId);
      await updateDoc(orderRef, {
        status: 'CompletedOnChain' as OrderStatus,
        contractConfirmationTxHash: tx.hash,
        payoutTimestamp: serverTimestamp(), // Mark when customer confirmed
        // supplierPayoutAmount and transporterPayoutAmount are now determined by the contract
        // We can fetch them from contract or listen to PayoutsMade event if needed for records
        supplierPayoutAmount: order.totalAmount, // totalAmount is productAmount in SC
        transporterPayoutAmount: order.estimatedTransporterFee ?? 0, // estimatedTransporterFee is shippingFee in SC
      });
      
      toast({ title: "Delivery Confirmed & Payouts Processed On-Chain!", description: `Smart contract handled payouts. Tx: ${tx.hash.substring(0,10)}...`, duration: 10000 });

    } catch (error: any) {
      console.error("Error confirming delivery on chain:", error);
      const errorMessage = error.reason || error.message || "An unknown error occurred.";
      toast({ 
        title: "Smart Contract Error", 
        description: `Could not confirm delivery on chain: ${errorMessage}`, 
        variant: "destructive" 
      });
    } finally {
      setActionOrderId(null);
    }
  };

  const handleDenyReceiptOnChain = async (orderId: string) => { // Renamed to clarify it's on-chain
    setActionOrderId(orderId);
    const order = orders.find(o => o.id === orderId);
    if (!order || !order.contractOrderId) {
       toast({ title: "Error", description: "Order contract details not found.", variant: "destructive" });
       setActionOrderId(null);
       return;
    }
    // Add appropriate status checks from contract if needed, e.g. must be Funded or Delivered
    if (order.status !== 'FundedOnChain' && order.status !== 'Delivered' && order.status !== 'Shipped') {
        toast({ title: "Dispute Error", description: "Order not in a state to be disputed on-chain.", variant: "destructive" });
        setActionOrderId(null);
        return;
    }

    toast({ title: "Submitting Dispute On-Chain...", description: "Please confirm in Metamask.", duration: 10000 });
    try {
      const contract = await getEscrowContract();
      const tx = await contract.disputeOrder(order.contractOrderId);
      toast({ title: "Dispute Submitted", description: `Tx Hash: ${tx.hash.substring(0,10)}... Waiting for confirmation.` });
      await tx.wait();

      const orderRef = doc(db, "orders", orderId);
      await updateDoc(orderRef, {
        status: 'DisputedOnChain' as OrderStatus,
        // refundTimestamp: serverTimestamp() // Actual refund happens via resolveDispute by owner
      });
      toast({ title: "Order Disputed On-Chain", description: `Order marked as disputed. Tx: ${tx.hash.substring(0,10)}... Owner can resolve.` });
    } catch (error: any) {
      toast({ title: "Smart Contract Error", description: `Could not dispute order on chain: ${error.message || 'Unknown error'}`, variant: "destructive" });
    } finally {
      setActionOrderId(null);
    }
  };


  const handleOpenAssessmentDialog = (order: StoredOrder) => {
    setCurrentOrderForAssessment(order);
    setSupplierRating(order.supplierRating?.toString() || '');
    setSupplierFeedback(order.supplierFeedback || '');
    setTransporterRating(order.transporterRating?.toString() || '');
    setTransporterFeedback(order.transporterFeedback || '');
    setIsAssessmentDialogOpen(true);
  };

  const handleCloseAssessmentDialog = () => {
    setIsAssessmentDialogOpen(false);
    setCurrentOrderForAssessment(null);
    setSupplierRating(''); setSupplierFeedback('');
    setTransporterRating(''); setTransporterFeedback('');
  };

  const handleSubmitAssessment = async () => {
    if (!currentOrderForAssessment) return;
    const sRating = supplierRating ? parseInt(supplierRating, 10) : undefined;
    const tRating = transporterRating ? parseInt(transporterRating, 10) : undefined;
    if (supplierRating && (isNaN(sRating!) || sRating! < 1 || sRating! > 5)) {
      toast({ title: "Invalid Input", description: "Supplier rating: 1-5.", variant: "destructive"}); return;
    }
    if (currentOrderForAssessment.transporterId && transporterRating && (isNaN(tRating!) || tRating! < 1 || tRating! > 5)) {
      toast({ title: "Invalid Input", description: "Transporter rating: 1-5.", variant: "destructive"}); return;
    }
    setIsSubmittingAssessment(true);
    const updateData: Partial<StoredOrder> = {
      supplierRating: sRating, supplierFeedback: supplierFeedback.trim() || undefined, assessmentSubmitted: true,
    };
    if (currentOrderForAssessment.transporterId) {
      updateData.transporterRating = tRating; updateData.transporterFeedback = transporterFeedback.trim() || undefined;
    }
    try {
      await updateDoc(doc(db, "orders", currentOrderForAssessment.id), updateData);
      toast({ title: "Evaluation Submitted", description: "Thank you for your feedback!" });
      handleCloseAssessmentDialog();
    } catch (error) {
      toast({ title: "Error", description: "Could not submit evaluation.", variant: "destructive" });
    } finally {
      setIsSubmittingAssessment(false);
    }
  };
  
  const truncateText = (text: string | undefined | null, length: number = 10) => {
    if (!text) return 'N/A';
    if (text.length <= length) return text;
    return text.substring(0, length) + '...';
  };


  if (isLoading) return <div className="flex justify-center items-center py-8"><Loader2 className="h-8 w-8 animate-spin mr-2" /> Loading...</div>;
  if (orders.length === 0 && !isLoading) return <p className="text-center text-muted-foreground py-8">No orders yet.</p>;

  const isManagerView = user?.role === 'manager';

  return (
    <>
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[60px]">Icon</TableHead>
            <TableHead>Order Date</TableHead>
            <TableHead>Product</TableHead>
            {!isCustomerView && <TableHead>Customer</TableHead>}
            {isCustomerView && <TableHead>Supplier</TableHead>}
            <TableHead>Transporter</TableHead>
            {isManagerView && <TableHead title="Firestore Order ID">FS Order ID</TableHead>}
            {isManagerView && <TableHead title="Smart Contract Order ID (bytes32)">SC Order ID</TableHead>}
            <TableHead className="text-right">Amount (USD)</TableHead>
            <TableHead className="text-right">Quantity</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Shipment Status</TableHead>
            <TableHead>Predicted Delivery</TableHead>
            {isCustomerView && <TableHead>Transaction Outcome</TableHead>}
            {isManagerView && <TableHead title="Customer On-Chain Funding Transaction Hash"><Hash className="inline-block h-4 w-4 mr-1"/>Funding Hash</TableHead>}
            {isManagerView && <TableHead title="Smart Contract Escrow Address"><KeyRound className="inline-block h-4 w-4 mr-1"/>SC Address</TableHead>}
            {isManagerView && <TableHead title="Customer On-Chain Confirmation Transaction Hash"><FileSignature className="inline-block h-4 w-4 mr-1"/>Confirm Hash</TableHead>}
            <TableHead className="w-[220px] text-center">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {orders.map((order) => {
            const displayDate = order.orderDate || (order as any).date;
            const productName = order.productName || (order as any).fruitType;

            const canCreateOnChain = user?.role === 'supplier' && order.status === 'Awaiting Supplier Confirmation' && !user.isSuspended;
            const canPayOnChain = isCustomerView && order.status === 'AwaitingOnChainFunding';
            const canConfirmOrDenyOnChain = isCustomerView && order.status === 'FundedOnChain' && order.shipmentStatus === 'Delivered' && !order.assessmentSubmitted;
            const canEvaluate = isCustomerView && (order.status === 'CompletedOnChain' || order.status === 'DisputedOnChain') && !order.assessmentSubmitted;
            
            const isCurrentUserSupplierSuspended = user?.role === 'supplier' && user?.isSuspended;

            const displayAmount = order.finalTotalAmount ?? order.totalAmount;

            return (
            <TableRow key={order.id}>
              <TableCell>{order.FruitIcon ? <order.FruitIcon className="h-6 w-6 text-accent" /> : <FruitIcon className="h-6 w-6 text-gray-400" />}</TableCell>
              <TableCell>{displayDate ? format((displayDate as Timestamp).toDate(), "MMM d, yyyy") : 'N/A'}</TableCell>
              <TableCell className="font-medium">{productName}</TableCell>
              {!isCustomerView && <TableCell>{order.customerName} ({truncateText(order.customerEthereumAddress, 8)})</TableCell>}
              {isCustomerView && (
                <TableCell>
                  {order.supplierName} ({truncateText(order.supplierEthereumAddress,8)})
                  {allUsersList.find(u=>u.id === order.supplierId)?.averageSupplierRating !== undefined && (<Badge variant="outline" className="ml-1 text-xs font-normal py-0.5"><Star className="h-3 w-3 mr-1 text-yellow-400 fill-yellow-400" />{allUsersList.find(u=>u.id === order.supplierId)!.averageSupplierRating!.toFixed(1)}</Badge>)}
                </TableCell>
              )}
              <TableCell>
                {order.transporterName || 'N/A'} {order.transporterName && `(${truncateText(order.transporterEthereumAddress,8)})`}
                {order.transporterId && allUsersList.find(u=>u.id === order.transporterId)?.averageTransporterRating !== undefined && (<Badge variant="outline" className="ml-1 text-xs font-normal py-0.5"><Star className="h-3 w-3 mr-1 text-yellow-400 fill-yellow-400" />{allUsersList.find(u=>u.id === order.transporterId)!.averageTransporterRating!.toFixed(1)}</Badge>)}
              </TableCell>
              {isManagerView && <TableCell className="text-xs" title={order.id}>{truncateText(order.id, 8)}</TableCell>}
              {isManagerView && <TableCell className="text-xs" title={order.contractOrderId || undefined}>{truncateText(order.contractOrderId, 12)}</TableCell>}
              <TableCell className="text-right">{order.currency} {displayAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
              <TableCell className="text-right">{order.quantity.toLocaleString()} {order.unit}</TableCell>
              <TableCell><Badge variant={getStatusBadgeVariant(order.status)}>{order.status}</Badge></TableCell>
              <TableCell>{order.shipmentStatus ? <Badge variant={getStatusBadgeVariant(order.shipmentStatus)}>{order.shipmentStatus}</Badge> : <span className="text-xs text-muted-foreground">N/A</span>}</TableCell>
              <TableCell>{order.predictedDeliveryDate ? format((order.predictedDeliveryDate as Timestamp).toDate(), "MMM d, yyyy") : <span className="text-xs text-muted-foreground">N/A</span>}</TableCell>
              {isCustomerView && (
                <TableCell className="text-xs">
                  {order.status === 'CompletedOnChain' && (
                    <div className="space-y-0.5">
                      <p className="flex items-center text-green-600" title={`Smart contract handled payouts. Confirmation Tx: ${order.contractConfirmationTxHash || 'N/A'}`}>
                        <Zap className="h-3 w-3 mr-1" /> Payouts by Contract
                        {order.contractConfirmationTxHash && <Info className="h-3 w-3 ml-1 text-blue-500 cursor-help" />}
                      </p>
                      {order.payoutTimestamp && (
                        <p className="text-muted-foreground">
                          Confirmed: {format((order.payoutTimestamp as Timestamp).toDate(), "MMM d, yy")}
                        </p>
                      )}
                    </div>
                  )}
                  {order.status === 'DisputedOnChain' && (
                    <div className="space-y-0.5">
                      <p className="text-destructive">Order Disputed On-Chain</p>
                      {/* Refund status would depend on resolveDispute by owner */}
                    </div>
                  )}
                  {(order.status !== 'CompletedOnChain' && order.status !== 'DisputedOnChain') && (
                     <span className="text-muted-foreground">Pending...</span>
                  )}
                </TableCell>
              )}
              {isManagerView && <TableCell className="text-xs" title={order.paymentTransactionHash || undefined}>{truncateText(order.paymentTransactionHash, 12)}</TableCell>}
              {isManagerView && <TableCell className="text-xs" title={GANACHE_RECIPIENT_ADDRESS}>{truncateText(GANACHE_RECIPIENT_ADDRESS, 12)}</TableCell>}
              {isManagerView && <TableCell className="text-xs" title={order.contractConfirmationTxHash || undefined}>{truncateText(order.contractConfirmationTxHash, 12)}</TableCell>}
              <TableCell className="space-x-1 text-center">
                {canCreateOnChain && (
                  <Button variant="outline" size="sm" onClick={() => handleOpenAssignTransporterDialog(order)} disabled={actionOrderId === order.id || !!actionOrderId} className="h-8 px-2 text-blue-600 border-blue-600 hover:text-blue-700 hover:bg-blue-50" title="Assign Transporter & Create On-Chain">
                     {actionOrderId === order.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSignature className="h-4 w-4" />} <span className="ml-1">Finalize & Create On-Chain</span>
                  </Button>
                )}
                {canPayOnChain && (
                  <Button variant="outline" size="sm" onClick={() => handlePayWithMetamaskOnChain(order.id)} disabled={actionOrderId === order.id || !!actionOrderId} className="h-8 px-2" title="Fund Order On-Chain">
                    {actionOrderId === order.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wallet className="h-4 w-4" />} <span className={actionOrderId === order.id ? "sr-only" : "ml-1"}>Fund</span>
                  </Button>
                )}
                {canConfirmOrDenyOnChain && (
                  <>
                    <Button variant="outline" size="sm" onClick={() => handleCustomerConfirmReceiptOnChain(order.id)} disabled={actionOrderId === order.id || !!actionOrderId} className="h-8 px-2 text-green-600 border-green-600 hover:text-green-700" title="Confirm Delivery On-Chain">
                      {actionOrderId === order.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <ThumbsUp className="h-4 w-4" />} <span className="ml-1">Confirm</span>
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleDenyReceiptOnChain(order.id)} disabled={actionOrderId === order.id || !!actionOrderId} className="h-8 px-2 text-red-600 border-red-600 hover:text-red-700" title="Dispute Order On-Chain">
                      {actionOrderId === order.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <ThumbsDown className="h-4 w-4" />} <span className="ml-1">Dispute</span>
                    </Button>
                  </>
                )}
                {canEvaluate && (
                  <Button variant="outline" size="sm" onClick={() => handleOpenAssessmentDialog(order)} className="h-8 px-2 text-blue-600 border-blue-600 hover:text-blue-700 hover:bg-blue-50" title="Evaluate Service">
                    <Star className="h-4 w-4" /> <span className="ml-1">Evaluate</span>
                  </Button>
                )}
                {user?.role !== 'customer' && order.status !== 'Awaiting Supplier Confirmation' && order.status !== 'AwaitingOnChainCreation' && ( // Prevent deletion if pending supplier action
                  <Button variant="ghost" size="icon" onClick={() => handleDeleteOrder(order.id)} aria-label="Delete order" className="h-8 w-8" disabled={isCurrentUserSupplierSuspended && user?.role === 'supplier'}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                )}
                {isCurrentUserSupplierSuspended && user?.role === 'supplier' && canCreateOnChain && (
                    <Badge variant="destructive" className="text-xs"><Ban className="h-3 w-3 mr-1"/> Suspended</Badge>
                )}
                {/* Fallback display for other states */}
                {isCustomerView && !canPayOnChain && !canConfirmOrDenyOnChain && !canEvaluate && order.status !== 'CompletedOnChain' && order.status !== 'DisputedOnChain' && (
                     <Badge variant={getStatusBadgeVariant(order.status)} className="text-xs">Awaiting Action</Badge>
                )}
                 {isCustomerView && (order.status === 'CompletedOnChain' || order.status === 'DisputedOnChain') && !canEvaluate && (
                    <Badge variant={order.status === 'CompletedOnChain' ? 'default' : 'destructive'} className="text-xs bg-opacity-70">
                       <CheckCircle className="h-3 w-3 mr-1"/> {order.status === 'CompletedOnChain' ? 'Evaluated' : 'Disputed & Evaluated'}
                    </Badge>
                )}
              </TableCell>
            </TableRow>
          )})}
        </TableBody>
      </Table>
    </div>

    {isAssignTransporterDialogOpen && currentOrderToAssign && (
      <Dialog open={isAssignTransporterDialogOpen} onOpenChange={(isOpen) => { if (!isOpen) { setCurrentOrderToAssign(null); setSelectedTransporter(null); } setIsAssignTransporterDialogOpen(isOpen); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Assign Transporter & Create On-Chain</DialogTitle><DialogDescription>Order: {currentOrderToAssign.productName} for {currentOrderToAssign.customerName}</DialogDescription></DialogHeader>
          <div className="py-4 space-y-2">
            <p className="text-sm">Product Cost: ${currentOrderToAssign.totalAmount.toFixed(2)}</p>
            <p className="text-xs text-muted-foreground">Selected transporter's shipping fee will be added. This will then be created on the smart contract for customer funding.</p>
            
            {availableTransporters.length > 0 ? (
              <>
                <Label htmlFor="transporter-select">Select Transporter (Must have ETH address)</Label>
                <Select onValueChange={setSelectedTransporter} value={selectedTransporter || undefined}>
                  <SelectTrigger id="transporter-select"><SelectValue placeholder="Choose..." /></SelectTrigger>
                  <SelectContent>{availableTransporters.map(t => (<SelectItem key={t.id} value={t.id}>{t.name} ({truncateText(t.ethereumAddress,10)}) {t.averageTransporterRating !== undefined && (<span className="ml-2 text-xs text-muted-foreground">(<Star className="inline-block h-3 w-3 mr-0.5 text-yellow-400 fill-yellow-400" />{t.averageTransporterRating.toFixed(1)} - {t.transporterRatingCount} ratings)</span>)}</SelectItem>))}
                  </SelectContent>
                </Select>
              </>
            ) : (
              <div className="p-4 text-sm text-muted-foreground text-center border rounded-md bg-secondary/50">
                <Info className="h-5 w-5 mx-auto mb-2 text-primary" />
                No transporters are currently eligible (must be approved, not suspended, have ETH address, and shipping rates set).
              </div>
            )}
          </div>
          <DialogFooter>
            <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
            <Button 
              type="button" 
              onClick={handleConfirmAssignTransporter} 
              disabled={!selectedTransporter || actionOrderId === currentOrderToAssign.id || !!actionOrderId || availableTransporters.length === 0}
            >
              {(actionOrderId === currentOrderToAssign.id) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirm & Create On-Chain
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )}

    {isAssessmentDialogOpen && currentOrderForAssessment && (
      <Dialog open={isAssessmentDialogOpen} onOpenChange={handleCloseAssessmentDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>Evaluate Order #{currentOrderForAssessment.id.substring(0,6)}</DialogTitle><DialogDescription>Product: {currentOrderForAssessment.productName}</DialogDescription></DialogHeader>
          <div className="py-4 space-y-6">
            <div className="space-y-2 p-4 border rounded-md"><h3 className="text-md font-semibold">Supplier: {currentOrderForAssessment.supplierName}</h3><div><Label htmlFor="supplierRating">Rating (1-5)</Label><Input id="supplierRating" type="number" min="1" max="5" value={supplierRating} onChange={(e) => setSupplierRating(e.target.value)} placeholder="5"/></div><div><Label htmlFor="supplierFeedback">Feedback</Label><Textarea id="supplierFeedback" value={supplierFeedback} onChange={(e) => setSupplierFeedback(e.target.value)} placeholder="Comments..." rows={3}/></div></div>
            {currentOrderForAssessment.transporterId && (<div className="space-y-2 p-4 border rounded-md"><h3 className="text-md font-semibold">Transporter: {currentOrderForAssessment.transporterName}</h3><div><Label htmlFor="transporterRating">Rating (1-5)</Label><Input id="transporterRating" type="number" min="1" max="5" value={transporterRating} onChange={(e) => setTransporterRating(e.target.value)} placeholder="5"/></div><div><Label htmlFor="transporterFeedback">Feedback</Label><Textarea id="transporterFeedback" value={transporterFeedback} onChange={(e) => setTransporterFeedback(e.target.value)} placeholder="Comments..." rows={3}/></div></div>)}
          </div>
          <DialogFooter><DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose><Button type="button" onClick={handleSubmitAssessment} disabled={isSubmittingAssessment}>{isSubmittingAssessment && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Submit</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    )}
    </>
  );
}
