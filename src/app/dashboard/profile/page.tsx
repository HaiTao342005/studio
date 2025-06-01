
"use client";

import { useState, useEffect, type FormEvent } from 'react';
import { Header } from '@/components/dashboard/Header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { UserCircle, Home, Save, Loader2, Wallet } from 'lucide-react'; 

interface ProfilePageProps {
  params: {};
  searchParams: { [key: string]: string | string[] | undefined };
}

export default function ProfilePage({ params, searchParams }: ProfilePageProps) {
  const { user, updateUserProfile, isLoading: authLoading } = useAuth(); 
  const [address, setAddress] = useState('');
  const [ethereumAddress, setEthereumAddress] = useState(''); 
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (user) {
      setAddress(user.address || '');
      setEthereumAddress(user.ethereumAddress || ''); 
    }
  }, [user]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user || !user.id) {
      toast({ title: "Error", description: "You must be logged in to update your profile.", variant: "destructive" });
      return;
    }
    setIsSaving(true);
    
    const success = await updateUserProfile(user.id, { 
      address: address.trim(), 
      ethereumAddress: ethereumAddress.trim() 
    });
    // Toast for success/failure is handled within updateUserProfile
    setIsSaving(false);
  };

  if (authLoading || !user) {
    return (
      <>
        <Header title="My Profile" />
        <main className="flex-1 p-6 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="ml-2 text-muted-foreground">Loading profile...</p>
        </main>
      </>
    );
  }

  return (
    <>
      <Header title="My Profile" />
      <main className="flex-1 p-6 space-y-6">
        <Card className="shadow-lg max-w-2xl mx-auto">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserCircle className="h-7 w-7 text-primary" />
              Your Profile Information
            </CardTitle>
            <CardDescription>
              View and update your physical and Ethereum wallet addresses.
              Your Ethereum address is crucial for receiving payouts if you are a Supplier or Transporter.
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-6">
              <div>
                <Label className="text-sm font-medium text-muted-foreground">Username</Label>
                <p className="text-lg font-semibold">{user.name}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-muted-foreground">Role</Label>
                <p className="text-lg">{user.role?.charAt(0).toUpperCase() + (user.role?.slice(1) || '')}</p>
              </div>
              
              <div className="space-y-1 pt-4 border-t">
                <Label htmlFor="address" className="flex items-center gap-1.5">
                  <Home className="h-4 w-4 text-muted-foreground" />
                  Your Physical Address
                </Label>
                <Input
                  id="address"
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Enter your full physical address"
                  className="mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Used as pickup (supplier) or delivery (customer) location.
                </p>
              </div>

              <div className="space-y-1">
                <Label htmlFor="ethereumAddress" className="flex items-center gap-1.5">
                  <Wallet className="h-4 w-4 text-muted-foreground" />
                  Ethereum Wallet Address
                </Label>
                <Input
                  id="ethereumAddress"
                  type="text"
                  value={ethereumAddress}
                  onChange={(e) => setEthereumAddress(e.target.value)}
                  placeholder="0x..."
                  className="mt-1"
                  required={(user.role === 'supplier' || user.role === 'transporter')} // Make it visually required for them
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {(user.role === 'supplier' || user.role === 'transporter') 
                    ? "Required for receiving payouts via the smart contract." 
                    : "Optional. Used for on-chain interactions if applicable."
                  }
                </p>
              </div>
            </CardContent>
            <CardFooter>
              <Button type="submit" disabled={isSaving || authLoading} className="w-full">
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <Save className="mr-2 h-4 w-4" />
                Save Profile
              </Button>
            </CardFooter>
          </form>
        </Card>
      </main>
    </>
  );
}
