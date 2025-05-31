
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
import { Trash2, Wallet, Loader2, Eye, ThumbsUp, Truck, AlertTriangle, ThumbsDown, Star, CheckCircle, Ban } from 'lucide-react';
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
import { useAuth, type User as AuthUser } from '@/contexts/AuthContext';
import { calculateDistance, type CalculateDistanceOutput } from '@/ai/flows/calculate-distance-flow';


const GANACHE_RECIPIENT_ADDRESS = "0x83491285C0aC3dd64255A5D68f0C3e919A5Eacf2";
const FALLBACK_SIMULATED_ETH_USD_PRICE = 2000;
const BASE_FARE = 2.00; 
const RATE_PER_KM = 0.50; 

const getStatusBadgeVariant = (status: OrderStatus | OrderShipmentStatus): "default" | "secondary" | "destructive" | "outline" => {
  switch (status) {
    case 'Paid': return 'default'; 
    case 'Delivered': return 'secondary'; 
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
  const [confirmingOrderId, setConfirmingOrderId] = useState<string | null>(null);
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

  const availableTransporters = allUsersList.filter(u => u.role === 'transporter' && u.isApproved && !u.isSuspended);

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
      
      if (currentRole === 'supplier') {
        fetchedOrders.sort((a, b) => {
            const dateA = (a.orderDate as Timestamp)?.toMillis() || 0;
            const dateB = (b.orderDate as Timestamp)?.toMillis() || 0;
            return dateB - dateA;
        });
      }
      setOrders(fetchedOrders);
      setIsLoading(false);
    }, (error) => {
      console.error(`Error fetching orders for role ${currentRole}:`, error);
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
    if (orderToPay.totalAmount <= 0) {
      toast({ title: "Payment Error", description: "Order amount must be > 0.", variant: "destructive" });
      return false;
    }
    if (typeof window.ethereum === 'undefined') {
      toast({ title: "Metamask Not Found", description: "Please install Metamask.", variant: "destructive" });
      return false;
    }

    setPayingOrderId(orderId);
    const currentEthUsdPrice = await fetchEthPrice();
    const ethAmount = parseFloat((orderToPay.totalAmount / currentEthUsdPrice).toFixed(18));
    toast({ title: "Initiating Payment", description: `Order: ${orderToPay.totalAmount.toFixed(2)} USD. Sending: ${ethAmount.toFixed(6)} ETH. Confirm in Metamask.` });

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

  const handleSupplierConfirmOrder = async (orderId: string) => {
    if (user?.isSuspended) {
      toast({ title: "Action Denied", description: "Your account is suspended.", variant: "destructive" });
      return;
    }
    setConfirmingOrderId(orderId);
    try {
      const orderRef = doc(db, "orders", orderId);
      await updateDoc(orderRef, { status: 'Awaiting Payment' as OrderStatus }); 
      toast({ title: "Order Confirmed", description: "Order confirmed. Customer will be prompted to pay." });
    } catch (error) {
      toast({ title: "Error", description: "Could not confirm order.", variant: "destructive" });
    } finally {
      setConfirmingOrderId(null);
    }
  };

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

    let supplierAddress = 'N/A', customerAddress = 'N/A';
    let predictedDeliveryTimestamp: Timestamp | null = null;
    let calculatedTransporterFee: number | undefined = undefined;

    try {
      const supplierDetails = allUsersList.find(u => u.id === currentOrderToAssign.supplierId);
      if (supplierDetails?.address) supplierAddress = supplierDetails.address;
      const customerDetails = allUsersList.find(u => u.id === currentOrderToAssign.customerId);
      if (customerDetails?.address) customerAddress = customerDetails.address;

      if (supplierAddress !== 'N/A' && customerAddress !== 'N/A') {
        const distanceInfo = await calculateDistance({ originAddress: supplierAddress, destinationAddress: customerAddress });
        if (distanceInfo.predictedDeliveryIsoDate) {
          const parsedDate = new Date(distanceInfo.predictedDeliveryIsoDate);
          if (!isNaN(parsedDate.getTime())) predictedDeliveryTimestamp = Timestamp.fromDate(parsedDate);
        }
        if (distanceInfo.distanceKm && typeof distanceInfo.distanceKm === 'number') {
          calculatedTransporterFee = BASE_FARE + (distanceInfo.distanceKm * RATE_PER_KM);
        }
        toast({ title: "Logistics Estimated", description: `Delivery: ${predictedDeliveryTimestamp ? format(predictedDeliveryTimestamp.toDate(), "MMM d, yyyy") : 'N/A'}. Fee: ${calculatedTransporterFee ? '$'+calculatedTransporterFee.toFixed(2) : 'N/A'}. Note: ${distanceInfo.note || ''}`});
      }
    } catch (err) {
      toast({title: "Address/Distance Error", description: "Could not estimate delivery/fee.", variant: "outline"});
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
        estimatedTransporterFee: calculatedTransporterFee,
      };
      if (predictedDeliveryTimestamp) updateData.predictedDeliveryDate = predictedDeliveryTimestamp;

      await updateDoc(orderRef, updateData);
      toast({ title: "Transporter Assigned", description: `${transporterUser.name} assigned. Order ready for pickup.` });
      setIsAssignTransporterDialogOpen(false);
    } catch (error) {
      toast({ title: "Error", description: "Could not assign transporter.", variant: "destructive" });
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
      const supplierPayout = order.totalAmount - (order.estimatedTransporterFee || 0);
      const transporterPayout = order.estimatedTransporterFee || 0;

      await updateDoc(orderRef, {
        status: 'Completed' as OrderStatus, 
        supplierPayoutAmount: supplierPayout,
        transporterPayoutAmount: transporterPayout,
        payoutTimestamp: serverTimestamp()
      });
      toast({ title: "Receipt Confirmed & Order Completed!", description: "Funds released to supplier and transporter (simulated)." });
    } catch (error) {
      toast({ title: "Error", description: "Could not confirm receipt and process payout.", variant: "destructive" });
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

  if (isLoading) return <div className="flex justify-center items-center py-8"><Loader2 className="h-8 w-8 animate-spin mr-2" /> Loading...</div>;
  if (orders.length === 0 && !isLoading) return <p className="text-center text-muted-foreground py-8">No orders yet.</p>;

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
            
            const canPay = isCustomerView && order.status === 'Awaiting Payment';
            const canConfirmOrDeny = isCustomerView && order.status === 'Paid' && order.shipmentStatus === 'Delivered';
            const canEvaluate = isCustomerView && (order.status === 'Completed' || order.status === 'Disputed') && !order.assessmentSubmitted;
            
            const supplierForOrder = allUsersList.find(u => u.id === order.supplierId);
            const transporterForOrder = order.transporterId ? allUsersList.find(u => u.id === order.transporterId) : null;
            const isCurrentUserSupplierSuspended = user?.role === 'supplier' && user?.isSuspended;

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
              <TableCell className="text-right">{order.currency} {order.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
              <TableCell className="text-right">{order.quantity.toLocaleString()} {order.unit}</TableCell>
              <TableCell><Badge variant={getStatusBadgeVariant(order.status)}>{order.status}</Badge></TableCell>
              <TableCell>{order.shipmentStatus ? <Badge variant={getStatusBadgeVariant(order.shipmentStatus)}>{order.shipmentStatus}</Badge> : <span className="text-xs text-muted-foreground">N/A</span>}</TableCell>
              <TableCell>{order.predictedDeliveryDate ? format((order.predictedDeliveryDate as Timestamp).toDate(), "MMM d, yyyy") : <span className="text-xs text-muted-foreground">N/A</span>}</TableCell>
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
                  <Button variant="outline" size="sm" onClick={() => handleSupplierConfirmOrder(order.id)} disabled={confirmingOrderId === order.id || !!confirmingOrderId || isCurrentUserSupplierSuspended} className="h-8 px-2 text-green-600 border-green-600 hover:text-green-700 hover:bg-green-50" title="Confirm Order">
                    {confirmingOrderId === order.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <ThumbsUp className="h-4 w-4" />} <span className="ml-1">Confirm Order</span>
                  </Button>
                )}
                {!isCustomerView && user?.role === 'supplier' && order.status === 'Awaiting Transporter Assignment' && (
                  <Button variant="outline" size="sm" onClick={() => handleOpenAssignTransporterDialog(order)} disabled={assigningTransporterOrderId === order.id || !!assigningTransporterOrderId || isCurrentUserSupplierSuspended} className="h-8 px-2 text-blue-600 border-blue-600 hover:text-blue-700 hover:bg-blue-50" title="Assign Transporter">
                    {assigningTransporterOrderId === order.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Truck className="h-4 w-4" />} <span className="ml-1">Assign Transporter</span>
                  </Button>
                )}
                {user?.role !== 'customer' && (
                  <Button variant="ghost" size="icon" onClick={() => handleDeleteOrder(order.id)} aria-label="Delete order" className="h-8 w-8" disabled={isCurrentUserSupplierSuspended && user?.role === 'supplier'}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                )}
                {isCurrentUserSupplierSuspended && !isCustomerView && user?.role === 'supplier' && (order.status === 'Awaiting Supplier Confirmation' || order.status === 'Awaiting Transporter Assignment') && (
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
          <DialogHeader><DialogTitle>Assign Transporter: {currentOrderToAssign.productName}</DialogTitle><DialogDescription>Customer: {currentOrderToAssign.customerName}</DialogDescription></DialogHeader>
          <div className="py-4 space-y-2">
            <Label htmlFor="transporter-select">Select Transporter</Label>
            <Select onValueChange={setSelectedTransporter} value={selectedTransporter || undefined}>
              <SelectTrigger id="transporter-select"><SelectValue placeholder="Choose..." /></SelectTrigger>
              <SelectContent>{availableTransporters.length > 0 ? availableTransporters.map(t => (<SelectItem key={t.id} value={t.id}>{t.name}{t.averageTransporterRating !== undefined && (<span className="ml-2 text-xs text-muted-foreground">(<Star className="inline-block h-3 w-3 mr-0.5 text-yellow-400 fill-yellow-400" />{t.averageTransporterRating.toFixed(1)} - {t.transporterRatingCount} ratings)</span>)}</SelectItem>)) : (<div className="p-4 text-sm text-muted-foreground">No transporters.</div>)}</SelectContent>
            </Select>
          </div>
          <DialogFooter><DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose><Button type="button" onClick={handleAssignTransporter} disabled={!selectedTransporter || assigningTransporterOrderId === currentOrderToAssign.id || !!assigningTransporterOrderId}>{(assigningTransporterOrderId === currentOrderToAssign.id) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Assign</Button></DialogFooter>
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

    