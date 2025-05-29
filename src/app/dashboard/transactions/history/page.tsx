import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TransactionHistoryTable } from "@/components/transactions/TransactionHistoryTable"; // Keeping component name for now
import { Header } from "@/components/dashboard/Header";

interface OrderHistoryPageProps { // Renamed from TransactionHistoryPageProps
  params: {}; 
  searchParams: { [key: string]: string | string[] | undefined };
}

export default function OrderHistoryPage({ params, searchParams }: OrderHistoryPageProps) { // Renamed
  return (
    <>
      <Header title="Order History" /> {/* Changed title */}
      <main className="flex-1 p-6">
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>Historical Orders</CardTitle> {/* Changed title */}
            <CardDescription>
              Browse through all recorded customer orders.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <TransactionHistoryTable /> {/* The underlying table component is still named TransactionHistoryTable */}
          </CardContent>
        </Card>
      </main>
    </>
  );
}
