
"use client";

import { useState, useEffect, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Header } from "@/components/dashboard/Header";
import { ProductForm } from "@/components/products/ProductForm";
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase/config';
import { collection, query, where, onSnapshot, doc, deleteDoc, Timestamp, getDoc } from 'firebase/firestore';
import type { Product as ProductType, StoredProduct } from '@/types/product';
import { PackagePlus, Trash2, Loader2, Info, ImageOff, Edit3, Package, CalendarDays, Home, Landmark, AlertCircle, Ban } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import Image from 'next/image';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';

const generateAiHint = (name: string, category?: string): string => {
  if (category) {
    const categoryWords = category.split(' ').map(word => word.toLowerCase().replace(/[^a-z0-9]/gi, '')).filter(Boolean);
    if (categoryWords.length > 0) return categoryWords.slice(0, 2).join(' ');
  }
  const nameWords = name.split(' ').map(word => word.toLowerCase().replace(/[^a-z0-9]/gi, '')).filter(Boolean);
  return nameWords.slice(0, 2).join(' ');
};

function ProductCard({ product, onDelete, onEdit, isSuspended }: { product: ProductType, onDelete: (productId: string, productName: string) => void, onEdit: (product: ProductType) => void, isSuspended?: boolean }) {
  const aiHint = generateAiHint(product.name, product.category);
  const isOutOfStock = product.stockQuantity !== undefined && product.stockQuantity <= 0;

  return (
    <Card className={`flex flex-col shadow-lg hover:shadow-xl transition-shadow duration-300 ${isOutOfStock ? 'opacity-70' : ''} ${isSuspended ? 'opacity-50 cursor-not-allowed' : ''}`}>
      <CardHeader className="pb-2">
        {product.imageUrl ? (
          <div className="relative w-full h-48 rounded-t-md overflow-hidden">
            <Image
              src={product.imageUrl}
              alt={product.name}
              fill
              style={{ objectFit: 'cover' }}
              data-ai-hint={aiHint || "product image"}
            />
          </div>
        ) : (
          <div className="w-full h-48 rounded-t-md bg-muted flex items-center justify-center">
            <ImageOff className="h-16 w-16 text-muted-foreground" />
          </div>
        )}
        <CardTitle className="mt-4 text-xl">{product.name}</CardTitle>
        {product.category && <Badge variant="outline" className="w-fit mt-1">{product.category}</Badge>}
        {isOutOfStock && (
          <Badge variant="destructive" className="w-fit mt-1">
            <AlertCircle className="mr-1 h-3 w-3" /> Out of Stock
          </Badge>
        )}
      </CardHeader>
      <CardContent className="flex-grow space-y-2 text-sm">
        <p className="text-2xl font-semibold text-primary">
          ${product.price.toFixed(2)} <span className="text-sm text-muted-foreground">/{product.unit}</span>
        </p>
        <p className="text-muted-foreground flex items-center">
          <Package className="h-4 w-4 mr-1.5 text-primary/80" />
          Stock: {product.stockQuantity} {product.unit}{product.stockQuantity !== 1 ? 's' : ''}
        </p>
        <CardDescription className="line-clamp-2 mb-2">{product.description}</CardDescription>
        
        {product.producedDate && (
          <p className="text-xs text-muted-foreground flex items-center">
            <CalendarDays className="h-3 w-3 mr-1.5 text-primary/70" />
            Produced: {format(product.producedDate, "MMM d, yyyy")}
          </p>
        )}
        {product.producedArea && (
          <p className="text-xs text-muted-foreground flex items-center">
            <Home className="h-3 w-3 mr-1.5 text-primary/70" />
            Area: {product.producedArea}
          </p>
        )}
        {product.producedByOrganization && (
          <p className="text-xs text-muted-foreground flex items-center">
            <Landmark className="h-3 w-3 mr-1.5 text-primary/70" />
            By: {product.producedByOrganization}
          </p>
        )}
      </CardContent>
      <CardFooter className="flex justify-between items-center pt-4 border-t mt-auto">
         <p className="text-xs text-muted-foreground">
            Listed: {product.createdAt ? format(product.createdAt, "MMM d, yyyy") : 'N/A'}
          </p>
        <div className="flex gap-1">
          <Button variant="outline" size="icon" onClick={() => !isSuspended && onEdit(product)} aria-label="Edit product" disabled={isSuspended}>
            <Edit3 className="h-5 w-5 text-primary" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => !isSuspended && onDelete(product.id, product.name)} aria-label={`Delete product ${product.name}`} disabled={isSuspended}>
            <Trash2 className="h-5 w-5 text-destructive" />
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}


interface MyProductsPageProps {
  params: {};
  searchParams: { [key: string]: string | string[] | undefined };
}

