
"use client";

import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { CalendarIcon, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { ReactNode } from 'react';
import type { OrderStatus } from '@/types/transaction'; 
import { db } from '@/lib/firebase/config';
import { collection, addDoc, Timestamp } from 'firebase/firestore';

const orderStatuses: [OrderStatus, ...OrderStatus[]] = ['Pending', 'Awaiting Payment', 'Paid', 'Shipped', 'Delivered', 'Cancelled'];

const orderSchema = z.object({
  transactionDate: z.date({ required_error: "Order date is required." }),
  fruitType: z.string().min(1, "Fruit type is required."),
  quantity: z.coerce.number().positive("Quantity must be a positive number.").optional().or(z.literal(undefined)),
  unit: z.enum(['kg', 'ton', 'box', 'pallet'], { required_error: "Unit is required."}),
  pricePerUnit: z.coerce.number().positive("Price per unit must be positive.").optional().or(z.literal(undefined)),
  currency: z.string().min(2, "Currency is required (e.g., USD).").default("USD"),
  customerName: z.string().min(2, "Customer name is required."),
  supplierName: z.string().min(2, "Supplier name is required."),
  status: z.enum(orderStatuses).default('Pending'),
  notes: z.string().optional(),
});

type OrderFormData = z.infer<typeof orderSchema>;

interface OrderFormProps {
  onSubmitSuccess?: () => void;
  children?: ReactNode; 
}

export function TransactionForm({ onSubmitSuccess, children }: OrderFormProps) {
  const { toast } = useToast();
  const form = useForm<OrderFormData>({
    resolver: zodResolver(orderSchema),
    defaultValues: {
      transactionDate: new Date(),
      fruitType: '',
      quantity: undefined,
      unit: 'kg',
      pricePerUnit: undefined,
      currency: 'USD',
      customerName: '',
      supplierName: '',
      status: 'Pending',
      notes: '',
    },
  });

  const {formState: { isSubmitting }} = form;

  const onSubmit: SubmitHandler<OrderFormData> = async (data) => {
    // This structure attempts to match StoredOrder more closely
    // but the key discrepancy was `date` vs `orderDate`
    const orderDataToSave = {
      orderDate: Timestamp.fromDate(data.transactionDate), // Standardized to orderDate
      productName: data.fruitType, // Assuming fruitType is the productName for these orders
      productId: `manual-${Date.now()}`, // Placeholder productId
      quantity: data.quantity ?? 0,
      unit: data.unit,
      pricePerUnit: data.pricePerUnit ?? 0,
      totalAmount: (data.pricePerUnit ?? 0) * (data.quantity ?? 0), 
      currency: data.currency,
      customerName: data.customerName, // Corresponds to customerName in StoredOrder
      customerId: `manual-customer-${Date.now()}`, // Placeholder customerId
      supplierName: data.supplierName, // Corresponds to supplierName in StoredOrder
      supplierId: `manual-supplier-${Date.now()}`, // Placeholder supplierId
      status: data.status,
      notes: data.notes ?? '',
    };

    try {
      await addDoc(collection(db, "orders"), orderDataToSave);
      
      toast({
        title: "Order Submitted!",
        description: `${data.fruitType} order for ${data.customerName} successfully recorded in Firestore.`,
        variant: "default",
      });
      form.reset();
      if (onSubmitSuccess) onSubmitSuccess();

    } catch (error) {
      console.error("Failed to save order to Firestore:", error);
      toast({
        title: "Firestore Error",
        description: "Could not save order. Please try again. " + (error instanceof Error ? error.message : ""),
        variant: "destructive",
      });
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid md:grid-cols-2 gap-6">
          <FormField
            control={form.control}
            name="transactionDate"
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel>Order Date *</FormLabel>
                <Popover>
                  <PopoverTrigger asChild>
                    <FormControl>
                      <Button
                        variant={"outline"}
                        className={cn(
                          "w-full pl-3 text-left font-normal",
                          !field.value && "text-muted-foreground"
                        )}
                      >
                        {field.value ? (
                          format(field.value, "PPP")
                        ) : (
                          <span>Pick a date</span>
                        )}
                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                      </Button>
                    </FormControl>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={field.value}
                      onSelect={field.onChange}
                      disabled={(date) =>
                        date > new Date() || date < new Date("1900-01-01")
                      }
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="fruitType"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Product Name *</FormLabel> 
                <FormControl><Input placeholder="e.g., Organic Apples" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          <FormField
            control={form.control}
            name="quantity"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Quantity *</FormLabel>
                <FormControl>
                  <Input 
                    type="number" 
                    placeholder="e.g., 1000" 
                    {...field} 
                    value={field.value ?? ''}
                    onChange={event => field.onChange(event.target.value === '' ? undefined : +event.target.value)} 
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="unit"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Unit *</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a unit" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="kg">Kilograms (kg)</SelectItem>
                    <SelectItem value="ton">Tons</SelectItem>
                    <SelectItem value="box">Boxes</SelectItem>
                    <SelectItem value="pallet">Pallets</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="pricePerUnit"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Price Per Unit *</FormLabel>
                <FormControl>
                  <Input 
                    type="number" 
                    step="0.01" 
                    placeholder="e.g., 1.50" 
                    {...field} 
                    value={field.value ?? ''}
                    onChange={event => field.onChange(event.target.value === '' ? undefined : +event.target.value)} 
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        
        <div className="grid md:grid-cols-2 gap-6">
          <FormField
            control={form.control}
            name="customerName" 
            render={({ field }) => (
              <FormItem>
                <FormLabel>Customer Name *</FormLabel>
                <FormControl><Input placeholder="e.g., FreshProduce Retail Inc." {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="supplierName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Supplier Name *</FormLabel> 
                <FormControl><Input placeholder="e.g., Your Fruit Co." {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

         <div className="grid md:grid-cols-2 gap-6">
          <FormField
            control={form.control}
            name="currency"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Currency *</FormLabel>
                <FormControl><Input placeholder="e.g., USD" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
           <FormField
            control={form.control}
            name="status"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Order Status *</FormLabel>
                 <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {orderStatuses.map(status => (
                       <SelectItem key={status} value={status}>{status}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notes (Optional)</FormLabel>
              <FormControl><Textarea placeholder="Any additional details about the order..." {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        {children ? children : (
           <Button type="submit" disabled={isSubmitting} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground">
            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Record Order
          </Button>
        )}
      </form>
    </Form>
  );
}
