
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
    <div>Test</div>
  );
}
