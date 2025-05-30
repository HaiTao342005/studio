
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
  durationText: z.string().describe("The estimated travel duration as a string (e.g., 'Approx. 5 hours')."),
  note: z.string().optional().describe('A note indicating the source of the data (AI Estimation) or if there was an issue.'),
});
export type CalculateDistanceOutput = z.infer<typeof CalculateDistanceOutputSchema>;

export async function calculateDistance(input: CalculateDistanceInput): Promise<CalculateDistanceOutput> {
  return calculateDistanceFlow(input);
}

const distanceEstimationPrompt = ai.definePrompt({
  name: 'distanceEstimationPrompt',
  input: {schema: CalculateDistanceInputSchema},
  output: {schema: CalculateDistanceOutputSchema.pick({distanceText: true, durationText: true})},
  prompt: `Based on general knowledge, provide an estimated driving distance and travel time between the following origin and destination.
Present the distance in kilometers (km) and the duration in hours and minutes.
Be concise. Example: "Distance: Approx. 150 km. Duration: Approx. 2 hours 15 minutes."

Origin: {{{originAddress}}}
Destination: {{{destinationAddress}}}

Estimated Distance:
Estimated Duration:
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
      if (output) {
        return {
          distanceText: output.distanceText,
          durationText: output.durationText,
          note: 'Distance and duration estimated by AI. Actual travel may vary.',
        };
      } else {
        throw new Error("AI estimation returned no output.");
      }
    } catch (aiError) {
      console.error('[calculateDistanceFlow] AI distance estimation failed:', aiError);
      return {
        distanceText: 'N/A (Estimation Failed)',
        durationText: 'N/A (Estimation Failed)',
        note: 'AI estimation for distance and duration failed. Please try again or check addresses.',
      };
    }
  }
);
