
'use server';
/**
 * @fileOverview An AI flow to calculate distance between two addresses using LLM estimation.
 *
 * - calculateDistance - A function that handles distance calculation.
 * - CalculateDistanceInput - The input type for the calculateDistance function.
 * - CalculateDistanceOutput - The return type for the calculateDistance function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const CalculateDistanceInputSchema = z.object({
  originAddress: z.string().describe('The starting address or place name.'),
  destinationAddress: z.string().describe('The destination address or place name.'),
});
export type CalculateDistanceInput = z.infer<typeof CalculateDistanceInputSchema>;

const CalculateDistanceOutputSchema = z.object({
  distanceText: z.string().describe("The estimated distance as a string (e.g., 'Approx. 500 km')."),
  distanceKm: z.number().optional().describe("The estimated distance in kilometers as a number (e.g., 500)."),
  durationText: z.string().describe("The estimated travel duration as a string (e.g., 'Approx. 5 hours')."),
  predictedDeliveryIsoDate: z.string().optional().describe("The predicted delivery date and time in ISO 8601 format (e.g., 'YYYY-MM-DDTHH:mm:ss.sssZ'), assuming travel starts immediately after calculation based on estimated duration."),
  note: z.string().optional().describe('A note indicating the source of the data (AI Estimation) or if there was an issue.'),
});
export type CalculateDistanceOutput = z.infer<typeof CalculateDistanceOutputSchema>;

export async function calculateDistance(input: CalculateDistanceInput): Promise<CalculateDistanceOutput> {
  return calculateDistanceFlow(input);
}

const distanceEstimationPrompt = ai.definePrompt({
  name: 'distanceEstimationPrompt',
  input: {schema: CalculateDistanceInputSchema},
  output: {schema: CalculateDistanceOutputSchema.pick({distanceText: true, distanceKm: true, durationText: true, predictedDeliveryIsoDate: true })},
  prompt: `Based on general knowledge, provide an estimated driving distance and travel time between the following origin and destination.
Present the distance in kilometers (km) and the duration in hours and minutes.
Also, provide a predicted delivery date and time in ISO 8601 format (e.g., 'YYYY-MM-DDTHH:mm:ss.sssZ'), assuming travel starts now.
Be concise.

Origin: {{{originAddress}}}
Destination: {{{destinationAddress}}}

Estimated Distance (text):
Estimated Distance (km, number only):
Estimated Duration (text):
Predicted Delivery ISO Date:
`,
});


const calculateDistanceFlow = ai.defineFlow(
  {
    name: 'calculateDistanceFlow',
    inputSchema: CalculateDistanceInputSchema,
    outputSchema: CalculateDistanceOutputSchema,
  },
  async ({ originAddress, destinationAddress }) => {
    console.log('[calculateDistanceFlow] Using AI for distance estimation.');
    try {
      const {output} = await distanceEstimationPrompt({ originAddress, destinationAddress });
      if (output && output.distanceText && output.durationText) { // Check if core fields are present
        return {
          distanceText: output.distanceText,
          distanceKm: output.distanceKm,
          durationText: output.durationText,
          predictedDeliveryIsoDate: output.predictedDeliveryIsoDate,
          note: 'Distance, duration, and predicted delivery date estimated by AI. Actual travel may vary.',
        };
      } else {
        console.error('[calculateDistanceFlow] AI estimation returned incomplete output:', output);
        throw new Error("AI estimation returned incomplete output.");
      }
    } catch (aiError) {
      console.error('[calculateDistanceFlow] AI distance estimation failed:', aiError);
      // Fallback simulation if AI fails or returns incomplete data
      const randomHours = Math.floor(Math.random() * 72) + 8; // 8 to 80 hours
      const deliveryDate = new Date();
      deliveryDate.setHours(deliveryDate.getHours() + randomHours);
      const randomKm = Math.floor(Math.random() * 500) + 100;

      return {
        distanceText: `Approx. ${randomKm} km (Simulated Fallback)`,
        distanceKm: randomKm,
        durationText: `Approx. ${Math.floor(randomHours / 24)} days ${randomHours % 24} hours (Simulated Fallback)`,
        predictedDeliveryIsoDate: deliveryDate.toISOString(),
        note: 'AI estimation for distance and duration failed. Displaying simulated fallback values. Please try again or check addresses.',
      };
    }
  }
);