export default function MyProductsPage({ params, searchParams }: MyProductsPageProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [products, setProducts] = useState<ProductType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductType | null>(null);

  useEffect(() => {
    if (!user || !user.id) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const q = query(collection(db, "products"), where("supplierId", "==", user.id));

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const fetchedProducts: ProductType[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data() as Omit<StoredProduct, 'id' | 'createdAt' | 'updatedAt' | 'producedDate'>;
        fetchedProducts.push({
          ...data,
          id: doc.id,
          producedDate: (doc.data().producedDate as Timestamp)?.toDate(),
          createdAt: (doc.data().createdAt as Timestamp)?.toDate() || new Date(),
          updatedAt: (doc.data().updatedAt as Timestamp)?.toDate() || new Date(),
        });
      });
      setProducts(fetchedProducts.sort((a,b) => b.createdAt.getTime() - a.createdAt.getTime()));
      setIsLoading(false);
    }, (error) => {
      console.error("Error fetching products: ", error);
      toast({ title: "Error", description: "Could not fetch products.", variant: "destructive" });
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [user, toast]);

  const handleDeleteProduct = async (productId: string, productName: string) => {
    if (user?.isSuspended) {
      toast({ title: "Action Denied", description: "Your account is suspended. You cannot delete products.", variant: "destructive" });
      return;
    }
    if (!user || !user.id) {
      toast({ title: "Authentication Error", description: "You must be logged in to delete products.", variant: "destructive" });
      console.log("[MyProductsPage] Delete cancelled: User not authenticated.");
      return;
    }

    console.log(`[MyProductsPage] User ${user.id} is attempting to delete product: "${productName}" (ID: ${productId})`);

    if (!confirm(`Are you sure you want to delete the product "${productName}"? This action cannot be undone.`)) {
      console.log(`[MyProductsPage] Deletion cancelled by user for product: "${productName}"`);
      return;
    }
    
    console.log(`[MyProductsPage] User confirmed deletion for product: "${productName}" (ID: ${productId})`);
    try {
      const productRef = doc(db, "products", productId);
      const productSnap = await getDoc(productRef);

      if (!productSnap.exists()) {
        console.error("[MyProductsPage] Product not found in Firestore during delete attempt:", productId);
        toast({ title: "Error", description: `Product "${productName}" not found. It may have already been deleted.`, variant: "destructive" });
        return;
      }

      const productData = productSnap.data();
      if (productData.supplierId !== user.id) {
        console.error(`[MyProductsPage] Ownership check failed: User ${user.id} attempting to delete product owned by ${productData.supplierId}`);
        toast({ title: "Permission Denied", description: "You can only delete your own products.", variant: "destructive" });
        return;
      }
      
      console.log("[MyProductsPage] Ownership confirmed. Attempting to delete product from Firestore:", productId);
      await deleteDoc(productRef);
      console.log("[MyProductsPage] Product successfully deleted from Firestore:", productId);
      toast({ title: "Product Deleted", description: `Product "${productName}" has been successfully removed from your listings.` });
    } catch (error) {
      console.error("[MyProductsPage] Error deleting product from Firestore:", error);
      toast({ title: "Error Deleting Product", description: `Could not delete product "${productName}". ${error instanceof Error ? error.message : 'Unknown error'}`, variant: "destructive" });
    }
  };

  const handleOpenAddProductForm = () => {
    if (user?.isSuspended) {
      toast({ title: "Action Denied", description: "Your account is suspended. You cannot add new products.", variant: "destructive" });
      return;
    }
    if (!user?.address) {
      toast({
        title: "Address Required",
        description: "Please update your address in your profile before adding new products. This address will be used as the pickup location.",
        variant: "destructive",
        duration: 7000,
      });
      return;
    }
    setEditingProduct(null); 
    setIsFormOpen(true);
  };

  const handleOpenEditProductForm = (product: ProductType) => {
    if (user?.isSuspended) {
       toast({ title: "Action Denied", description: "Your account is suspended. You cannot edit products.", variant: "destructive" });
      return;
    }
    setEditingProduct(product);
    setIsFormOpen(true);
  };

  const handleFormSubmitSuccess = () => {
    setIsFormOpen(false);
    setEditingProduct(null); 
  };

  return (
    <>
      <Header title="My Product Listings" />
      <main className="flex-1 p-6 space-y-6">
        <Card className="shadow-lg">
          <CardHeader className="flex flex-row items-center p-6">
            <div className="flex-grow">
              <CardTitle>Manage Your Products</CardTitle>
              <CardDescription>
                {user?.isSuspended 
                  ? "Your account is currently suspended. You cannot add or manage products." 
                  : "Add new products you offer or manage existing ones. Ensure your profile address is up-to-date for pickup locations."
                }
              </CardDescription>
            </div>
            <Button onClick={handleOpenAddProductForm} className="ml-4" disabled={user?.isSuspended}>
              {user?.isSuspended ? <Ban className="mr-2 h-5 w-5" /> : <PackagePlus className="mr-2 h-5 w-5" />}
              {user?.isSuspended ? "Account Suspended" : "Add New Product"}
            </Button>
          </CardHeader>
          <CardContent>
            {isLoading && (
              <div className="flex justify-center items-center py-10">
                <Loader2 className="h-8 w-8 animate-spin text-primary mr-2" />
                <p className="text-muted-foreground">Loading your products...</p>
              </div>
            )}
            {!isLoading && products.length === 0 && (
              <div className="text-center py-10">
                <Info className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-xl font-semibold text-muted-foreground">No Products Listed Yet</h3>
                <p className="text-sm text-muted-foreground">
                  {user?.isSuspended ? "Your account is suspended." : "Click \"Add New Product\" to get started."}
                </p>
              </div>
            )}
            {!isLoading && products.length > 0 && (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {products.map(product => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    onDelete={handleDeleteProduct}
                    onEdit={handleOpenEditProductForm}
                    isSuspended={user?.isSuspended}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Dialog open={isFormOpen && !user?.isSuspended} onOpenChange={(isOpen) => {
          if (user?.isSuspended) {
            setIsFormOpen(false);
            return;
          }
          setIsFormOpen(isOpen);
          if (!isOpen) setEditingProduct(null); 
        }}>
          <DialogContent className="sm:max-w-xl md:max-w-2xl lg:max-w-3xl">
            <DialogHeader>
              <DialogTitle>{editingProduct ? `Edit Product: ${editingProduct.name}` : 'Add a New Product'}</DialogTitle>
            </DialogHeader>
            <ProductForm
              productToEdit={editingProduct}
              onFormSubmitSuccess={handleFormSubmitSuccess}
            />
          </DialogContent>
        </Dialog>
      </main>
    </>
  );
}

    