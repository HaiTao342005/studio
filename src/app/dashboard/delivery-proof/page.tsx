
"use client";

import { Header } from '@/components/dashboard/Header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PackageSearch } from 'lucide-react';

interface ProofOfDeliveryPageProps {
  params: {};
  searchParams: { [key: string]: string | string[] | undefined };
}

export default function ProofOfDeliveryPage({ params, searchParams }: ProofOfDeliveryPageProps) {
  return (
    <>
      <Header title="Proof of Delivery" />
      <main className="flex-1 p-6 space-y-6">
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PackageSearch className="h-6 w-6 text-primary" />
              Upload & Manage Proof of Delivery
            </CardTitle>
            <CardDescription>
              Submit and view proof of delivery documents for completed shipments.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="py-10 text-center">
              <h3 className="text-xl font-semibold text-muted-foreground">Feature Coming Soon!</h3>
              <p className="text-sm text-muted-foreground">
                This section will allow you to upload and manage proof of delivery documents.
              </p>
            </div>
          </CardContent>
        </Card>
      </main>
    </>
  );
}
