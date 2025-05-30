
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
import { Trash2, Wallet, Loader2, Eye, ThumbsUp, Truck, AlertTriangle, ThumbsDown, Star } from 'lucide-react';
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
  runTransaction
} from 'firebase/firestore';
import { useAuth, type User as AuthUser } from '@/contexts/AuthContext';
import { calculateDistance, type CalculateDistanceOutput } from '@/ai/flows/calculate-distance-flow';


const GANACHE_RECIPIENT_ADDRESS = "0x83491285C0aC3dd64255A5D68f0C3e919A5Eacf2";
const FALLBACK_SIMULATED_ETH_USD_PRICE = 2000;

const getStatusBadgeVariant = (status: OrderStatus | OrderShipmentStatus): "default" | "secondary" | "destructive" | "outline" => {
  switch (status) {
    case 'Paid': return 'default';
    case 'Delivered': return 'default'; // Main status when shipment is delivered
    case 'Receipt Confirmed': return 'default';
    case 'Shipped': return 'secondary'; // Main status when shipment is in progress
    case 'Ready for Pickup': return 'secondary'; // Shipment status
    case 'In Transit': return 'secondary'; // Shipment status
    case 'Out for Delivery': return 'secondary'; // Shipment status
    case 'Awaiting Supplier Confirmation': return 'outline';
    case 'Awaiting Transporter Assignment': return 'outline';
    case 'Awaiting Payment': return 'outline';
    case 'Pending': return 'outline';
    case 'Cancelled': return 'destructive';
    case 'Delivery Failed': return 'destructive'; // Shipment status
    case 'Shipment Cancelled': return 'destructive'; // Shipment status
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
  const [confirmingOrderId, setConfirmingOrderId] = useState<string | null>(null);
  const [assigningTransporterOrderId, setAssigningTransporterOrderId] = useState<string | null>(null);
  const [confirmingReceiptOrderId, setConfirmingReceiptOrderId] = useState<string | null>(null);
  const [denyingReceiptOrderId, setDenyingReceiptOrderId] = useState<string | null>(null);
  const [isAssignTransporterDialogOpen, setIsAssignTransporterDialogOpen] = useState(false);
  const [currentOrderToAssign, setCurrentOrderToAssign] = useState<StoredOrder | null>(null);
  const [selectedTransporter, setSelectedTransporter] = useState<string | null>(null);

  // State for Assessment Dialog
  const [isAssessmentDialogOpen, setIsAssessmentDialogOpen] = useState(false);
  const [currentOrderForAssessment, setCurrentOrderForAssessment] = useState<StoredOrder | null>(null);
  const [supplierRating, setSupplierRating] = useState('');
  const [supplierFeedback, setSupplierFeedback] = useState('');
  const [transporterRating, setTransporterRating] = useState('');
  const [transporterFeedback, setTransporterFeedback] = useState('');
  const [isSubmittingAssessment, setIsSubmittingAssessment] = useState(false);

  const { toast } = useToast();
  const { user, allUsersList } = useAuth();

  const availableTransporters = allUsersList.filter(u => u.role === 'transporter' && u.isApproved);

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

    console.log(`[TransactionHistoryTable] Setting up listener for role: ${currentRole}, User ID: ${user.id}`);

    if (currentRole === 'supplier') {
      ordersQuery = query(
        collection(db, "orders"),
        where("supplierId", "==", user.id)
        // orderBy("orderDate", "desc") // Temporarily removed for client-side sort
      );
    } else if (currentRole === 'manager') {
      ordersQuery = query(collection(db, "orders"), orderBy("orderDate", "desc"));
    } else {
      setOrders([]);
      setIsLoading(false);
      return;
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
      
      // Client-side sorting for supplier view if orderBy is removed from query
      if (currentRole === 'supplier') {
        fetchedOrders.sort((a, b) => {
            const dateA = (a.orderDate as Timestamp)?.toMillis() || 0;
            const dateB = (b.orderDate as Timestamp)?.toMillis() || 0;
            return dateB - dateA;
        });
        console.log(`[TransactionHistoryTable] Supplier ${user.id} fetched ${fetchedOrders.length} orders (client-sorted):`, fetchedOrders);
      } else if (currentRole === 'manager') {
         console.log(`[TransactionHistoryTable] Manager fetched ${fetchedOrders.length} orders:`, fetchedOrders);
      }

      setOrders(fetchedOrders);
      setIsLoading(false);
    }, (error) => {
      console.error(`[TransactionHistoryTable] Error fetching orders from Firestore for role ${currentRole}:`, error);
      toast({
        title: "Firestore Query Error",
        description: `Failed to fetch orders: ${error.message}. If this is an index error, please create the required composite index in your Firebase console.`,
        variant: "destructive",
        duration: 15000,
      });
      setIsLoading(false);
      setOrders([]);
    });

    return () => {
      console.log("[TransactionHistoryTable] Unsubscribing from Firestore listener.");
      unsubscribe();
    };
  }, [user, isCustomerView, initialOrders, toast]);


  const handleDeleteOrder = async (orderId: string) => {
    if (user?.role === 'customer') {
        toast({ title: "Action Not Allowed", description: "Customers cannot delete orders. Please contact support.", variant: "destructive"});
        return;
    }
    if (!confirm("Are you sure you want to delete this order? This action cannot be undone.")) {
      return;
    }
    try {
      await deleteDoc(doc(db, "orders", orderId));
      toast({ title: "Order Deleted", description: "The order has been removed from Firestore." });
    } catch (error) {
      console.error("Error deleting order from Firestore:", error);
      toast({ title: "Error Deleting Order", description: (error as Error).message, variant: "destructive" });
    }
  };

  const fetchEthPrice = async (): Promise<number> => {
    toast({
      title: "Fetching Live ETH Price...",
      description: "Getting the latest ETH to USD conversion rate from CoinGecko.",
    });
    try {
      const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd');
      if (!response.ok) {
        throw new Error(`CoinGecko API responded with status: ${response.status}`);
      }
      const data = await response.json();
      const price = data?.ethereum?.usd;
      if (typeof price !== 'number') {
        throw new Error("Invalid price format from CoinGecko API.");
      }
      toast({
        title: "Live ETH Price Fetched",
        description: `1 ETH = $${price.toFixed(2)} USD`,
      });
      return price;
    } catch (error) {
      console.error("Failed to fetch ETH price from CoinGecko:", error);
      toast({
        title: "Live Price Error",
        description: `Could not fetch live ETH price. Using fallback rate: 1 ETH = $${FALLBACK_SIMULATED_ETH_USD_PRICE.toFixed(2)} USD. Error: ${(error as Error).message}`,
        variant: "destructive",
        duration: 7000,
      });
      return FALLBACK_SIMULATED_ETH_USD_PRICE;
    }
  };

  const handlePayWithMetamask = useCallback(async (orderId: string): Promise<boolean> => {
    const orderToPay = orders.find(o => o.id === orderId);
    if (!orderToPay) {
      toast({ title: "Error", description: "Order not found.", variant: "destructive" });
      return false;
    }
     if (orderToPay.totalAmount <= 0) {
      toast({ title: "Payment Error", description: "Order amount must be greater than zero to pay.", variant: "destructive" });
      return false;
    }
    if (GANACHE_RECIPIENT_ADDRESS === "YOUR_GANACHE_ACCOUNT_ADDRESS_HERE") {
      toast({
        title: "Configuration Needed",
        description: "Please set your Ganache recipient address in TransactionHistoryTable.tsx.",
        variant: "destructive",
        duration: 10000,
      });
      return false;
    }
    if (typeof window.ethereum === 'undefined') {
      toast({ title: "Metamask Not Found", description: "Please install Metamask to use this feature.", variant: "destructive" });
      return false;
    }

    setPayingOrderId(orderId);
    let currentEthUsdPrice: number;
    try {
      currentEthUsdPrice = await fetchEthPrice();
    } catch (priceError) {
      currentEthUsdPrice = FALLBACK_SIMULATED_ETH_USD_PRICE;
    }
    const ethAmount = orderToPay.totalAmount / currentEthUsdPrice;
    const ethAmountFixed = parseFloat(ethAmount.toFixed(18));

    toast({
      title: "Initiating Payment",
      description: `Order Total: ${orderToPay.totalAmount.toFixed(2)} USD. ETH to send: ${ethAmountFixed.toFixed(6)} ETH (at 1 ETH = $${currentEthUsdPrice.toFixed(2)} USD). Confirm in Metamask.`
    });

    try {
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' }) as string[];
      if (!accounts || accounts.length === 0) {
        toast({ title: "Connection Failed", description: "No accounts found in Metamask.", variant: "destructive" });
        setPayingOrderId(null);
        return false;
      }
      const fromAccount = accounts[0];
      const amountInWei = BigInt(Math.floor(ethAmountFixed * 1e18));
      if (amountInWei <= 0) {
        toast({ title: "Payment Error", description: "Calculated ETH amount is too small or zero. Please check order total and ETH price.", variant: "destructive" });
        setPayingOrderId(null);
        return false;
      }
      const transactionParameters = {
        to: GANACHE_RECIPIENT_ADDRESS,
        from: fromAccount,
        value: '0x' + amountInWei.toString(16),
      };
      toast({
        title: "Sending to Smart Contract (Simulated)",
        description: `Sending ${ethAmountFixed.toFixed(6)} ETH. Awaiting your confirmation in Metamask...`
      });
      const txHash = await window.ethereum.request({
        method: 'eth_sendTransaction',
        params: [transactionParameters],
      }) as string;
      toast({
        title: "Transaction Submitted to Ganache",
        description: `Tx Hash: ${txHash.substring(0,10)}... Simulating block confirmation.`
      });

      await new Promise(resolve => setTimeout(resolve, 4000));
      const orderRef = doc(db, "orders", orderId);
      await updateDoc(orderRef, {
        status: 'Paid' as OrderStatus,
        paymentTransactionHash: txHash
      });
      toast({
        title: "Payment Confirmed (Simulated)",
        description: `Order for ${orderToPay.productName || (orderToPay as any).fruitType} (Amount: ${ethAmountFixed.toFixed(6)} ETH) marked as Paid.`,
        variant: "default"
      });

      if (orderToPay.productId && orderToPay.quantity > 0) {
        const productRef = doc(db, "products", orderToPay.productId);
        try {
          await runTransaction(db, async (transaction) => {
            const productDoc = await transaction.get(productRef);
            if (!productDoc.exists()) {
              throw new Error("Product not found, cannot update stock.");
            }
            const currentStock = productDoc.data().stockQuantity || 0;
            const newStock = Math.max(0, currentStock - orderToPay.quantity);
            transaction.update(productRef, { stockQuantity: newStock });
            console.log(`[TransactionHistoryTable] Stock updated for product ${orderToPay.productId}. New stock: ${newStock}`);
             toast({
                title: "Stock Updated",
                description: `Stock for ${orderToPay.productName || (orderToPay as any).fruitType} reduced by ${orderToPay.quantity}. New stock: ${newStock}.`,
             });
          });
        } catch (stockError: any) {
          console.error("[TransactionHistoryTable] Error updating product stock:", stockError);
          toast({
            title: "Stock Update Failed",
            description: `Could not update stock for ${orderToPay.productName || (orderToPay as any).fruitType}. Please check manually. Error: ${stockError.message || stockError}`,
            variant: "destructive",
            duration: 7000,
          });
        }
      } else {
        console.warn("[TransactionHistoryTable] Product ID or quantity missing in order, cannot update stock:", orderToPay);
      }
      return true;
    } catch (error: any) {
      console.error("Metamask payment failed:", error);
      toast({
        title: "Payment Error",
        description: error.message || "Failed to process payment with Metamask.",
        variant: "destructive"
      });
      return false;
    } finally {
      setPayingOrderId(null);
    }
  }, [orders, toast]);

  const handleSupplierConfirmOrder = async (orderId: string) => {
    setConfirmingOrderId(orderId);
    try {
      const orderRef = doc(db, "orders", orderId);
      await updateDoc(orderRef, { status: 'Awaiting Transporter Assignment' as OrderStatus });
      toast({ title: "Order Confirmed", description: "Order is now awaiting transporter assignment." });
    } catch (error) {
      toast({ title: "Error", description: "Could not confirm order.", variant: "destructive" });
      console.error("Error confirming order:", error);
    } finally {
      setConfirmingOrderId(null);
    }
  };

  const handleOpenAssignTransporterDialog = (order: StoredOrder) => {
    setCurrentOrderToAssign(order);
    setSelectedTransporter(null);
    setIsAssignTransporterDialogOpen(true);
  };

  const handleAssignTransporter = async () => {
    if (!currentOrderToAssign || !selectedTransporter || !user) {
      toast({ title: "Error", description: "Please select a transporter or ensure order details are present.", variant: "destructive" });
      return;
    }
    setAssigningTransporterOrderId(currentOrderToAssign.id);
    const transporterUser = allUsersList.find(u => u.id === selectedTransporter);
    if (!transporterUser) {
      toast({ title: "Error", description: "Selected transporter not found.", variant: "destructive" });
      setAssigningTransporterOrderId(null);
      return;
    }

    let supplierAddress = 'N/A';
    let customerAddress = 'N/A';
    let predictedDeliveryTimestamp: Timestamp | null = null;

    try {
        const supplierDocRef = doc(db, "users", currentOrderToAssign.supplierId);
        const supplierDocSnap = await getDoc(supplierDocRef);
        if (supplierDocSnap.exists() && supplierDocSnap.data().address) {
            supplierAddress = supplierDocSnap.data().address;
        }

        const customerDocRef = doc(db, "users", currentOrderToAssign.customerId);
        const customerDocSnap = await getDoc(customerDocRef);
        if (customerDocSnap.exists() && customerDocSnap.data().address) {
            customerAddress = customerDocSnap.data().address;
        }

        if (supplierAddress !== 'N/A' && customerAddress !== 'N/A') {
            console.log(`[AssignTransporter] Calculating distance from ${supplierAddress} to ${customerAddress}`);
            const distanceInfo = await calculateDistance({originAddress: supplierAddress, destinationAddress: customerAddress});
            if (distanceInfo.predictedDeliveryIsoDate) {
                const parsedDate = new Date(distanceInfo.predictedDeliveryIsoDate);
                if (!isNaN(parsedDate.getTime())) {
                    predictedDeliveryTimestamp = Timestamp.fromDate(parsedDate);
                    toast({ title: "Delivery Date Estimated", description: `AI predicts delivery on ${format(parsedDate, "MMM d, yyyy")}. Note: ${distanceInfo.note || ''}`});
                } else {
                    toast({ title: "Date Parsing Error", description: "Could not parse AI's predicted delivery date.", variant: "outline" });
                }
            }
        } else {
            toast({ title: "Address Missing", description: "Supplier or customer address missing, cannot estimate delivery date.", variant: "outline"});
        }

    } catch (addrError) {
        console.error("Error fetching addresses or calculating distance for order:", addrError);
        toast({title: "Address/Distance Error", description: "Could not fetch addresses or estimate delivery. Using N/A for addresses.", variant: "outline", duration: 6000});
    }

    try {
      const orderRef = doc(db, "orders", currentOrderToAssign.id);
      const updateData: Partial<StoredOrder> = {
        transporterId: selectedTransporter,
        transporterName: transporterUser.name,
        status: 'Ready for Pickup' as OrderStatus,
        shipmentStatus: 'Ready for Pickup' as OrderShipmentStatus,
        pickupAddress: supplierAddress,
        deliveryAddress: customerAddress,
      };
      if (predictedDeliveryTimestamp) {
        updateData.predictedDeliveryDate = predictedDeliveryTimestamp;
      }

      await updateDoc(orderRef, updateData);
      toast({ title: "Transporter Assigned", description: `${transporterUser.name} assigned. Order ready for pickup.` });
      setIsAssignTransporterDialogOpen(false);
      setCurrentOrderToAssign(null);
    } catch (error) {
      toast({ title: "Error", description: "Could not assign transporter.", variant: "destructive" });
      console.error("Error assigning transporter:", error);
    } finally {
      setAssigningTransporterOrderId(null);
    }
  };

  const handleCustomerConfirmReceipt = async (orderId: string) => {
    setConfirmingReceiptOrderId(orderId);
    try {
      const orderRef = doc(db, "orders", orderId);
      await updateDoc(orderRef, { status: 'Receipt Confirmed' as OrderStatus });
      toast({ title: "Receipt Confirmed", description: "Thank you! Please proceed with payment if outstanding." });
      // Note: handlePayWithMetamask is NOT called here anymore, payment is now a separate explicit step by customer
    } catch (error) {
      toast({ title: "Error", description: "Could not confirm receipt.", variant: "destructive" });
      console.error("Error confirming receipt:", error);
    } finally {
      setConfirmingReceiptOrderId(null);
    }
  };

  const handleDenyReceipt = async (orderId: string) => {
    setDenyingReceiptOrderId(orderId);
    try {
      const orderRef = doc(db, "orders", orderId);
      await updateDoc(orderRef, { status: 'Disputed' as OrderStatus });
      toast({ title: "Receipt Denied", description: "Delivery issue reported for order. Please contact support or the supplier." });
    } catch (error) {
      toast({ title: "Error", description: "Could not deny receipt.", variant: "destructive" });
      console.error("Error denying receipt:", error);
    } finally {
      setDenyingReceiptOrderId(null);
    }
  };

  // Assessment Dialog Handlers
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
    // Reset form fields
    setSupplierRating('');
    setSupplierFeedback('');
    setTransporterRating('');
    setTransporterFeedback('');
  };

  const handleSubmitAssessment = async () => {
    if (!currentOrderForAssessment) return;

    const sRating = supplierRating ? parseInt(supplierRating, 10) : undefined;
    const tRating = transporterRating ? parseInt(transporterRating, 10) : undefined;

    if (supplierRating && (isNaN(sRating!) || sRating! < 1 || sRating! > 5)) {
      toast({ title: "Invalid Input", description: "Supplier rating must be a number between 1 and 5.", variant: "destructive"});
      return;
    }
    if (currentOrderForAssessment.transporterId && transporterRating && (isNaN(tRating!) || tRating! < 1 || tRating! > 5)) {
      toast({ title: "Invalid Input", description: "Transporter rating must be a number between 1 and 5.", variant: "destructive"});
      return;
    }

    setIsSubmittingAssessment(true);
    const orderRef = doc(db, "orders", currentOrderForAssessment.id);
    const assessmentData: Partial<StoredOrder> = {
      supplierRating: sRating,
      supplierFeedback: supplierFeedback.trim() || undefined,
      assessmentSubmitted: true,
    };

    if (currentOrderForAssessment.transporterId) {
      assessmentData.transporterRating = tRating;
      assessmentData.transporterFeedback = transporterFeedback.trim() || undefined;
    }

    try {
      await updateDoc(orderRef, assessmentData);
      toast({ title: "Evaluation Submitted", description: "Thank you for your feedback!" });
      handleCloseAssessmentDialog();
    } catch (error) {
      console.error("Error submitting assessment:", error);
      toast({ title: "Error", description: "Could not submit your evaluation.", variant: "destructive" });
    } finally {
      setIsSubmittingAssessment(false);
    }
  };


  if (isLoading) {
    return <div className="flex justify-center items-center py-8"><Loader2 className="h-8 w-8 animate-spin mr-2" /> Loading order history...</div>;
  }

  if (orders.length === 0 && !isLoading) {
    return <p className="text-center text-muted-foreground py-8">No orders recorded yet.</p>;
  }

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
            <TableHead className="text-right">Amount</TableHead>
            <TableHead className="text-right">Quantity</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Shipment Status</TableHead>
            <TableHead>Predicted Delivery</TableHead>
            <TableHead className="w-[200px] text-center">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {orders.map((order) => {
            const displayDate = order.orderDate || (order as any).date;
            const productName = order.productName || (order as any).fruitType;
            const canConfirmOrDeny = isCustomerView && order.shipmentStatus === 'Delivered' && order.status !== 'Paid' && order.status !== 'Receipt Confirmed' && order.status !== 'Disputed';
            const canPay = isCustomerView && (order.status === 'Awaiting Payment' || order.status === 'Receipt Confirmed') && order.status !== 'Paid' && order.status !== 'Disputed';
            const canEvaluate = isCustomerView && (order.status === 'Receipt Confirmed' || order.status === 'Disputed') && !order.assessmentSubmitted;


            return (
            <TableRow key={order.id}>
              <TableCell>
                {order.FruitIcon ? <order.FruitIcon className="h-6 w-6 text-accent" /> : <FruitIcon className="h-6 w-6 text-gray-400" />}
              </TableCell>
              <TableCell>{displayDate ? format((displayDate as Timestamp).toDate(), "MMM d, yyyy") : 'N/A'}</TableCell>
              <TableCell className="font-medium">{productName}</TableCell>
              {!isCustomerView && <TableCell>{order.customerName}</TableCell>}
              {isCustomerView && <TableCell>{order.supplierName}</TableCell>}
              <TableCell className="text-right">{order.currency} {order.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
              <TableCell className="text-right">{order.quantity.toLocaleString()} {order.unit}</TableCell>
              <TableCell>
                <Badge variant={getStatusBadgeVariant(order.status)}>{order.status}</Badge>
              </TableCell>
              <TableCell>
                {order.shipmentStatus ? <Badge variant={getStatusBadgeVariant(order.shipmentStatus)}>{order.shipmentStatus}</Badge> : <span className="text-xs text-muted-foreground">N/A</span>}
              </TableCell>
              <TableCell>
                {order.predictedDeliveryDate ? format((order.predictedDeliveryDate as Timestamp).toDate(), "MMM d, yyyy") : <span className="text-xs text-muted-foreground">N/A</span>}
              </TableCell>
              <TableCell className="space-x-1 text-center">
                {canPay && (
                  <Button
                    variant="outline" size="sm" onClick={() => handlePayWithMetamask(order.id)}
                    disabled={payingOrderId === order.id || !!payingOrderId || !!confirmingReceiptOrderId || !!denyingReceiptOrderId} className="h-8 px-2" title="Pay with Metamask"
                  >
                    {payingOrderId === order.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wallet className="h-4 w-4" />}
                    <span className={payingOrderId === order.id ? "sr-only" : "ml-1"}>Pay</span>
                  </Button>
                )}
                {canConfirmOrDeny && (
                  <>
                    <Button
                      variant="outline" size="sm" onClick={() => handleCustomerConfirmReceipt(order.id)}
                      disabled={confirmingReceiptOrderId === order.id || !!confirmingReceiptOrderId || !!denyingReceiptOrderId || !!payingOrderId} className="h-8 px-2 text-green-600 border-green-600 hover:text-green-700" title="Confirm Receipt"
                    >
                      {confirmingReceiptOrderId === order.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <ThumbsUp className="h-4 w-4" />}
                      <span className="ml-1">Confirm</span>
                    </Button>
                    <Button
                      variant="outline" size="sm" onClick={() => handleDenyReceipt(order.id)}
                      disabled={denyingReceiptOrderId === order.id || !!denyingReceiptOrderId || !!confirmingReceiptOrderId || !!payingOrderId} className="h-8 px-2 text-red-600 border-red-600 hover:text-red-700" title="Deny Receipt / Report Issue"
                    >
                      {denyingReceiptOrderId === order.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <ThumbsDown className="h-4 w-4" />}
                      <span className="ml-1">Deny</span>
                    </Button>
                  </>
                )}
                {canEvaluate && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleOpenAssessmentDialog(order)}
                    className="h-8 px-2 text-blue-600 border-blue-600 hover:text-blue-700 hover:bg-blue-50"
                    title="Evaluate Service"
                  >
                    <Star className="h-4 w-4" />
                    <span className="ml-1">Evaluate</span>
                  </Button>
                )}

                {!isCustomerView && user?.role === 'supplier' && order.status === 'Awaiting Supplier Confirmation' && (
                  <Button
                    variant="outline" size="sm" onClick={() => handleSupplierConfirmOrder(order.id)}
                    disabled={confirmingOrderId === order.id || !!confirmingOrderId} className="h-8 px-2 text-green-600 border-green-600 hover:text-green-700 hover:bg-green-50" title="Confirm Order"
                  >
                    {confirmingOrderId === order.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <ThumbsUp className="h-4 w-4" />}
                    <span className="ml-1">Confirm Order</span>
                  </Button>
                )}
                {!isCustomerView && user?.role === 'supplier' && order.status === 'Awaiting Transporter Assignment' && (
                  <Button
                    variant="outline" size="sm" onClick={() => handleOpenAssignTransporterDialog(order)}
                    disabled={assigningTransporterOrderId === order.id || !!assigningTransporterOrderId} className="h-8 px-2 text-blue-600 border-blue-600 hover:text-blue-700 hover:bg-blue-50" title="Assign Transporter"
                  >
                    {assigningTransporterOrderId === order.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Truck className="h-4 w-4" />}
                    <span className="ml-1">Assign Transporter</span>
                  </Button>
                )}

                {user?.role !== 'customer' && (
                  <Button variant="ghost" size="icon" onClick={() => handleDeleteOrder(order.id)} aria-label="Delete order" className="h-8 w-8">
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                )}
                {isCustomerView && !canConfirmOrDeny && !canPay && !canEvaluate && (
                    <Button variant="ghost" size="icon" onClick={() => alert(`Viewing order ${order.id} - details would show here.`)} aria-label="View order" className="h-8 w-8">
                        <Eye className="h-4 w-4 text-primary" />
                    </Button>
                )}
              </TableCell>
            </TableRow>
          )})}
        </TableBody>
      </Table>
    </div>

    {isAssignTransporterDialogOpen && currentOrderToAssign && (
      <Dialog open={isAssignTransporterDialogOpen} onOpenChange={(isOpen) => {
        if (!isOpen) {
          setCurrentOrderToAssign(null);
          setSelectedTransporter(null);
        }
        setIsAssignTransporterDialogOpen(isOpen);
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Assign Transporter for Order: {currentOrderToAssign.productName || (currentOrderToAssign as any).fruitType}</DialogTitle>
            <DialogDescription>
              Customer: {currentOrderToAssign.customerName} <br/>
              Order ID: {currentOrderToAssign.id}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-2">
            <Label htmlFor="transporter-select">Select Transporter</Label>
            <Select onValueChange={setSelectedTransporter} value={selectedTransporter || undefined}>
              <SelectTrigger id="transporter-select">
                <SelectValue placeholder="Choose a transporter..." />
              </SelectTrigger>
              <SelectContent>
                {availableTransporters.length > 0 ? (
                  availableTransporters.map(t => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))
                ) : (
                  <div className="p-4 text-sm text-muted-foreground">No approved transporters available.</div>
                )}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">Cancel</Button>
            </DialogClose>
            <Button
              type="button"
              onClick={handleAssignTransporter}
              disabled={!selectedTransporter || assigningTransporterOrderId === currentOrderToAssign.id || !!assigningTransporterOrderId}
            >
              {(assigningTransporterOrderId === currentOrderToAssign.id && assigningTransporterOrderId) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Assign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )}

    {isAssessmentDialogOpen && currentOrderForAssessment && (
      <Dialog open={isAssessmentDialogOpen} onOpenChange={handleCloseAssessmentDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Evaluate Service for Order #{currentOrderForAssessment.id.substring(0,6)}</DialogTitle>
            <DialogDescription>
              Product: {currentOrderForAssessment.productName} <br/>
              Help us improve by rating your experience with the supplier and transporter.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-6">
            {/* Supplier Assessment */}
            <div className="space-y-2 p-4 border rounded-md">
              <h3 className="text-md font-semibold">Supplier: {currentOrderForAssessment.supplierName}</h3>
              <div>
                <Label htmlFor="supplierRating">Rating (1-5 stars)</Label>
                <Input 
                  id="supplierRating" 
                  type="number" 
                  min="1" max="5" 
                  value={supplierRating} 
                  onChange={(e) => setSupplierRating(e.target.value)}
                  placeholder="e.g., 5"
                />
              </div>
              <div>
                <Label htmlFor="supplierFeedback">Feedback (Optional)</Label>
                <Textarea 
                  id="supplierFeedback" 
                  value={supplierFeedback} 
                  onChange={(e) => setSupplierFeedback(e.target.value)}
                  placeholder="Your comments about the supplier..."
                  rows={3}
                />
              </div>
            </div>

            {/* Transporter Assessment (Conditional) */}
            {currentOrderForAssessment.transporterId && (
              <div className="space-y-2 p-4 border rounded-md">
                <h3 className="text-md font-semibold">Transporter: {currentOrderForAssessment.transporterName}</h3>
                <div>
                  <Label htmlFor="transporterRating">Rating (1-5 stars)</Label>
                  <Input 
                    id="transporterRating" 
                    type="number" 
                    min="1" max="5" 
                    value={transporterRating} 
                    onChange={(e) => setTransporterRating(e.target.value)}
                    placeholder="e.g., 5"
                  />
                </div>
                <div>
                  <Label htmlFor="transporterFeedback">Feedback (Optional)</Label>
                  <Textarea 
                    id="transporterFeedback" 
                    value={transporterFeedback} 
                    onChange={(e) => setTransporterFeedback(e.target.value)}
                    placeholder="Your comments about the transporter..."
                    rows={3}
                  />
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">Cancel</Button>
            </DialogClose>
            <Button
              type="button"
              onClick={handleSubmitAssessment}
              disabled={isSubmittingAssessment}
            >
              {isSubmittingAssessment && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Submit Evaluation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )}
    </>
  );
}
