
"use client";

import { Header } from '@/components/dashboard/Header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Truck } from 'lucide-react';

interface ManageShipmentsPageProps {
  params: {};
  searchParams: { [key: string]: string | string[] | undefined };
}

export default function ManageShipmentsPage({ params, searchParams }: ManageShipmentsPageProps) {
  return (
    <>
      <Header title="Manage Shipments" />
      <main className="flex-1 p-6 space-y-6">
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Truck className="h-6 w-6 text-primary" />
              Your Shipments
            </CardTitle>
            <CardDescription>
              View, update, and manage all your ongoing and past shipments.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="py-10 text-center">
              <h3 className="text-xl font-semibold text-muted-foreground">Feature Coming Soon!</h3>
              <p className="text-sm text-muted-foreground">
                This section will allow you to manage all your transportation assignments.
              </p>
            </div>
          </CardContent>
        </Card>
      </main>
    </>
  );
}
