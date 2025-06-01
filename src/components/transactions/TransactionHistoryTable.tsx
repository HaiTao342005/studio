

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
import { Trash2, Wallet, Loader2, Eye, ThumbsUp, Truck, AlertTriangle, ThumbsDown, Star, CheckCircle, Ban, Edit, Info, Hash, KeyRound, CircleDollarSign, Send, Zap, FileSignature } from 'lucide-react';
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
import { getEscrowContract, convertToBytes32, getSignerAndProvider } from '@/lib/ethersService';
import { ethers } from 'ethers';


const FALLBACK_SIMULATED_ETH_USD_PRICE = 3000; 

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
    case 'FundedOnChain': case 'CompletedOnChain': return 'default'; 
    case 'Shipped': case 'Ready for Pickup': case 'In Transit': case 'Out for Delivery': case 'Delivered': return 'secondary';
    case 'Awaiting Supplier Confirmation': case 'AwaitingOnChainCreation': case 'AwaitingOnChainFunding': case 'Pending': return 'outline'; 
    case 'Cancelled': case 'Delivery Failed': case 'Shipment Cancelled': case 'DisputedOnChain': return 'destructive';
    // Deprecated/legacy, keep for now for old data
    case 'Paid': case 'Receipt Confirmed': case 'Awaiting Payment': case 'Awaiting Transporter Assignment':
       return 'outline';
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
  const [actionOrderId, setActionOrderId] = useState<string | null>(null);
  
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
      querySnapshot.forEach((docSnapshot) => { // Renamed doc to docSnapshot to avoid conflict
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
    const orderToDelete = orders.find(o => o.id === orderId);
    if (user?.role === 'customer' || orderToDelete?.status === 'FundedOnChain' || orderToDelete?.status === 'CompletedOnChain' || orderToDelete?.status === 'DisputedOnChain') {
        toast({ title: "Action Not Allowed", description: "Customers cannot delete orders, and on-chain orders cannot be deleted from this interface.", variant: "destructive"});
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
      if (!response.ok) throw new Error(`CoinGecko API Error: ${response.status}`);
      const data = await response.json();
      const price = data?.ethereum?.usd;
      if (typeof price !== 'number') throw new Error("Invalid price format from CoinGecko.");
      toast({ title: "ETH Price Fetched", description: `1 ETH = $${price.toFixed(2)} USD` });
      return price;
    } catch (error) {
      toast({ title: "ETH Price Error", description: `Using fallback rate $${FALLBACK_SIMULATED_ETH_USD_PRICE}. Error: ${(error as Error).message}`, variant: "destructive", duration: 7000 });
      return FALLBACK_SIMULATED_ETH_USD_PRICE;
    }
  };

  const handleCreateOrderOnChain = useCallback(async (orderToAssign: StoredOrder, selectedTransporterId: string): Promise<boolean> => {
    setActionOrderId(orderToAssign.id);
    const supplier = allUsersList.find(u => u.id === orderToAssign.supplierId);
    const customer = allUsersList.find(u => u.id === orderToAssign.customerId);
    const transporter = allUsersList.find(u => u.id === selectedTransporterId);

    if (!supplier?.ethereumAddress || !customer?.ethereumAddress || !transporter?.ethereumAddress) {
        toast({ title: "Address Missing", description: "Customer, Supplier, or Transporter Ethereum address is missing. Cannot create order on chain.", variant: "destructive", duration: 8000 });
        setActionOrderId(null);
        return false;
    }
    if (!transporter.shippingRates) {
        toast({ title: "Transporter Rates Missing", description: `${transporter.name} has not set shipping rates.`, variant: "destructive"});
        setActionOrderId(null);
        return false;
    }

    let calculatedTransporterFeeUSD: number | null = null;
    let finalTotalOrderAmountUSD = orderToAssign.totalAmount; 
    let predictedDeliveryDateISO: string | undefined = undefined;

    try {
      const distanceInput = { 
          originAddress: supplier.address || 'Supplier Address Not Set', 
          destinationAddress: customer.address || 'Customer Address Not Set',
          orderCreationDate: (orderToAssign.orderDate as Timestamp).toDate().toISOString() 
      };
      if (!supplier.address || !customer.address) {
         toast({ title: "Address Info", description: "Supplier or Customer physical address missing. Distance/Fee estimation might be inaccurate.", variant: "outline", duration: 7000 });
      }
      const distanceInfo = await calculateDistance(distanceInput);
      if (distanceInfo.predictedDeliveryIsoDate) {
        predictedDeliveryDateISO = distanceInfo.predictedDeliveryIsoDate;
      }
      if (distanceInfo.distanceKm !== undefined) {
        calculatedTransporterFeeUSD = calculateTieredShippingPrice(distanceInfo.distanceKm, transporter.shippingRates);
        if (calculatedTransporterFeeUSD !== null) {
          finalTotalOrderAmountUSD = orderToAssign.totalAmount + calculatedTransporterFeeUSD;
        } else {
           toast({title: "Transporter Rates Error", description: `${transporter.name} has incomplete shipping rates. Using product total for now.`, variant: "outline", duration: 8000});
           calculatedTransporterFeeUSD = 0; 
        }
      } else {
        toast({title: "Distance Error", description: `Could not estimate distance for fee. ${distanceInfo.note || ''} Using product total.`, variant: "outline", duration: 7000});
        calculatedTransporterFeeUSD = 0; 
      }
    } catch (err) {
      toast({title: "Distance/Fee Calc Error", description: "Could not estimate shipping fee. Using product total.", variant: "outline", duration: 7000});
      calculatedTransporterFeeUSD = 0; 
    }

    if (calculatedTransporterFeeUSD === null || calculatedTransporterFeeUSD <= 0) {
        toast({
            title: "Shipping Fee Error",
            description: `Cannot create order on-chain. The shipping fee for transporter ${transporter.name} must be greater than zero. Ensure transporter rates are set and yield a positive fee for this distance. Current calculated fee: $${(calculatedTransporterFeeUSD ?? 0).toFixed(2)}`,
            variant: "destructive",
            duration: 12000
        });
        setActionOrderId(null);
        return false;
    }
    if (orderToAssign.totalAmount <= 0) {
        toast({ title: "Product Amount Error", description: "Product amount must be greater than zero to create an order on-chain.", variant: "destructive", duration: 8000 });
        setActionOrderId(null);
        return false;
    }
    
    const currentEthUsdPrice = await fetchEthPrice();
    const productAmountInWei = ethers.parseEther((orderToAssign.totalAmount / currentEthUsdPrice).toFixed(18));
    const shippingFeeInWei = ethers.parseEther(((calculatedTransporterFeeUSD) / currentEthUsdPrice).toFixed(18)); // No ?? 0, already checked > 0

    try {
        const contract = await getEscrowContract();
        const orderIdBytes32 = convertToBytes32(orderToAssign.id);

        toast({ title: "Creating Order On-Chain...", description: "Please confirm in Metamask. This involves a gas fee.", duration: 10000});
        
        const { signer } = await getSignerAndProvider();
        const connectedSupplierAddress = await signer.getAddress();
        if (connectedSupplierAddress.toLowerCase() !== supplier.ethereumAddress.toLowerCase()) {
            toast({ title: "Wallet Mismatch", description: `Please ensure Metamask is connected with the supplier's registered wallet: ${supplier.ethereumAddress}. Currently connected: ${connectedSupplierAddress}`, variant: "destructive", duration: 10000 });
            setActionOrderId(null);
            return false;
        }

        const tx = await contract.createOrder(
            orderIdBytes32,
            customer.ethereumAddress,
            supplier.ethereumAddress,
            transporter.ethereumAddress,
            productAmountInWei,
            shippingFeeInWei,
            ethers.ZeroAddress 
        );
        await tx.wait();
        toast({ title: "Order Created On-Chain!", description: `Smart contract order ID: ${orderIdBytes32.substring(0,10)}... Tx: ${tx.hash.substring(0,10)}...`});

        const orderRef = doc(db, "orders", orderToAssign.id);
        const updatePayload: Partial<StoredOrder> = {
            transporterId: selectedTransporterId,
            transporterName: transporter.name,
            transporterEthereumAddress: transporter.ethereumAddress,
            supplierEthereumAddress: supplier.ethereumAddress, 
            customerEthereumAddress: customer.ethereumAddress, 
            status: 'AwaitingOnChainFunding' as OrderStatus,
            shipmentStatus: 'Ready for Pickup' as OrderShipmentStatus,
            pickupAddress: supplier.address || 'N/A',
            deliveryAddress: customer.address || 'N/A',
            estimatedTransporterFee: calculatedTransporterFeeUSD,
            finalTotalAmount: finalTotalOrderAmountUSD,
            contractOrderId: orderIdBytes32,
            contractCreationTxHash: tx.hash,
        };
        if (predictedDeliveryDateISO) {
            updatePayload.predictedDeliveryDate = Timestamp.fromDate(new Date(predictedDeliveryDateISO));
        }

        await updateDoc(orderRef, updatePayload);
        setIsAssignTransporterDialogOpen(false);
        return true;
    } catch (error: any) {
        console.error("Error creating order on chain:", error);
        const readableError = error.reason || error.data?.message || error.message || "Unknown smart contract error";
        toast({ title: "Smart Contract Error", description: `Could not create order on chain: ${readableError}`, variant: "destructive", duration: 10000 });
        return false;
    } finally {
        setActionOrderId(null);
    }
  }, [allUsersList, toast]);


  const handlePayWithMetamaskOnChain = useCallback(async (orderId: string): Promise<boolean> => {
    const orderToPay = orders.find(o => o.id === orderId);
    if (!orderToPay || !orderToPay.contractOrderId || orderToPay.finalTotalAmount === undefined) {
      toast({ title: "Error", description: "Order details missing for on-chain payment.", variant: "destructive" });
      return false;
    }
    if (orderToPay.status !== 'AwaitingOnChainFunding') {
      toast({ title: "Payment Error", description: `Order is not awaiting funding. Status: ${orderToPay.status}`, variant: "destructive" });
      return false;
    }
    if (!user?.ethereumAddress || user.ethereumAddress.toLowerCase() !== orderToPay.customerEthereumAddress?.toLowerCase()) {
         toast({ title: "Wallet Mismatch", description: `Please ensure Metamask is connected with the customer's wallet: ${orderToPay.customerEthereumAddress}. Currently connected: ${user?.ethereumAddress || 'N/A'}`, variant: "destructive", duration: 10000 });
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
      const readableError = error.reason || error.data?.message || error.message || "Unknown smart contract error";
      toast({ title: "Smart Contract Error", description: `Metamask payment failed: ${readableError}`, variant: "destructive", duration: 10000 });
      return false;
    } finally {
      setActionOrderId(null);
    }
  }, [orders, toast, user]);


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
    if (order.status !== 'FundedOnChain' || order.shipmentStatus !== 'Delivered') { 
         toast({ title: "Action Error", description: `Order must be 'FundedOnChain' and 'Delivered' by transporter. Current status: ${order.status}, Shipment: ${order.shipmentStatus}`, variant: "destructive", duration: 8000 });
         setActionOrderId(null);
         return;
    }
    if (!user?.ethereumAddress || user.ethereumAddress.toLowerCase() !== order.customerEthereumAddress?.toLowerCase()) {
         toast({ title: "Wallet Mismatch", description: `Please ensure Metamask is connected with the customer's wallet: ${order.customerEthereumAddress}. Currently connected: ${user?.ethereumAddress || 'N/A'}`, variant: "destructive", duration: 10000 });
         setActionOrderId(null);
         return;
    }

    toast({ title: "Confirming Delivery On-Chain...", description: "Please confirm in Metamask. This will trigger payouts by the contract.", duration: 10000 });
    try {
      const contract = await getEscrowContract();
      const tx = await contract.confirmDelivery(order.contractOrderId);
      toast({ title: "Confirmation Submitted", description: `Tx Hash: ${tx.hash.substring(0,10)}... Waiting for on-chain processing.` });
      await tx.wait();
      
      const orderRef = doc(db, "orders", orderId);
      await updateDoc(orderRef, {
        status: 'CompletedOnChain' as OrderStatus,
        contractConfirmationTxHash: tx.hash,
        payoutTimestamp: serverTimestamp(), 
        supplierPayoutAmount: order.totalAmount, 
        transporterPayoutAmount: order.estimatedTransporterFee ?? 0,
      });
      
      toast({ title: "Delivery Confirmed & Payouts Processed On-Chain!", description: `Smart contract handled payouts. Tx: ${tx.hash.substring(0,10)}...`, duration: 10000 });

    } catch (error: any) {
      console.error("Error confirming delivery on chain:", error);
      const readableError = error.reason || error.data?.message || error.message || "Unknown smart contract error";
      toast({ 
        title: "Smart Contract Error", 
        description: `Could not confirm delivery on chain: ${readableError}`, 
        variant: "destructive", duration: 10000
      });
    } finally {
      setActionOrderId(null);
    }
  };

  const handleDenyReceiptOnChain = async (orderId: string) => { 
    setActionOrderId(orderId);
    const order = orders.find(o => o.id === orderId);
    if (!order || !order.contractOrderId) {
       toast({ title: "Error", description: "Order contract details not found.", variant: "destructive" });
       setActionOrderId(null);
       return;
    }
    if (order.status !== 'FundedOnChain' || order.shipmentStatus !== 'Delivered') {
        toast({ title: "Dispute Error", description: "Order must be 'FundedOnChain' and 'Delivered' by transporter to dispute.", variant: "destructive", duration: 8000 });
        setActionOrderId(null);
        return;
    }
    if (!user?.ethereumAddress || user.ethereumAddress.toLowerCase() !== order.customerEthereumAddress?.toLowerCase()) {
         toast({ title: "Wallet Mismatch", description: `Please ensure Metamask is connected with the customer's wallet: ${order.customerEthereumAddress}. Currently connected: ${user?.ethereumAddress || 'N/A'}`, variant: "destructive", duration: 10000 });
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
      });
      toast({ title: "Order Disputed On-Chain", description: `Order marked as disputed. Tx: ${tx.hash.substring(0,10)}... Owner can resolve.` });
    } catch (error: any) {
      const readableError = error.reason || error.data?.message || error.message || "Unknown smart contract error";
      toast({ title: "Smart Contract Error", description: `Could not dispute order on chain: ${readableError}`, variant: "destructive", duration: 10000 });
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
            {isManagerView && <TableHead title="Firestore Order ID">FS ID</TableHead>}
            {isManagerView && <TableHead title="Smart Contract Order ID (bytes32)">SC ID</TableHead>}
            <TableHead className="text-right">Total (USD)</TableHead>
            <TableHead className="text-right">Qty</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Shipment</TableHead>
            <TableHead>Pred. Delivery</TableHead>
            {isCustomerView && <TableHead>On-Chain Outcome</TableHead>}
            {isManagerView && <TableHead title="Order Creation Tx Hash"><Hash className="inline-block h-4 w-4 mr-1"/>Create Hash</TableHead>}
            {isManagerView && <TableHead title="Customer Funding Tx Hash"><Hash className="inline-block h-4 w-4 mr-1"/>Fund Hash</TableHead>}
            {isManagerView && <TableHead title="Customer Confirmation Tx Hash"><FileSignature className="inline-block h-4 w-4 mr-1"/>Confirm Hash</TableHead>}
            <TableHead className="w-[220px] text-center">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {orders.map((order) => {
            const displayDate = order.orderDate || (order as any).date;
            const productName = order.productName || (order as any).fruitType;

            const canCreateOnChain = user?.role === 'supplier' && order.status === 'Awaiting Supplier Confirmation' && !user.isSuspended;
            const canPayOnChain = isCustomerView && order.status === 'AwaitingOnChainFunding' && !user?.isSuspended;
            const canConfirmOrDenyOnChain = isCustomerView && order.status === 'FundedOnChain' && order.shipmentStatus === 'Delivered' && !order.assessmentSubmitted && !user?.isSuspended;
            const canEvaluate = isCustomerView && (order.status === 'CompletedOnChain' || order.status === 'DisputedOnChain') && !order.assessmentSubmitted && !user?.isSuspended;
            
            const isCurrentUserSupplierSuspended = user?.role === 'supplier' && user?.isSuspended;

            const displayAmount = order.finalTotalAmount ?? order.totalAmount;

            return (
            <TableRow key={order.id}>
              <TableCell>{order.FruitIcon ? <order.FruitIcon className="h-6 w-6 text-accent" /> : <FruitIcon className="h-6 w-6 text-gray-400" />}</TableCell>
              <TableCell>{displayDate ? format((displayDate as Timestamp).toDate(), "MMM d, yyyy") : 'N/A'}</TableCell>
              <TableCell className="font-medium">{productName}</TableCell>
              {!isCustomerView && <TableCell title={order.customerEthereumAddress || 'Cust ETH Address N/A'}>{order.customerName} ({truncateText(order.customerEthereumAddress, 8)})</TableCell>}
              {isCustomerView && (
                <TableCell title={order.supplierEthereumAddress || 'Supp ETH Address N/A'}>
                  {order.supplierName} ({truncateText(order.supplierEthereumAddress,8)})
                  {allUsersList.find(u=>u.id === order.supplierId)?.averageSupplierRating !== undefined && (<Badge variant="outline" className="ml-1 text-xs font-normal py-0.5"><Star className="h-3 w-3 mr-1 text-yellow-400 fill-yellow-400" />{allUsersList.find(u=>u.id === order.supplierId)!.averageSupplierRating!.toFixed(1)}</Badge>)}
                </TableCell>
              )}
              <TableCell title={order.transporterEthereumAddress || 'Trans ETH Address N/A'}>
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
                    </div>
                  )}
                  {(order.status !== 'CompletedOnChain' && order.status !== 'DisputedOnChain') && (
                     <span className="text-muted-foreground">Pending...</span>
                  )}
                </TableCell>
              )}
              {isManagerView && <TableCell className="text-xs" title={order.contractCreationTxHash || undefined}>{truncateText(order.contractCreationTxHash, 12)}</TableCell>}
              {isManagerView && <TableCell className="text-xs" title={order.paymentTransactionHash || undefined}>{truncateText(order.paymentTransactionHash, 12)}</TableCell>}
              {isManagerView && <TableCell className="text-xs" title={order.contractConfirmationTxHash || undefined}>{truncateText(order.contractConfirmationTxHash, 12)}</TableCell>}
              <TableCell className="space-x-1 text-center">
                {canCreateOnChain && (
                  <Button variant="outline" size="sm" onClick={() => handleOpenAssignTransporterDialog(order)} disabled={actionOrderId === order.id || !!actionOrderId} className="h-8 px-2 text-blue-600 border-blue-600 hover:text-blue-700 hover:bg-blue-50" title="Assign Transporter & Create On-Chain">
                     {actionOrderId === order.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSignature className="h-4 w-4" />} <span className="ml-1">Finalize & Create</span>
                  </Button>
                )}
                {canPayOnChain && (
                  <Button variant="outline" size="sm" onClick={() => handlePayWithMetamaskOnChain(order.id)} disabled={actionOrderId === order.id || !!actionOrderId} className="h-8 px-2" title="Fund Order On-Chain">
                    {actionOrderId === order.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wallet className="h-4 w-4" />} <span className={actionOrderId === order.id ? "sr-only" : "ml-1"}>Fund Escrow</span>
                  </Button>
                )}
                {canConfirmOrDenyOnChain && (
                  <>
                    <Button variant="outline" size="sm" onClick={() => handleCustomerConfirmReceiptOnChain(order.id)} disabled={actionOrderId === order.id || !!actionOrderId} className="h-8 px-2 text-green-600 border-green-600 hover:text-green-700" title="Confirm Delivery On-Chain & Release Funds">
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
                {user?.role !== 'customer' && order.status !== 'Awaiting Supplier Confirmation' && order.status !== 'AwaitingOnChainFunding' && order.status !== 'FundedOnChain' && order.status !== 'CompletedOnChain' && order.status !== 'DisputedOnChain' && (
                  <Button variant="ghost" size="icon" onClick={() => handleDeleteOrder(order.id)} aria-label="Delete order" className="h-8 w-8" disabled={isCurrentUserSupplierSuspended && user?.role === 'supplier'}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                )}
                {isCurrentUserSupplierSuspended && user?.role === 'supplier' && canCreateOnChain && (
                    <Badge variant="destructive" className="text-xs"><Ban className="h-3 w-3 mr-1"/> Suspended</Badge>
                )}
                {isCustomerView && (user?.isSuspended || (order.status !== 'AwaitingOnChainFunding' && order.status !== 'FundedOnChain' && !canEvaluate && !canConfirmOrDenyOnChain)) && order.status !== 'CompletedOnChain' && order.status !== 'DisputedOnChain' && (
                     <Badge variant={user?.isSuspended ? "destructive" : getStatusBadgeVariant(order.status)} className="text-xs">
                        {user?.isSuspended ? "Account Suspended" : "Awaiting Action"}
                     </Badge>
                )}
                 {isCustomerView && (order.status === 'CompletedOnChain' || order.status === 'DisputedOnChain') && !canEvaluate && (
                    <Badge variant={order.status === 'CompletedOnChain' ? 'default' : 'destructive'} className="text-xs bg-opacity-70">
                       <CheckCircle className="h-3 w-3 mr-1"/> {order.assessmentSubmitted ? (order.status === 'CompletedOnChain' ? 'Evaluated' : 'Disputed & Evaluated') : (order.status === 'CompletedOnChain' ? 'Completed' : 'Disputed')}
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
          <DialogHeader><DialogTitle>Finalize & Create Order On-Chain</DialogTitle><DialogDescription>Order: {currentOrderToAssign.productName} for {currentOrderToAssign.customerName}</DialogDescription></DialogHeader>
          <div className="py-4 space-y-2">
            <p className="text-sm">Product Cost: ${currentOrderToAssign.totalAmount.toFixed(2)} USD</p>
            <p className="text-xs text-muted-foreground">Select a transporter. Their shipping fee will be calculated and added. This total will be used for the on-chain escrow order.</p>
            
            {availableTransporters.length > 0 ? (
              <>
                <Label htmlFor="transporter-select">Select Transporter (Must have ETH address & rates)</Label>
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
             {!user?.ethereumAddress && (
                <p className="text-xs text-destructive mt-2">Warning: Your (Supplier) Ethereum address is not set in your profile. It's required for the smart contract.</p>
            )}
            {!currentOrderToAssign.customerEthereumAddress && (
                 <p className="text-xs text-destructive mt-2">Warning: Customer ({currentOrderToAssign.customerName}) Ethereum address is not set. It's required.</p>
            )}
            {selectedTransporter && !allUsersList.find(u => u.id === selectedTransporter)?.ethereumAddress && (
                 <p className="text-xs text-destructive mt-2">Warning: Selected Transporter does not have an Ethereum address set. It's required.</p>
            )}
          </div>
          <DialogFooter>
            <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
            <Button 
              type="button" 
              onClick={handleConfirmAssignTransporter} 
              disabled={!selectedTransporter || actionOrderId === currentOrderToAssign.id || !!actionOrderId || availableTransporters.length === 0 || !user?.ethereumAddress || !currentOrderToAssign.customerEthereumAddress || !allUsersList.find(u => u.id === selectedTransporter)?.ethereumAddress}
            >
              {(actionOrderId === currentOrderToAssign.id) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create On-Chain Order
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )}

    {isAssessmentDialogOpen && currentOrderForAssessment && (
      <Dialog open={isAssessmentDialogOpen} onOpenChange={handleCloseAssessmentDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>Evaluate Order #{currentOrderForAssessment.contractOrderId?.substring(0,8) || currentOrderForAssessment.id.substring(0,6)}</DialogTitle><DialogDescription>Product: {currentOrderForAssessment.productName}</DialogDescription></DialogHeader>
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

