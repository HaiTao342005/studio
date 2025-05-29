
"use client";

import { Header } from '@/components/dashboard/Header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ClipboardList, Loader2, Info } from 'lucide-react';
import { TransactionHistoryTable } from '@/components/transactions/TransactionHistoryTable'; // Re-using for customer view
import { useAuth } from '@/contexts/AuthContext';
import { StoredOrder } from '@/types/transaction';
import { db } from '@/lib/firebase/config';
import { collection, onSnapshot, query, where, Timestamp } from 'firebase/firestore';
import { useState, useEffect } from 'react';

interface MyOrdersPageProps {
  params: {};
  searchParams: { [key: string]: string | string[] | undefined };
}

export default function MyOrdersPage({ params, searchParams }: MyOrdersPageProps) {
  const { user } = useAuth();
  const [customerOrders, setCustomerOrders] = useState<StoredOrder[]>([]);
  const [isLoadingOrders, setIsLoadingOrders] = useState(true);

  useEffect(() => {
    if (user && user.role === 'customer') {
      setIsLoadingOrders(true);
      const ordersQuery = query(
        collection(db, "orders"),
        where("customerId", "==", user.id),
        // orderBy("orderDate", "desc") // Requires composite index if not already present
      );

      const unsubscribe = onSnapshot(ordersQuery, (querySnapshot) => {
        const fetchedOrders: StoredOrder[] = [];
        querySnapshot.forEach((doc) => {
          fetchedOrders.push({
            ...(doc.data() as Omit<StoredOrder, 'id' | 'date'>),
            id: doc.id,
            date: doc.data().orderDate as Timestamp, // Ensure field name matches Firestore
          });
        });
         // Sort manually as orderBy might require composite index setup
        fetchedOrders.sort((a, b) => b.date.toMillis() - a.date.toMillis());
        setCustomerOrders(fetchedOrders);
        setIsLoadingOrders(false);
      }, (error) => {
        console.error("Error fetching customer orders:", error);
        setIsLoadingOrders(false);
      });

      return () => unsubscribe();
    } else {
      setIsLoadingOrders(false);
    }
  }, [user]);


  return (
    <>
      <Header title="My Orders" />
      <main className="flex-1 p-6 space-y-6">
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClipboardList className="h-6 w-6 text-primary" />
              Your Order History
            </CardTitle>
            <CardDescription>
              View the status and details of all your past and current orders.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingOrders && (
              <div className="flex justify-center items-center py-10">
                <Loader2 className="h-8 w-8 animate-spin text-primary mr-2" />
                <p className="text-muted-foreground">Loading your orders...</p>
              </div>
            )}
            {!isLoadingOrders && customerOrders.length === 0 && (
              <div className="py-10 text-center">
                 <Info className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-xl font-semibold text-muted-foreground">No Orders Found</h3>
                <p className="text-sm text-muted-foreground">
                  You haven't placed any orders yet. Start by finding products!
                </p>
              </div>
            )}
            {!isLoadingOrders && customerOrders.length > 0 && (
              // Pass only the customer's orders to the table
              <TransactionHistoryTable initialOrders={customerOrders} isCustomerView={true} />
            )}
          </CardContent>
        </Card>
      </main>
    </>
  );
}
