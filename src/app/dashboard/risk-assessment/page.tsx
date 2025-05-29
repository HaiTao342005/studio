
"use client";

import { useState } from 'react';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { assessPaymentRisk, type PaymentRiskInput, type PaymentRiskOutput } from '@/ai/flows/payment-risk-assessment';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Header } from '@/components/dashboard/Header';
import { Loader2, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
// Removed: import type { ReactNode } from 'react';


const riskAssessmentSchema = z.object({
  importerName: z.string().min(2, { message: "Importer name must be at least 2 characters." }),
  exporterName: z.string().min(2, { message: "Exporter name must be at least 2 characters." }),
  importerCountry: z.string().min(2, { message: "Importer country must be at least 2 characters." }),
  exporterCountry: z.string().min(2, { message: "Exporter country must be at least 2 characters." }),
  transactionAmount: z.coerce.number().positive({ message: "Transaction amount must be positive." }),
});

type RiskAssessmentFormData = z.infer<typeof riskAssessmentSchema>;

export default function RiskAssessmentPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [assessmentResult, setAssessmentResult] = useState<PaymentRiskOutput | null>(null);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<RiskAssessmentFormData>({
    resolver: zodResolver(riskAssessmentSchema),
    defaultValues: {
      importerName: '',
      exporterName: '',
      importerCountry: '',
      exporterCountry: '',
      transactionAmount: 0,
    },
  });

  const onSubmit: SubmitHandler<RiskAssessmentFormData> = async (data) => {
    setIsLoading(true);
    setAssessmentResult(null);
    setError(null);
    try {
      const result = await assessPaymentRisk(data as PaymentRiskInput);
      setAssessmentResult(result);
    } catch (e) {
      setError("Failed to assess risk. Please try again.");
      console.error(e);
    }
    setIsLoading(false);
  };
  
  const getRiskLevel = (score: number): { level: string; color: string; Icon: any } => { // Changed React.ElementType to any
    if (score < 30) return { level: "Low Risk", color: "text-primary", Icon: CheckCircle2 };
    if (score < 70) return { level: "Medium Risk", color: "text-accent", Icon: AlertTriangle };
    return { level: "High Risk", color: "text-destructive", Icon: AlertTriangle };
  };

  return (
    <div>
      <Header title="Payment Risk Assessment" />
      <main className="flex-1 p-6 grid md:grid-cols-2 gap-6 items-start">
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>Assess Transaction Risk</CardTitle>
            <CardDescription>
              Enter transaction details to get an AI-powered risk score and justification.
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
                  {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Assess Risk
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>

        <div className="space-y-6">
          {isLoading && (
            <Card className="shadow-md">
              <CardHeader>
                <CardTitle>Assessing Risk...</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col items-center justify-center space-y-4 py-12">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
                <p className="text-muted-foreground">Please wait while we analyze the transaction.</p>
              </CardContent>
            </Card>
          )}
          {error && (
            <Card className="shadow-md border-destructive">
              <CardHeader>
                <CardTitle className="text-destructive">Assessment Error</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col items-center justify-center space-y-4 py-12">
                <AlertTriangle className="h-12 w-12 text-destructive" />
                <p className="text-destructive">{error}</p>
              </CardContent>
            </Card>
          )}
          {assessmentResult && !isLoading && !error && (
            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle>Risk Assessment Result</CardTitle>
                <CardDescription>
                  Based on the provided details and current market intelligence.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <Label className="text-lg font-semibold">Risk Score</Label>
                  <div className="mt-1 flex items-center gap-4">
                    <Progress value={assessmentResult.riskScore} className="flex-1 h-6" aria-label={`Risk score: ${assessmentResult.riskScore} out of 100`} />
                    <span className={`text-2xl font-bold ${getRiskLevel(assessmentResult.riskScore).color} flex items-center shrink-0`}>
                      <getRiskLevel(assessmentResult.riskScore).Icon className="mr-1 h-6 w-6" />
                      {assessmentResult.riskScore}/100
                    </span>
                  </div>
                  <p className={`text-sm font-semibold mt-1 ${getRiskLevel(assessmentResult.riskScore).color}`}>
                     ({getRiskLevel(assessmentResult.riskScore).level})
                  </p>
                </div>
                <div>
                  <Label className="text-lg font-semibold">Justification</Label>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap mt-1">{assessmentResult.justification}</p>
                </div>
              </CardContent>
              <CardFooter>
                <Button onClick={() => { setAssessmentResult(null); form.reset(); }} variant="outline">
                  Assess Another Transaction
                </Button>
              </CardFooter>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}
