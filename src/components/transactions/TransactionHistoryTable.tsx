
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
import { Trash2, Wallet, Loader2, Eye, ThumbsUp, Truck, AlertTriangle, ThumbsDown, Star, CheckCircle, Ban, Edit, Info, Hash, KeyRound, CircleDollarSign } from 'lucide-react';
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


const GANACHE_RECIPIENT_ADDRESS = "0x83491285C0aC3dd64255A5D68f0C3e919A5Eacf2";
const FALLBACK_SIMULATED_ETH_USD_PRICE = 2000;

// Helper function to calculate tiered shipping price
const calculateTieredShippingPrice = (distanceKm: number, rates?: UserShippingRates): number | null => {
  if (!rates || rates.tier1_0_100_km_price === undefined || rates.tier2_101_500_km_price_per_km === undefined || rates.tier3_501_1000_km_price_per_km === undefined) {
    return null; // Rates not fully set
  }
  const { tier1_0_100_km_price, tier2_101_500_km_price_per_km, tier3_501_1000_km_price_per_km } = rates;

  if (distanceKm <= 0) return 0;
  if (distanceKm <= 100) return tier1_0_100_km_price;

  let price = tier1_0_100_km_price;
  if (distanceKm <= 500) {
    price += (distanceKm - 100) * tier2_101_500_km_price_per_km;
    return price;
  }

  price += (400) * tier2_101_500_km_price_per_km; // Full price for 101-500km segment
  if (distanceKm <= 1000) {
    price += (distanceKm - 500) * tier3_501_1000_km_price_per_km;
    return price;
  }

  // For distances > 1000km
  price += (500) * tier3_501_1000_km_price_per_km; // Full price for 501-1000km segment
  price += (distanceKm - 1000) * tier3_501_1000_km_price_per_km; // Use tier 3 rate for the remainder
  return price;
};


