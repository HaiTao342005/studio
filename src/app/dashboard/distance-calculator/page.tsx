
"use client";

import { useState, type FormEvent, useEffect } from 'react'; // Added useEffect
import { Header } from '@/components/dashboard/Header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { calculateDistance, type CalculateDistanceOutput, type CalculateDistanceInput } from '@/ai/flows/calculate-distance-flow';
import { Loader2, MapPin, Route, Info, DollarSign } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useAuth, type UserShippingRates } from '@/contexts/AuthContext'; // Added useAuth

interface DistanceCalculatorPageProps {
  params: {};
  searchParams: { [key: string]: string | string[] | undefined };
}

// Helper function to calculate tiered shipping price - copied
const calculateTieredShippingPrice = (distanceKm: number, rates?: UserShippingRates): number | null => {
  if (!rates || rates.tier1_0_100_km_price === undefined || rates.tier2_101_500_km_price_per_km === undefined || rates.tier3_501_1000_km_price_per_km === undefined) {
    return null;
  }
  const { tier1_0_100_km_price, tier2_101_500_km_price_per_km, tier3_501_1000_km_price_per_km } = rates;

  if (distanceKm <= 0) return 0;
  if (distanceKm <= 100) return tier1_0_100_km_price;

  let price = tier1_0_100_km_price;
  if (distanceKm <= 500) {
    price += (distanceKm - 100) * tier2_101_500_km_price_per_km;
    return price;
  }

  price += (400) * tier2_101_500_km_price_per_km;
  if (distanceKm <= 1000) {
    price += (distanceKm - 500) * tier3_501_1000_km_price_per_km;
    return price;
  }

  price += (500) * tier3_501_1000_km_price_per_km;
  price += (distanceKm - 1000) * tier3_501_1000_km_price_per_km;
  return price;
};


