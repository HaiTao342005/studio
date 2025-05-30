
"use client";

import { useState, useEffect, useCallback } from 'react';
import { Header } from '@/components/dashboard/Header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { StoredOrder, OrderShipmentStatus } from '@/types/transaction';
import { db } from '@/lib/firebase/config';
import { collection, onSnapshot, query, where, doc, updateDoc, Timestamp } from 'firebase/firestore';
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
    const q = query(
      collection(db, "orders"),
      // Querying for orders relevant to a transporter
      // This could be orders explicitly assigned to them OR orders that are "Paid" and awaiting pickup
      // For simplicity, we will fetch orders that are 'Paid' OR already assigned to this transporter
      // and not in a finalized state.
      // A more complex OR query (e.g., (status == 'Paid' AND transporterId == null) OR (transporterId == user.id))
      // is harder with basic Firestore queries. We'll filter more client-side.
      where("status", "in", ["Paid", "Shipped", "Delivered"]) // Fetch potentially relevant orders
    );

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const fetchedOrders: StoredOrder[] = [];
      querySnapshot.forEach((orderDoc) => {
        const orderData = { id: orderDoc.id, ...orderDoc.data() } as StoredOrder;
        
        const isRelevantForPickup = orderData.status === 'Paid' && 
                                   (!orderData.shipmentStatus || !['Delivered', 'Shipment Cancelled'].includes(orderData.shipmentStatus));
        
        const isAlreadyAssigned = orderData.transporterId === user.id &&
                                 (!orderData.shipmentStatus || !['Delivered', 'Shipment Cancelled'].includes(orderData.shipmentStatus));

        if (isRelevantForPickup || isAlreadyAssigned) {
          fetchedOrders.push(orderData);
        }
      });
      
      // Sort by order date descending, handling potential undefined dates or mixed date fields
      fetchedOrders.sort((a, b) => {
        const tsA = (a.orderDate || (a as any).date) as Timestamp | undefined;
        const tsB = (b.orderDate || (b as any).date) as Timestamp | undefined;
        const timeA = tsA ? tsA.toMillis() : 0;
        const timeB = tsB ? tsB.toMillis() : 0;
        return timeB - timeA; // Sort descending
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
    const orderToUpdate = assignedShipments.find(s => s.id === orderId);

    try {
      const updateData: Partial<StoredOrder> = {
        shipmentStatus: newStatus,
      };
      if (!orderToUpdate?.transporterId && ['Ready for Pickup', 'In Transit', 'Out for Delivery', 'Delivered'].includes(newStatus)) { 
        // Assign current transporter if one isn't already set and status indicates active handling
        updateData.transporterId = user.id;
        updateData.transporterName = user.name;
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

  const getTransporterName = (transporterId?: string) => {
    if (!transporterId) return 'N/A';
    const transporterUser = allUsersList.find(u => u.id === transporterId);
    return transporterUser?.name || transporterId.substring(0, 6);
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
              View and update the status of your assigned shipments. Orders with 'Paid' status are ready for pickup.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {assignedShipments.length === 0 ? (
              <div className="py-10 text-center">
                <Info className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-xl font-semibold text-muted-foreground">No Active Shipments</h3>
                <p className="text-sm text-muted-foreground">
                  There are currently no shipments requiring your attention.
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
                      <TableHead>Current Order Status</TableHead>
                      <TableHead>Current Shipment Status</TableHead>
                      <TableHead>Assigned Transporter</TableHead>
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
                          <TableCell>{shipment.status}</TableCell>
                          <TableCell>
                            <span className={`px-2 py-1 text-xs rounded-full ${
                              shipment.shipmentStatus === 'Delivered' ? 'bg-green-100 text-green-700' :
                              shipment.shipmentStatus === 'In Transit' ? 'bg-blue-100 text-blue-700' :
                              shipment.shipmentStatus === 'Out for Delivery' ? 'bg-blue-100 text-blue-700' :
                              shipment.shipmentStatus === 'Ready for Pickup' ? 'bg-yellow-100 text-yellow-700' :
                              'bg-muted text-muted-foreground' // default for others or undefined
                            }`}>
                              {shipment.shipmentStatus || (shipment.status === 'Paid' ? 'Ready for Pickup' : 'Pending Assignment')}
                            </span>
                          </TableCell>
                          <TableCell>{shipment.transporterName || getTransporterName(shipment.transporterId) || (shipment.status === 'Paid' ? 'Awaiting Assignment' : 'N/A')}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Select
                                defaultValue={shipment.shipmentStatus}
                                onValueChange={(value) => handleStatusUpdate(shipment.id, value as OrderShipmentStatus)}
                                disabled={updatingShipmentId === shipment.id}
                              >
                                <SelectTrigger className="w-[180px] h-9">
                                  <SelectValue placeholder="Select status" />
                                </SelectTrigger>
                                <SelectContent>
                                  {shipmentStatuses.map(status => (
                                    <SelectItem key={status} value={status}>{status}</SelectItem>
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
