
"use client";

import { useEffect } from 'react';
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
import { collection, addDoc, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '@/contexts/AuthContext';
import type { ProductUnit, Product, ProductFormData } from '@/types/product';
import { Loader2 } from 'lucide-react';

const productUnits: [ProductUnit, ...ProductUnit[]] = ['kg', 'box', 'pallet', 'item'];

const productSchema = z.object({
  id: z.string().optional(), // For identifying product to update
  name: z.string().min(3, "Product name must be at least 3 characters."),
  description: z.string().min(10, "Description must be at least 10 characters."),
  price: z.coerce.number().positive("Price must be a positive number."),
  unit: z.enum(productUnits, { required_error: "Unit is required." }),
  stockQuantity: z.coerce.number().int().min(0, "Stock quantity cannot be negative.").optional(),
  category: z.string().optional(),
  imageUrl: z.string().url("Must be a valid URL for an image.").optional().or(z.literal('')),
});

interface ProductFormProps {
  productToEdit?: Product | null; // Product data for editing
  onFormSubmitSuccess?: () => void; // Callback for both add and update
}

export function ProductForm({ productToEdit, onFormSubmitSuccess }: ProductFormProps) {
  const { toast } = useToast();
  const { user } = useAuth();

  const form = useForm<ProductFormData>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      id: productToEdit?.id || undefined,
      name: productToEdit?.name || '',
      description: productToEdit?.description || '',
      price: productToEdit?.price || undefined,
      unit: productToEdit?.unit || 'item',
      stockQuantity: productToEdit?.stockQuantity ?? undefined,
      category: productToEdit?.category || '',
      imageUrl: productToEdit?.imageUrl || '',
    },
  });

  const { formState: { isSubmitting }, reset } = form;

  // Reset form when productToEdit changes (e.g., opening dialog for a new product or different product)
  useEffect(() => {
    if (productToEdit) {
      reset({
        id: productToEdit.id,
        name: productToEdit.name,
        description: productToEdit.description,
        price: productToEdit.price,
        unit: productToEdit.unit,
        stockQuantity: productToEdit.stockQuantity,
        category: productToEdit.category,
        imageUrl: productToEdit.imageUrl,
      });
    } else {
      reset({ // Default values for adding a new product
        id: undefined,
        name: '',
        description: '',
        price: undefined,
        unit: 'item',
        stockQuantity: undefined,
        category: '',
        imageUrl: '',
      });
    }
  }, [productToEdit, reset]);

  const onSubmit: SubmitHandler<ProductFormData> = async (data) => {
    if (!user || !user.id) {
      toast({ title: "Authentication Error", description: "You must be logged in.", variant: "destructive" });
      return;
    }

    const productDataForFirestore = {
      supplierId: user.id,
      name: data.name,
      description: data.description,
      price: data.price,
      unit: data.unit,
      stockQuantity: data.stockQuantity ?? 0,
      category: data.category || '',
      imageUrl: data.imageUrl || `https://placehold.co/300x200.png?text=${encodeURIComponent(data.name)}`,
      updatedAt: serverTimestamp(),
    };

    try {
      if (productToEdit && productToEdit.id) { // Editing existing product
        const productRef = doc(db, "products", productToEdit.id);
        await updateDoc(productRef, productDataForFirestore);
        toast({
          title: "Product Updated!",
          description: `${data.name} has been successfully updated.`,
        });
      } else { // Adding new product
        await addDoc(collection(db, "products"), {
          ...productDataForFirestore,
          createdAt: serverTimestamp(), // Only set createdAt for new products
        });
        toast({
          title: "Product Added!",
          description: `${data.name} has been successfully listed.`,
        });
      }
      form.reset(); // Reset form after successful submission
      if (onFormSubmitSuccess) onFormSubmitSuccess();
    } catch (error) {
      console.error("Failed to save product to Firestore:", error);
      toast({
        title: "Firestore Error",
        description: `Could not ${productToEdit ? 'update' : 'add'} product. Please try again. ${error instanceof Error ? error.message : ''}`,
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

        <div className="grid md:grid-cols-3 gap-6">
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
                    value={field.value ?? ''} // Ensure value is always a string or number
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
                <Select onValueChange={field.onChange} value={field.value}> {/* Use value prop here */}
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
           <FormField
            control={form.control}
            name="stockQuantity"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Stock Qty.</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    step="1"
                    placeholder="e.g., 100"
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
              <p className="text-xs text-muted-foreground">If blank, a placeholder will be used.</p>
            </FormItem>
          )}
        />

        <Button type="submit" disabled={isSubmitting} className="w-full">
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {productToEdit ? 'Update Product' : 'Add Product'}
        </Button>
      </form>
    </Form>
  );
}
