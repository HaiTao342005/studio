
"use client";

import { useState, useEffect, useCallback } from 'react';
import { Header } from '@/components/dashboard/Header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { StoredOrder, OrderShipmentStatus, OrderStatus } from '@/types/transaction';
import { db } from '@/lib/firebase/config';
import { collection, onSnapshot, query, where, doc, updateDoc, Timestamp } from 'firebase/firestore';
import { useAuth, type UserShippingRates } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Truck, Loader2, Info, DollarSign, Ban } from 'lucide-react';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { calculateDistance, type CalculateDistanceOutput } from '@/ai/flows/calculate-distance-flow';


const shipmentStatuses: OrderShipmentStatus[] = ['Ready for Pickup', 'In Transit', 'Out for Delivery', 'Delivered', 'Delivery Failed', 'Shipment Cancelled'];

interface ManageShipmentsPageProps {
  params: {};
  searchParams: { [key: string]: string | string[] | undefined };
}

// Helper function to calculate tiered shipping price - copied from TransactionHistoryTable
const calculateTieredShippingPrice = (distanceKm: number, rates?: UserShippingRates): number | null => {
  if (!rates || rates.tier1_0_100_km_price === undefined || rates.tier2_101_500_km_price_per_km === undefined || rates.tier3_501_1000_km_price_per_km === undefined) {
    return null;
  }
  const { tier1_0_100_km_price, tier2_101_500_km_price_per_km, tier3_501_1000_km_price_per_km } = rates;

  if (distanceKm <= 0) return 0;
  if (distanceKm <= 100) return tier1_0_100_km_price;

  let price = tier1_0_100_km_price;
  if (distanceKm <= 500) {
    price += (distanceKm - 100) * tier2_101_500_km_price_per_km;
    return price;
  }

  price += (400) * tier2_101_500_km_price_per_km;
  if (distanceKm <= 1000) {
    price += (distanceKm - 500) * tier3_501_1000_km_price_per_km;
    return price;
  }

  price += (500) * tier3_501_1000_km_price_per_km;
  price += (distanceKm - 1000) * tier3_501_1000_km_price_per_km;
  return price;
};


const getStatusBadgeVariant = (status: OrderStatus | OrderShipmentStatus): "default" | "secondary" | "destructive" | "outline" => {
  switch (status) {
    case 'Paid': case 'Delivered': case 'Receipt Confirmed': case 'Completed': return 'default';
    case 'Shipped': case 'Ready for Pickup': case 'In Transit': case 'Out for Delivery': return 'secondary';
    case 'Awaiting Supplier Confirmation': case 'Awaiting Transporter Assignment': case 'Awaiting Payment': case 'Pending': return 'outline';
    case 'Cancelled': case 'Delivery Failed': case 'Shipment Cancelled': case 'Disputed': return 'destructive';
    default: return 'secondary';
  }
};

interface ShipmentWithDistance extends StoredOrder {
    distanceInfo?: CalculateDistanceOutput | null;
    isLoadingDistance?: boolean;
    shippingPrice?: number | null; // Can be null if rates not set
}


