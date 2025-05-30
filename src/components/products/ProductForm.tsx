
"use client";

import { useEffect } from 'react';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { CalendarIcon, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { db } from '@/lib/firebase/config';
import { collection, addDoc, doc, updateDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { useAuth } from '@/contexts/AuthContext';
import type { ProductUnit, Product, ProductFormData, StoredProduct } from '@/types/product';

const productUnits: [ProductUnit, ...ProductUnit[]] = ['kg', 'box', 'pallet', 'item'];

const productSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(3, "Product name must be at least 3 characters."),
  description: z.string().min(10, "Description must be at least 10 characters."),
  price: z.coerce.number().positive("Price must be a positive number."),
  unit: z.enum(productUnits, { required_error: "Unit is required." }),
  stockQuantity: z.coerce.number().int().min(0, "Stock quantity cannot be negative.").optional(),
  category: z.string().optional(),
  imageUrl: z.string().url("Must be a valid URL for an image.").optional().or(z.literal('')),
  producedDate: z.date({ required_error: "Produced date is required." }),
  producedArea: z.string().min(2, "Produced area is required (e.g., farm name, region)."),
  producedByOrganization: z.string().min(2, "Organization name is required."),
});

interface ProductFormProps {
  productToEdit?: Product | null;
  onFormSubmitSuccess?: () => void;
}

export function ProductForm({ productToEdit, onFormSubmitSuccess }: ProductFormProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const isEditing = !!productToEdit;

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
      producedDate: productToEdit?.producedDate || new Date(),
      producedArea: productToEdit?.producedArea || '',
      producedByOrganization: productToEdit?.producedByOrganization || '',
    },
  });

  const { formState: { isSubmitting }, reset } = form;

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
        producedDate: productToEdit.producedDate ? new Date(productToEdit.producedDate) : new Date(),
        producedArea: productToEdit.producedArea,
        producedByOrganization: productToEdit.producedByOrganization,
      });
    } else {
      reset({
        id: undefined,
        name: '',
        description: '',
        price: undefined,
        unit: 'item',
        stockQuantity: undefined,
        category: '',
        imageUrl: '',
        producedDate: new Date(),
        producedArea: '',
        producedByOrganization: '',
      });
    }
  }, [productToEdit, reset]);

  const onSubmit: SubmitHandler<ProductFormData> = async (data) => {
    if (!user || !user.id) {
      toast({ title: "Authentication Error", description: "You must be logged in.", variant: "destructive" });
      return;
    }

    try {
      if (isEditing && productToEdit && productToEdit.id) {
        // UPDATING existing product
        const productRef = doc(db, "products", productToEdit.id);
        const updatePayload: Partial<Omit<StoredProduct, 'id' | 'createdAt'>> = {
          // Editable fields from form data
          name: data.name,
          description: data.description,
          price: data.price,
          unit: data.unit,
          stockQuantity: data.stockQuantity ?? 0,
          category: data.category || '',
          imageUrl: data.imageUrl || `https://placehold.co/300x200.png?text=${encodeURIComponent(data.name)}`,
          // Non-editable fields - take from the original productToEdit (ensure they exist)
          producedDate: productToEdit.producedDate ? Timestamp.fromDate(productToEdit.producedDate) : serverTimestamp(), // Fallback, should exist
          producedArea: productToEdit.producedArea,
          producedByOrganization: productToEdit.producedByOrganization,
          // Always update supplierId and updatedAt
          supplierId: user.id, 
          updatedAt: serverTimestamp(),
        };

        await updateDoc(productRef, updatePayload);
        toast({
          title: "Product Updated!",
          description: `${data.name} has been successfully updated.`,
        });
      } else {
        // ADDING new product
        const newProductData = {
          supplierId: user.id,
          name: data.name,
          description: data.description,
          price: data.price,
          unit: data.unit,
          stockQuantity: data.stockQuantity ?? 0,
          category: data.category || '',
          imageUrl: data.imageUrl || `https://placehold.co/300x200.png?text=${encodeURIComponent(data.name)}`,
          producedDate: Timestamp.fromDate(data.producedDate), 
          producedArea: data.producedArea,                    
          producedByOrganization: data.producedByOrganization, 
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };
        await addDoc(collection(db, "products"), newProductData);
        toast({
          title: "Product Added!",
          description: `${data.name} has been successfully listed.`,
        });
      }
      form.reset(); 
      if (onFormSubmitSuccess) onFormSubmitSuccess();
    } catch (error) {
      console.error("Failed to save product to Firestore:", error);
      toast({
        title: "Firestore Error",
        description: `Could not ${isEditing ? 'update' : 'add'} product. Please try again. ${error instanceof Error ? error.message : ''}`,
        variant: "destructive",
      });
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 md:space-y-6">
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
              <FormControl><Textarea placeholder="Describe your product..." {...field} rows={3} /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid md:grid-cols-3 gap-4">
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
                <Select onValueChange={field.onChange} value={field.value}>
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

        <div className="grid md:grid-cols-2 gap-4">
           <FormField
            control={form.control}
            name="producedDate"
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel>Produced Date *</FormLabel>
                <Popover>
                  <PopoverTrigger asChild>
                    <FormControl>
                      <Button
                        variant={"outline"}
                        className={cn(
                          "w-full pl-3 text-left font-normal",
                          !field.value && "text-muted-foreground"
                        )}
                        disabled={isEditing} // Disable if editing
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
                      disabled={(date) => // Keep existing calendar disabled logic + isEditing
                        isEditing || date > new Date() || date < new Date("1900-01-01")
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
            name="category"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Category (Optional)</FormLabel>
                <FormControl><Input placeholder="e.g., Fresh Fruits, Apples" {...field} value={field.value ?? ''} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        
        <FormField
          control={form.control}
          name="producedArea"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Produced Area/Farm *</FormLabel>
              <FormControl><Input placeholder="e.g., Sunny Valley Orchard, CA" {...field} disabled={isEditing} /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="producedByOrganization"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Produced By (Organization) *</FormLabel>
              <FormControl><Input placeholder="e.g., Your Company Name / Farm Cooperative" {...field} disabled={isEditing} /></FormControl>
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
              <FormControl><Input placeholder="https://placehold.co/300x200.png" {...field} value={field.value ?? ''} /></FormControl>
              <FormDescription>If blank, a placeholder will be used.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" disabled={isSubmitting} className="w-full">
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isEditing ? 'Update Product' : 'Add Product'}
        </Button>
      </form>
    </Form>
  );
}

