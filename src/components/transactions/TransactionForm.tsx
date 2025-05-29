
"use client";

import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label'; // Unused, but kept for consistency if needed later
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
import type { StoredTransaction, TransactionStatus } from '@/types/transaction';

const transactionStatuses: [TransactionStatus, ...TransactionStatus[]] = ['Pending', 'Completed', 'In Transit', 'Cancelled'];

const transactionSchema = z.object({
  transactionDate: z.date({ required_error: "Transaction date is required." }),
  fruitType: z.string().min(1, "Fruit type is required."),
  quantity: z.coerce.number().positive("Quantity must be a positive number."),
  unit: z.enum(['kg', 'ton', 'box', 'pallet'], { required_error: "Unit is required."}),
  pricePerUnit: z.coerce.number().positive("Price per unit must be positive."),
  currency: z.string().min(2, "Currency is required (e.g., USD).").default("USD"),
  importerName: z.string().min(2, "Importer name is required."),
  exporterName: z.string().min(2, "Exporter name is required."),
  status: z.enum(transactionStatuses).default('Pending'),
  notes: z.string().optional(),
});

type TransactionFormData = z.infer<typeof transactionSchema>;

interface TransactionFormProps {
  onSubmitSuccess?: () => void;
  children?: ReactNode; // For submit button or other elements
}

const LOCAL_STORAGE_KEY = 'transactions';

export function TransactionForm({ onSubmitSuccess, children }: TransactionFormProps) {
  const { toast } = useToast();
  const form = useForm<TransactionFormData>({
    resolver: zodResolver(transactionSchema),
    defaultValues: {
      transactionDate: new Date(),
      fruitType: '',
      quantity: undefined, // Use undefined for numeric inputs with placeholders
      unit: 'kg',
      pricePerUnit: undefined,
      currency: 'USD',
      importerName: '',
      exporterName: '',
      status: 'Pending',
      notes: '',
    },
  });

  const {formState: { isSubmitting }} = form;

  const onSubmit: SubmitHandler<TransactionFormData> = async (data) => {
    // Simulate API call delay if needed, or remove for faster client-side ops
    // await new Promise(resolve => setTimeout(resolve, 1000));

    const newTransaction: StoredTransaction = {
      id: crypto.randomUUID(),
      date: data.transactionDate.toISOString(),
      fruitType: data.fruitType,
      quantity: data.quantity,
      unit: data.unit,
      // Calculate total amount: pricePerUnit * quantity
      // For simplicity, we'll store pricePerUnit and let table calculate if needed, or store total.
      // Here, let's assume 'amount' means total transaction value for now.
      amount: data.pricePerUnit * data.quantity, 
      currency: data.currency,
      importer: data.importerName,
      exporter: data.exporterName,
      status: data.status,
      notes: data.notes,
    };

    try {
      const existingTransactionsRaw = localStorage.getItem(LOCAL_STORAGE_KEY);
      const existingTransactions: StoredTransaction[] = existingTransactionsRaw ? JSON.parse(existingTransactionsRaw) : [];
      existingTransactions.push(newTransaction);
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(existingTransactions));
      
      console.log("Transaction Data Saved:", newTransaction);
      toast({
        title: "Transaction Submitted!",
        description: `${data.fruitType} transaction for ${data.importerName} successfully recorded.`,
        variant: "default",
      });
      form.reset();
      if (onSubmitSuccess) onSubmitSuccess();

    } catch (error) {
      console.error("Failed to save transaction to localStorage:", error);
      toast({
        title: "Storage Error",
        description: "Could not save transaction. Please try again.",
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
                <FormLabel>Transaction Date *</FormLabel>
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
                <FormLabel>Fruit Type *</FormLabel>
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
                <FormControl><Input type="number" placeholder="e.g., 1000" {...field} onChange={e => field.onChange(e.target.value === '' ? undefined : +e.target.value)} /></FormControl>
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
                <FormControl><Input type="number" step="0.01" placeholder="e.g., 1.50" {...field} onChange={e => field.onChange(e.target.value === '' ? undefined : +e.target.value)} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        
        <div className="grid md:grid-cols-2 gap-6">
          <FormField
            control={form.control}
            name="importerName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Importer Name *</FormLabel>
                <FormControl><Input placeholder="e.g., FreshProduce Imports Ltd." {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="exporterName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Exporter Name *</FormLabel>
                <FormControl><Input placeholder="e.g., SunnyFarms Exports" {...field} /></FormControl>
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
                <FormLabel>Status *</FormLabel>
                 <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {transactionStatuses.map(status => (
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
              <FormControl><Textarea placeholder="Any additional details about the transaction..." {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        {children ? children : (
           <Button type="submit" disabled={isSubmitting} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground">
            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Record Transaction
          </Button>
        )}
      </form>
    </Form>
  );
}
