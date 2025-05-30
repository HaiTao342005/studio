
'use server';
/**
 * @fileOverview An AI flow to calculate distance between two addresses.
 * It first attempts to use Google Maps API if a key is provided.
 * If Google Maps API fails, it falls back to an LLM for estimation.
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
  distanceText: z.string().describe("The calculated distance as a string (e.g., 'Approx. 500 km')."),
  durationText: z.string().describe("The calculated travel duration as a string (e.g., 'Approx. 5 hours')."),
  note: z.string().optional().describe('A note indicating the source of the data (Google Maps or AI Estimation) or if there was an issue.'),
});
export type CalculateDistanceOutput = z.infer<typeof CalculateDistanceOutputSchema>;

export async function calculateDistance(input: CalculateDistanceInput): Promise<CalculateDistanceOutput> {
  return calculateDistanceFlow(input);
}

async function geocodeAddressWithGoogle(address: string, apiKey: string): Promise<{ lat: number; lng: number } | null> {
  const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`;
  console.log(`[calculateDistanceFlow] Geocoding URL for ${address}: ${geocodeUrl.replace(apiKey, 'YOUR_API_KEY')}`);
  try {
    const response = await fetch(geocodeUrl);
    const data = await response.json();

    if (!response.ok) {
      console.error(`[calculateDistanceFlow] Geocoding API error for ${address}: ${response.status} ${response.statusText}`, data);
      return null;
    }
    
    if (data.status === 'OK' && data.results && data.results.length > 0) {
      console.log(`[calculateDistanceFlow] Geocoding successful for ${address}:`, data.results[0].geometry.location);
      return data.results[0].geometry.location;
    } else {
      console.warn(`[calculateDistanceFlow] Geocoding failed for ${address}: ${data.status}`, data.error_message || '');
      return null;
    }
  } catch (error) {
    console.error(`[calculateDistanceFlow] Network error during geocoding for ${address}:`, error);
    return null;
  }
}

const distanceEstimationPrompt = ai.definePrompt({
  name: 'distanceEstimationPrompt',
  input: {schema: CalculateDistanceInputSchema},
  output: {schema: CalculateDistanceOutputSchema.pick({distanceText: true, durationText: true})}, // Only ask for these two fields
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
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

    if (apiKey) {
      console.log('[calculateDistanceFlow] Google Maps API Key found. Attempting Google Maps calculation.');

      const originCoords = await geocodeAddressWithGoogle(originAddress, apiKey);
      if (!originCoords) {
        console.warn(`[calculateDistanceFlow] Could not geocode origin address: "${originAddress}" with Google. Will try AI fallback.`);
      }

      const destinationCoords = await geocodeAddressWithGoogle(destinationAddress, apiKey);
      if (!destinationCoords) {
        console.warn(`[calculateDistanceFlow] Could not geocode destination address: "${destinationAddress}" with Google. Will try AI fallback.`);
      }

      if (originCoords && destinationCoords) {
        const distanceMatrixUrl = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${originCoords.lat},${originCoords.lng}&destinations=${destinationCoords.lat},${destinationCoords.lng}&key=${apiKey}`;
        console.log(`[calculateDistanceFlow] Distance Matrix URL: ${distanceMatrixUrl.replace(apiKey, 'YOUR_API_KEY')}`);

        try {
          const response = await fetch(distanceMatrixUrl);
          const data = await response.json();

          if (!response.ok) {
            console.error(`[calculateDistanceFlow] Distance Matrix API error: ${response.status} ${response.statusText}`, data);
            // Fall through to AI estimation
          } else if (data.status === 'OK' && data.rows && data.rows[0] && data.rows[0].elements && data.rows[0].elements[0]) {
            const element = data.rows[0].elements[0];
            if (element.status === 'OK') {
              console.log('[calculateDistanceFlow] Distance Matrix API call successful:', element);
              return {
                distanceText: element.distance.text,
                durationText: element.duration.text,
                note: `Distance calculated using Google Maps API. Origin: ${data.origin_addresses[0]}. Destination: ${data.destination_addresses[0]}.`,
              };
            } else {
              console.warn(`[calculateDistanceFlow] Distance Matrix element status for route not OK: ${element.status}. This usually means no route was found. Will try AI fallback.`);
            }
          } else {
            console.warn('[calculateDistanceFlow] Distance Matrix API call failed or returned unexpected data structure:', data.status, data.error_message || '', 'Will try AI fallback.');
          }
        } catch (error) {
          console.error('[calculateDistanceFlow] Network error during Distance Matrix API call:', error, 'Will try AI fallback.');
        }
      }
    } else {
      console.log('[calculateDistanceFlow] Google Maps API Key is not configured. Proceeding with AI estimation.');
    }

    // Fallback to AI estimation
    console.log('[calculateDistanceFlow] Falling back to AI for distance estimation.');
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
