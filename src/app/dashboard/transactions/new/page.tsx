
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TransactionForm } from "@/components/transactions/TransactionForm";
import { Header } from "@/components/dashboard/Header";

interface NewOrderPageProps {
  params: {}; 
  searchParams: { [key: string]: string | string[] | undefined };
}

export default function NewOrderPage({ params: originalParams, searchParams: originalSearchParams }: NewOrderPageProps) {
  const params = React.use(originalParams); // Unwrapping params
  const searchParams = React.use(originalSearchParams); // Unwrapping searchParams

  return (
    <>
      <Header title="Record New Order" />
      <main className="flex-1 p-6">
        <Card className="max-w-4xl mx-auto shadow-lg">
          <CardHeader>
            <CardTitle>New Order Details</CardTitle>
            <CardDescription>
              Enter the specifics of the customer order. All fields marked with * are required.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <TransactionForm />
          </CardContent>
        </Card>
      </main>
    </>
  );
}
