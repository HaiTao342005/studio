import { Header } from '@/components/dashboard/Header';
import { PaymentFlowVisualization } from '@/components/dashboard/PaymentFlowVisualization';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface PaymentFlowsPageProps {
  params: {}; // Static route
  searchParams: { [key: string]: string | string[] | undefined };
}

export default function PaymentFlowsPage({ params, searchParams }: PaymentFlowsPageProps) {
  return (
    <>
      <Header title="Payment Flow Visualization" />
      <main className="flex-1 p-6 space-y-6">
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>Understanding Payment Flows</CardTitle>
            <CardDescription>
              Visualize the typical journey of payments in international fruit trade.
            </CardDescription>
          </CardHeader>
          <CardContent>
             <PaymentFlowVisualization />
          </CardContent>
        </Card>
        
        <Card className="shadow-md">
          <CardHeader>
            <CardTitle>Key Considerations</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p><strong>Payment Methods:</strong> Common methods include Letters of Credit (L/C), Documentary Collections, and Open Account.</p>
            <p><strong>Intermediary Banks:</strong> Often, payments pass through one or more intermediary (correspondent) banks, especially for cross-border transactions.</p>
            <p><strong>Currency Exchange:</strong> FX rates and fees can impact the final amount received.</p>
            <p><strong>Timing:</strong> Payment processing times can vary significantly based on the method, banks involved, and regulatory checks.</p>
          </CardContent>
        </Card>
      </main>
    </>
  );
}
