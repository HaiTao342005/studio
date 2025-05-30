
"use client";

import { useState, useEffect, useCallback } from 'react';
import { Header } from '@/components/dashboard/Header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { StoredOrder, OrderShipmentStatus, OrderStatus } from '@/types/transaction';
import { db } from '@/lib/firebase/config';
import { collection, onSnapshot, query, where, doc, updateDoc, Timestamp, orderBy } from 'firebase/firestore';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Truck, ListFilter, MapPin, Loader2, Info, PackageCheck } from 'lucide-react';
import { format } from 'date-fns';

const shipmentStatuses: OrderShipmentStatus[] = ['Ready for Pickup', 'In Transit', 'Out for Delivery', 'Delivered', 'Delivery Failed', 'Shipment Cancelled'];

interface ManageShipmentsPageProps {
  params: {};
  searchParams: { [key: string]: string | string[] | undefined };
}

export default function ManageShipmentsPage({ params, searchParams }: ManageShipmentsPageProps) {
  const { user, allUsersList } = useAuth();
  const { toast } = useToast();
  const [assignedShipments, setAssignedShipments] = useState<StoredOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [updatingShipmentId, setUpdatingShipmentId] = useState<string | null>(null);

  useEffect(() => {
    if (!user || user.role !== 'transporter') {
      setIsLoading(false);
      setAssignedShipments([]);
      return;
    }

    setIsLoading(true);
    // Transporters should see orders assigned to them and ready for action
    const q = query(
      collection(db, "orders"),
      where("transporterId", "==", user.id),
      where("status", "in", ['Ready for Pickup', 'Shipped', 'Delivered']), // Core statuses transporter acts on
      orderBy("orderDate", "desc")
    );

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const fetchedOrders: StoredOrder[] = [];
      querySnapshot.forEach((orderDoc) => {
        const orderData = { id: orderDoc.id, ...orderDoc.data() } as StoredOrder;
        // Further client-side filtering if needed, e.g., not 'Delivered' AND podSubmitted
        if (orderData.shipmentStatus !== 'Shipment Cancelled') { // Exclude cancelled shipments
             fetchedOrders.push(orderData);
        }
      });
      setAssignedShipments(fetchedOrders);
      setIsLoading(false);
    }, (error) => {
      console.error("Error fetching shipments:", error);
      toast({ title: "Error", description: "Could not fetch shipments.", variant: "destructive" });
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [user, toast]);

  const handleStatusUpdate = async (orderId: string, newStatus: OrderShipmentStatus) => {
    if (!user || user.role !== 'transporter') return;
    setUpdatingShipmentId(orderId);
    const orderRef = doc(db, "orders", orderId);
    
    try {
      const updateData: Partial<StoredOrder> = {
        shipmentStatus: newStatus,
      };
      // If marked as Delivered, also update the main order status if it's not already reflecting a final customer state
      if (newStatus === 'Delivered') {
        const currentOrder = assignedShipments.find(s => s.id === orderId);
        if (currentOrder && !['Paid', 'Receipt Confirmed', 'Cancelled'].includes(currentOrder.status)) {
            // This status update mainly signals to customer they can confirm receipt.
            // The main 'status' field will be updated by customer confirmation or payment.
        }
      }
      await updateDoc(orderRef, updateData);
      toast({ title: "Success", description: `Shipment status updated to ${newStatus}.` });
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
              View and update the status of your assigned shipments.
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
                      <TableHead>Current Main Status</TableHead>
                      <TableHead>Current Shipment Status</TableHead>
                      <TableHead className="w-[250px]">Update Shipment Status</TableHead>
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
                          <TableCell>
                             <Badge variant={getStatusBadgeVariant(shipment.status)}>{shipment.status}</Badge>
                          </TableCell>
                          <TableCell>
                            <span className={`px-2 py-1 text-xs rounded-full ${
                              shipment.shipmentStatus === 'Delivered' ? 'bg-green-100 text-green-700' :
                              shipment.shipmentStatus === 'In Transit' ? 'bg-blue-100 text-blue-700' :
                              shipment.shipmentStatus === 'Out for Delivery' ? 'bg-blue-100 text-blue-700' :
                              shipment.shipmentStatus === 'Ready for Pickup' ? 'bg-yellow-100 text-yellow-700' :
                              'bg-muted text-muted-foreground'
                            }`}>
                              {shipment.shipmentStatus || 'Awaiting Action'}
                            </span>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Select
                                defaultValue={shipment.shipmentStatus}
                                onValueChange={(value) => handleStatusUpdate(shipment.id, value as OrderShipmentStatus)}
                                disabled={updatingShipmentId === shipment.id || shipment.shipmentStatus === 'Delivered'}
                              >
                                <SelectTrigger className="w-[180px] h-9">
                                  <SelectValue placeholder="Select status" />
                                </SelectTrigger>
                                <SelectContent>
                                  {shipmentStatuses.map(status => (
                                    <SelectItem key={status} value={status} disabled={shipment.shipmentStatus === 'Delivered' && status !== 'Delivered'}>
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