export default function DistanceCalculatorPage({ params, searchParams }: DistanceCalculatorPageProps) {
  const [originAddress, setOriginAddress] = useState('');
  const [destinationAddress, setDestinationAddress] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<CalculateDistanceOutput | null>(null);
  const [shippingPrice, setShippingPrice] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const { user } = useAuth(); // Get current user for their shipping rates

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!originAddress || !destinationAddress) {
      toast({ title: "Input Error", description: "Please provide both pickup and customer addresses.", variant: "destructive" });
      return;
    }
     if (user?.role !== 'transporter') {
      toast({ title: "Access Denied", description: "This feature is for transporters.", variant: "destructive" });
      return;
    }
    if (!user.shippingRates?.tier1_0_100_km_price) {
        toast({ title: "Rates Not Set", description: "Please set your shipping rates first in the 'Shipping Rates' tab.", variant: "destructive", duration: 7000 });
        setShippingPrice(null);
        // We can still show distance if AI call succeeds
    }


    setIsLoading(true);
    setResult(null);
    setShippingPrice(null);
    setError(null);

    try {
      const input: CalculateDistanceInput = { originAddress, destinationAddress };
      const distanceResult = await calculateDistance(input);
      setResult(distanceResult);

      if (distanceResult.distanceKm && typeof distanceResult.distanceKm === 'number' && user?.shippingRates) {
        const calculatedPrice = calculateTieredShippingPrice(distanceResult.distanceKm, user.shippingRates);
        setShippingPrice(calculatedPrice);
      } else {
        setShippingPrice(null);
         if (distanceResult.distanceKm && !user?.shippingRates?.tier1_0_100_km_price) {
             // No explicit toast here as it's handled by the check before API call,
             // but ensuring price is null if rates are missing after distance is fetched.
         }
      }

      if (distanceResult.note && (distanceResult.note.toLowerCase().includes('error') || distanceResult.note.toLowerCase().includes('failed'))) {
        toast({
          title: "Calculation Info",
          description: distanceResult.note,
          duration: 8000,
          variant: "destructive",
        });
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "An unknown error occurred.";
      setError(errorMessage);
      toast({ title: "Calculation Failed", description: errorMessage, variant: "destructive" });
      console.error("Error calculating distance:", err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Header title="Distance Calculator" />
      <main className="flex-1 p-6 space-y-6">
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Route className="h-6 w-6 text-primary" />
              Estimate Trip Details & Your Shipping Price
            </CardTitle>
            <CardDescription>
              Enter pickup and customer addresses to get an AI-powered estimation of travel distance, duration, and your potential shipping price based on your set rates.
              {user?.role === 'transporter' && !user?.shippingRates?.tier1_0_100_km_price && (
                <span className="text-destructive block mt-1"> Please set your shipping rates in the "Shipping Rates" tab to see accurate price estimations.</span>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="originAddress">Pickup Address (Origin)</Label>
                <Input
                  id="originAddress"
                  value={originAddress}
                  onChange={(e) => setOriginAddress(e.target.value)}
                  placeholder="e.g., 123 Main St, Farmville, CA"
                  required
                />
              </div>
              <div>
                <Label htmlFor="destinationAddress">Customer Address (Destination)</Label>
                <Input
                  id="destinationAddress"
                  value={destinationAddress}
                  onChange={(e) => setDestinationAddress(e.target.value)}
                  placeholder="e.g., 456 Market Ave, Cityburg, NY"
                  required
                />
              </div>
              <Button type="submit" disabled={isLoading || user?.role !== 'transporter'} className="w-full">
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Estimate Details
              </Button>
            </form>
          </CardContent>
        </Card>

        {result && (
          <Card className="shadow-md">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-primary" />
                  AI Estimation Result
                </div>
                 <Badge variant="outline" className="text-blue-600 border-blue-400">AI Estimated</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p>
                <span className="font-medium">From:</span> {originAddress}
              </p>
              <p>
                <span className="font-medium">To:</span> {destinationAddress}
              </p>
              <p className="text-lg">
                <strong>Distance:</strong> <span className="font-semibold text-primary">{result.distanceText}</span>
                {result.distanceKm && ` (${result.distanceKm.toFixed(1)} km)`}
              </p>
              <p className="text-lg">
                <strong>Est. Duration:</strong> <span className="font-semibold text-primary">{result.durationText}</span>
              </p>
              {shippingPrice !== null ? (
                <p className="text-lg flex items-center">
                  <DollarSign className="h-5 w-5 mr-1 text-green-600" />
                  <strong>Your Est. Shipping Price:</strong> <span className="font-semibold text-green-600">${shippingPrice.toFixed(2)}</span>
                </p>
              ) : result?.distanceKm && user?.role === 'transporter' && !user?.shippingRates?.tier1_0_100_km_price && (
                 <p className="text-destructive text-sm">Set your shipping rates to calculate estimated price.</p>
              )}
               {result.predictedDeliveryIsoDate && (
                <p className="text-sm">
                  <strong>Predicted Delivery:</strong> {new Date(result.predictedDeliveryIsoDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </p>
              )}
              {result.note && (
                <Alert className={`mt-4 ${result.note.toLowerCase().includes('failed') || result.note.toLowerCase().includes('error') ? 'border-destructive text-destructive dark:text-destructive-foreground' : 'border-blue-400 text-blue-700 dark:text-blue-300'}`}>
                  <Info className="h-4 w-4" />
                  <AlertTitle>{result.note.toLowerCase().includes('failed') || result.note.toLowerCase().includes('error') ? 'Estimation Error' : 'Estimation Info'}</AlertTitle>
                  <AlertDescription>{result.note}</AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        )}

        {error && !isLoading && (
          <Card className="shadow-md border-destructive">
            <CardHeader>
              <CardTitle className="text-destructive">Error</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-destructive-foreground">{error}</p>
            </CardContent>
          </Card>
        )}
      </main>
    </>
  );
}
