
'use server';
/**
 * @fileOverview An AI flow to calculate distance between two addresses using Google Maps API.
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
  note: z.string().optional().describe('A note, e.g., indicating if the calculation is simulated or if there was an issue.'),
});
export type CalculateDistanceOutput = z.infer<typeof CalculateDistanceOutputSchema>;

export async function calculateDistance(input: CalculateDistanceInput): Promise<CalculateDistanceOutput> {
  return calculateDistanceFlow(input);
}

async function geocodeAddress(address: string, apiKey: string): Promise<{ lat: number; lng: number } | null> {
  const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`;
  try {
    const response = await fetch(geocodeUrl);
    if (!response.ok) {
      console.error(`Geocoding API error for ${address}: ${response.status} ${response.statusText}`);
      const errorBody = await response.text();
      console.error('Geocoding error body:', errorBody);
      return null;
    }
    const data = await response.json();
    if (data.status === 'OK' && data.results && data.results.length > 0) {
      return data.results[0].geometry.location;
    } else {
      console.warn(`Geocoding failed for ${address}: ${data.status}`, data.error_message || '');
      return null;
    }
  } catch (error) {
    console.error(`Network error during geocoding for ${address}:`, error);
    return null;
  }
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
        note: 'Real distance calculation requires a Google Maps API key and setup. This is simulated data.',
      };
    }

    const originCoords = await geocodeAddress(originAddress, apiKey);
    if (!originCoords) {
      return {
        distanceText: 'N/A (Simulated)',
        durationText: 'N/A (Simulated)',
        note: `Could not geocode origin address: "${originAddress}". Please check the address. Using simulated data.`,
      };
    }

    const destinationCoords = await geocodeAddress(destinationAddress, apiKey);
    if (!destinationCoords) {
      return {
        distanceText: 'N/A (Simulated)',
        durationText: 'N/A (Simulated)',
        note: `Could not geocode destination address: "${destinationAddress}". Please check the address. Using simulated data.`,
      };
    }

    const distanceMatrixUrl = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${originCoords.lat},${originCoords.lng}&destinations=${destinationCoords.lat},${destinationCoords.lng}&key=${apiKey}`;

    try {
      const response = await fetch(distanceMatrixUrl);
      if (!response.ok) {
        console.error(`Distance Matrix API error: ${response.status} ${response.statusText}`);
        const errorBody = await response.text();
        console.error('Distance Matrix error body:', errorBody);
        return {
          distanceText: 'Error (Simulated)',
          durationText: 'Error (Simulated)',
          note: `Distance Matrix API request failed. Status: ${response.status}. Check API key, enabled APIs, or billing. Using simulated data.`,
        };
      }
      const data = await response.json();

      if (data.status === 'OK' && data.rows && data.rows[0] && data.rows[0].elements && data.rows[0].elements[0]) {
        const element = data.rows[0].elements[0];
        if (element.status === 'OK') {
          return {
            distanceText: element.distance.text,
            durationText: element.duration.text,
            note: `Distance calculated using Google Maps API. Origin: ${data.origin_addresses[0]}. Destination: ${data.destination_addresses[0]}.`,
          };
        } else {
           console.warn(`Distance Matrix element status for route not OK: ${element.status}`);
          return {
            distanceText: 'N/A (Simulated)',
            durationText: 'N/A (Simulated)',
            note: `Could not calculate route between addresses (e.g., no route found). Status: ${element.status}. Using simulated data.`,
          };
        }
      } else {
        console.warn('Distance Matrix API call failed or returned unexpected data structure:', data.status, data.error_message || '');
        return {
          distanceText: 'Error (Simulated)',
          durationText: 'Error (Simulated)',
          note: `Distance Matrix API call failed: ${data.status}. ${data.error_message || ''}. Using simulated data.`,
        };
      }
    } catch (error) {
      console.error('Network error during Distance Matrix API call:', error);
      return {
        distanceText: 'Network Error (Simulated)',
        durationText: 'Network Error (Simulated)',
        note: 'A network error occurred while trying to calculate the distance. Using simulated data.',
      };
    }
  }
);
