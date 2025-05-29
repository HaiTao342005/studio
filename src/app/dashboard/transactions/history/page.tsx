import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TransactionHistoryTable } from "@/components/transactions/TransactionHistoryTable";
import { Header } from "@/components/dashboard/Header";

interface TransactionHistoryPageProps {
  params: {}; // Static route
  searchParams: { [key: string]: string | string[] | undefined };
}

export default function TransactionHistoryPage({ params, searchParams }: TransactionHistoryPageProps) {
  return (
    <>
      <Header title="Transaction History" />
      <main className="flex-1 p-6">
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>Historical Transactions</CardTitle>
            <CardDescription>
              Browse through all recorded import/export deals.
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
