
"use client";

import { useState, useEffect, type SVGProps, type ElementType } from 'react';
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
import { Trash2, Wallet, Loader2, Eye } from 'lucide-react';
import type { Order, OrderStatus, StoredOrder } from '@/types/transaction';
import { AppleIcon, BananaIcon, OrangeIcon, GrapeIcon, MangoIcon, FruitIcon } from '@/components/icons/FruitIcons';
import { format } from 'date-fns';
import { useToast } from "@/hooks/use-toast";
import { db } from '@/lib/firebase/config';
import { collection, onSnapshot, query, orderBy, doc, deleteDoc, updateDoc, Timestamp, where } from 'firebase/firestore';
import { useAuth } from '@/contexts/AuthContext';

const GANACHE_RECIPIENT_ADDRESS = "0x83491285C0aC3dd64255A5D68f0C3e919A5Eacf2";
const FALLBACK_SIMULATED_ETH_USD_PRICE = 2000;

const getStatusBadgeVariant = (status: OrderStatus): "default" | "secondary" | "destructive" | "outline" => {
  switch (status) {
    case 'Paid': return 'default';
    case 'Delivered': return 'default';
    case 'Shipped': return 'secondary';
    case 'Awaiting Payment': return 'outline';
    case 'Pending': return 'outline';
    case 'Cancelled': return 'destructive';
    default: return 'secondary';
  }
};

