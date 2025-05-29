
"use client";

import { Header } from '@/components/dashboard/Header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ClipboardList } from 'lucide-react';

interface MyOrdersPageProps {
  params: {};
  searchParams: { [key: string]: string | string[] | undefined };
}

export default function MyOrdersPage({ params, searchParams }: MyOrdersPageProps) {
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
            <div className="py-10 text-center">
              <h3 className="text-xl font-semibold text-muted-foreground">Feature Coming Soon!</h3>
              <p className="text-sm text-muted-foreground">
                This section will display your order history.
              </p>
            </div>
          </CardContent>
        </Card>
      </main>
    </>
  );
}
