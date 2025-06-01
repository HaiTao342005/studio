
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TransactionHistoryTable } from "@/components/transactions/TransactionHistoryTable";
import { Header } from "@/components/dashboard/Header";

interface OrderHistoryPageProps {
  params: {}; 
  searchParams: { [key: string]: string | string[] | undefined };
}

export default function OrderHistoryPage({ params: originalParams, searchParams: originalSearchParams }: OrderHistoryPageProps) {
  const params = React.use(originalParams); // Unwrapping params
  const searchParams = React.use(originalSearchParams); // Unwrapping searchParams

  return (
    <>
      <Header title="Order History" />
      <main className="flex-1 p-6">
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>Historical Orders</CardTitle>
            <CardDescription>
              Browse through all recorded customer orders.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <TransactionHistoryTable />
          </CardContent>
        </Card>
      </main>
    </>
  );
}
