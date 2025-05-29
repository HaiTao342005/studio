
"use client";

import { Header } from '@/components/dashboard/Header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FileText } from 'lucide-react';

interface MyDocumentsPageProps {
  params: {};
  searchParams: { [key: string]: string | string[] | undefined };
}

export default function MyDocumentsPage({ params, searchParams }: MyDocumentsPageProps) {
  return (
    <>
      <Header title="My Documents" />
      <main className="flex-1 p-6 space-y-6">
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-6 w-6 text-primary" />
              Your Documents
            </CardTitle>
            <CardDescription>
              Access and download invoices, shipping documents, and other relevant files.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="py-10 text-center">
              <h3 className="text-xl font-semibold text-muted-foreground">Feature Coming Soon!</h3>
              <p className="text-sm text-muted-foreground">
                This section will provide access to your order-related documents.
              </p>
            </div>
          </CardContent>
        </Card>
      </main>
    </>
  );
}
