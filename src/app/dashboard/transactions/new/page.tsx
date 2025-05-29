import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TransactionForm } from "@/components/transactions/TransactionForm";
import { Header } from "@/components/dashboard/Header";

interface NewTransactionPageProps {
  params: {}; // Static route
  searchParams: { [key: string]: string | string[] | undefined };
}

export default function NewTransactionPage({ params, searchParams }: NewTransactionPageProps) {
  return (
    <>
      <Header title="Record New Transaction" />
      <main className="flex-1 p-6">
        <Card className="max-w-4xl mx-auto shadow-lg">
          <CardHeader>
            <CardTitle>New Transaction Details</CardTitle>
            <CardDescription>
              Enter the specifics of the import/export deal. All fields marked with * are required.
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
