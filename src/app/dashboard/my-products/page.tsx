
"use client";

import { useState, useEffect, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { Header } from "@/components/dashboard/Header";
import { ProductForm } from "@/components/products/ProductForm";
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase/config';
import { collection, query, where, onSnapshot, doc, deleteDoc, Timestamp } from 'firebase/firestore';
import type { Product as ProductType, StoredProduct } from '@/types/product';
import { PackagePlus, Trash2, Loader2, Info, ImageOff, Edit3, Package } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import Image from 'next/image';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';


function ProductCard({ product, onDelete }: { product: ProductType, onDelete: (productId: string) => void }) {
  return (
    <Card className="flex flex-col shadow-lg hover:shadow-xl transition-shadow duration-300">
      <CardHeader className="pb-2">
        {product.imageUrl ? (
          <div className="relative w-full h-48 rounded-t-md overflow-hidden">
            <Image 
              src={product.imageUrl} 
              alt={product.name} 
              fill 
              style={{ objectFit: 'cover' }}
              data-ai-hint="product image"
            />
          </div>
        ) : (
          <div className="w-full h-48 rounded-t-md bg-muted flex items-center justify-center">
            <ImageOff className="h-16 w-16 text-muted-foreground" />
          </div>
        )}
        <CardTitle className="mt-4 text-xl">{product.name}</CardTitle>
        {product.category && <Badge variant="outline" className="w-fit">{product.category}</Badge>}
      </CardHeader>
      <CardContent className="flex-grow space-y-2">
        <p className="text-2xl font-semibold text-primary">
          ${product.price.toFixed(2)} <span className="text-sm text-muted-foreground">/{product.unit}</span>
        </p>
        <p className="text-sm text-muted-foreground flex items-center">
          <Package className="h-4 w-4 mr-1.5 text-primary/80" />
          Stock: {product.stockQuantity} {product.unit}{product.stockQuantity !== 1 ? 's' : ''}
        </p>
        <CardDescription className="line-clamp-3">{product.description}</CardDescription>
      </CardContent>
      <CardFooter className="flex justify-between items-center pt-4 border-t">
         <p className="text-xs text-muted-foreground">
            Listed: {format(product.createdAt, "MMM d, yyyy")}
          </p>
        <Button variant="ghost" size="icon" onClick={() => onDelete(product.id)} aria-label="Delete product">
          <Trash2 className="h-5 w-5 text-destructive" />
        </Button>
        {/* Edit button can be added later */}
        {/* <Button variant="outline" size="sm"><Edit3 className="h-4 w-4 mr-2" /> Edit</Button> */}
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
        const data = doc.data() as Omit<StoredProduct, 'id' | 'createdAt' | 'updatedAt'>;
        fetchedProducts.push({
          ...data,
          id: doc.id,
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

  const handleDeleteProduct = async (productId: string) => {
    if (!confirm("Are you sure you want to delete this product?")) return;
    try {
      await deleteDoc(doc(db, "products", productId));
      toast({ title: "Product Deleted", description: "The product has been removed." });
      // Firestore listener will update the list automatically
    } catch (error) {
      console.error("Error deleting product: ", error);
      toast({ title: "Error", description: "Could not delete product.", variant: "destructive" });
    }
  };

  return (
    <>
      <Header title="My Product Listings" />
      <main className="flex-1 p-6 space-y-6">
        <Card className="shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Manage Your Products</CardTitle>
              <CardDescription>Add new products you offer or manage existing ones.</CardDescription>
            </div>
            <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
              <DialogTrigger asChild>
                <Button>
                  <PackagePlus className="mr-2 h-5 w-5" /> Add New Product
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Add a New Product</DialogTitle>
                </DialogHeader>
                <ProductForm onProductAddSuccess={() => setIsFormOpen(false)} />
              </DialogContent>
            </Dialog>
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
                <p className="text-sm text-muted-foreground">Click "Add New Product" to get started.</p>
              </div>
            )}
            {!isLoading && products.length > 0 && (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {products.map(product => (
                  <ProductCard key={product.id} product={product} onDelete={handleDeleteProduct} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </>
  );
}
