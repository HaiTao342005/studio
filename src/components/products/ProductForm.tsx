
"use client";

import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { db } from '@/lib/firebase/config';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '@/contexts/AuthContext';
import type { ProductUnit } from '@/types/product';
import { Loader2 } from 'lucide-react';

const productUnits: [ProductUnit, ...ProductUnit[]] = ['kg', 'box', 'pallet', 'item'];

const productSchema = z.object({
  name: z.string().min(3, "Product name must be at least 3 characters."),
  description: z.string().min(10, "Description must be at least 10 characters."),
  price: z.coerce.number().positive("Price must be a positive number."),
  unit: z.enum(productUnits, { required_error: "Unit is required." }),
  category: z.string().optional(),
  imageUrl: z.string().url("Must be a valid URL for an image.").optional().or(z.literal('')),
});

type ProductFormData = z.infer<typeof productSchema>;

interface ProductFormProps {
  onProductAddSuccess?: () => void;
  // 'product' prop could be added later for editing
}

export function ProductForm({ onProductAddSuccess }: ProductFormProps) {
  const { toast } = useToast();
  const { user } = useAuth();

  const form = useForm<ProductFormData>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: '',
      description: '',
      price: undefined,
      unit: 'item',
      category: '',
      imageUrl: '',
    },
  });

  const { formState: { isSubmitting } } = form;

  const onSubmit: SubmitHandler<ProductFormData> = async (data) => {
    if (!user || !user.id) {
      toast({ title: "Authentication Error", description: "You must be logged in to add products.", variant: "destructive" });
      return;
    }

    const productDataToSave = {
      supplierId: user.id,
      name: data.name,
      description: data.description,
      price: data.price,
      unit: data.unit,
      category: data.category || '',
      imageUrl: data.imageUrl || `https://placehold.co/300x200.png?text=${encodeURIComponent(data.name)}`, // Default placeholder
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    try {
      await addDoc(collection(db, "products"), productDataToSave);
      toast({
        title: "Product Added!",
        description: `${data.name} has been successfully listed.`,
        variant: "default",
      });
      form.reset();
      if (onProductAddSuccess) onProductAddSuccess();
    } catch (error) {
      console.error("Failed to save product to Firestore:", error);
      toast({
        title: "Firestore Error",
        description: `Could not add product. Please try again. ${error instanceof Error ? error.message : ''}`,
        variant: "destructive",
      });
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Product Name *</FormLabel>
              <FormControl><Input placeholder="e.g., Organic Fuji Apples" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description *</FormLabel>
              <FormControl><Textarea placeholder="Describe your product..." {...field} rows={4} /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid md:grid-cols-2 gap-6">
          <FormField
            control={form.control}
            name="price"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Price (USD) *</FormLabel>
                <FormControl>
                  <Input 
                    type="number" 
                    step="0.01" 
                    placeholder="e.g., 25.99" 
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
                  <FormControl><SelectTrigger><SelectValue placeholder="Select a unit" /></SelectTrigger></FormControl>
                  <SelectContent>
                    {productUnits.map(unit => (
                      <SelectItem key={unit} value={unit}>{unit.charAt(0).toUpperCase() + unit.slice(1)}</SelectItem>
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
          name="category"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Category (Optional)</FormLabel>
              <FormControl><Input placeholder="e.g., Fresh Fruits, Apples" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <FormField
          control={form.control}
          name="imageUrl"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Image URL (Optional)</FormLabel>
              <FormControl><Input placeholder="https://placehold.co/300x200.png" {...field} /></FormControl>
              <FormMessage />
              <p className="text-xs text-muted-foreground">If left blank, a placeholder will be used.</p>
            </FormItem>
          )}
        />

        <Button type="submit" disabled={isSubmitting} className="w-full">
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Add Product
        </Button>
      </form>
    </Form>
  );
}
