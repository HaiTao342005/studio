
"use client";

import { Header } from '@/components/dashboard/Header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Coins, Loader2, Info } from 'lucide-react';
import { TransactionHistoryTable } from '@/components/transactions/TransactionHistoryTable';
import { useAuth } from '@/contexts/AuthContext';
import { StoredOrder } from '@/types/transaction';
import { db } from '@/lib/firebase/config';
import { collection, onSnapshot, query, where, Timestamp } from 'firebase/firestore';
import { useState, useEffect } from 'react';

interface MyEscrowPageProps {
  params: {};
  searchParams: { [key: string]: string | string[] | undefined };
}

export default function MyEscrowPage({ params, searchParams }: MyEscrowPageProps) {
  const { user } = useAuth();
  const [escrowedOrders, setEscrowedOrders] = useState<StoredOrder[]>([]);
  const [isLoadingOrders, setIsLoadingOrders] = useState(true);

  useEffect(() => {
    if (user && user.role === 'customer') {
      setIsLoadingOrders(true);
      // Query for orders that are 'Paid' (funds in escrow) or 'Delivered' (goods received, awaiting customer confirmation for fund release)
      const ordersQuery = query(
        collection(db, "orders"),
        where("customerId", "==", user.id),
        where("status", "in", ["Paid", "Delivered"])
      );

      const unsubscribe = onSnapshot(ordersQuery, (querySnapshot) => {
        const fetchedOrders: StoredOrder[] = [];
        querySnapshot.forEach((doc) => {
          fetchedOrders.push({
            ...(doc.data() as Omit<StoredOrder, 'id'>), 
            id: doc.id,
          });
        });
        // Client-side sorting as a workaround if no orderBy is used in query
        fetchedOrders.sort((a, b) => {
            const dateA = (a.orderDate as Timestamp)?.toMillis() || 0;
            const dateB = (b.orderDate as Timestamp)?.toMillis() || 0;
            return dateB - dateA;
        });
        setEscrowedOrders(fetchedOrders);
        setIsLoadingOrders(false);
      }, (error) => {
        console.error("Error fetching escrowed orders:", error);
        setIsLoadingOrders(false);
        // Optionally, show a toast message for the error
      });

      return () => unsubscribe();
    } else {
      setIsLoadingOrders(false); // Not a customer or user not loaded
      setEscrowedOrders([]);
    }
  }, [user]);


  return (
    <>
      <Header title="My Escrowed Payments" />
      <main className="flex-1 p-6 space-y-6">
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Coins className="h-6 w-6 text-primary" />
              Your Funds in Escrow
            </CardTitle>
            <CardDescription>
              These are orders you have paid for. The funds are held securely until you confirm receipt of the goods.
              If an order is marked 'Delivered', please confirm or deny receipt to release funds or raise a dispute.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingOrders && (
              <div className="flex justify-center items-center py-10">
                <Loader2 className="h-8 w-8 animate-spin text-primary mr-2" />
                <p className="text-muted-foreground">Loading your escrowed payments...</p>
              </div>
            )}
            {!isLoadingOrders && escrowedOrders.length === 0 && (
              <div className="py-10 text-center">
                 <Info className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-xl font-semibold text-muted-foreground">No Payments in Escrow</h3>
                <p className="text-sm text-muted-foreground">
                  You have no orders currently awaiting your receipt confirmation.
                </p>
              </div>
            )}
            {!isLoadingOrders && escrowedOrders.length > 0 && (
              <TransactionHistoryTable initialOrders={escrowedOrders} isCustomerView={true} />
            )}
          </CardContent>
        </Card>
      </main>
    </>
  );
}

    