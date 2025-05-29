
"use client";

import type { ElementType } from 'react';
import { useState } from 'react';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import { Header } from '@/components/dashboard/Header';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { assessPaymentRisk, type PaymentRiskOutput, type PaymentRiskInput } from '@/ai/flows/payment-risk-assessment';
import { Loader2, AlertTriangle, ShieldCheck, ShieldAlert, ShieldQuestion } from 'lucide-react';

interface CustomerRiskPageProps { // Renamed page props
  params: {}; 
  searchParams: { [key: string]: string | string[] | undefined };
}

const formSchema = z.object({
  customerName: z.string().min(1, "Customer name is required."), // Changed from importerName
  supplierName: z.string().min(1, "Supplier name is required."), // Changed from exporterName
  customerCountry: z.string().min(1, "Customer country is required."), // Changed from importerCountry
  supplierCountry: z.string().min(1, "Supplier country is required."), // Changed from exporterCountry
  transactionAmount: z.coerce.number().positive("Transaction amount must be a positive number.").optional().or(z.literal(undefined)),
});

type FormData = z.infer<typeof formSchema>;

export default function CustomerRiskPage({ params, searchParams }: CustomerRiskPageProps) { // Renamed page component
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [riskResult, setRiskResult] = useState<PaymentRiskOutput | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { toast } = useToast();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      customerName: '',
      supplierName: '', // Could be pre-filled if known
      customerCountry: '',
      supplierCountry: '', // Could be pre-filled if known
      transactionAmount: undefined, 
    },
  });

  const onSubmit: SubmitHandler<FormData> = async (data) => {
    setIsLoading(true);
    setError(null);
    setRiskResult(null);
    try {
      const validatedData: PaymentRiskInput = {
        ...data,
        transactionAmount: data.transactionAmount ?? 0,
      };
      const result = await assessPaymentRisk(validatedData);
      setRiskResult(result);
      toast({
        title: "Risk Assessment Complete",
        description: `Customer payment risk score: ${result.riskScore}`,
      });
    } catch (err) {
      console.error("Risk assessment failed:", err);
      const errorMessage = err instanceof Error ? err.message : "An unknown error occurred.";
      setError(errorMessage);
      toast({
        title: "Assessment Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getRiskLevel = (score: number | undefined): {
    level: 'Low' | 'Medium' | 'High' | 'Unknown';
    badgeClass: string;
    Icon: ElementType;
  } => {
    if (score === undefined || score === null) {
      return { level: 'Unknown', badgeClass: 'bg-muted text-muted-foreground border', Icon: ShieldQuestion };
    }
    if (score < 30) {
      return { level: 'Low', badgeClass: 'bg-green-100 text-green-700 dark:bg-green-700 dark:text-green-100 border border-green-300 dark:border-green-600', Icon: ShieldCheck };
    }
    if (score < 70) {
      return { level: 'Medium', badgeClass: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-600 dark:text-yellow-50 border border-yellow-300 dark:border-yellow-500', Icon: ShieldAlert };
    }
    return { level: 'High', badgeClass: 'bg-red-100 text-red-700 dark:bg-red-700 dark:text-red-100 border border-red-300 dark:border-red-600', Icon: AlertTriangle };
  };
  
  const currentRiskDisplay = riskResult ? getRiskLevel(riskResult.riskScore) : getRiskLevel(undefined);

  return (
    <div>
      <Header title="Customer Payment Risk Assessment" /> {/* Changed title */}
      <main className="flex-1 p-6 grid md:grid-cols-2 gap-6 items-start">
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>Assess Customer Payment Risk</CardTitle> {/* Changed title */}
            <CardDescription>
              Enter customer and transaction details to get an AI-powered risk assessment.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="customerName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Customer Name</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Global Fruits Retail" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="supplierName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Supplier Name (Your Company)</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Sunny Valley Fruits" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="customerCountry"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Customer Country</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., USA" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="supplierCountry"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Supplier Country (Your Country)</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Spain" {...field} />
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
                        <Input 
                          type="number" 
                          placeholder="e.g., 50000" 
                          {...field} 
                          value={field.value ?? ''}
                          onChange={event => field.onChange(event.target.value === '' ? undefined : +event.target.value)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" disabled={isLoading} className="w-full">
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Assess Risk
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>

        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>Assessment Result</CardTitle>
            <CardDescription>
              The AI's evaluation of the payment risk for this customer transaction.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoading && (
              <div className="flex items-center space-x-2 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>Assessing risk...</span>
              </div>
            )}
            {error && !isLoading && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Error Assessing Risk</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            {!isLoading && !error && !riskResult && (
              <p className="text-muted-foreground text-center py-8">
                Submit the form to view the risk assessment.
              </p>
            )}
            {riskResult && !isLoading && !error && (
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row items-center justify-between p-4 rounded-lg border gap-4 bg-card">
                  <div className="text-center sm:text-left">
                    <p className="text-sm text-muted-foreground">Overall Risk Score</p>
                    <p className="text-4xl font-bold text-primary">{riskResult.riskScore} / 100</p>
                  </div>
                  <div className={`inline-flex items-center px-4 py-2 rounded-full text-md font-semibold ${currentRiskDisplay.badgeClass}`}>
                    <currentRiskDisplay.Icon className="mr-2 h-5 w-5" />
                    {currentRiskDisplay.level} Risk
                  </div>
                </div>
                
                <div>
                  <h3 className="font-semibold mb-2 text-xl">Justification:</h3>
                  <p className="text-sm text-muted-foreground bg-secondary/50 p-4 rounded-md whitespace-pre-wrap border">
                    {riskResult.justification}
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
