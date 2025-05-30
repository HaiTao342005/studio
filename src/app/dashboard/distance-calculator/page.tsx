
"use client";

import { useState, type FormEvent } from 'react';
import { Header } from '@/components/dashboard/Header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { calculateDistance, type CalculateDistanceOutput, type CalculateDistanceInput } from '@/ai/flows/calculate-distance-flow';
import { Loader2, MapPin, Route } from 'lucide-react';

interface DistanceCalculatorPageProps {
  params: {};
  searchParams: { [key: string]: string | string[] | undefined };
}

export default function DistanceCalculatorPage({ params, searchParams }: DistanceCalculatorPageProps) {
  const [originAddress, setOriginAddress] = useState('');
  const [destinationAddress, setDestinationAddress] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<CalculateDistanceOutput | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!originAddress || !destinationAddress) {
      toast({ title: "Input Error", description: "Please provide both pickup and customer addresses.", variant: "destructive" });
      return;
    }

    setIsLoading(true);
    setResult(null);
    setError(null);

    try {
      const input: CalculateDistanceInput = { originAddress, destinationAddress };
      const distanceResult = await calculateDistance(input);
      setResult(distanceResult);
      if (distanceResult.note) {
        toast({ title: "Calculation Note", description: distanceResult.note, duration: 7000 });
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
              Calculate Trip Distance
            </CardTitle>
            <CardDescription>
              Enter pickup and customer addresses to estimate travel distance and duration.
              This tool uses a simulated calculation if the Google Maps API key is not configured.
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
              <Button type="submit" disabled={isLoading} className="w-full">
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Calculate Distance
              </Button>
            </form>
          </CardContent>
        </Card>

        {result && (
          <Card className="shadow-md">
            <CardHeader>
              <CardTitle>Calculation Result</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p>
                <MapPin className="inline-block mr-2 h-4 w-4 text-primary/70" />
                <strong>From:</strong> {originAddress}
              </p>
              <p>
                <MapPin className="inline-block mr-2 h-4 w-4 text-primary/70" />
                <strong>To:</strong> {destinationAddress}
              </p>
              <p className="text-lg font-semibold">
                Distance: <span className="text-primary">{result.distanceText}</span>
              </p>
              <p className="text-lg font-semibold">
                Est. Duration: <span className="text-primary">{result.durationText}</span>
              </p>
              {result.note && (
                <p className="text-xs text-muted-foreground italic mt-2">{result.note}</p>
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
