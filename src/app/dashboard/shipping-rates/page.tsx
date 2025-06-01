
"use client";

import { useEffect } from 'react';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter } from 'next/navigation';
import { Header } from '@/components/dashboard/Header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form"; // Added FormDescription
import { useAuth, type UserShippingRates } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { DollarSign, Save, Loader2 } from 'lucide-react';

const shippingRatesSchema = z.object({
  tier1_0_100_km_price: z.coerce.number().min(0, "Price must be non-negative.").default(0),
  tier2_101_500_km_price_per_km: z.coerce.number().min(0, "Rate must be non-negative.").default(0),
  tier3_501_1000_km_price_per_km: z.coerce.number().min(0, "Rate must be non-negative.").default(0),
});

type ShippingRatesFormData = z.infer<typeof shippingRatesSchema>;

interface ShippingRatesPageProps {
  params: {};
  searchParams: { [key: string]: string | string[] | undefined };
}

export default function ShippingRatesPage({ params, searchParams }: ShippingRatesPageProps) {
  const { user, updateTransporterShippingRates, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const router = useRouter();

  const form = useForm<ShippingRatesFormData>({
    resolver: zodResolver(shippingRatesSchema),
    defaultValues: {
      tier1_0_100_km_price: user?.shippingRates?.tier1_0_100_km_price ?? 0,
      tier2_101_500_km_price_per_km: user?.shippingRates?.tier2_101_500_km_price_per_km ?? 0,
      tier3_501_1000_km_price_per_km: user?.shippingRates?.tier3_501_1000_km_price_per_km ?? 0,
    },
  });

  useEffect(() => {
    if (!authLoading && (!user || user.role !== 'transporter')) {
      router.replace('/dashboard');
    }
    if (user && user.shippingRates) {
      form.reset(user.shippingRates);
    }
  }, [user, authLoading, router, form]);

  const onSubmit: SubmitHandler<ShippingRatesFormData> = async (data) => {
    if (!user || !user.id || user.role !== 'transporter') {
      toast({ title: "Error", description: "Invalid user or permission.", variant: "destructive" });
      return;
    }
    await updateTransporterShippingRates(user.id, data);
    // Toast for success/failure is handled within updateTransporterShippingRates
  };

  if (authLoading || !user) {
    return (
      <>
        <Header title="Manage Shipping Rates" />
        <main className="flex-1 p-6 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="ml-2 text-muted-foreground">Loading...</p>
        </main>
      </>
    );
  }
  if (user.role !== 'transporter') {
     return (
        <>
            <Header title="Access Denied" />
            <main className="flex-1 p-6">
            <p>You do not have permission to view this page.</p>
            </main>
        </>
    );
  }


  return (
    <>
      <Header title="Manage Your Shipping Rates" />
      <main className="flex-1 p-6">
        <Card className="max-w-2xl mx-auto shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-7 w-7 text-primary" />
              Set Your Tiered Shipping Prices
            </CardTitle>
            <CardDescription>
              Define your charges for different distance ranges. These rates will be used to calculate shipping fees for orders assigned to you.
            </CardDescription>
          </CardHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)}>
              <CardContent className="space-y-6">
                <FormField
                  control={form.control}
                  name="tier1_0_100_km_price"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Price for first 100 km (Fixed Amount in USD)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="e.g., 15.00"
                          {...field}
                          value={field.value ?? ''}
                          onChange={event => field.onChange(event.target.value === '' ? undefined : +event.target.value)}
                        />
                      </FormControl>
                      <FormDescription>Enter the total fixed price for shipments up to 100 km.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="tier2_101_500_km_price_per_km"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Price per km for 101-500 km (USD)</FormLabel>
                      <FormControl>
                         <Input
                          type="number"
                          step="0.01"
                          placeholder="e.g., 0.50"
                          {...field}
                          value={field.value ?? ''}
                          onChange={event => field.onChange(event.target.value === '' ? undefined : +event.target.value)}
                        />
                      </FormControl>
                      <FormDescription>Enter the rate per kilometer for distances between 101 km and 500 km.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="tier3_501_1000_km_price_per_km"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Price per km for 501-1000 km (and beyond) (USD)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="e.g., 0.40"
                          {...field}
                          value={field.value ?? ''}
                          onChange={event => field.onChange(event.target.value === '' ? undefined : +event.target.value)}
                        />
                      </FormControl>
                      <FormDescription>Enter the rate per kilometer for distances from 501 km up to 1000 km. This rate will also apply for distances beyond 1000 km.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
              <CardFooter>
                <Button type="submit" disabled={form.formState.isSubmitting || authLoading} className="w-full">
                  {(form.formState.isSubmitting || authLoading) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  <Save className="mr-2 h-4 w-4" />
                  Save Shipping Rates
                </Button>
              </CardFooter>
            </form>
          </Form>
        </Card>
      </main>
    </>
  );
}

