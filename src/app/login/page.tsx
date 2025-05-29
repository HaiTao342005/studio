
"use client";

import { useState, type FormEvent, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, type UserRole } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Input } from '@/components/ui/input';
import { Leaf, UserPlus, LogIn } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

// Manager role is removed from public signup
const SIGNUP_ROLES: Exclude<UserRole, 'manager' | null>[] = ['supplier', 'transporter', 'customer'];


export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [selectedRole, setSelectedRole] = useState<UserRole>('supplier');
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');

  const { login, signup, user } = useAuth();
  const router = useRouter();

  // Redirect if already logged in
  useEffect(() => {
    if (user) {
      router.replace('/dashboard');
    }
  }, [user, router]);


  const handleLoginSubmit = (e: FormEvent) => {
    e.preventDefault();
    login(username, password);
  };

  const handleSignupSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (selectedRole && selectedRole !== 'manager') { // Ensure manager cannot be selected via form
      signup(username, password, selectedRole);
    } else if (selectedRole === 'manager') {
        // This case should ideally not be reachable if UI prevents manager selection
        alert("Manager accounts cannot be created through this form.");
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-secondary/50 p-4">
      <Card className="w-full max-w-md shadow-2xl">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex items-center justify-center">
            <Leaf className="h-16 w-16 text-primary" />
          </div>
          <CardTitle className="text-3xl font-bold text-primary">Welcome to FruitFlow</CardTitle>
          <CardDescription className="text-lg">
            Please {authMode === 'login' ? 'sign in' : 'sign up'} to continue.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="login" value={authMode} onValueChange={(value) => setAuthMode(value as 'login' | 'signup')} className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="login" className="gap-2">
                <LogIn className="h-5 w-5" /> Sign In
              </TabsTrigger>
              <TabsTrigger value="signup" className="gap-2">
                <UserPlus className="h-5 w-5" /> Sign Up
              </TabsTrigger>
            </TabsList>
            <TabsContent value="login">
              <form onSubmit={handleLoginSubmit} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="login-username">Username</Label>
                  <Input
                    id="login-username"
                    placeholder="Enter your username (e.g., manager)"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="login-password">Password</Label>
                  <Input
                    id="login-password"
                    type="password"
                    placeholder="Enter your password (e.g., password)"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
                <Button type="submit" className="w-full text-lg py-3 bg-primary hover:bg-primary/90 text-primary-foreground">
                  Sign In
                </Button>
              </form>
            </TabsContent>
            <TabsContent value="signup">
              <form onSubmit={handleSignupSubmit} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="signup-username">Username</Label>
                  <Input
                    id="signup-username"
                    placeholder="Choose a username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-password">Password</Label>
                  <Input
                    id="signup-password"
                    type="password"
                    placeholder="Create a password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-base font-medium">Select Your Role:</Label>
                  <RadioGroup
                    value={selectedRole || 'supplier'}
                    onValueChange={(value: UserRole) => setSelectedRole(value)}
                    className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-2" 
                  >
                    {SIGNUP_ROLES.map((role) => (
                      <div key={role}>
                        <RadioGroupItem value={role as string} id={`signup-${role}`} className="peer sr-only" />
                        <Label
                          htmlFor={`signup-${role}`}
                          className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer transition-all text-center"
                        >
                          {role!.charAt(0).toUpperCase() + role!.slice(1)}
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>
                </div>
                <Button type="submit" className="w-full text-lg py-3 bg-primary hover:bg-primary/90 text-primary-foreground">
                  Sign Up
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
        <CardFooter className="text-center text-sm text-muted-foreground">
          <p>
            This is a demonstration. Passwords are not stored securely. Manager accounts are pre-configured.
            Suppliers & Transporters require manager approval after signup. Customers are auto-approved.
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
