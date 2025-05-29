
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
import { Trash2, Wallet, Loader2 } from 'lucide-react'; // Added Wallet and Loader2
import type { Order, OrderStatus, StoredOrder } from '@/types/transaction';
import { AppleIcon, BananaIcon, OrangeIcon, GrapeIcon, MangoIcon, FruitIcon } from '@/components/icons/FruitIcons';
import { format, parseISO } from 'date-fns';
import { useToast } from "@/hooks/use-toast"; // Added useToast

const LOCAL_STORAGE_KEY = 'orders';

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
  const [payingOrderId, setPayingOrderId] = useState<string | null>(null); // State for managing payment simulation
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
      toast({ title: "Error", description: "Could not delete order.", variant: "destructive" });
    }
  };

  const handlePayWithMetamask = async (orderId: string) => {
    const orderToPay = orders.find(o => o.id === orderId);
    if (!orderToPay) {
      toast({ title: "Error", description: "Order not found.", variant: "destructive" });
      return;
    }

    setPayingOrderId(orderId);
    toast({ 
      title: "Initiating Smart Contract Payment", 
      description: "Please confirm the transaction in your wallet (e.g., Metamask)." 
    });

    // Simulate Metamask interaction and user confirmation
    await new Promise(resolve => setTimeout(resolve, 2500));

    // --- START: Placeholder for actual Metamask/ethers.js interaction ---
    // 1. Connect to Metamask/provider (e.g., using ethers.js)
    //    const provider = new ethers.BrowserProvider(window.ethereum);
    //    await provider.send("eth_requestAccounts", []);
    //    const signer = await provider.getSigner();
    //
    // 2. Prepare the transaction details (amount, recipient from a smart contract)
    //    const contractAddress = "YOUR_SMART_CONTRACT_ADDRESS_ON_GANACHE";
    //    const contractABI = [ /* ... your contract's ABI ... */ ];
    //    const contract = new ethers.Contract(contractAddress, contractABI, signer);
    //    const amountInWei = ethers.parseEther((orderToPay.amount / 1000).toString()); // Example conversion
    //    const transactionResponse = await contract.payOrder(orderId, { value: amountInWei });
    //
    // 3. Send the transaction
    //    toast({ title: "Processing Payment", description: `Transaction sent: ${transactionResponse.hash}. Waiting for confirmation...` });
    //    await transactionResponse.wait(); // Wait for transaction to be mined
    // --- END: Placeholder for actual Metamask/ethers.js interaction ---

    // For simulation, assume payment is successful after some delay
    toast({ 
      title: "Transaction Submitted", 
      description: "Waiting for confirmation from the simulated blockchain (e.g., Ganache)..." 
    });
    await new Promise(resolve => setTimeout(resolve, 3500)); // Simulate transaction mining time

    try {
      const storedOrdersRaw = localStorage.getItem(LOCAL_STORAGE_KEY);
      let storedOrders: StoredOrder[] = storedOrdersRaw ? JSON.parse(storedOrdersRaw) : [];
      storedOrders = storedOrders.map(o => 
        o.id === orderId ? { ...o, status: 'Paid' as OrderStatus } : o
      );
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(storedOrders));
      loadOrders(); // Reload orders to reflect the change
      toast({ 
        title: "Payment Confirmed!", 
        description: `Order for ${orderToPay.fruitType} marked as Paid. (Simulated blockchain confirmation)`, 
        variant: "default" 
      });
    } catch (error) {
      console.error("Failed to update order status in localStorage:", error);
      toast({ title: "Storage Error", description: "Could not update order status.", variant: "destructive" });
    } finally {
      setPayingOrderId(null);
    }
  };

  if (isLoading) {
    return <p>Loading order history...</p>;
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
                  disabled={payingOrderId === order.id || !!payingOrderId} // Disable if any payment is in progress
                  className="h-8 px-2"
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

