
'use server';
/**
 * @fileOverview AI-powered risk assessment tool based on transaction details for suppliers.
 *
 * - assessPaymentRisk - A function that handles the payment risk assessment process.
 * - PaymentRiskInput - The input type for the assessPaymentRisk function.
 * - PaymentRiskOutput - The return type for the assessPaymentRisk function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const PaymentRiskInputSchema = z.object({
  customerName: z.string().describe('Name of the customer (importer).'), // Changed from importerName
  supplierName: z.string().describe('Name of the supplier (exporter).'), // Changed from exporterName
  customerCountry: z.string().describe('Country of the customer (importer).'), // Changed from importerCountry
  supplierCountry: z.string().describe('Country of the supplier (exporter).'), // Changed from exporterCountry
  transactionAmount: z.number().describe('Amount of the transaction in USD.'),
});
export type PaymentRiskInput = z.infer<typeof PaymentRiskInputSchema>;

const PaymentRiskOutputSchema = z.object({
  riskScore: z.number().describe('Risk score from 0 to 100, with 0 being lowest risk and 100 being highest risk for the supplier receiving payment from the customer.'),
  justification: z.string().describe('Justification for the risk score based on current events, the customer\'s payment history (if known), and reputations of the involved parties.'),
});
export type PaymentRiskOutput = z.infer<typeof PaymentRiskOutputSchema>;

export async function assessPaymentRisk(input: PaymentRiskInput): Promise<PaymentRiskOutput> {
  return assessPaymentRiskFlow(input);
}

const prompt = ai.definePrompt({
  name: 'customerPaymentRiskAssessmentPrompt', // Renamed prompt
  input: {schema: PaymentRiskInputSchema},
  output: {schema: PaymentRiskOutputSchema},
  prompt: `You are an AI assistant that assesses the risk of a supplier not receiving payment from a customer for an international transaction.

  Based on the customer name: {{{customerName}}},
  supplier name: {{{supplierName}}},
  customer country: {{{customerCountry}}},
  supplier country: {{{supplierCountry}}},
  and transaction amount: {{{transactionAmount}}} USD,

  provide a risk assessment score from 0 to 100 (0=lowest risk for supplier, 100=highest risk for supplier) and a justification.
  The justification should consider factors like geopolitical stability, customer's country economic situation, typical payment behaviors for such transactions, and general reputation.
  The justification should be at least 3 sentences long.
  Risk assessment score: 
  Justification: `,
});

const assessPaymentRiskFlow = ai.defineFlow(
  {
    name: 'customerPaymentRiskFlow', // Renamed flow
    inputSchema: PaymentRiskInputSchema,
    outputSchema: PaymentRiskOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
