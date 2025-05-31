
"use client";

import { useState, useEffect, useCallback, type FormEvent } from 'react';
import { Header } from '@/components/dashboard/Header';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { useAuth, type User as AuthUser } from '@/contexts/AuthContext';
import type { Product as ProductType, StoredProduct } from '@/types/product';
import { db } from '@/lib/firebase/config';
import { collection, getDocs, query, Timestamp, where } from 'firebase/firestore'; // Added where
import { Loader2, Search, Package, ShoppingBag, Info, ImageOff, MessageSquare, CalendarDays, Home, Landmark, AlertCircle, Star, HistoryIcon } from 'lucide-react';
import Image from 'next/image';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';

interface SupplierWithProducts {
  supplier: AuthUser;
  products: ProductType[];
  purchaseCount: number; // How many times the current customer bought from this supplier
}

interface FindProductsPageProps {
  params: {};
  searchParams: { [key: string]: string | string[] | undefined };
}

const generateAiHint = (name: string, category?: string): string => {
  if (category) {
    const categoryWords = category.split(' ').map(word => word.toLowerCase().replace(/[^a-z0-9]/gi, '')).filter(Boolean);
    if (categoryWords.length > 0) return categoryWords.slice(0, 2).join(' ');
  }
  const nameWords = name.split(' ').map(word => word.toLowerCase().replace(/[^a-z0-9]/gi, '')).filter(Boolean);
  return nameWords.slice(0, 2).join(' ');
};

