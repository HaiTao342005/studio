
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
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Truck, MapPin, Loader2, Info, PackageCheck, RouteIcon } from 'lucide-react'; // Added RouteIcon
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { calculateDistance, type CalculateDistanceOutput } from '@/ai/flows/calculate-distance-flow'; // Import the flow


const shipmentStatuses: OrderShipmentStatus[] = ['Ready for Pickup', 'In Transit', 'Out for Delivery', 'Delivered', 'Delivery Failed', 'Shipment Cancelled'];

interface ManageShipmentsPageProps {
  params: {};
  searchParams: { [key: string]: string | string[] | undefined };
}

const getStatusBadgeVariant = (status: OrderStatus | OrderShipmentStatus): "default" | "secondary" | "destructive" | "outline" => {
  switch (status) {
    case 'Paid': case 'Delivered': case 'Receipt Confirmed': return 'default';
    case 'Shipped': case 'Ready for Pickup': case 'In Transit': case 'Out for Delivery': return 'secondary';
    case 'Awaiting Supplier Confirmation': case 'Awaiting Transporter Assignment': case 'Awaiting Payment': case 'Pending': return 'outline';
    case 'Cancelled': case 'Delivery Failed': case 'Shipment Cancelled': return 'destructive';
    default: return 'secondary';
  }
};

interface ShipmentWithDistance extends StoredOrder {
    distanceInfo?: CalculateDistanceOutput | null;
    isLoadingDistance?: boolean;
}


export default function ManageShipmentsPage({ params, searchParams }: ManageShipmentsPageProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [assignedShipments, setAssignedShipments] = useState<ShipmentWithDistance[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [updatingShipmentId, setUpdatingShipmentId] = useState<string | null>(null);

  const fetchDistanceForShipment = useCallback(async (shipment: StoredOrder): Promise<ShipmentWithDistance> => {
    if (shipment.pickupAddress && shipment.deliveryAddress && shipment.pickupAddress !== 'N/A' && shipment.deliveryAddress !== 'N/A') {
      try {
        const distanceResult = await calculateDistance({
          originAddress: shipment.pickupAddress,
          destinationAddress: shipment.deliveryAddress,
        });
        return { ...shipment, distanceInfo: distanceResult, isLoadingDistance: false };
      } catch (error) {
        console.error(`Error calculating distance for order ${shipment.id}:`, error);
        return { ...shipment, distanceInfo: { distanceText: 'Error', durationText: 'Error', note: 'Failed to calculate distance.' }, isLoadingDistance: false };
      }
    }
    return { ...shipment, isLoadingDistance: false };
  }, []);


  useEffect(() => {
    if (!user || user.role !== 'transporter') {
      setIsLoading(false);
      setAssignedShipments([]);
      return;
    }

    setIsLoading(true);
    const q = query(
      collection(db, "orders"),
      where("transporterId", "==", user.id),
      where("status", "in", ['Ready for Pickup', 'Shipped', 'Delivered'])
      // Firestore index needed for this query if also ordering by orderDate:
      // transporterId ASC, status ASC, orderDate DESC
      // Link: https://console.firebase.google.com/v1/r/project/newtech-be296/firestore/indexes?create_composite=Ckxwcm9qZWN0cy9uZXd0ZWNoLWJlMjk2L2RhdGFiYXNlcy8oZGVmYXVsdCkvY29sbGVjdGlvbkdyb3Vwcy9vcmRlcnMvaW5kZXhlcy9fEAEaEQoNdHJhbnNwb3J0ZXJJZBABGgoKBnN0YXR1cxABGg0KCW9yZGVyRGF0ZRACGgwKCF9fbmFtZV9fEAI
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
      
      // Fetch distances for all shipments
      const shipmentsWithDistancePromises = fetchedOrdersData.map(order => 
        fetchDistanceForShipment(order)
      );
      const shipmentsWithDistances = await Promise.all(shipmentsWithDistancePromises);

      setAssignedShipments(shipmentsWithDistances);
      setIsLoading(false);
    }, (error) => {
      console.error("Error fetching shipments:", error);
      toast({ title: "Error", description: "Could not fetch shipments. If this is an index error, please create the index in Firebase.", variant: "destructive", duration: 10000 });
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [user, toast, fetchDistanceForShipment]);

  const handleStatusUpdate = async (orderId: string, newStatus: OrderShipmentStatus) => {
    if (!user || user.role !== 'transporter') return;
    setUpdatingShipmentId(orderId);
    const orderRef = doc(db, "orders", orderId);

    try {
      let updateData: Partial<StoredOrder> = { shipmentStatus: newStatus };

      if (newStatus === 'Shipment Cancelled') {
        updateData = {
          ...updateData,
          status: 'Awaiting Transporter Assignment',
          transporterId: null,
          transporterName: null,
        };
        toast({ title: "Shipment Cancelled", description: `Order ${orderId} is now awaiting re-assignment by the supplier.` });
      } else if (newStatus === 'Delivered') {
        updateData.status = 'Delivered'; // Main status update for customer to confirm
        toast({ title: "Success", description: `Shipment status updated to ${newStatus}. Customer will be prompted to confirm receipt.` });
      } else if (newStatus === 'In Transit' || newStatus === 'Out for Delivery' || newStatus === 'Ready for Pickup') {
        updateData.status = 'Shipped'; // Main order status
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
              View, update status, and see estimated travel for your assigned shipments.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {assignedShipments.length === 0 ? (
              <div className="py-10 text-center">
                <Info className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-xl font-semibold text-muted-foreground">No Active Shipments</h3>
                <p className="text-sm text-muted-foreground">
                  There are currently no shipments assigned to you or requiring your attention.
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
                      <TableHead>Pickup Address</TableHead>
                      <TableHead>Delivery Address</TableHead>
                      <TableHead>Est. Distance/Time</TableHead>
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
                          <TableCell className="text-xs max-w-xs truncate" title={shipment.pickupAddress || 'N/A'}>{shipment.pickupAddress || 'N/A'}</TableCell>
                          <TableCell className="text-xs max-w-xs truncate" title={shipment.deliveryAddress || 'N/A'}>{shipment.deliveryAddress || 'N/A'}</TableCell>
                          <TableCell className="text-xs">
                            {shipment.isLoadingDistance ? <Loader2 className="h-4 w-4 animate-spin" /> :
                             shipment.distanceInfo ? (
                                <div>
                                    <p>{shipment.distanceInfo.distanceText}</p>
                                    <p>{shipment.distanceInfo.durationText}</p>
                                    {shipment.distanceInfo.note && <p className="text-muted-foreground italic">({shipment.distanceInfo.note.includes("AI estimation") ? "AI Est." : shipment.distanceInfo.note})</p>}
                                </div>
                             ) : (
                                <span className="text-muted-foreground">N/A</span>
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
                                disabled={updatingShipmentId === shipment.id || shipment.shipmentStatus === 'Delivered' || shipment.shipmentStatus === 'Shipment Cancelled'}
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

    