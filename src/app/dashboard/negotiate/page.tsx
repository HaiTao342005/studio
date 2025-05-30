
"use client";

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { Header } from '@/components/dashboard/Header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useAuth, type User as AuthUser } from '@/contexts/AuthContext';
import type { Product as ProductType, StoredProduct } from '@/types/product';
import { OrderStatus } from '@/types/transaction'; // Import OrderStatus
import { db } from '@/lib/firebase/config';
import { doc, getDoc, addDoc, collection, serverTimestamp, Timestamp } from 'firebase/firestore';
import { Loader2, Info, ShoppingBag, UserCircle, ArrowLeft, CheckCircle, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface NegotiationPageContentProps {
  productId: string;
  supplierId: string;
}

function NegotiationPageContent({ productId, supplierId }: NegotiationPageContentProps) {
  const router = useRouter();
  const { user: customer, isLoading: isLoadingAuth } = useAuth();
  const { toast } = useToast();

  const [product, setProduct] = useState<ProductType | null>(null);
  const [supplier, setSupplier] = useState<AuthUser | null>(null);
  const [desiredQuantity, setDesiredQuantity] = useState<number>(1);
  const [totalPrice, setTotalPrice] = useState<number>(0);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { allUsersList } = useAuth();

  useEffect(() => {
    if (!productId || !supplierId) {
      setError("Missing product or supplier information.");
      setIsLoadingData(false);
      return;
    }

    const fetchProduct = async () => {
      try {
        const productRef = doc(db, "products", productId);
        const productSnap = await getDoc(productRef);
        if (productSnap.exists()) {
          const data = productSnap.data() as Omit<StoredProduct, 'id' | 'createdAt' | 'updatedAt'>;
          setProduct({
            ...data,
            id: productSnap.id,
            createdAt: (data.createdAt as Timestamp)?.toDate() || new Date(),
            updatedAt: (data.updatedAt as Timestamp)?.toDate() || new Date(),
          });
        } else {
          setError("Product not found.");
        }
      } catch (err) {
        console.error("Error fetching product:", err);
        setError("Failed to load product details.");
      }
    };

    const findSupplier = () => {
      const foundSupplier = allUsersList.find(u => u.id === supplierId && u.role === 'supplier');
      if (foundSupplier) {
        setSupplier(foundSupplier);
      } else {
        setError("Supplier not found.");
      }
    };

    // Ensure both fetchProduct and findSupplier (dependent on allUsersList) are handled
    if (allUsersList.length > 0 || isLoadingAuth) { // Proceed if users are loaded or still loading (to avoid race condition)
        Promise.all([fetchProduct(), findSupplier()]).finally(() => setIsLoadingData(false));
    } else if (!isLoadingAuth && allUsersList.length === 0 && supplierId) {
        // Handle case where users list is definitively empty but we need a supplier
        setError("Supplier list not available. Cannot find supplier.");
        setIsLoadingData(false);
    }


  }, [productId, supplierId, allUsersList, isLoadingAuth]); // Added isLoadingAuth

  useEffect(() => {
    if (product && desiredQuantity > 0) {
      setTotalPrice(product.price * desiredQuantity);
    } else {
      setTotalPrice(0);
    }
  }, [product, desiredQuantity]);

  const handleMakeOrder = async () => {
    console.log("[NegotiatePage] handleMakeOrder called");
    console.log("[NegotiatePage] Product:", product);
    console.log("[NegotiatePage] Supplier:", supplier);
    console.log("[NegotiatePage] Customer:", customer);
    console.log("[NegotiatePage] Desired Quantity:", desiredQuantity);
    console.log("[NegotiatePage] Total Price:", totalPrice);


    if (!product || !supplier || !customer || desiredQuantity <= 0) {
      console.error("[NegotiatePage] Validation failed: Missing product, supplier, customer, or invalid quantity.");
      toast({ title: "Order Error", description: "Missing information or invalid quantity.", variant: "destructive" });
      return;
    }

    const availableStock = product.stockQuantity ?? 0;
    console.log("[NegotiatePage] Available Stock:", availableStock);

    if (desiredQuantity > availableStock) {
      console.error("[NegotiatePage] Validation failed: Not enough stock.");
      toast({ title: "Order Error", description: `Not enough stock. Available: ${availableStock} ${product.unit}(s).`, variant: "destructive" });
      return;
    }

    setIsSubmittingOrder(true);
    console.log("[NegotiatePage] Attempting to create orderData...");
    try {
      const orderData = {
        productId: product.id,
        productName: product.name,
        supplierId: supplier.id,
        supplierName: supplier.name,
        customerId: customer.id,
        customerName: customer.name,
        quantity: desiredQuantity,
        pricePerUnit: product.price,
        totalAmount: totalPrice,
        currency: 'USD',
        unit: product.unit,
        status: 'Awaiting Supplier Confirmation' as OrderStatus,
        orderDate: serverTimestamp(),
        shipmentStatus: undefined,
        podSubmitted: false,
      };
      console.log("[NegotiatePage] OrderData to be sent to Firestore:", orderData);

      const docRef = await addDoc(collection(db, "orders"), orderData);
      console.log("[NegotiatePage] Order placed successfully in Firestore, doc ID:", docRef.id);

      toast({ title: "Order Placed!", description: `Your order for ${desiredQuantity} ${product.unit}(s) of ${product.name} has been placed and is awaiting supplier confirmation.`, });
      router.push('/dashboard/my-orders');
    } catch (err) {
      console.error("[NegotiatePage] Error placing order in try-catch:", err);
      toast({ title: "Order Failed", description: `Could not place your order. ${(err as Error).message || 'Please try again.'}`, variant: "destructive" });
    } finally {
      setIsSubmittingOrder(false);
      console.log("[NegotiatePage] handleMakeOrder finished.");
    }
  };

  if (isLoadingData || isLoadingAuth) {
    return (
      <div className="flex flex-1 justify-center items-center min-h-screen">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-3 text-muted-foreground">Loading negotiation details...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-1 flex-col justify-center items-center min-h-screen p-6">
        <Info className="h-12 w-12 text-destructive mb-4" />
        <h3 className="text-xl font-semibold text-destructive mb-2">Error</h3>
        <p className="text-muted-foreground mb-4">{error}</p>
        <Button onClick={() => router.push('/dashboard/find-products')}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Find Products
        </Button>
      </div>
    );
  }

  if (!product || !supplier || !customer) {
     return (
      <div className="flex flex-1 flex-col justify-center items-center min-h-screen p-6">
        <Info className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-xl font-semibold text-muted-foreground">Information Missing</h3>
        <p className="text-sm text-muted-foreground mb-4">Could not load product, supplier, or customer details. Please try again.</p>
        <Button onClick={() => router.push('/dashboard/find-products')}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Find Products
        </Button>
      </div>
    );
  }

  return (
    <>
      <Header title="Negotiate Purchase" />
      <main className="flex-1 p-6 space-y-6">
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-2xl text-primary">Product Details</CardTitle>
          </CardHeader>
          <CardContent className="grid md:grid-cols-2 gap-6">
            <div className="relative w-full h-64 md:h-80 rounded-lg overflow-hidden border">
              <Image
                src={product.imageUrl || `https://placehold.co/600x400.png?text=${encodeURIComponent(product.name)}`}
                alt={product.name}
                fill
                style={{ objectFit: 'cover' }}
                data-ai-hint={generateAiHint(product.name, product.category)}
              />
            </div>
            <div className="space-y-3">
              <h2 className="text-3xl font-bold">{product.name}</h2>
              {product.category && <Badge variant="outline">{product.category}</Badge>}
              <p className="text-muted-foreground">{product.description}</p>
              <p className="text-2xl font-semibold text-primary">
                ${product.price.toFixed(2)} <span className="text-sm text-muted-foreground">/{product.unit}</span>
              </p>
              <p className="text-sm text-muted-foreground">
                Available Stock: {product.stockQuantity ?? 0} {product.unit}{(product.stockQuantity ?? 0) !== 1 ? 's' : ''}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <ShoppingBag className="h-5 w-5 text-primary" /> Supplier: {supplier.name}
            </CardTitle>
          </CardHeader>
        </Card>

        <Card className="shadow-md">
          <CardHeader>
            <CardTitle>Your Offer</CardTitle>
            <CardDescription>Specify the quantity you wish to purchase.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="desiredQuantity" className="text-base">Desired Quantity ({product.unit}{product.unit !== 'item' ? 's' : ''})</Label>
              <Input
                id="desiredQuantity"
                type="number"
                min="1"
                max={product.stockQuantity ?? 0}
                value={desiredQuantity}
                onChange={(e) => setDesiredQuantity(Math.max(1, parseInt(e.target.value, 10) || 1))}
                className="mt-1 text-lg p-2"
              />
              {desiredQuantity > (product.stockQuantity ?? 0) && (
                <p className="text-sm text-destructive mt-1">Requested quantity exceeds available stock ({product.stockQuantity ?? 0}).</p>
              )}
            </div>
            {desiredQuantity > 0 && (
              <div className="p-4 bg-secondary/50 rounded-md border">
                <p className="text-sm text-muted-foreground">Calculated Total:</p>
                <p className="text-3xl font-bold text-primary">${totalPrice.toFixed(2)}</p>
                <p className="text-xs text-muted-foreground">
                  ({desiredQuantity} {product.unit}{desiredQuantity !== 1 ? 's' : ''} x ${product.price.toFixed(2)}/{product.unit})
                </p>
              </div>
            )}
          </CardContent>
          <CardFooter className="flex flex-col sm:flex-row justify-end gap-3 pt-4 border-t">
            <Button variant="outline" onClick={() => router.push('/dashboard/find-products')} className="w-full sm:w-auto">
              <XCircle className="mr-2 h-4 w-4" /> Find Another Supplier
            </Button>
            <Button
              onClick={handleMakeOrder}
              disabled={isSubmittingOrder || desiredQuantity <= 0 || desiredQuantity > (product.stockQuantity ?? 0)}
              className="w-full sm:w-auto"
            >
              {isSubmittingOrder ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle className="mr-2 h-4 w-4" />
              )}
              Make Order
            </Button>
          </CardFooter>
        </Card>
      </main>
    </>
  );
}

