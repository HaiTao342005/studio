
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
import { Trash2 } from 'lucide-react';
import type { Order, OrderStatus, StoredOrder } from '@/types/transaction'; // Changed Transaction to Order, etc.
import { AppleIcon, BananaIcon, OrangeIcon, GrapeIcon, MangoIcon, FruitIcon } from '@/components/icons/FruitIcons';
import { format, parseISO } from 'date-fns';

const LOCAL_STORAGE_KEY = 'orders'; // Changed from 'transactions'

const getStatusBadgeVariant = (status: OrderStatus): "default" | "secondary" | "destructive" | "outline" => {
  switch (status) {
    case 'Paid': return 'default'; // Green for paid
    case 'Delivered': return 'default';
    case 'Shipped': return 'secondary';
    case 'Awaiting Payment': return 'outline'; // Yellow/Orange for awaiting payment
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
  return FruitIcon; // Default icon
};

// Renamed TransactionHistoryTable to OrderHistoryTable internally, but keeping export name for now
export function TransactionHistoryTable() { 
  const [orders, setOrders] = useState<Order[]>([]); // Changed transactions to orders
  const [isLoading, setIsLoading] = useState(true);

  const loadOrders = () => { // Renamed from loadTransactions
    setIsLoading(true);
    try {
      const storedOrdersRaw = localStorage.getItem(LOCAL_STORAGE_KEY);
      const storedOrders: StoredOrder[] = storedOrdersRaw ? JSON.parse(storedOrdersRaw) : [];
      
      const displayOrders: Order[] = storedOrders.map(order => ({ // Changed tx to order
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
    window.addEventListener('ordersUpdated', handleStorageChange); // Changed event name

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('ordersUpdated', handleStorageChange);
    };
  }, []);

  const handleDeleteOrder = (orderId: string) => { // Changed transactionId to orderId
    try {
      const updatedOrders = orders.filter(order => order.id !== orderId);
      const storedUpdatedOrders = updatedOrders.map(({ FruitIcon, ...rest}) => rest); 
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(storedUpdatedOrders));
      setOrders(updatedOrders); 
      window.dispatchEvent(new CustomEvent('ordersUpdated')); // Changed event name
    } catch (error) {
      console.error("Failed to delete order from localStorage:", error);
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
          <TableHead>Customer</TableHead> {/* Changed from Importer */}
          <TableHead>Supplier</TableHead> {/* Changed from Exporter */}
          <TableHead className="text-right">Amount</TableHead>
          <TableHead className="text-right">Quantity</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="w-[80px]">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {orders.map((order) => ( // Changed transaction to order
          <TableRow key={order.id}>
            <TableCell>
              {order.FruitIcon ? <order.FruitIcon className="h-6 w-6 text-accent" /> : <FruitIcon className="h-6 w-6 text-gray-400" />}
            </TableCell>
            <TableCell>{format(parseISO(order.date), "MMM d, yyyy")}</TableCell>
            <TableCell className="font-medium">{order.fruitType}</TableCell>
            <TableCell>{order.customer}</TableCell> {/* Changed from importer */}
            <TableCell>{order.supplier}</TableCell> {/* Changed from exporter */}
            <TableCell className="text-right">{order.currency} {order.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
            <TableCell className="text-right">{order.quantity.toLocaleString()} {order.unit}</TableCell>
            <TableCell>
              <Badge variant={getStatusBadgeVariant(order.status)}>{order.status}</Badge>
            </TableCell>
            <TableCell>
              <Button variant="ghost" size="icon" onClick={() => handleDeleteOrder(order.id)} aria-label="Delete order">
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
