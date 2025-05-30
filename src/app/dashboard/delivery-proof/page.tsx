
"use client";

import { useState, useEffect } from 'react';
import { Header } from '@/components/dashboard/Header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input'; // For PoD notes
import { Textarea } from '@/components/ui/textarea'; // For PoD notes
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { StoredOrder } from '@/types/transaction';
import { db } from '@/lib/firebase/config';
import { collection, onSnapshot, query, where, doc, updateDoc, Timestamp } from 'firebase/firestore';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { PackageSearch, UploadCloud, CheckCircle2, Loader2, Info, FileText } from 'lucide-react';
import { format } from 'date-fns';

interface ProofOfDeliveryPageProps {
  params: {};
  searchParams: { [key: string]: string | string[] | undefined };
}

export default function ProofOfDeliveryPage({ params, searchParams }: ProofOfDeliveryPageProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [deliveredShipments, setDeliveredShipments] = useState<StoredOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedShipment, setSelectedShipment] = useState<StoredOrder | null>(null);
  const [podNotes, setPodNotes] = useState('');
  const [isSubmittingPod, setIsSubmittingPod] = useState(false);

  useEffect(() => {
    if (!user || user.role !== 'transporter') {
      setIsLoading(false);
      setDeliveredShipments([]);
      return;
    }

    setIsLoading(true);
    const q = query(
      collection(db, "orders"),
      where("transporterId", "==", user.id),
      where("shipmentStatus", "==", "Delivered"),
      where("podSubmitted", "==", false) // Only show if PoD not yet submitted
    );

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const fetchedOrders: StoredOrder[] = [];
      querySnapshot.forEach((orderDoc) => {
        fetchedOrders.push({ id: orderDoc.id, ...orderDoc.data() } as StoredOrder);
      });
      fetchedOrders.sort((a, b) => (b.orderDate as Timestamp).toMillis() - (a.orderDate as Timestamp).toMillis());
      setDeliveredShipments(fetchedOrders);
      setIsLoading(false);
    }, (error) => {
      console.error("Error fetching delivered shipments:", error);
      toast({ title: "Error", description: "Could not fetch shipments for PoD.", variant: "destructive" });
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [user, toast]);

  const handleOpenPodModal = (shipment: StoredOrder) => {
    setSelectedShipment(shipment);
    setPodNotes(shipment.podNotes || '');
  };

  const handleSubmitPod = async () => {
    if (!selectedShipment || !user) return;
    setIsSubmittingPod(true);
    const orderRef = doc(db, "orders", selectedShipment.id);
    try {
      await updateDoc(orderRef, {
        podSubmitted: true,
        podNotes: podNotes,
      });
      toast({ title: "Success", description: `Proof of Delivery submitted for order ${selectedShipment.productName}.` });
      setSelectedShipment(null);
      setPodNotes('');
    } catch (error) {
      console.error("Error submitting PoD:", error);
      toast({ title: "Error", description: "Could not submit Proof of Delivery.", variant: "destructive" });
    } finally {
      setIsSubmittingPod(false);
    }
  };
  
  if (isLoading) {
    return (
      <>
        <Header title="Proof of Delivery" />
        <main className="flex-1 p-6 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="ml-2 text-muted-foreground">Loading shipments...</p>
        </main>
      </>
    );
  }

  return (
    <>
      <Header title="Proof of Delivery" />
      <main className="flex-1 p-6 space-y-6">
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PackageSearch className="h-6 w-6 text-primary" />
              Submit Proof of Delivery (PoD)
            </CardTitle>
            <CardDescription>
              For shipments marked as 'Delivered', please submit Proof of Delivery.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {deliveredShipments.length === 0 ? (
              <div className="py-10 text-center">
                <Info className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-xl font-semibold text-muted-foreground">No Shipments Awaiting PoD</h3>
                <p className="text-sm text-muted-foreground">
                  All your delivered shipments have Proof of Delivery submitted or none are in 'Delivered' status yet.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-border">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Order Date</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Product</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Customer</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Action</th>
                    </tr>
                  </thead>
                  <tbody className="bg-background divide-y divide-border">
                    {deliveredShipments.map((shipment) => (
                      <tr key={shipment.id}>
                        <td className="px-4 py-3 whitespace-nowrap text-sm">
                          {format((shipment.orderDate as Timestamp).toDate(), "MMM d, yyyy")}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm font-medium">{shipment.productName}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm">{shipment.customerName}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenPodModal(shipment)}
                          >
                            <FileText className="mr-2 h-4 w-4" /> Submit PoD
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {selectedShipment && (
          <Dialog open={!!selectedShipment} onOpenChange={(isOpen) => { if (!isOpen) setSelectedShipment(null); }}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Submit Proof of Delivery for {selectedShipment.productName}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <p className="text-sm text-muted-foreground">
                  Order ID: {selectedShipment.id} <br/>
                  Customer: {selectedShipment.customerName}
                </p>
                <div>
                  <label htmlFor="podNotes" className="block text-sm font-medium text-foreground mb-1">
                    Proof of Delivery Notes (Optional)
                  </label>
                  <Textarea
                    id="podNotes"
                    value={podNotes}
                    onChange={(e) => setPodNotes(e.target.value)}
                    placeholder="e.g., Signed receipt XYZ123, goods received in good condition."
                    rows={3}
                  />
                </div>
                <div className="text-xs text-muted-foreground p-3 bg-secondary rounded-md border">
                  <UploadCloud className="inline h-4 w-4 mr-1 text-primary/70"/>
                  In a full application, you would have a file upload field here to attach a signed receipt or photo. For this prototype, only notes are captured.
                </div>
              </div>
              <DialogFooter className="sm:justify-between">
                <DialogClose asChild>
                  <Button type="button" variant="outline">
                    Cancel
                  </Button>
                </DialogClose>
                <Button type="button" onClick={handleSubmitPod} disabled={isSubmittingPod}>
                  {isSubmittingPod && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  <CheckCircle2 className="mr-2 h-4 w-4" /> Mark as PoD Submitted
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </main>
    </>
  );
}

