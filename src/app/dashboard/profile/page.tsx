
"use client";

import { useState, useEffect, type FormEvent } from 'react';
import { Header } from '@/components/dashboard/Header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { UserCircle, Home, Save, Loader2 } from 'lucide-react';

interface ProfilePageProps {
  params: {};
  searchParams: { [key: string]: string | string[] | undefined };
}

export default function ProfilePage({ params, searchParams }: ProfilePageProps) {
  const { user, updateUserAddress, isLoading: authLoading } = useAuth();
  const [address, setAddress] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (user && user.address) {
      setAddress(user.address);
    } else if (user && !user.address) {
      setAddress('');
    }
  }, [user]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user || !user.id) {
      toast({ title: "Error", description: "You must be logged in to update your profile.", variant: "destructive" });
      return;
    }
    setIsSaving(true);
    const success = await updateUserAddress(user.id, address);
    if (success) {
      // Toast is handled within updateUserAddress
    }
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
              View and update your contact address.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-sm font-medium text-muted-foreground">Username</Label>
              <p className="text-lg font-semibold">{user.name}</p>
            </div>
            <div>
              <Label className="text-sm font-medium text-muted-foreground">Role</Label>
              <p className="text-lg">{user.role?.charAt(0).toUpperCase() + (user.role?.slice(1) || '')}</p>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4 pt-4 border-t">
              <div>
                <Label htmlFor="address" className="flex items-center gap-1.5">
                  <Home className="h-4 w-4 text-muted-foreground" />
                  Your Address
                </Label>
                <Input
                  id="address"
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Enter your full address"
                  className="mt-1"
                  required
                />
                <p className="text-xs text-muted-foreground mt-1">
                  This address will be used as the pickup location if you are a supplier, or the delivery location if you are a customer.
                </p>
              </div>
              <Button type="submit" disabled={isSaving || authLoading} className="w-full">
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <Save className="mr-2 h-4 w-4" />
                Save Address
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>
    </>
  );
}

    