const getStatusBadgeVariant = (status: OrderStatus | OrderShipmentStatus): "default" | "secondary" | "destructive" | "outline" => {
  switch (status) {
    case 'Paid': return 'default';
    case 'Delivered': return 'default'; 
    case 'Receipt Confirmed': return 'default';
    case 'Completed': return 'default';
    case 'Shipped': return 'secondary';
    case 'Ready for Pickup': return 'secondary';
    case 'In Transit': return 'secondary';
    case 'Out for Delivery': return 'secondary';
    case 'Awaiting Supplier Confirmation': return 'outline';
    case 'Awaiting Transporter Assignment': return 'outline';
    case 'Awaiting Payment': return 'outline';
    case 'Pending': return 'outline';
    case 'Cancelled': return 'destructive';
    case 'Delivery Failed': return 'destructive';
    case 'Shipment Cancelled': return 'destructive';
    case 'Disputed': return 'destructive';
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
  const [payingOrderId, setPayingOrderId] = useState<string | null>(null);
  const [assigningTransporterOrderId, setAssigningTransporterOrderId] = useState<string | null>(null);
  const [confirmingReceiptOrderId, setConfirmingReceiptOrderId] = useState<string | null>(null);
  const [denyingReceiptOrderId, setDenyingReceiptOrderId] = useState<string | null>(null);
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
    typeof u.shippingRates.tier3_501_1000_km_price_per_km === 'number'
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

  const handlePayWithMetamask = useCallback(async (orderId: string): Promise<boolean> => {
    const orderToPay = orders.find(o => o.id === orderId);
    if (!orderToPay) {
      toast({ title: "Error", description: "Order not found.", variant: "destructive" });
      return false;
    }

    const amountToPay = orderToPay.finalTotalAmount ?? orderToPay.totalAmount;

    if (amountToPay <= 0) {
      toast({ title: "Payment Error", description: "Order amount must be > 0.", variant: "destructive" });
      return false;
    }
    if (typeof window.ethereum === 'undefined') {
      toast({ title: "Metamask Not Found", description: "Please install Metamask.", variant: "destructive" });
      return false;
    }

    setPayingOrderId(orderId);
    const currentEthUsdPrice = await fetchEthPrice();
    const ethAmount = parseFloat((amountToPay / currentEthUsdPrice).toFixed(18));
    toast({ title: "Initiating Payment", description: `Order: ${amountToPay.toFixed(2)} USD. Sending: ${ethAmount.toFixed(6)} ETH. Confirm in Metamask.` });

    try {
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' }) as string[];
      if (!accounts || accounts.length === 0) {
        toast({ title: "Connection Failed", description: "No accounts in Metamask.", variant: "destructive" });
        return false;
      }
      const amountInWei = BigInt(Math.floor(ethAmount * 1e18));
      if (amountInWei <= 0) {
        toast({ title: "Payment Error", description: "Calculated ETH amount too small.", variant: "destructive" });
        return false;
      }
      const txHash = await window.ethereum.request({
        method: 'eth_sendTransaction',
        params: [{ to: GANACHE_RECIPIENT_ADDRESS, from: accounts[0], value: '0x' + amountInWei.toString(16) }],
      }) as string;
      toast({ title: "Transaction Submitted", description: `Tx Hash: ${txHash.substring(0,10)}... Simulating confirmation.` });

      await new Promise(resolve => setTimeout(resolve, 4000));
      const orderRef = doc(db, "orders", orderId);
      await updateDoc(orderRef, {
        status: 'Paid' as OrderStatus,
        paymentTransactionHash: txHash
      });
      toast({ title: "Payment Confirmed (Simulated Escrow)", description: `Order marked as Paid. Funds are now held.`, variant: "default" });

      if (orderToPay.productId && orderToPay.quantity > 0) {
        const productRef = doc(db, "products", orderToPay.productId);
        await runTransaction(db, async (transaction) => {
          const productDoc = await transaction.get(productRef);
          if (!productDoc.exists()) throw new Error("Product not found for stock update.");
          const newStock = Math.max(0, (productDoc.data().stockQuantity || 0) - orderToPay.quantity);
          transaction.update(productRef, { stockQuantity: newStock });
          toast({ title: "Stock Updated", description: `Stock for ${orderToPay.productName} reduced. New stock: ${newStock}.` });
        });
      }
      return true;
    } catch (error: any) {
      toast({ title: "Payment Error", description: error.message || "Metamask payment failed.", variant: "destructive" });
      return false;
    } finally {
      setPayingOrderId(null);
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

  const handleAssignTransporter = async () => {
    if (user?.isSuspended) {
      toast({ title: "Action Denied", description: "Your account is suspended.", variant: "destructive" });
      setIsAssignTransporterDialogOpen(false);
      return;
    }
    if (!currentOrderToAssign || !selectedTransporter || !user) {
      toast({ title: "Error", description: "Select transporter or order details missing.", variant: "destructive" });
      return;
    }
    setAssigningTransporterOrderId(currentOrderToAssign.id);
    const transporterUser = allUsersList.find(u => u.id === selectedTransporter);
    if (!transporterUser) {
      toast({ title: "Error", description: "Selected transporter not found.", variant: "destructive" });
      setAssigningTransporterOrderId(null);
      return;
    }
     if (!transporterUser.shippingRates ||
        typeof transporterUser.shippingRates.tier1_0_100_km_price !== 'number' ||
        typeof transporterUser.shippingRates.tier2_101_500_km_price_per_km !== 'number' ||
        typeof transporterUser.shippingRates.tier3_501_1000_km_price_per_km !== 'number') {
        toast({ title: "Rates Incomplete", description: `${transporterUser.name} has not fully set their shipping rates. Cannot assign.`, variant: "destructive", duration: 7000 });
        setAssigningTransporterOrderId(null);
        return;
    }


    let supplierAddress = 'N/A', customerAddress = 'N/A';
    let predictedDeliveryTimestamp: Timestamp | null = null;
    let calculatedTransporterFee: number | null = null;
    let finalTotalOrderAmount: number = currentOrderToAssign.totalAmount;


    try {
      const supplierDetails = allUsersList.find(u => u.id === currentOrderToAssign.supplierId);
      if (supplierDetails?.address) supplierAddress = supplierDetails.address;
      const customerDetails = allUsersList.find(u => u.id === currentOrderToAssign.customerId);
      if (customerDetails?.address) customerAddress = customerDetails.address;

      let distanceKm: number | undefined;
      let distanceNote: string | undefined;

      if (supplierAddress !== 'N/A' && customerAddress !== 'N/A') {
        const distanceInput = { 
            originAddress: supplierAddress, 
            destinationAddress: customerAddress,
            orderCreationDate: (currentOrderToAssign.orderDate as Timestamp).toDate().toISOString() 
        };
        const distanceInfo = await calculateDistance(distanceInput);
        distanceKm = distanceInfo.distanceKm;
        distanceNote = distanceInfo.note;
        if (distanceInfo.predictedDeliveryIsoDate) {
          const parsedDate = new Date(distanceInfo.predictedDeliveryIsoDate);
          if (!isNaN(parsedDate.getTime())) predictedDeliveryTimestamp = Timestamp.fromDate(parsedDate);
        }

        if (distanceKm !== undefined) {
          calculatedTransporterFee = calculateTieredShippingPrice(distanceKm, transporterUser.shippingRates);
          if (calculatedTransporterFee !== null) {
            finalTotalOrderAmount = currentOrderToAssign.totalAmount + calculatedTransporterFee;
            toast({ title: "Logistics Estimated", description: `Delivery: ${predictedDeliveryTimestamp ? format(predictedDeliveryTimestamp.toDate(), "MMM d, yyyy") : 'N/A'}. Fee: $${calculatedTransporterFee.toFixed(2)}. New Total: $${finalTotalOrderAmount.toFixed(2)}. Note: ${distanceInfo.note || ''}`});
          } else {
             toast({title: "Transporter Rates Missing", description: `${transporterUser.name} has not set their shipping rates. Cannot calculate shipping fee. Using product total.`, variant: "destructive", duration: 8000});
          }
        } else {
          toast({title: "Distance Error", description: `Could not estimate distance. ${distanceNote || ''} Using product total.`, variant: "outline"});
        }
      } else {
        toast({title: "Address Info Missing", description: "Supplier or customer address not found. Cannot accurately estimate delivery/fee. Using product total.", variant: "outline"});
      }
    } catch (err) {
      toast({title: "Distance/Fee Error", description: "Could not estimate delivery/fee. Using product total.", variant: "outline"});
    }

    try {
      const orderRef = doc(db, "orders", currentOrderToAssign.id);
      const updateData: Partial<StoredOrder> = {
        transporterId: selectedTransporter,
        transporterName: transporterUser.name,
        status: 'Awaiting Payment' as OrderStatus,
        shipmentStatus: 'Ready for Pickup' as OrderShipmentStatus,
        pickupAddress: supplierAddress,
        deliveryAddress: customerAddress,
        estimatedTransporterFee: calculatedTransporterFee ?? undefined,
        finalTotalAmount: finalTotalOrderAmount,
      };
      if (predictedDeliveryTimestamp) updateData.predictedDeliveryDate = predictedDeliveryTimestamp;

      await updateDoc(orderRef, updateData);
      toast({ title: "Transporter Assigned & Final Price Set", description: `${transporterUser.name} assigned. Order status updated to 'Awaiting Payment' with final price $${finalTotalOrderAmount.toFixed(2)}.` });
      setIsAssignTransporterDialogOpen(false);
    } catch (error) {
      toast({ title: "Error", description: "Could not assign transporter or finalize price.", variant: "destructive" });
    } finally {
      setAssigningTransporterOrderId(null);
    }
  };

  const handleCustomerConfirmReceipt = async (orderId: string) => {
    setConfirmingReceiptOrderId(orderId);
    const order = orders.find(o => o.id === orderId);
    if (!order) {
       toast({ title: "Error", description: "Order not found.", variant: "destructive" });
       setConfirmingReceiptOrderId(null);
       return;
    }

    try {
      const orderRef = doc(db, "orders", orderId);
      const basisAmount = order.finalTotalAmount ?? order.totalAmount;
      const transporterFee = order.estimatedTransporterFee !== undefined && order.estimatedTransporterFee !== null ? order.estimatedTransporterFee : 0;
      const supplierPayout = basisAmount - transporterFee;

      const supplierUser = allUsersList.find(u => u.id === order.supplierId);
      const transporterUser = order.transporterId ? allUsersList.find(u => u.id === order.transporterId) : null;

      const updatePayload: Partial<StoredOrder> = {
        status: 'Completed' as OrderStatus,
        supplierPayoutAmount: supplierPayout,
        transporterPayoutAmount: transporterFee,
        payoutTimestamp: serverTimestamp(),
        supplierPayoutAddress: supplierUser?.ethereumAddress || undefined,
        transporterPayoutAddress: transporterUser?.ethereumAddress || undefined,
      };

      await updateDoc(orderRef, updatePayload);

      let toastDescription = `Simulated Payouts: Supplier ($${supplierPayout.toFixed(2)} to ${updatePayload.supplierPayoutAddress || 'address not set'})`;
      if (transporterFee > 0 && order.transporterId) {
        toastDescription += ` and Transporter ($${transporterFee.toFixed(2)} to ${updatePayload.transporterPayoutAddress || 'address not set'}).`;
      } else {
        toastDescription += ".";
      }
      
      toast({ title: "Receipt Confirmed & Order Completed!", description: toastDescription });

    } catch (error) {
      console.error("Error confirming receipt and processing payout:", error);
      const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
      toast({ 
        title: "Confirmation Error", 
        description: `Could not confirm receipt and process payout. ${errorMessage}`, 
        variant: "destructive" 
      });
    } finally {
      setConfirmingReceiptOrderId(null);
    }
  };

  const handleDenyReceipt = async (orderId: string) => {
    setDenyingReceiptOrderId(orderId);
    try {
      const orderRef = doc(db, "orders", orderId);
      await updateDoc(orderRef, {
        status: 'Disputed' as OrderStatus,
        refundTimestamp: serverTimestamp()
      });
      toast({ title: "Receipt Denied", description: "Delivery issue reported. Funds returned to customer (simulated)." });
    } catch (error) {
      toast({ title: "Error", description: "Could not deny receipt.", variant: "destructive" });
    } finally {
      setDenyingReceiptOrderId(null);
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
            {isManagerView && <TableHead>Customer ID</TableHead>}
            {isManagerView && <TableHead>Supplier ID</TableHead>}
            {isManagerView && <TableHead>Transporter ID</TableHead>}
            <TableHead className="text-right">Amount</TableHead>
            <TableHead className="text-right">Quantity</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Shipment Status</TableHead>
            <TableHead>Predicted Delivery</TableHead>
            {isCustomerView && <TableHead>Transaction Outcome</TableHead>}
            {isManagerView && <TableHead title="Payment Transaction Hash"><Hash className="inline-block h-4 w-4 mr-1"/>Hash</TableHead>}
            {isManagerView && <TableHead title="Simulated Recipient Address"><KeyRound className="inline-block h-4 w-4 mr-1"/>Recipient</TableHead>}
            <TableHead className="w-[200px] text-center">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {orders.map((order) => {
            const displayDate = order.orderDate || (order as any).date;
            const productName = order.productName || (order as any).fruitType;

            const canPay = isCustomerView && order.status === 'Awaiting Payment';
            const canConfirmOrDeny = isCustomerView && order.status === 'Delivered' && !order.assessmentSubmitted;
            const canEvaluate = isCustomerView && (order.status === 'Completed' || order.status === 'Disputed') && !order.assessmentSubmitted;

            const supplierForOrder = allUsersList.find(u => u.id === order.supplierId);
            const transporterForOrder = order.transporterId ? allUsersList.find(u => u.id === order.transporterId) : null;
            const isCurrentUserSupplierSuspended = user?.role === 'supplier' && user?.isSuspended;

            const displayAmount = (order.status === 'Awaiting Payment' || order.status === 'Paid' || order.status === 'Delivered' || order.status === 'Receipt Confirmed' || order.status === 'Completed' || order.status === 'Disputed') && order.finalTotalAmount !== undefined
                                ? order.finalTotalAmount
                                : order.totalAmount;

            return (
            <TableRow key={order.id}>
              <TableCell>{order.FruitIcon ? <order.FruitIcon className="h-6 w-6 text-accent" /> : <FruitIcon className="h-6 w-6 text-gray-400" />}</TableCell>
              <TableCell>{displayDate ? format((displayDate as Timestamp).toDate(), "MMM d, yyyy") : 'N/A'}</TableCell>
              <TableCell className="font-medium">{productName}</TableCell>
              {!isCustomerView && <TableCell>{order.customerName}</TableCell>}
              {isCustomerView && (
                <TableCell>
                  {order.supplierName}
                  {supplierForOrder?.averageSupplierRating !== undefined && (<Badge variant="outline" className="ml-1 text-xs font-normal py-0.5"><Star className="h-3 w-3 mr-1 text-yellow-400 fill-yellow-400" />{supplierForOrder.averageSupplierRating.toFixed(1)}</Badge>)}
                </TableCell>
              )}
              <TableCell>
                {order.transporterName || 'N/A'}
                {transporterForOrder?.averageTransporterRating !== undefined && (<Badge variant="outline" className="ml-1 text-xs font-normal py-0.5"><Star className="h-3 w-3 mr-1 text-yellow-400 fill-yellow-400" />{transporterForOrder.averageTransporterRating.toFixed(1)}</Badge>)}
              </TableCell>
              {isManagerView && <TableCell className="text-xs" title={order.customerId}>{truncateText(order.customerId, 8)}</TableCell>}
              {isManagerView && <TableCell className="text-xs" title={order.supplierId}>{truncateText(order.supplierId, 8)}</TableCell>}
              {isManagerView && <TableCell className="text-xs" title={order.transporterId || undefined}>{truncateText(order.transporterId, 8)}</TableCell>}
              <TableCell className="text-right">{order.currency} {displayAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
              <TableCell className="text-right">{order.quantity.toLocaleString()} {order.unit}</TableCell>
              <TableCell><Badge variant={getStatusBadgeVariant(order.status)}>{order.status}</Badge></TableCell>
              <TableCell>{order.shipmentStatus ? <Badge variant={getStatusBadgeVariant(order.shipmentStatus)}>{order.shipmentStatus}</Badge> : <span className="text-xs text-muted-foreground">N/A</span>}</TableCell>
              <TableCell>{order.predictedDeliveryDate ? format((order.predictedDeliveryDate as Timestamp).toDate(), "MMM d, yyyy") : <span className="text-xs text-muted-foreground">N/A</span>}</TableCell>
              {isCustomerView && (
                <TableCell className="text-xs">
                  {order.status === 'Completed' && (
                    <div className="space-y-0.5">
                      {order.supplierPayoutAmount !== undefined && (
                        <p className="flex items-center" title={order.supplierPayoutAddress || 'Supplier address not set'}>
                          <CircleDollarSign className="h-3 w-3 mr-1 text-green-600" />
                          Supplier: ${order.supplierPayoutAmount.toFixed(2)} (to: {truncateText(order.supplierPayoutAddress, 6) || 'N/A'})
                        </p>
                      )}
                      {order.transporterPayoutAmount !== undefined && order.transporterId && (
                        <p className="flex items-center" title={order.transporterPayoutAddress || 'Transporter address not set'}>
                           <CircleDollarSign className="h-3 w-3 mr-1 text-blue-600" />
                          Transporter: ${order.transporterPayoutAmount.toFixed(2)} (to: {truncateText(order.transporterPayoutAddress, 6) || 'N/A'})
                        </p>
                      )}
                      {order.payoutTimestamp && (
                        <p className="text-muted-foreground">
                          Released: {format((order.payoutTimestamp as Timestamp).toDate(), "MMM d, yy")}
                        </p>
                      )}
                    </div>
                  )}
                  {order.status === 'Disputed' && (
                    <div className="space-y-0.5">
                      <p className="text-destructive">Funds Refunded (Simulated)</p>
                      {order.refundTimestamp && (
                        <p className="text-muted-foreground">
                          Processed: {format((order.refundTimestamp as Timestamp).toDate(), "MMM d, yy")}
                        </p>
                      )}
                    </div>
                  )}
                  {(order.status !== 'Completed' && order.status !== 'Disputed') && (
                     <span className="text-muted-foreground">Pending...</span>
                  )}
                </TableCell>
              )}
              {isManagerView && <TableCell className="text-xs" title={order.paymentTransactionHash || undefined}>{truncateText(order.paymentTransactionHash, 12)}</TableCell>}
              {isManagerView && <TableCell className="text-xs" title={GANACHE_RECIPIENT_ADDRESS}>{truncateText(GANACHE_RECIPIENT_ADDRESS, 12)}</TableCell>}
              <TableCell className="space-x-1 text-center">
                {canPay && (
                  <Button variant="outline" size="sm" onClick={() => handlePayWithMetamask(order.id)} disabled={payingOrderId === order.id || !!payingOrderId} className="h-8 px-2" title="Pay with Metamask">
                    {payingOrderId === order.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wallet className="h-4 w-4" />} <span className={payingOrderId === order.id ? "sr-only" : "ml-1"}>Pay</span>
                  </Button>
                )}
                {canConfirmOrDeny && (
                  <>
                    <Button variant="outline" size="sm" onClick={() => handleCustomerConfirmReceipt(order.id)} disabled={confirmingReceiptOrderId === order.id || !!confirmingReceiptOrderId || !!denyingReceiptOrderId} className="h-8 px-2 text-green-600 border-green-600 hover:text-green-700" title="Confirm Receipt">
                      {confirmingReceiptOrderId === order.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <ThumbsUp className="h-4 w-4" />} <span className="ml-1">Confirm</span>
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleDenyReceipt(order.id)} disabled={denyingReceiptOrderId === order.id || !!denyingReceiptOrderId || !!confirmingReceiptOrderId} className="h-8 px-2 text-red-600 border-red-600 hover:text-red-700" title="Deny Receipt / Report Issue">
                      {denyingReceiptOrderId === order.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <ThumbsDown className="h-4 w-4" />} <span className="ml-1">Deny</span>
                    </Button>
                  </>
                )}
                {canEvaluate && (
                  <Button variant="outline" size="sm" onClick={() => handleOpenAssessmentDialog(order)} className="h-8 px-2 text-blue-600 border-blue-600 hover:text-blue-700 hover:bg-blue-50" title="Evaluate Service">
                    <Star className="h-4 w-4" /> <span className="ml-1">Evaluate</span>
                  </Button>
                )}
                {!isCustomerView && user?.role === 'supplier' && order.status === 'Awaiting Supplier Confirmation' && (
                  <Button variant="outline" size="sm" onClick={() => handleOpenAssignTransporterDialog(order)} disabled={assigningTransporterOrderId === order.id || !!assigningTransporterOrderId || isCurrentUserSupplierSuspended} className="h-8 px-2 text-blue-600 border-blue-600 hover:text-blue-700 hover:bg-blue-50" title="Assign Transporter & Finalize Price">
                     {assigningTransporterOrderId === order.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Edit className="h-4 w-4" />} <span className="ml-1">Finalize & Assign</span>
                  </Button>
                )}

                {user?.role !== 'customer' && (
                  <Button variant="ghost" size="icon" onClick={() => handleDeleteOrder(order.id)} aria-label="Delete order" className="h-8 w-8" disabled={isCurrentUserSupplierSuspended && user?.role === 'supplier'}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                )}
                {isCurrentUserSupplierSuspended && !isCustomerView && user?.role === 'supplier' && (order.status === 'Awaiting Supplier Confirmation') && (
                    <Badge variant="destructive" className="text-xs"><Ban className="h-3 w-3 mr-1"/> Suspended</Badge>
                )}
                {isCustomerView && !canPay && !canConfirmOrDeny && !canEvaluate && order.status !== 'Completed' && order.status !== 'Disputed' && (
                     <Badge variant={getStatusBadgeVariant(order.status)} className="text-xs">Awaiting Action</Badge>
                )}
                 {isCustomerView && (order.status === 'Completed' || order.status === 'Disputed') && !canEvaluate && (
                    <Badge variant={order.status === 'Completed' ? 'default' : 'destructive'} className="text-xs bg-opacity-70">
                       <CheckCircle className="h-3 w-3 mr-1"/> {order.status === 'Completed' ? 'Evaluated' : 'Disputed & Evaluated'}
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
          <DialogHeader><DialogTitle>Assign Transporter & Set Final Price</DialogTitle><DialogDescription>Order: {currentOrderToAssign.productName} for {currentOrderToAssign.customerName}</DialogDescription></DialogHeader>
          <div className="py-4 space-y-2">
            <p className="text-sm">Product Cost: ${currentOrderToAssign.totalAmount.toFixed(2)}</p>
            <p className="text-xs text-muted-foreground">Selected transporter's shipping fee will be added to this to get the final price for the customer.</p>
            
            {availableTransporters.length > 0 ? (
              <>
                <Label htmlFor="transporter-select">Select Transporter</Label>
                <Select onValueChange={setSelectedTransporter} value={selectedTransporter || undefined}>
                  <SelectTrigger id="transporter-select"><SelectValue placeholder="Choose..." /></SelectTrigger>
                  <SelectContent>{availableTransporters.map(t => (<SelectItem key={t.id} value={t.id}>{t.name}{t.averageTransporterRating !== undefined && (<span className="ml-2 text-xs text-muted-foreground">(<Star className="inline-block h-3 w-3 mr-0.5 text-yellow-400 fill-yellow-400" />{t.averageTransporterRating.toFixed(1)} - {t.transporterRatingCount} ratings)</span>)}</SelectItem>))}
                  </SelectContent>
                </Select>
              </>
            ) : (
              <div className="p-4 text-sm text-muted-foreground text-center border rounded-md bg-secondary/50">
                <Info className="h-5 w-5 mx-auto mb-2 text-primary" />
                No transporters are currently eligible for assignment. They may need to set up their shipping rates.
              </div>
            )}
          </div>
          <DialogFooter>
            <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
            <Button 
              type="button" 
              onClick={handleAssignTransporter} 
              disabled={!selectedTransporter || assigningTransporterOrderId === currentOrderToAssign.id || !!assigningTransporterOrderId || availableTransporters.length === 0}
            >
              {(assigningTransporterOrderId === currentOrderToAssign.id) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirm & Set Price
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