// Wrapper component to handle Suspense for useSearchParams
export default function NegotiationPage() {
  return (
    <Suspense fallback={<div className="flex flex-1 justify-center items-center min-h-screen"><Loader2 className="h-12 w-12 animate-spin text-primary" /><p className="ml-3 text-muted-foreground">Loading...</p></div>}>
      <NegotiationPageInternal />
    </Suspense>
  );
}

function NegotiationPageInternal() {
  const searchParams = useSearchParams();
  const productId = searchParams.get('productId');
  const supplierId = searchParams.get('supplierId');

  if (!productId || !supplierId) {
    return (
        <div className="flex flex-1 flex-col justify-center items-center min-h-screen p-6">
            <Header title="Error" />
            <main className="flex-1 p-6">
                <Info className="mx-auto h-12 w-12 text-destructive mb-4" />
                <h3 className="text-xl font-semibold text-destructive mb-2 text-center">Missing Information</h3>
                <p className="text-muted-foreground text-center">Product or supplier ID is missing. Please go back and try again.</p>
                <div className="mt-6 flex justify-center">
                    <Button onClick={() => window.history.back()}>
                        <ArrowLeft className="mr-2 h-4 w-4" /> Go Back
                    </Button>
                </div>
            </main>
        </div>
    );
  }

  return <NegotiationPageContent productId={productId} supplierId={supplierId} />;
}

const generateAiHint = (name: string, category?: string): string => {
  if (category) {
    const categoryWords = category.split(' ').map(word => word.toLowerCase().replace(/[^a-z0-9]/gi, '')).filter(Boolean);
    if (categoryWords.length > 0) return categoryWords.slice(0, 2).join(' ');
  }
  const nameWords = name.split(' ').map(word => word.toLowerCase().replace(/[^a-z0-9]/gi, '')).filter(Boolean);
  return nameWords.slice(0, 2).join(' ');
};

