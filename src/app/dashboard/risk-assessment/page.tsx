
"use client";

import { useState, type ElementType } from 'react';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
// import { assessPaymentRisk, type PaymentRiskInput, type PaymentRiskOutput } from '@/ai/flows/payment-risk-assessment';
// For now, let's define a placeholder for PaymentRiskOutput if the import is an issue.
// If `PaymentRiskOutput` is exported separately from the flow, that import can remain.
// Assuming PaymentRiskOutput might be part of the issue or complex:
interface DummyPaymentRiskOutput {
  riskScore: number;
  justification: string;
}
import type { PaymentRiskOutput } from '@/ai/flows/payment-risk-assessment'; // Let's try keeping this if it's just a type

import { Header } from '@/components/dashboard/Header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label as UILabel } from '@/components/ui/label'; // Renamed to avoid conflict
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
// import { useToast } from "@/hooks/use-toast"; // Comment out toast
import { Loader2, AlertCircle, CheckCircle, Info, BarChartBig } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";

const RiskAssessmentFormSchema = z.object({
  importerName: z.string().min(2, { message: "Importer name must be at least 2 characters." }),
  exporterName: z.string().min(2, { message: "Exporter name must be at least 2 characters." }),
  importerCountry: z.string().min(2, { message: "Importer country must be at least 2 characters." }),
  exporterCountry: z.string().min(2, { message: "Exporter country must be at least 2 characters." }),
  transactionAmount: z.coerce.number().positive({ message: "Transaction amount must be a positive number." }),
});
type RiskAssessmentFormData = z.infer<typeof RiskAssessmentFormSchema>;

interface RiskAssessmentPageProps {
  params: {};
  searchParams: { [key: string]: string | string[] | undefined };
}

export default function RiskAssessmentPage({ params, searchParams }: RiskAssessmentPageProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [riskResult, setRiskResult] = useState<PaymentRiskOutput | null>(null); // Using original type, ensure it's correctly imported/defined
  const [formError, setFormError] = useState<string | null>(null);
  // const { toast } = useToast(); // Toast hook commented out

  const form = useForm<RiskAssessmentFormData>({
    resolver: zodResolver(RiskAssessmentFormSchema),
    defaultValues: {
      importerName: '',
      exporterName: '',
      importerCountry: '',
      exporterCountry: '',
      transactionAmount: 0,
    },
  });

  // Simplified onSubmit handler
  const onSubmit: SubmitHandler<RiskAssessmentFormData> = (data) => {
    console.log("Form submitted (simplified):", data);
    setIsLoading(true);
    setRiskResult(null); // Reset previous results
    setFormError(null);  // Reset previous errors

    // Simulate a delay and a dummy result
    setTimeout(() => {
      // setRiskResult({ riskScore: Math.floor(Math.random() * 100), justification: "This is a dummy justification." });
      setIsLoading(false);
    }, 1000);
  };

  const getRiskLevel = (score: number): { level: string; color: string; Icon: ElementType } => {
    if (score < 30) return { level: 'Low', color: 'text-green-600 dark:text-green-400', Icon: CheckCircle };
    if (score < 70) return { level: 'Medium', color: 'text-yellow-600 dark:text-yellow-400', Icon: Info };
    return { level: 'High', color: 'text-red-600 dark:text-red-400', Icon: AlertCircle };
  };

  return (
    <div>
      <Header title="Payment Risk Assessment" />
      <main className="flex-1 p-6 grid md:grid-cols-2 gap-6 items-start">
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>Assess Transaction Risk</CardTitle>
            <CardDescription>
              Enter transaction details to get an AI-powered risk assessment.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="importerName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Importer Name</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Global Fruits Inc." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="exporterName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Exporter Name</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Tropical Exports Co." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="importerCountry"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Importer Country</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., USA" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="exporterCountry"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Exporter Country</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Brazil" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="transactionAmount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Transaction Amount (USD)</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="e.g., 50000" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" disabled={isLoading} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground">
                  {isLoading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <BarChartBig className="mr-2 h-4 w-4" />
                  )}
                  Assess Risk
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>

        <Card className="shadow-lg sticky top-20">
          <CardHeader>
            <CardTitle>Assessment Result</CardTitle>
            <CardDescription>
              The AI-generated risk score and justification will appear here.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoading && (
              <div className="flex items-center justify-center p-8 text-muted-foreground">
                <Loader2 className="mr-2 h-8 w-8 animate-spin text-primary" />
                <span>Generating assessment...</span>
              </div>
            )}
            {formError && !isLoading && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{formError}</AlertDescription>
              </Alert>
            )}
            {riskResult && !isLoading && !formError && (
              <div className="space-y-4">
                <div>
                  <UILabel htmlFor="riskScoreDisplay" className="text-lg font-semibold">Risk Score</UILabel>
                  <div className="flex items-center gap-2 mt-1">
                    <Progress value={riskResult.riskScore} className="w-full h-4" id="riskScoreDisplay" />
                    <span className={`text-2xl font-bold ${getRiskLevel(riskResult.riskScore).color}`}>
                      {riskResult.riskScore}/100
                    </span>
                  </div>
                   <div className="flex items-center mt-2 text-sm">
                     <getRiskLevel(riskResult.riskScore).Icon className={`mr-2 h-5 w-5 ${getRiskLevel(riskResult.riskScore).color}`} />
                     <span className={`font-medium ${getRiskLevel(riskResult.riskScore).color}`}>
                       Risk Level: {getRiskLevel(riskResult.riskScore).level}
                     </span>
                   </div>
                </div>
                <div>
                  <UILabel className="text-lg font-semibold">Justification</UILabel>
                  <p className="mt-1 text-sm text-muted-foreground bg-muted p-3 rounded-md whitespace-pre-wrap">
                    {riskResult.justification}
                  </p>
                </div>
              </div>
            )}
            {!isLoading && !riskResult && !formError && (
              <div className="flex items-center justify-center p-8 text-muted-foreground">
                <Info className="mr-2 h-5 w-5" />
                <span>Submit the form to see the risk assessment.</span>
              </div>
            )}
          </CardContent>
           <CardFooter className="text-xs text-muted-foreground">
            Risk scores are indicative and based on AI analysis. Always perform due diligence.
          </CardFooter>
        </Card>
      </main>
    </div>
  );
}