export default function ManageShipmentsPage({ params, searchParams }: ManageShipmentsPageProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [assignedShipments, setAssignedShipments] = useState<ShipmentWithDistance[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [updatingShipmentId, setUpdatingShipmentId] = useState<string | null>(null);

  const fetchDistanceAndPriceForShipment = useCallback(async (shipment: StoredOrder): Promise<ShipmentWithDistance> => {
    let updatedShipment: ShipmentWithDistance = { ...shipment, isLoadingDistance: true };

    if (shipment.pickupAddress && shipment.deliveryAddress && shipment.pickupAddress !== 'N/A' && shipment.deliveryAddress !== 'N/A') {
      try {
        const distanceResult = await calculateDistance({
          originAddress: shipment.pickupAddress,
          destinationAddress: shipment.deliveryAddress,
        });
        updatedShipment.distanceInfo = distanceResult;
        if (distanceResult.distanceKm && typeof distanceResult.distanceKm === 'number' && user?.shippingRates) {
          updatedShipment.shippingPrice = calculateTieredShippingPrice(distanceResult.distanceKm, user.shippingRates);
        } else if (distanceResult.distanceKm && !user?.shippingRates) {
            updatedShipment.shippingPrice = null; // Transporter hasn't set rates
            console.warn(`Transporter ${user?.name} has not set shipping rates for order ${shipment.id}`);
        }
      } catch (error) {
        console.error(`Error calculating distance for order ${shipment.id}:`, error);
        updatedShipment.distanceInfo = { distanceText: 'Error', durationText: 'Error', note: 'Failed to calculate distance.' };
      }
    }
    updatedShipment.isLoadingDistance = false;
    return updatedShipment;
  }, [user]);


  useEffect(() => {
    if (!user || user.role !== 'transporter') {
      setIsLoading(false);
      setAssignedShipments([]);
      return;
    }

    setIsLoading(true);
    const q = query(
      collection(db, "orders"),
      where("transporterId", "==", user.id)
    );

    const unsubscribe = onSnapshot(q, async (querySnapshot) => {
      const fetchedOrdersData: StoredOrder[] = [];
      querySnapshot.forEach((orderDoc) => {
        fetchedOrdersData.push({ id: orderDoc.id, ...orderDoc.data() } as StoredOrder);
      });

      fetchedOrdersData.sort((a, b) => {
        const dateA = (a.orderDate || (a as any).date) as Timestamp | undefined;
        const dateB = (b.orderDate || (b as any).date) as Timestamp | undefined;
        return (dateB?.toMillis() || 0) - (dateA?.toMillis() || 0);
      });

      const shipmentsWithDetailsPromises = fetchedOrdersData.map(order =>
        fetchDistanceAndPriceForShipment(order)
      );
      const shipmentsWithDetails = await Promise.all(shipmentsWithDetailsPromises);

      setAssignedShipments(shipmentsWithDetails);
      setIsLoading(false);
    }, (error) => {
      console.error("Error fetching shipments:", error);
      toast({ title: "Error", description: "Could not fetch shipments. If this is an index error, please create the index in Firebase.", variant: "destructive", duration: 10000 });
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [user, toast, fetchDistanceAndPriceForShipment]);

  const handleStatusUpdate = async (orderId: string, newStatus: OrderShipmentStatus) => {
    if (!user || user.role !== 'transporter' || user.isSuspended) {
      toast({ title: "Action Denied", description: user?.isSuspended ? "Your account is suspended." : "Invalid user.", variant: "destructive" });
      return;
    }
    setUpdatingShipmentId(orderId);
    const orderRef = doc(db, "orders", orderId);

    try {
      let updateData: Partial<StoredOrder> = { shipmentStatus: newStatus };
      const currentOrder = assignedShipments.find(s => s.id === orderId);

      if (newStatus === 'Shipment Cancelled') {
        updateData = {
          ...updateData,
          status: 'Awaiting Transporter Assignment', // Revert main status
          transporterId: null,
          transporterName: null,
          estimatedTransporterFee: undefined,
          finalTotalAmount: currentOrder?.totalAmount, // Revert to original product total
        };
        toast({ title: "Shipment Cancelled", description: `Order ${orderId} is now awaiting re-assignment by the supplier.` });
      } else if (newStatus === 'Delivered') {
        if (currentOrder && (currentOrder.status === 'Paid' || currentOrder.status === 'Shipped')) {
            updateData.status = 'Delivered' as OrderStatus; // Update main order status
        }
        toast({ title: "Success", description: `Shipment status updated to ${newStatus}. Customer will be prompted to confirm receipt.` });
      } else if (newStatus === 'In Transit' || newStatus === 'Out for Delivery' || newStatus === 'Ready for Pickup') {
        if (currentOrder && (currentOrder.status === 'Paid' || currentOrder.status === 'Ready for Pickup')) { // Ensure order is paid or already set for pickup
             updateData.status = 'Shipped' as OrderStatus; // Update main order status if appropriate
        }
        toast({ title: "Success", description: `Shipment status updated to ${newStatus}.` });
      } else {
         toast({ title: "Success", description: `Shipment status updated to ${newStatus}.` });
      }

      await updateDoc(orderRef, updateData);

    } catch (error) {
      console.error("Error updating shipment status:", error);
      toast({ title: "Error", description: "Could not update shipment status.", variant: "destructive" });
    } finally {
      setUpdatingShipmentId(null);
    }
  };

  if (isLoading) {
    return (
      <>
        <Header title="Manage Shipments" />
        <main className="flex-1 p-6 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="ml-2 text-muted-foreground">Loading shipments...</p>
        </main>
      </>
    );
  }

  if (user?.isSuspended) {
    return (
      <>
        <Header title="Manage Shipments" />
        <main className="flex-1 p-6">
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <Ban className="h-6 w-6" />
                Account Suspended
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Your account is currently suspended. You cannot manage shipments.</p>
            </CardContent>
          </Card>
        </main>
      </>
    );
  }


  return (
    <>
      <Header title="Manage Shipments" />
      <main className="flex-1 p-6 space-y-6">
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Truck className="h-6 w-6 text-primary" />
              Your Shipment Assignments
            </CardTitle>
            <CardDescription>
              View, update status, see estimated travel, and estimated shipping price for your assignments based on your set rates.
              {!user?.shippingRates?.tier1_0_100_km_price && (
                <span className="text-destructive block mt-1"> Please set your shipping rates in the "Shipping Rates" tab to see accurate price estimations.</span>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {assignedShipments.length === 0 ? (
              <div className="py-10 text-center">
                <Info className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-xl font-semibold text-muted-foreground">No Active Shipments</h3>
                <p className="text-sm text-muted-foreground">
                  There are currently no shipments assigned to you.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Order Date</TableHead>
                      <TableHead>Product</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Pickup</TableHead>
                      <TableHead>Delivery</TableHead>
                      <TableHead>Est. Dist./Time</TableHead>
                      <TableHead>Predicted Delivery</TableHead>
                      <TableHead className="text-right">Your Est. Shipping Price</TableHead>
                      <TableHead>Shipment Status</TableHead>
                      <TableHead className="w-[200px]">Update Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {assignedShipments.map((shipment) => {
                      const displayDate = shipment.orderDate || (shipment as any).date;
                      return (
                        <TableRow key={shipment.id}>
                          <TableCell>
                            { displayDate ?
                              format((displayDate as Timestamp).toDate(), "MMM d, yyyy") :
                              'N/A'
                            }
                          </TableCell>
                          <TableCell>{shipment.productName || (shipment as any).fruitType || 'N/A'}</TableCell>
                          <TableCell>{shipment.customerName}</TableCell>
                          <TableCell className="text-xs max-w-[150px] truncate" title={shipment.pickupAddress || 'N/A'}>{shipment.pickupAddress || 'N/A'}</TableCell>
                          <TableCell className="text-xs max-w-[150px] truncate" title={shipment.deliveryAddress || 'N/A'}>{shipment.deliveryAddress || 'N/A'}</TableCell>
                          <TableCell className="text-xs">
                            {shipment.isLoadingDistance ? <Loader2 className="h-4 w-4 animate-spin" /> :
                             shipment.distanceInfo ? (
                                <div>
                                    <p>{shipment.distanceInfo.distanceText}</p>
                                    <p>{shipment.distanceInfo.durationText}</p>
                                    {shipment.distanceInfo.note && <p className="text-muted-foreground italic text-xs">({shipment.distanceInfo.note.includes("AI estimation") ? "AI Est." : shipment.distanceInfo.note})</p>}
                                </div>
                             ) : (
                                <span className="text-muted-foreground">N/A</span>
                             )
                            }
                          </TableCell>
                          <TableCell>
                            {shipment.predictedDeliveryDate ? format((shipment.predictedDeliveryDate as Timestamp).toDate(), "MMM d, yyyy") : <span className="text-xs text-muted-foreground">N/A</span>}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {shipment.isLoadingDistance ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> :
                             shipment.shippingPrice !== undefined && shipment.shippingPrice !== null ? (
                                `$${shipment.shippingPrice.toFixed(2)}`
                             ) : (
                                <span className="text-muted-foreground text-xs">Rates not set / Error</span>
                             )
                            }
                          </TableCell>
                          <TableCell>
                            <Badge variant={getStatusBadgeVariant(shipment.shipmentStatus || shipment.status)} className="whitespace-nowrap">
                              {shipment.shipmentStatus || shipment.status || 'Awaiting Action'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Select
                                value={shipment.shipmentStatus || ''}
                                onValueChange={(value) => handleStatusUpdate(shipment.id, value as OrderShipmentStatus)}
                                disabled={updatingShipmentId === shipment.id || shipment.shipmentStatus === 'Delivered' || shipment.shipmentStatus === 'Shipment Cancelled' || user?.isSuspended}
                              >
                                <SelectTrigger className="w-[180px] h-9 text-xs">
                                  <SelectValue placeholder="Select status" />
                                </SelectTrigger>
                                <SelectContent>
                                  {shipmentStatuses.map(status => (
                                    <SelectItem key={status} value={status}
                                      disabled={(shipment.shipmentStatus === 'Delivered' && status !== 'Delivered') || (shipment.shipmentStatus === 'Shipment Cancelled' && status !== 'Shipment Cancelled')}
                                    >
                                      {status}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              {updatingShipmentId === shipment.id && <Loader2 className="h-4 w-4 animate-spin" />}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </>
  );
}

    