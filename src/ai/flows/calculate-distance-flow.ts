'use server';
/**
 * @fileOverview An AI flow to calculate (simulate) distance between two addresses using Google Maps API.
 *
 * - calculateDistance - A function that simulates distance calculation.
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
  distanceText: z.string().describe("The calculated distance as a string (e.g., 'Approx. 500 km')."),
  durationText: z.string().describe("The calculated travel duration as a string (e.g., 'Approx. 5 hours')."),
  note: z.string().optional().describe('A note, e.g., indicating if the calculation is simulated.'),
});
export type CalculateDistanceOutput = z.infer<typeof CalculateDistanceOutputSchema>;

export async function calculateDistance(input: CalculateDistanceInput): Promise<CalculateDistanceOutput> {
  return calculateDistanceFlow(input);
}

const calculateDistanceFlow = ai.defineFlow(
  {
    name: 'calculateDistanceFlow',
    inputSchema: CalculateDistanceInputSchema,
    outputSchema: CalculateDistanceOutputSchema,
  },
  async ({ originAddress, destinationAddress }) => {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

    if (!apiKey) {
      console.warn('[calculateDistanceFlow] Google Maps API Key is not configured. Returning simulated data.');
      return {
        distanceText: 'Approx. 300-700 km (Simulated)',
        durationText: 'Approx. 3-7 hours (Simulated)',
        note: 'Real distance calculation requires Google Maps API key and setup. Customer address is also needed.',
      };
    }

    // TODO: Implement actual Google Maps API calls here.
    // 1. Geocode originAddress to get originLat, originLng
    //    Example endpoint: `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(originAddress)}&key=${apiKey}`
    // 2. Geocode destinationAddress to get destLat, destLng
    //    Example endpoint: `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(destinationAddress)}&key=${apiKey}`
    // 3. Call Distance Matrix API with coordinates
    //    Example endpoint: `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${originLat},${originLng}&destinations=${destLat},${destLng}&key=${apiKey}`
    // 4. Parse the response to extract distance and duration.

    // For now, return simulated data.
    const simulatedDistance = Math.floor(Math.random() * (700 - 100 + 1) + 100); // Random km between 100 and 700
    const simulatedDuration = Math.floor(simulatedDistance / 80); // Assuming average 80km/h

    return {
      distanceText: `Approx. ${simulatedDistance} km (Simulated)`,
      durationText: `Approx. ${simulatedDuration} hours (Simulated)`,
      note: 'This is a simulated distance. Configure Google Maps API key for real calculation. Customer address is also needed.',
    };
  }
);
