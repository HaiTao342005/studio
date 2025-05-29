
"use client";

import { Header } from '@/components/dashboard/Header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CreditCard } from 'lucide-react';

interface MyPaymentsPageProps {
  params: {};
  searchParams: { [key: string]: string | string[] | undefined };
}

export default function MyPaymentsPage({ params, searchParams }: MyPaymentsPageProps) {
  return (
    <>
      <Header title="My Payments" />
      <main className="flex-1 p-6 space-y-6">
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-6 w-6 text-primary" />
              Your Payment History & Options
            </CardTitle>
            <CardDescription>
              Review your payment history and manage payment methods.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="py-10 text-center">
              <h3 className="text-xl font-semibold text-muted-foreground">Feature Coming Soon!</h3>
              <p className="text-sm text-muted-foreground">
                This section will allow you to view payment history and make payments.
              </p>
            </div>
          </CardContent>
        </Card>
      </main>
    </>
  );
}
