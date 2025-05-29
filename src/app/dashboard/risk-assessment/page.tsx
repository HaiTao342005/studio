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
  
  const getRiskLevel = (score: number): { level: string; color: string; Icon: React.ElementType } => {
    if (score < 30) return { level: "Low Risk", color: "text-green-500", Icon: CheckCircle2 };
    if (score < 70) return { level: "Medium Risk", color: "text-yellow-500", Icon: AlertTriangle };
    return { level: "High Risk", color: "text-red-500", Icon: AlertTriangle };
  };

  return (
    <>
      <Header title="Payment Risk Assessment" />
      <main className="flex-1 p-6 grid md:grid-cols-2 gap-6 items-start">
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>Assess Transaction Risk</CardTitle>
            <CardDescription>Enter transaction details to get an AI-powered risk assessment.</CardDescription>
          </CardHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)}>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="importerName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Importer Name</FormLabel>
                      <FormControl><Input placeholder="e.g., Global Fruits Inc." {...field} /></FormControl>
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
                      <FormControl><Input placeholder="e.g., Tropical Exports Co." {...field} /></FormControl>
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
                      <FormControl><Input placeholder="e.g., USA" {...field} /></FormControl>
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
                      <FormControl><Input placeholder="e.g., Brazil" {...field} /></FormControl>
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
                      <FormControl><Input type="number" placeholder="e.g., 50000" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
              <CardFooter>
                <Button type="submit" disabled={isLoading} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground">
                  {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Assess Risk
                </Button>
              </CardFooter>
            </form>
          </Form>
        </Card>

        <Card className="shadow-lg sticky top-20"> {/* Sticky for result visibility */}
          <CardHeader>
            <CardTitle>Assessment Result</CardTitle>
            <CardDescription>The AI's assessment of the payment risk.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoading && (
              <div className="flex flex-col items-center justify-center h-40">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
                <p className="mt-2 text-muted-foreground">Assessing risk...</p>
              </div>
            )}
            {error && (
              <div className="flex flex-col items-center justify-center h-40 text-destructive">
                <AlertTriangle className="h-12 w-12" />
                <p className="mt-2">{error}</p>
              </div>
            )}
            {assessmentResult && !isLoading && (
              <div className="space-y-4">
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Risk Score</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <Progress value={assessmentResult.riskScore} className="w-full h-3" />
                    <span className={`text-2xl font-bold ${getRiskLevel(assessmentResult.riskScore).color}`}>
                      {assessmentResult.riskScore}/100
                    </span>
                  </div>
                   <div className={`mt-1 text-sm font-semibold flex items-center ${getRiskLevel(assessmentResult.riskScore).color}`}>
                    <getRiskLevel(assessmentResult.riskScore).Icon className="mr-1 h-4 w-4" />
                    {getRiskLevel(assessmentResult.riskScore).level}
                  </div>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Justification</Label>
                  <p className="mt-1 text-sm bg-secondary p-3 rounded-md whitespace-pre-wrap">{assessmentResult.justification}</p>
                </div>
              </div>
            )}
            {!isLoading && !assessmentResult && !error && (
              <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
                 <ShieldCheck className="h-12 w-12" />
                <p className="mt-2">Submit the form to see the risk assessment.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </>
  );
}