export default function FindProductsPage({ params, searchParams }: FindProductsPageProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [results, setResults] = useState<SupplierWithProducts[]>([]);
  const { user: currentUser, allUsersList, isLoadingUsers } = useAuth(); // Renamed user to currentUser for clarity
  const { toast } = useToast();
  const router = useRouter();

  const performSearch = useCallback(async (currentSearchTerm: string) => {
    if (!currentUser || currentUser.role !== 'customer') {
      setResults([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setResults([]);

    try {
      // Fetch all products
      const productsQuery = query(collection(db, "products"));
      const productsSnapshot = await getDocs(productsQuery);
      const fetchedProducts: ProductType[] = [];
      productsSnapshot.forEach(doc => {
        const data = doc.data() as Omit<StoredProduct, 'id' | 'createdAt' | 'updatedAt' | 'producedDate'>;
        fetchedProducts.push({
          ...data,
          id: doc.id,
          producedDate: (doc.data().producedDate as Timestamp)?.toDate(),
          createdAt: (doc.data().createdAt as Timestamp)?.toDate() || new Date(),
          updatedAt: (doc.data().updatedAt as Timestamp)?.toDate() || new Date(),
        });
      });

      // Fetch current customer's order history
      const customerOrdersQuery = query(collection(db, "orders"), where("customerId", "==", currentUser.id));
      const customerOrdersSnapshot = await getDocs(customerOrdersQuery);
      const purchaseFrequencyMap = new Map<string, number>();
      customerOrdersSnapshot.forEach(orderDoc => {
        const supplierId = orderDoc.data().supplierId as string;
        if (supplierId) {
          purchaseFrequencyMap.set(supplierId, (purchaseFrequencyMap.get(supplierId) || 0) + 1);
        }
      });

      // Filter products based on search term
      let matchingProducts = fetchedProducts;
      const lowerSearchTerm = currentSearchTerm.toLowerCase().trim();
      if (lowerSearchTerm) {
        matchingProducts = fetchedProducts.filter(product =>
          product.name.toLowerCase().includes(lowerSearchTerm) ||
          (product.category && product.category.toLowerCase().includes(lowerSearchTerm))
        );
      }

      // Group products by supplier and include purchase count
      const suppliersMap = new Map<string, SupplierWithProducts>();
      matchingProducts.forEach(product => {
        const supplier = allUsersList.find(u => u.id === product.supplierId && u.role === 'supplier' && !u.isSuspended && u.isApproved);
        if (supplier) {
          if (!suppliersMap.has(supplier.id)) {
            suppliersMap.set(supplier.id, {
              supplier,
              products: [],
              purchaseCount: purchaseFrequencyMap.get(supplier.id) || 0,
            });
          }
          suppliersMap.get(supplier.id)!.products.push(product);
        }
      });
      
      // Sort products within each supplier's list
      suppliersMap.forEach(supplierWithProducts => {
        supplierWithProducts.products.sort((a, b) => a.name.localeCompare(b.name));
      });

      // Sort suppliers: 1. by purchaseCount (desc), 2. by name (asc)
      const sortedResults = Array.from(suppliersMap.values()).sort((a, b) => {
        if (a.purchaseCount !== b.purchaseCount) {
          return b.purchaseCount - a.purchaseCount; // Higher purchase count first
        }
        return a.supplier.name.localeCompare(b.supplier.name); // Then by name
      });
      setResults(sortedResults);

    } catch (error) {
      console.error("Error searching products:", error);
      toast({ title: "Search Error", description: "Could not perform search. Please try again.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [allUsersList, toast, currentUser]); // Added currentUser to dependencies

  useEffect(() => {
    // Ensure currentUser and allUsersList are loaded before searching
    if (!isLoadingUsers && currentUser) {
      performSearch(searchTerm); 
    } else if (!isLoadingUsers && !currentUser) {
      // Handle case where user is not logged in or not a customer (though page should be role-gated)
      setIsLoading(false);
      setResults([]);
    }
  }, [isLoadingUsers, performSearch, searchTerm, currentUser]); 

  const handleSearchFormSubmit = (e: FormEvent) => {
    e.preventDefault();
    // performSearch is already called by useEffect when searchTerm changes
  };
  
  const handleContactSupplier = (productId: string, supplierId: string) => {
    router.push(`/dashboard/negotiate?productId=${productId}&supplierId=${supplierId}`);
  };

  return (
    <>
      <Header title="Find Products" />
      <main className="flex-1 p-6 space-y-6">
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>Search for Products</CardTitle>
            <CardDescription>Enter a product name or category to filter listings. Leave blank to see all.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSearchFormSubmit} className="flex items-center gap-2">
              <Input
                type="search"
                placeholder="e.g., Organic Apples, Fuji, Fresh Fruits"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="flex-grow"
              />
              <Button type="submit" disabled={isLoading || isLoadingUsers}>
                {(isLoading || isLoadingUsers) ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                <span className="ml-2">Search</span>
              </Button>
            </form>
          </CardContent>
        </Card>

        {(isLoading || isLoadingUsers) && (
          <div className="flex justify-center items-center py-10">
            <Loader2 className="h-8 w-8 animate-spin text-primary mr-2" />
            <p className="text-muted-foreground">Loading products...</p>
          </div>
        )}

        {!isLoading && !isLoadingUsers && results.length === 0 && (
          <Card>
            <CardContent className="py-10 text-center">
              <Info className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-xl font-semibold text-muted-foreground">
                {searchTerm.trim() ? `No Products Found Matching "${searchTerm}"` : "No Products Currently Listed"}
              </h3>
              <p className="text-sm text-muted-foreground">
                {searchTerm.trim() ? "Try a different search term or clear your search to see all products." : "Check back later or ask suppliers to list their products."}
              </p>
            </CardContent>
          </Card>
        )}

        {!isLoading && !isLoadingUsers && results.length > 0 && (
          <div className="space-y-6">
            <h2 className="text-2xl font-semibold text-primary">
              {searchTerm.trim() ? `Suppliers Found for "${searchTerm}"` : "All Available Products"}
            </h2>
            {results.map(({ supplier, products, purchaseCount }) => (
              <Card key={supplier.id} className="shadow-md">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ShoppingBag className="h-6 w-6 text-primary" />
                    Supplier: {supplier.name}
                    {supplier.averageSupplierRating !== undefined && supplier.supplierRatingCount !== undefined && supplier.supplierRatingCount > 0 ? (
                      <Badge variant="outline" className="ml-2 text-xs font-normal py-0.5">
                        <Star className="h-3 w-3 mr-1 text-yellow-500 fill-yellow-500" /> 
                        {supplier.averageSupplierRating.toFixed(1)} ({supplier.supplierRatingCount} ratings)
                      </Badge>
                    ) : null}
                    {purchaseCount > 0 && (
                      <Badge variant="secondary" className="ml-2 text-xs font-normal py-0.5 bg-blue-100 text-blue-700 border-blue-300">
                        <HistoryIcon className="h-3 w-3 mr-1" /> Previously purchased ({purchaseCount} {purchaseCount === 1 ? 'time' : 'times'})
                      </Badge>
                    )}
                  </CardTitle>
                  <CardDescription>Products matching your criteria from this supplier.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {products.map(product => {
                       const aiHint = generateAiHint(product.name, product.category);
                       const isOutOfStock = product.stockQuantity !== undefined && product.stockQuantity <= 0;
                       return (
                        <Card key={product.id} className={`flex flex-col ${isOutOfStock ? 'opacity-60' : ''}`}>
                          <CardHeader className="pb-2">
                             {product.imageUrl ? (
                              <div className="relative w-full h-40 rounded-t-md overflow-hidden">
                                <Image
                                  src={product.imageUrl}
                                  alt={product.name}
                                  fill
                                  style={{ objectFit: 'cover' }}
                                  data-ai-hint={aiHint || "product image"}
                                />
                              </div>
                            ) : (
                              <div className="w-full h-40 rounded-t-md bg-muted flex items-center justify-center">
                                <ImageOff className="h-12 w-12 text-muted-foreground" />
                              </div>
                            )}
                            <CardTitle className="mt-3 text-lg">{product.name}</CardTitle>
                            {product.category && <Badge variant="outline" className="w-fit text-xs mt-1">{product.category}</Badge>}
                             {isOutOfStock && (
                              <Badge variant="destructive" className="w-fit text-xs mt-1">
                                <AlertCircle className="mr-1 h-3 w-3" /> Out of Stock
                              </Badge>
                            )}
                          </CardHeader>
                          <CardContent className="flex-grow space-y-1 text-sm">
                            <p className="text-lg font-semibold text-primary">
                              ${product.price.toFixed(2)} <span className="text-xs text-muted-foreground">/{product.unit}</span>
                            </p>
                            <p className="text-xs text-muted-foreground flex items-center">
                              <Package className="h-3 w-3 mr-1 text-primary/80" />
                              Stock: {product.stockQuantity} {product.unit}{product.stockQuantity !== 1 ? 's' : ''}
                            </p>
                            <p className="text-xs text-muted-foreground line-clamp-2">{product.description}</p>
                            {product.producedDate && (
                              <p className="text-xs text-muted-foreground flex items-center">
                                <CalendarDays className="h-3 w-3 mr-1 text-primary/70" />
                                Produced: {format(product.producedDate, "MMM d, yyyy")}
                              </p>
                            )}
                            {product.producedArea && (
                              <p className="text-xs text-muted-foreground flex items-center">
                                <Home className="h-3 w-3 mr-1 text-primary/70" />
                                Area: {product.producedArea}
                              </p>
                            )}
                            {product.producedByOrganization && (
                              <p className="text-xs text-muted-foreground flex items-center">
                                <Landmark className="h-3 w-3 mr-1 text-primary/70" />
                                By: {product.producedByOrganization}
                              </p>
                            )}
                          </CardContent>
                           <CardFooter className="pt-3 border-t mt-auto">
                            <Button
                              variant="outline"
                              size="sm"
                              className="w-full"
                              onClick={() => handleContactSupplier(product.id, supplier.id)}
                              disabled={isOutOfStock}
                            >
                              <MessageSquare className="mr-2 h-4 w-4"/>
                              {isOutOfStock ? 'Out of Stock' : 'Contact Supplier'}
                            </Button>
                          </CardFooter>
                        </Card>
                       );
                    })}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </>
  );
}
    

    