const getFruitIcon = (fruitTypeInput: string | undefined): ElementType<SVGProps<SVGSVGElement>> => {
  const fruitType = fruitTypeInput || ""; // Ensure fruitType is a string
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
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [payingOrderId, setPayingOrderId] = useState<string | null>(null);
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    if (isCustomerView && initialOrders) {
      const mappedOrders: Order[] = initialOrders.map(order => ({
        ...order,
        date: (order.orderDate as Timestamp).toDate(), // Ensure we use orderDate from StoredOrder
        FruitIcon: getFruitIcon(order.productName || (order as any).fruitType), // Use productName or fallback to fruitType
      }));
      setOrders(mappedOrders);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    let ordersQuery;
    if (isCustomerView && user) {
        ordersQuery = query(collection(db, "orders"), where("customerId", "==", user.id), orderBy("orderDate", "desc"));
    } else if (user && user.role === 'supplier') {
        ordersQuery = query(collection(db, "orders"), where("supplierId", "==", user.id), orderBy("orderDate", "desc"));
    } else if (user && user.role === 'manager') {
        ordersQuery = query(collection(db, "orders"), orderBy("orderDate", "desc"));
    } else {
      setIsLoading(false);
      setOrders([]);
      return; // No query if user role doesn't match known roles or user is null
    }

    const unsubscribe = onSnapshot(ordersQuery, (querySnapshot) => {
      const fetchedOrders: Order[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data() as Omit<StoredOrder, 'id'>;
        fetchedOrders.push({
          ...data,
          id: doc.id,
          date: (data.orderDate as Timestamp).toDate(),
          FruitIcon: getFruitIcon(data.productName || (data as any).fruitType), // Use productName or fallback to fruitType
        });
      });
      setOrders(fetchedOrders);
      setIsLoading(false);
    }, (error) => {
      console.error("Error fetching orders from Firestore:", error);
      toast({ title: "Error Loading Orders", description: (error as Error).message, variant: "destructive" });
      setIsLoading(false);
      setOrders([]);
    });

    return () => unsubscribe();
  }, [toast, initialOrders, isCustomerView, user]);

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
      console.error("Failed to delete order from Firestore:", error);
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

  const handlePayWithMetamask = async (orderId: string) => {
    const orderToPay = orders.find(o => o.id === orderId);
    if (!orderToPay) {
      toast({ title: "Error", description: "Order not found.", variant: "destructive" });
      return;
    }

    if (orderToPay.totalAmount <= 0) {
      toast({ title: "Payment Error", description: "Order amount must be greater than zero to pay.", variant: "destructive" });
      return;
    }

    if (GANACHE_RECIPIENT_ADDRESS === "YOUR_GANACHE_ACCOUNT_ADDRESS_HERE" || GANACHE_RECIPIENT_ADDRESS.toUpperCase().includes("YOUR_GANACHE_ACCOUNT_ADDRESS_HERE")) {
      toast({
        title: "Configuration Needed",
        description: "Please set your Ganache recipient address in TransactionHistoryTable.tsx.",
        variant: "destructive",
        duration: 10000,
      });
      return;
    }

    if (typeof window.ethereum === 'undefined') {
      toast({ title: "Metamask Not Found", description: "Please install Metamask to use this feature.", variant: "destructive" });
      return;
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
      description: `Preparing to pay ${orderToPay.totalAmount.toFixed(2)} USD (${ethAmountFixed.toFixed(6)} ETH at 1 ETH = $${currentEthUsdPrice.toFixed(2)} USD). Confirm in Metamask.`
    });

    try {
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' }) as string[];
      if (!accounts || accounts.length === 0) {
        toast({ title: "Connection Failed", description: "No accounts found in Metamask.", variant: "destructive" });
        setPayingOrderId(null);
        return;
      }
      const fromAccount = accounts[0];

      const amountInWei = BigInt(Math.floor(ethAmountFixed * 1e18));

      if (amountInWei <= 0) {
        toast({ title: "Payment Error", description: "Calculated ETH amount is too small or zero. Try a larger order amount.", variant: "destructive" });
        setPayingOrderId(null);
        return;
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
        paymentTransactionHash: txHash // Optionally store the transaction hash
      });

      toast({
        title: "Payment Confirmed (Simulated)",
        description: `Order for ${orderToPay.productName || (orderToPay as any).fruitType} (Amount: ${ethAmountFixed.toFixed(6)} ETH) marked as Paid. Block confirmed on Ganache (simulated).`,
        variant: "default"
      });

    } catch (error: any) {
      console.error("Metamask payment failed:", error);
      toast({
        title: "Payment Error",
        description: error.message || "Failed to process payment with Metamask.",
        variant: "destructive"
      });
    } finally {
      setPayingOrderId(null);
    }
  };

  if (isLoading) {
    return <div className="flex justify-center items-center py-8"><Loader2 className="h-8 w-8 animate-spin mr-2" /> Loading order history...</div>;
  }

  if (orders.length === 0) {
    return <p className="text-center text-muted-foreground py-8">No orders recorded yet.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[60px]">Icon</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Product</TableHead>
            {!isCustomerView && <TableHead>Customer</TableHead>}
            {isCustomerView && <TableHead>Supplier</TableHead>}
            <TableHead className="text-right">Amount</TableHead>
            <TableHead className="text-right">Quantity</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="w-[120px] text-center">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {orders.map((order) => (
            <TableRow key={order.id}>
              <TableCell>
                {order.FruitIcon ? <order.FruitIcon className="h-6 w-6 text-accent" /> : <FruitIcon className="h-6 w-6 text-gray-400" />}
              </TableCell>
              <TableCell>{format(order.date, "MMM d, yyyy")}</TableCell>
              <TableCell className="font-medium">{order.productName || (order as any).fruitType}</TableCell>
              {!isCustomerView && <TableCell>{order.customerName}</TableCell>}
              {isCustomerView && <TableCell>{order.supplierName}</TableCell>}
              <TableCell className="text-right">{order.currency} {order.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
              <TableCell className="text-right">{order.quantity.toLocaleString()} {order.unit}</TableCell>
              <TableCell>
                <Badge variant={getStatusBadgeVariant(order.status)}>{order.status}</Badge>
              </TableCell>
              <TableCell className="space-x-1 text-center">
                {order.status === 'Awaiting Payment' && (user?.role === 'customer' || user?.role === 'manager') && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePayWithMetamask(order.id)}
                    disabled={payingOrderId === order.id || !!payingOrderId}
                    className="h-8 px-2"
                    title="Pay with Metamask"
                  >
                    {payingOrderId === order.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Wallet className="h-4 w-4" />
                    )}
                    <span className={payingOrderId === order.id ? "sr-only" : "ml-1"}>Pay</span>
                  </Button>
                )}
                {user?.role !== 'customer' && (
                  <Button variant="ghost" size="icon" onClick={() => handleDeleteOrder(order.id)} aria-label="Delete order" className="h-8 w-8">
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                )}
                 {user?.role === 'customer' && order.status !== 'Awaiting Payment' && ( 
                    <Button variant="ghost" size="icon" onClick={() => alert(`Viewing order ${order.id} - details would show here.`)} aria-label="View order" className="h-8 w-8">
                        <Eye className="h-4 w-4 text-primary" />
                    </Button>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

    