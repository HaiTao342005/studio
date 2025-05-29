import { Header } from '@/components/dashboard/Header';
import { PaymentFlowVisualization } from '@/components/dashboard/PaymentFlowVisualization'; // Will need updates
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface PaymentTrackingPageProps { // Renamed page props
  params: {}; 
  searchParams: { [key: string]: string | string[] | undefined };
}

export default function PaymentTrackingPage({ params, searchParams }: PaymentTrackingPageProps) { // Renamed page component
  return (
    <>
      <Header title="Payment Tracking" /> {/* Changed title */}
      <main className="flex-1 p-6 space-y-6">
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>Understanding Order Payment Status</CardTitle> {/* Changed title */}
            <CardDescription>
              Visualize the typical journey of payments for customer orders.
            </CardDescription>
          </CardHeader>
          <CardContent>
             <PaymentFlowVisualization />
          </CardContent>
        </Card>
        
        <Card className="shadow-md">
          <CardHeader>
            <CardTitle>Key Considerations for Suppliers</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p><strong>Payment Terms:</strong> Clearly define payment terms with your customers (e.g., Net 30, upfront, Letter of Credit).</p>
            <p><strong>Payment Methods:</strong> Offer and track various payment methods (e.g., bank transfer, credit card - if applicable, L/C).</p>
            <p><strong>Communication:</strong> Maintain clear communication with customers regarding payment due dates and confirmations.</p>
            <p><strong>Record Keeping:</strong> Ensure accurate records of payments received and outstanding balances.</p>
          </CardContent>
        </Card>
      </main>
    </>
  );
}
