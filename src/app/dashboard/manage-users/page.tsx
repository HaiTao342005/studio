
"use client";

import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, type UserRole, type StoredUser } from '@/contexts/AuthContext';
import { Header } from '@/components/dashboard/Header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Info, Users, CheckCircle, XCircle, UserPlus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';


interface ManageUsersPageProps {
  params: {};
  searchParams: { [key: string]: string | string[] | undefined };
}

export default function ManageUsersPage({ params, searchParams }: ManageUsersPageProps) {
  const { user, getAllUsers, addManager, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [allUsersList, setAllUsersList] = useState<StoredUser[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);
  const [newManagerUsername, setNewManagerUsername] = useState('');
  const [newManagerPassword, setNewManagerPassword] = useState('');
  const [isCreatingManager, setIsCreatingManager] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (!authLoading && (!user || user.role !== 'manager')) {
      router.replace('/dashboard');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user && user.role === 'manager') {
      setIsLoadingUsers(true);
      const users = getAllUsers();
      setAllUsersList(users);
      setIsLoadingUsers(false);
    }
  }, [user, getAllUsers]);

  const handleCreateManager = async (e: FormEvent) => {
    e.preventDefault();
    if (!newManagerUsername || !newManagerPassword) {
        toast({ title: "Error", description: "Username and password are required for new manager.", variant: "destructive" });
        return;
    }
    setIsCreatingManager(true);
    const success = addManager(newManagerUsername, newManagerPassword);
    if (success) {
        setNewManagerUsername('');
        setNewManagerPassword('');
        // Refresh user list to show the new manager
        const updatedUsers = getAllUsers();
        setAllUsersList(updatedUsers);
        toast({ title: "Manager Created", description: `Manager account for ${newManagerUsername} created successfully.` });
    }
    // Toast for failure is handled within addManager in AuthContext
    setIsCreatingManager(false);
  };


  if (authLoading || isLoadingUsers) {
    return (
      <>
        <Header title="Manage Users" />
        <main className="flex-1 p-6 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary mr-2" />
          <p className="text-muted-foreground">Loading user data...</p>
        </main>
      </>
    );
  }

  if (!user || user.role !== 'manager') {
    return (
      <>
        <Header title="Access Denied" />
        <main className="flex-1 p-6">
          <p>You do not have permission to view this page.</p>
        </main>
      </>
    );
  }

  const getRoleBadgeVariant = (role: UserRole): "default" | "secondary" | "outline" | "destructive" => {
    switch (role) {
      case 'manager': return 'destructive'; 
      case 'supplier': return 'secondary';
      case 'transporter': return 'outline';
      case 'customer': return 'default'; 
      default: return 'outline';
    }
  };
  
  const getApprovalBadge = (isApproved: boolean, role: UserRole) => {
    if (role === 'customer' || role === 'manager') { // Customers and Managers are auto-approved
         return (
            <Badge variant="default" className="bg-green-500 hover:bg-green-600 text-white">
                <CheckCircle className="h-4 w-4 mr-1.5" />
                Auto-Approved
            </Badge>
         );
    }
    return isApproved ? (
      <Badge variant="default" className="bg-green-500 hover:bg-green-600 text-white">
        <CheckCircle className="h-4 w-4 mr-1.5" />
        Approved
      </Badge>
    ) : (
      <Badge variant="destructive" className="bg-yellow-500 hover:bg-yellow-600 text-white">
        <XCircle className="h-4 w-4 mr-1.5" />
        Pending
      </Badge>
    );
  };


  return (
    <>
      <Header title="Manage All Users" />
      <main className="flex-1 p-6 space-y-6">
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-6 w-6 text-primary" />
              All Registered Users
            </CardTitle>
            <CardDescription>
              View all users in the system, their roles, and approval status. Managers can also create new manager accounts.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {allUsersList.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <Info className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-lg font-semibold text-muted-foreground">No Users Found</p>
                <p className="text-sm text-muted-foreground">There are no registered users in the system yet.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Username</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead className="text-center">Approval Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {allUsersList.map((listedUser) => (
                      <TableRow key={listedUser.id}>
                        <TableCell className="font-medium">{listedUser.name}</TableCell>
                        <TableCell>
                          <Badge variant={getRoleBadgeVariant(listedUser.role)}>
                            {listedUser.role ? listedUser.role.charAt(0).toUpperCase() + listedUser.role.slice(1) : 'N/A'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          {getApprovalBadge(listedUser.isApproved, listedUser.role)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-md">
          <CardHeader>
            <CardTitle>Create New Manager Account</CardTitle>
            <CardDescription>Add a new manager to the system. This account will be auto-approved.</CardDescription>
          </CardHeader>
          <form onSubmit={handleCreateManager}>
            <CardContent className="space-y-4">
              <div className="space-y-1">
                <Label htmlFor="newManagerUsername">New Manager Username</Label>
                <Input 
                  id="newManagerUsername" 
                  value={newManagerUsername} 
                  onChange={(e) => setNewManagerUsername(e.target.value)} 
                  placeholder="Enter username"
                  required 
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="newManagerPassword">New Manager Password</Label>
                <Input 
                  id="newManagerPassword" 
                  type="password" 
                  value={newManagerPassword} 
                  onChange={(e) => setNewManagerPassword(e.target.value)} 
                  placeholder="Enter password"
                  required 
                />
              </div>
            </CardContent>
            <CardFooter>
              <Button type="submit" disabled={isCreatingManager} className="w-full">
                {isCreatingManager && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <UserPlus className="mr-2 h-4 w-4" /> Create Manager
              </Button>
            </CardFooter>
          </form>
        </Card>

      </main>
    </>
  );
}
