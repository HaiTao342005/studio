
"use client";

import { useState, useEffect, useMemo } from 'react';
import { Header } from '@/components/dashboard/Header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { StoredOrder, OrderStatus } from '@/types/transaction';
import { db } from '@/lib/firebase/config';
import { collection, onSnapshot, query, orderBy, Timestamp } from 'firebase/firestore';
import { format } from 'date-fns';
import { Hourglass, CheckCircle2, ListChecks, Truck, Ban, Loader2, Info } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface PaymentTrackingPageProps {
  params: {};
  searchParams: { [key: string]: string | string[] | undefined };
}

interface StatCardProps {
  title: string;
  value: number;
  Icon: LucideIcon;
  description?: string;
  color?: string;
}

const StatCard = ({ title, value, Icon, description, color = 'text-primary' }: StatCardProps) => (
  <Card className="shadow-md">
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-sm font-medium">{title}</CardTitle>
      <Icon className={`h-5 w-5 ${color}`} />
    </CardHeader>
    <CardContent>
      <div className="text-3xl font-bold">{value}</div>
      {description && <p className="text-xs text-muted-foreground">{description}</p>}
    </CardContent>
  </Card>
);

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


export default function PaymentTrackingPage({ params, searchParams }: PaymentTrackingPageProps) {
  const [orders, setOrders] = useState<StoredOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(true);
    const q = query(collection(db, "orders"), orderBy("orderDate", "desc")); // order by orderDate
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const fetchedOrders: StoredOrder[] = [];
      querySnapshot.forEach((doc) => {
        fetchedOrders.push({
          ...(doc.data() as Omit<StoredOrder, 'id' | 'orderDate'>), // Use orderDate here
          id: doc.id,
          orderDate: doc.data().orderDate as Timestamp, 
        });
      });
      setOrders(fetchedOrders);
      setIsLoading(false);
    }, (error) => {
      console.error("Error fetching orders from Firestore:", error);
      setIsLoading(false);
      setOrders([]);
    });

    return () => unsubscribe();
  }, []);

  const orderStatusCounts = useMemo(() => {
    const counts: Record<OrderStatus, number> = {
      'Pending': 0,
      'Awaiting Payment': 0,
      'Paid': 0,
      'Shipped': 0,
      'Delivered': 0,
      'Cancelled': 0,
    };
    orders.forEach(order => {
      counts[order.status]++;
    });
    return counts;
  }, [orders]);

  const ordersAwaitingPayment = useMemo(() => {
    return orders.filter(order => order.status === 'Awaiting Payment');
  }, [orders]);

  return (
    <>
      <Header title="Payment Tracking Dashboard" />
      <main className="flex-1 p-6 space-y-6">
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>Order Payment Status Overview</CardTitle>
            <CardDescription>
              Summary of your current order payment statuses.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin mr-2 text-primary" />
                <p className="text-muted-foreground">Loading order data...</p>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <StatCard 
                  title="Awaiting Payment" 
                  value={orderStatusCounts['Awaiting Payment']} 
                  Icon={Hourglass} 
                  color="text-yellow-500"
                  description="Orders needing payment"
                />
                <StatCard 
                  title="Paid" 
                  value={orderStatusCounts['Paid']} 
                  Icon={CheckCircle2} 
                  color="text-green-500"
                  description="Successfully paid orders"
                />
                <StatCard 
                  title="Pending" 
                  value={orderStatusCounts['Pending']} 
                  Icon={ListChecks}
                  color="text-blue-500"
                  description="Orders pending action/confirmation"
                />
                <StatCard 
                  title="Shipped" 
                  value={orderStatusCounts['Shipped']} 
                  Icon={Truck}
                  color="text-purple-500"
                  description="Orders on their way"
                />
              </div>
            )}
          </CardContent>
        </Card>
        
        <Card className="shadow-md">
          <CardHeader>
            <CardTitle>Orders Awaiting Payment</CardTitle>
            <CardDescription>A list of orders currently awaiting payment from customers.</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
               <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin mr-2 text-primary" />
                <p className="text-muted-foreground">Loading...</p>
              </div>
            ) : ordersAwaitingPayment.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <Info className="h-12 w-12 text-green-500 mb-4" />
                <p className="text-lg font-semibold text-muted-foreground">No Orders Awaiting Payment</p>
                <p className="text-sm text-muted-foreground">All caught up!</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Order Date</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Product</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ordersAwaitingPayment.map((order) => (
                      <TableRow key={order.id}>
                        <TableCell>{format(order.orderDate.toDate(), "MMM d, yyyy")}</TableCell>
                        <TableCell>{order.customerName}</TableCell>
                        <TableCell className="font-medium">{order.productName || (order as any).fruitType}</TableCell>
                        <TableCell className="text-right">{order.currency} {order.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                        <TableCell>
                          <Badge variant={getStatusBadgeVariant(order.status)}>{order.status}</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

         <Card className="shadow-md">
          <CardHeader>
            <CardTitle>Key Considerations for Suppliers</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p><strong>Payment Terms:</strong> Clearly define payment terms with your customers (e.g., Net 30, upfront payment before shipping).</p>
            <p><strong>Payment Method (Simulated):</strong> This app simulates payments using Metamask for Ethereum (ETH). In a real-world scenario, ensure your customers are comfortable and equipped for cryptocurrency transactions if this is your primary method.</p>
            <p><strong>Communication:</strong> Maintain clear communication with customers regarding payment due dates and confirmations, especially for crypto transactions which involve wallet addresses and network confirmations.</p>
            <p><strong>Record Keeping:</strong> Ensure accurate records of payments received and outstanding balances using a centralized system like Firestore, which tracks order statuses updated via the simulated Metamask payments.</p>
          </CardContent>
        </Card>
      </main>
    </>
  );
}

    