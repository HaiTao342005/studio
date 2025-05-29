
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
import { Trash2, Wallet, Loader2 } from 'lucide-react';
import type { Order, OrderStatus, StoredOrder } from '@/types/transaction';
import { AppleIcon, BananaIcon, OrangeIcon, GrapeIcon, MangoIcon, FruitIcon } from '@/components/icons/FruitIcons';
import { format, parseISO } from 'date-fns';
import { useToast } from "@/hooks/use-toast";

const LOCAL_STORAGE_KEY = 'orders';

// IMPORTANT: Replace this with one of your Ganache account addresses!
const GANACHE_RECIPIENT_ADDRESS = "YOUR_GANACHE_ACCOUNT_ADDRESS_HERE";
const SIMULATED_PAYMENT_ETH_AMOUNT = "0.001"; // Simulate paying 0.001 ETH

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

const getFruitIcon = (fruitType: string): ElementType<SVGProps<SVGSVGElement>> => {
  const lowerFruitType = fruitType.toLowerCase();
  if (lowerFruitType.includes('apple')) return AppleIcon;
  if (lowerFruitType.includes('banana')) return BananaIcon;
  if (lowerFruitType.includes('orange')) return OrangeIcon;
  if (lowerFruitType.includes('grape')) return GrapeIcon;
  if (lowerFruitType.includes('mango')) return MangoIcon;
  return FruitIcon;
};

export function TransactionHistoryTable() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [payingOrderId, setPayingOrderId] = useState<string | null>(null);
  const { toast } = useToast();

  const loadOrders = () => {
    setIsLoading(true);
    try {
      const storedOrdersRaw = localStorage.getItem(LOCAL_STORAGE_KEY);
      const storedOrders: StoredOrder[] = storedOrdersRaw ? JSON.parse(storedOrdersRaw) : [];
      
      const displayOrders: Order[] = storedOrders.map(order => ({
        ...order,
        FruitIcon: getFruitIcon(order.fruitType),
      })).sort((a, b) => parseISO(b.date).getTime() - parseISO(a.date).getTime()); 

      setOrders(displayOrders);
    } catch (error) {
      console.error("Failed to load orders from localStorage:", error);
      toast({ title: "Error Loading Orders", description: (error as Error).message, variant: "destructive" });
      setOrders([]); 
    }
    setIsLoading(false);
  };

  useEffect(() => {
    loadOrders();
    const handleStorageChange = () => loadOrders();
    window.addEventListener('storage', handleStorageChange); 
    window.addEventListener('ordersUpdated', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('ordersUpdated', handleStorageChange);
    };
  }, []);

  const handleDeleteOrder = (orderId: string) => {
    try {
      const updatedOrders = orders.filter(order => order.id !== orderId);
      const storedUpdatedOrders = updatedOrders.map(({ FruitIcon, ...rest}) => rest); 
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(storedUpdatedOrders));
      setOrders(updatedOrders); 
      toast({ title: "Order Deleted", description: "The order has been removed from history." });
      window.dispatchEvent(new CustomEvent('ordersUpdated'));
    } catch (error) {
      console.error("Failed to delete order from localStorage:", error);
      toast({ title: "Error Deleting Order", description: (error as Error).message, variant: "destructive" });
    }
  };

  const handlePayWithMetamask = async (orderId: string) => {
    const orderToPay = orders.find(o => o.id === orderId);
    if (!orderToPay) {
      toast({ title: "Error", description: "Order not found.", variant: "destructive" });
      return;
    }

    if (GANACHE_RECIPIENT_ADDRESS === "YOUR_GANACHE_ACCOUNT_ADDRESS_HERE") {
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
    toast({ 
      title: "Initiating Payment", 
      description: "Please confirm the transaction in Metamask." 
    });

    try {
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' }) as string[];
      if (!accounts || accounts.length === 0) {
        toast({ title: "Connection Failed", description: "No accounts found in Metamask.", variant: "destructive" });
        setPayingOrderId(null);
        return;
      }
      const fromAccount = accounts[0];

      // Convert ETH amount to Wei in hexadecimal
      // Note: For a real app, orderToPay.amount would need to be reliably in ETH or converted.
      // Here we use a fixed SIMULATED_PAYMENT_ETH_AMOUNT.
      const amountInWei = BigInt(Math.floor(parseFloat(SIMULATED_PAYMENT_ETH_AMOUNT) * 1e18));
      const transactionParameters = {
        to: GANACHE_RECIPIENT_ADDRESS,
        from: fromAccount,
        value: '0x' + amountInWei.toString(16), // Value in hexadecimal Wei
      };

      // Send the transaction
      const txHash = await window.ethereum.request({
        method: 'eth_sendTransaction',
        params: [transactionParameters],
      }) as string;

      toast({ 
        title: "Transaction Submitted", 
        description: `Tx Hash: ${txHash.substring(0,10)}... Waiting for confirmation.`
      });

      // In a real app, you'd wait for transaction confirmation (e.g., by polling with ethers.js getTransactionReceipt)
      // For this simulation, we'll proceed after a short delay.
      await new Promise(resolve => setTimeout(resolve, 4000)); // Simulate mining time

      // Update order status in localStorage
      const storedOrdersRaw = localStorage.getItem(LOCAL_STORAGE_KEY);
      let storedOrders: StoredOrder[] = storedOrdersRaw ? JSON.parse(storedOrdersRaw) : [];
      storedOrders = storedOrders.map(o => 
        o.id === orderId ? { ...o, status: 'Paid' as OrderStatus } : o
      );
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(storedOrders));
      
      loadOrders(); // Reload orders to reflect the change
      
      toast({ 
        title: "Payment Confirmed!", 
        description: `Order for ${orderToPay.fruitType} marked as Paid. (Simulated confirmation)`, 
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
    return <p className="text-center py-8">Loading order history...</p>;
  }

  if (orders.length === 0) {
    return <p className="text-center text-muted-foreground py-8">No orders recorded yet. Record a new order to see it here.</p>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-[60px]">Icon</TableHead>
          <TableHead>Date</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Customer</TableHead>
          <TableHead>Supplier</TableHead>
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
            <TableCell>{format(parseISO(order.date), "MMM d, yyyy")}</TableCell>
            <TableCell className="font-medium">{order.fruitType}</TableCell>
            <TableCell>{order.customer}</TableCell>
            <TableCell>{order.supplier}</TableCell>
            <TableCell className="text-right">{order.currency} {order.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
            <TableCell className="text-right">{order.quantity.toLocaleString()} {order.unit}</TableCell>
            <TableCell>
              <Badge variant={getStatusBadgeVariant(order.status)}>{order.status}</Badge>
            </TableCell>
            <TableCell className="space-x-1 text-center">
              {order.status === 'Awaiting Payment' && (
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
              <Button variant="ghost" size="icon" onClick={() => handleDeleteOrder(order.id)} aria-label="Delete order" className="h-8 w-8">
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
