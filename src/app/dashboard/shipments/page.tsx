
"use client";

import { useState, useEffect, useCallback } from 'react';
import { Header } from '@/components/dashboard/Header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { StoredOrder, OrderShipmentStatus, OrderStatus } from '@/types/transaction';
import { db } from '@/lib/firebase/config';
import { collection, onSnapshot, query, where, doc, updateDoc, Timestamp } from 'firebase/firestore'; // Removed orderBy
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Truck, ListFilter, MapPin, Loader2, Info, PackageCheck } from 'lucide-react';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';

const shipmentStatuses: OrderShipmentStatus[] = ['Ready for Pickup', 'In Transit', 'Out for Delivery', 'Delivered', 'Delivery Failed', 'Shipment Cancelled'];

interface ManageShipmentsPageProps {
  params: {};
  searchParams: { [key: string]: string | string[] | undefined };
}

// Helper function to determine badge variant based on status
const getStatusBadgeVariant = (status: OrderStatus): "default" | "secondary" | "destructive" | "outline" => {
  switch (status) {
    case 'Paid': return 'default';
    case 'Delivered': return 'default';
    case 'Receipt Confirmed': return 'default';
    case 'Shipped': return 'secondary';
    case 'Ready for Pickup': return 'secondary';
    case 'Awaiting Supplier Confirmation': return 'outline';
    case 'Awaiting Transporter Assignment': return 'outline';
    case 'Awaiting Payment': return 'outline';
    case 'Pending': return 'outline';
    case 'Cancelled': return 'destructive';
    default: return 'secondary';
  }
};


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
      where("status", "in", ['Ready for Pickup', 'Shipped', 'Delivered'])
      // Removed orderBy("orderDate", "desc") due to missing index. Client-side sorting will be applied.
    );

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const fetchedOrders: StoredOrder[] = [];
      querySnapshot.forEach((orderDoc) => {
        const orderData = { id: orderDoc.id, ...orderDoc.data() } as StoredOrder;
        if (orderData.shipmentStatus !== 'Shipment Cancelled' || orderData.status !== 'Awaiting Transporter Assignment') {
             fetchedOrders.push(orderData);
        }
      });
      // Client-side sorting
      fetchedOrders.sort((a, b) => {
        const dateA = (a.orderDate || (a as any).date) as Timestamp | undefined;
        const dateB = (b.orderDate || (b as any).date) as Timestamp | undefined;
        if (dateA && dateB) {
          return dateB.toMillis() - dateA.toMillis();
        }
        return 0;
      });
      setAssignedShipments(fetchedOrders);
      setIsLoading(false);
    }, (error) => {
      console.error("Error fetching shipments:", error);
      toast({ title: "Error", description: "Could not fetch shipments. If this is an index error, please create the index in Firebase.", variant: "destructive", duration: 10000 });
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [user, toast]);

  const handleStatusUpdate = async (orderId: string, newStatus: OrderShipmentStatus) => {
    if (!user || user.role !== 'transporter') return;
    setUpdatingShipmentId(orderId);
    const orderRef = doc(db, "orders", orderId);
    
    try {
      let updateData: Partial<StoredOrder> = {
        shipmentStatus: newStatus,
      };

      if (newStatus === 'Shipment Cancelled') {
        updateData = {
          ...updateData,
          status: 'Awaiting Transporter Assignment',
          transporterId: null, // Explicitly set to null
          transporterName: null, // Explicitly set to null
        };
        toast({ title: "Shipment Cancelled", description: `Order ${orderId} is now awaiting re-assignment by the supplier.` });
      } else if (newStatus === 'Delivered') {
        // Do not change main 'status' here. Customer 'Confirm Receipt' will handle payment & final status.
        toast({ title: "Success", description: `Shipment status updated to ${newStatus}. Customer will be prompted to confirm receipt.` });
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
                              shipment.shipmentStatus === 'Delivered' ? 'bg-green-100 text-green-700 dark:bg-green-700 dark:text-green-100' :
                              shipment.shipmentStatus === 'In Transit' ? 'bg-blue-100 text-blue-700 dark:bg-blue-700 dark:text-blue-100' :
                              shipment.shipmentStatus === 'Out for Delivery' ? 'bg-blue-100 text-blue-700 dark:bg-blue-700 dark:text-blue-100' :
                              shipment.shipmentStatus === 'Ready for Pickup' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-600 dark:text-yellow-100' :
                              shipment.shipmentStatus === 'Shipment Cancelled' ? 'bg-red-100 text-red-700 dark:bg-red-700 dark:text-red-100' :
                              'bg-muted text-muted-foreground'
                            }`}>
                              {shipment.shipmentStatus || 'Awaiting Action'}
                            </span>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Select
                                value={shipment.shipmentStatus || ''}
                                onValueChange={(value) => handleStatusUpdate(shipment.id, value as OrderShipmentStatus)}
                                disabled={updatingShipmentId === shipment.id || shipment.shipmentStatus === 'Delivered' || shipment.shipmentStatus === 'Shipment Cancelled'}
                              >
                                <SelectTrigger className="w-[180px] h-9">
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


    