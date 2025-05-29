
"use client";

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, type UserRole } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Input } from '@/components/ui/input'; // For password (mock)
import { Leaf } from 'lucide-react';

export default function LoginPage() {
  const [selectedRole, setSelectedRole] = useState<UserRole>('supplier');
  const [username, setUsername] = useState(''); // Mock username
  const [password, setPassword] = useState(''); // Mock password
  const { login } = useAuth();
  const router = useRouter();

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (selectedRole) {
      // In a real app, you'd validate username/password here
      login(username, selectedRole); // Pass username (or mock user ID) and role
      router.push('/dashboard');
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
          <CardDescription className="text-lg">Please select your role and sign in.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="username">Username (mock)</Label>
              <Input 
                id="username" 
                placeholder="Enter any username" 
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required 
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password (mock)</Label>
              <Input 
                id="password" 
                type="password" 
                placeholder="Enter any password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required 
              />
            </div>
            <div className="space-y-2">
              <Label className="text-base font-medium">Select Your Role:</Label>
              <RadioGroup
                defaultValue="supplier"
                onValueChange={(value: UserRole) => setSelectedRole(value)}
                className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2"
              >
                {['supplier', 'transporter', 'customer'].map((role) => (
                  <div key={role}>
                    <RadioGroupItem value={role} id={role} className="peer sr-only" />
                    <Label
                      htmlFor={role}
                      className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
                    >
                      {role.charAt(0).toUpperCase() + role.slice(1)}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </div>
            <Button type="submit" className="w-full text-lg py-3 bg-primary hover:bg-primary/90 text-primary-foreground">
              Sign In
            </Button>
          </form>
        </CardContent>
        <CardFooter className="text-center text-sm text-muted-foreground">
          <p>This is a simplified login for demonstration. Real authentication would be more secure.</p>
        </CardFooter>
      </Card>
    </div>
  );
}
