
"use client";

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { Header } from '@/components/dashboard/Header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"; 
import { useToast } from '@/hooks/use-toast';
import { useAuth, type User as AuthUser } from '@/contexts/AuthContext';
import type { Product as ProductType, StoredProduct } from '@/types/product';
import { OrderStatus } from '@/types/transaction'; 
import { db } from '@/lib/firebase/config';
import { doc, getDoc, addDoc, collection, serverTimestamp, Timestamp } from 'firebase/firestore';
import { Loader2, Info, ShoppingBag, UserCircle, ArrowLeft, CheckCircle, XCircle, CalendarDays, Home, Landmark, AlertCircle, Pin, Star } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { calculateDistance, type CalculateDistanceOutput } from '@/ai/flows/calculate-distance-flow';

interface NegotiationPageContentProps {
  productId: string;
  supplierId: string;
}

function NegotiationPageContent({ productId, supplierId }: NegotiationPageContentProps) {
  const router = useRouter();
  const { user: customer, isLoading: isLoadingAuth, allUsersList } = useAuth(); // Added allUsersList
  const { toast } = useToast();

  const [product, setProduct] = useState<ProductType | null>(null);
  const [supplier, setSupplier] = useState<AuthUser | null>(null);
  const [desiredQuantity, setDesiredQuantity] = useState<number>(1);
  const [totalPrice, setTotalPrice] = useState<number>(0);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shippingDistanceResult, setShippingDistanceResult] = useState<CalculateDistanceOutput | null>(null);
  const [isLoadingDistance, setIsLoadingDistance] = useState(false);
  const [distanceError, setDistanceError] = useState<string | null>(null);

  // const { allUsersList } = useAuth(); // Already destructured above

  useEffect(() => {
    console.log("[NegotiatePage] useEffect triggered. productId:", productId, "supplierId:", supplierId);
    if (!productId || !supplierId) {
      setError("Missing product or supplier information.");
      setIsLoadingData(false);
      console.error("[NegotiatePage] Missing productId or supplierId in useEffect.");
      return;
    }

    const fetchProductAndSupplier = async () => {
      setIsLoadingData(true);
      setError(null);
      setDistanceError(null);
      setShippingDistanceResult(null);

      try {
        const productRef = doc(db, "products", productId);
        const productSnap = await getDoc(productRef);
        let fetchedProduct: ProductType | null = null;

        if (productSnap.exists()) {
          const data = productSnap.data() as Omit<StoredProduct, 'id' | 'createdAt' | 'updatedAt' | 'producedDate'>;
          fetchedProduct = {
            ...data,
            id: productSnap.id,
            producedDate: (data.producedDate as Timestamp)?.toDate(),
            createdAt: (data.createdAt as Timestamp)?.toDate() || new Date(),
            updatedAt: (data.updatedAt as Timestamp)?.toDate() || new Date(),
          };
          setProduct(fetchedProduct);
          console.log("[NegotiatePage] Product fetched successfully:", fetchedProduct.name);
        } else {
          setError("Product not found.");
          console.error("[NegotiatePage] Product not found in Firestore with id:", productId);
        }

        // Use the supplier from allUsersList which includes rating info
        const foundSupplier = allUsersList.find(u => u.id === supplierId && u.role === 'supplier');
        if (foundSupplier) {
          setSupplier(foundSupplier);
          console.log("[NegotiatePage] Supplier found:", foundSupplier.name);
        } else if (allUsersList.length > 0) { 
          setError(prevError => prevError ? `${prevError} Supplier not found.` : "Supplier not found.");
          console.error("[NegotiatePage] Supplier not found in allUsersList with id:", supplierId);
        }
        
        if (fetchedProduct && fetchedProduct.producedArea && customer?.address) {
          setIsLoadingDistance(true);
          setDistanceError(null);
          try {
            const distanceResult = await calculateDistance({ 
              originAddress: fetchedProduct.producedArea, 
              destinationAddress: customer.address
            });
            setShippingDistanceResult(distanceResult);
            if (distanceResult.note && distanceResult.note.toLowerCase().includes('failed')) {
              toast({ title: "Shipping Info", description: distanceResult.note, duration: 7000, variant: 'destructive'});
            }
          } catch (distError) {
            const msg = distError instanceof Error ? distError.message : "Could not estimate shipping distance.";
            console.error("[NegotiatePage] Error calculating distance:", distError);
            setDistanceError(msg);
            toast({ title: "Distance Calculation Error", description: msg, variant: "destructive" });
          } finally {
            setIsLoadingDistance(false);
          }
        } else if (fetchedProduct && !customer?.address) {
             setDistanceError("Customer address not set. Please update your profile.");
             setIsLoadingDistance(false);
        }


      } catch (err) {
        console.error("[NegotiatePage] Error fetching data:", err);
        setError("Failed to load product or supplier details.");
      } finally {
        setIsLoadingData(false);
      }
    };
    
    if ((allUsersList.length > 0 || isLoadingAuth) && productId && supplierId) {
      fetchProductAndSupplier();
    } else if (!isLoadingAuth && (allUsersList.length === 0 && supplierId)) {
      setError("Supplier list not available. Cannot find supplier.");
      setIsLoadingData(false);
    }

  }, [productId, supplierId, allUsersList, isLoadingAuth, toast, customer]);

  useEffect(() => {
    if (product && desiredQuantity > 0) {
      setTotalPrice(product.price * desiredQuantity);
    } else {
      setTotalPrice(0);
    }
  }, [product, desiredQuantity]);

  const handleMakeOrder = async () => {
    console.log("[NegotiatePage] handleMakeOrder called");

    if (!customer?.address) {
      toast({
        title: "Delivery Address Required",
        description: "Please update your address in your profile before placing an order.",
        variant: "destructive",
        duration: 7000,
      });
      setIsSubmittingOrder(false);
      return;
    }

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
        podSubmitted: false,
        assessmentSubmitted: false, // Initialize assessment status
      };
      console.log("[NegotiatePage] OrderData to be sent to Firestore:", orderData);
      console.log("[NegotiatePage] Saving order with supplierId:", orderData.supplierId, "and customerId:", orderData.customerId);
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

  const isOutOfStock = product?.stockQuantity !== undefined && product.stockQuantity <= 0;
  const customerAddressMissing = !customer?.address;

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
              {isOutOfStock && (
                <Badge variant="destructive" className="mt-2">
                  <AlertCircle className="mr-1 h-4 w-4" /> Out of Stock
                </Badge>
              )}
              <p className="text-muted-foreground">{product.description}</p>
              <p className="text-2xl font-semibold text-primary">
                ${product.price.toFixed(2)} <span className="text-sm text-muted-foreground">/{product.unit}</span>
              </p>
              <p className="text-sm text-muted-foreground">
                Available Stock: {product.stockQuantity ?? 0} {product.unit}{(product.stockQuantity ?? 0) !== 1 ? 's' : ''}
              </p>
              {product.producedDate && (
                <p className="text-sm text-muted-foreground flex items-center">
                  <CalendarDays className="h-4 w-4 mr-1.5 text-primary/70" />
                  Produced: {format(product.producedDate, "PPP")}
                </p>
              )}
              {product.producedArea && (
                <p className="text-sm text-muted-foreground flex items-center">
                  <Home className="h-4 w-4 mr-1.5 text-primary/70" />
                  Area/Farm: {product.producedArea}
                </p>
              )}
              {product.producedByOrganization && (
                <p className="text-sm text-muted-foreground flex items-center">
                  <Landmark className="h-4 w-4 mr-1.5 text-primary/70" />
                  Produced By: {product.producedByOrganization}
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <ShoppingBag className="h-5 w-5 text-primary" /> Supplier: {supplier.name}
              {supplier.averageSupplierRating !== undefined && supplier.supplierRatingCount !== undefined ? (
                <Badge variant="outline" className="ml-2 text-xs font-normal py-0.5">
                  <Star className="h-3 w-3 mr-1 text-yellow-500 fill-yellow-500" /> 
                  {supplier.averageSupplierRating.toFixed(1)} ({supplier.supplierRatingCount} ratings)
                </Badge>
              ) : null}
            </CardTitle>
          </CardHeader>
        </Card>
        
        <Card className="shadow-md">
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xl">
                    <Pin className="h-5 w-5 text-primary" /> AI Estimated Shipping Information
                </CardTitle>
            </CardHeader>
            <CardContent>
                {isLoadingDistance && <div className="flex items-center"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Fetching distance...</div>}
                {!isLoadingDistance && distanceError && (
                    <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>Distance Estimation Error</AlertTitle>
                        <AlertDescription>{distanceError}</AlertDescription>
                    </Alert>
                )}
                {!isLoadingDistance && !distanceError && shippingDistanceResult && (
                    <div className="text-sm space-y-1">
                        <p>From: <span className="font-medium">{product.producedArea || 'N/A'}</span></p>
                        <p>To: <span className="font-medium">{customer.address || 'Customer Address Not Set'}</span></p>
                        <p>Est. Distance: <span className="font-semibold text-primary">{shippingDistanceResult.distanceText}</span></p>
                        <p>Est. Duration: <span className="font-semibold text-primary">{shippingDistanceResult.durationText}</span></p>
                        {shippingDistanceResult.note && <p className="text-xs text-muted-foreground mt-2 italic">{shippingDistanceResult.note}</p>}
                    </div>
                )}
                {!isLoadingDistance && !distanceError && !shippingDistanceResult && !isLoadingData && (
                    <p className="text-sm text-muted-foreground">Could not estimate shipping distance at this time or required addresses not provided.</p>
                )}
            </CardContent>
        </Card>


        <Card className="shadow-md">
          <CardHeader>
            <CardTitle>Your Offer</CardTitle>
            <CardDescription>Specify the quantity you wish to purchase. Please ensure your delivery address is updated in your profile.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isOutOfStock && (
                <Alert variant="destructive" className="mb-4">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Out of Stock</AlertTitle>
                    <AlertDescription>This product is currently out of stock and cannot be ordered.</AlertDescription>
                </Alert>
            )}
             {customerAddressMissing && !isOutOfStock && (
              <Alert variant="outline" className="mb-4 border-yellow-500 text-yellow-700">
                <Info className="h-4 w-4" />
                <AlertTitle>Address Required for Ordering</AlertTitle>
                <AlertDescription>
                  Please update your delivery address in your profile before you can place an order.
                  <Button variant="link" onClick={() => router.push('/dashboard/profile')} className="p-0 h-auto ml-1 text-yellow-700 hover:text-yellow-800">Go to Profile</Button>
                </AlertDescription>
              </Alert>
            )}
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
                disabled={isOutOfStock || customerAddressMissing}
              />
              {!isOutOfStock && desiredQuantity > (product.stockQuantity ?? 0) && (
                <p className="text-sm text-destructive mt-1">Requested quantity exceeds available stock ({product.stockQuantity ?? 0}).</p>
              )}
            </div>
            {!isOutOfStock && desiredQuantity > 0 && (
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
              disabled={
                isSubmittingOrder || 
                desiredQuantity <= 0 || 
                desiredQuantity > (product.stockQuantity ?? 0) || 
                isOutOfStock ||
                customerAddressMissing
              }
              className="w-full sm:w-auto"
            >
              {isSubmittingOrder ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle className="mr-2 h-4 w-4" />
              )}
              {isOutOfStock ? 'Out of Stock' : customerAddressMissing ? 'Update Profile to Order' : 'Make Order'}
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
