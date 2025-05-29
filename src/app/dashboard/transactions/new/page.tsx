import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TransactionForm } from "@/components/transactions/TransactionForm"; // Keeping component name for now
import { Header } from "@/components/dashboard/Header";

interface NewOrderPageProps { // Renamed from NewTransactionPageProps
  params: {}; 
  searchParams: { [key: string]: string | string[] | undefined };
}

export default function NewOrderPage({ params, searchParams }: NewOrderPageProps) { // Renamed
  return (
    <>
      <Header title="Record New Order" /> {/* Changed title */}
      <main className="flex-1 p-6">
        <Card className="max-w-4xl mx-auto shadow-lg">
          <CardHeader>
            <CardTitle>New Order Details</CardTitle> {/* Changed title */}
            <CardDescription>
              Enter the specifics of the customer order. All fields marked with * are required.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <TransactionForm /> {/* The underlying form component is still named TransactionForm */}
          </CardContent>
        </Card>
      </main>
    </>
  );
}
