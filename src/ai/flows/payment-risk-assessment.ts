// 'use server';

/**
 * @fileOverview AI-powered risk assessment tool based on transaction details.
 *
 * - assessPaymentRisk - A function that handles the payment risk assessment process.
 * - PaymentRiskInput - The input type for the assessPaymentRisk function.
 * - PaymentRiskOutput - The return type for the assessPaymentRisk function.
 */

'use server';
import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const PaymentRiskInputSchema = z.object({
  importerName: z.string().describe('Name of the importer.'),
  exporterName: z.string().describe('Name of the exporter.'),
  importerCountry: z.string().describe('Country of the importer.'),
  exporterCountry: z.string().describe('Country of the exporter.'),
  transactionAmount: z.number().describe('Amount of the transaction.'),
});
export type PaymentRiskInput = z.infer<typeof PaymentRiskInputSchema>;

const PaymentRiskOutputSchema = z.object({
  riskScore: z.number().describe('Risk score from 0 to 100, with 0 being lowest risk and 100 being highest risk.'),
  justification: z.string().describe('Justification for the risk score based on current events and the reputations of the involved parties.'),
});
export type PaymentRiskOutput = z.infer<typeof PaymentRiskOutputSchema>;

export async function assessPaymentRisk(input: PaymentRiskInput): Promise<PaymentRiskOutput> {
  return assessPaymentRiskFlow(input);
}

const prompt = ai.definePrompt({
  name: 'paymentRiskAssessmentPrompt',
  input: {schema: PaymentRiskInputSchema},
  output: {schema: PaymentRiskOutputSchema},
  prompt: `You are an AI assistant that assesses the risk of payment for international transactions.

  Based on the importer name: {{{importerName}}},
  exporter name: {{{exporterName}}},
  importer country: {{{importerCountry}}},
  exporter country: {{{exporterCountry}}},
  and transaction amount: {{{transactionAmount}}},

  provide a risk assessment score from 0 to 100 and a justification based on current events and the reputations of the involved parties.
  The lower the risk the closer the score will be to 0, and the higher the risk the closer the score will be to 100.
  The justification should be at least 5 sentences long.
  Risk assessment score: 
  Justification: `,
});

const assessPaymentRiskFlow = ai.defineFlow(
  {
    name: 'assessPaymentRiskFlow',
    inputSchema: PaymentRiskInputSchema,
    outputSchema: PaymentRiskOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
