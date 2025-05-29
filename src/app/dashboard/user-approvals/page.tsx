
"use client";

import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, type UserRole } from '@/contexts/AuthContext';
import { Header } from '@/components/dashboard/Header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CheckCircle, XCircle, Loader2, Info, UserPlus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';


interface StoredUserForDisplay {
  id: string;
  name: string;
  role: UserRole;
  isApproved: boolean;
}

interface UserApprovalsPageProps {
  params: {};
  searchParams: { [key: string]: string | string[] | undefined };
}

export default function UserApprovalsPage({ params, searchParams }: UserApprovalsPageProps) {
  const { user, getAllUsers, approveUser, addManager, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [pendingUsers, setPendingUsers] = useState<StoredUserForDisplay[]>([]);
  const [approvedUsers, setApprovedUsers] = useState<StoredUserForDisplay[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);
  const [newManagerUsername, setNewManagerUsername] = useState('');
  const [newManagerPassword, setNewManagerPassword] = useState('');
  const [isCreatingManager, setIsCreatingManager] = useState(false);
  const { toast } = useToast();

  const refreshUserLists = useCallback(() => {
    if (user && user.role === 'manager') {
      setIsLoadingUsers(true);
      const allUsers = getAllUsers();
      const pending = allUsers.filter(u => (u.role === 'supplier' || u.role === 'transporter') && !u.isApproved)
                              .map(u => ({ id: u.id, name: u.name, role: u.role, isApproved: u.isApproved }));
      const approved = allUsers.filter(u => (u.role === 'supplier' || u.role === 'transporter') && u.isApproved)
                               .map(u => ({ id: u.id, name: u.name, role: u.role, isApproved: u.isApproved }));
      setPendingUsers(pending);
      setApprovedUsers(approved);
      setIsLoadingUsers(false);
    }
  }, [user, getAllUsers]);


  useEffect(() => {
    if (!authLoading && (!user || user.role !== 'manager')) {
      router.replace('/dashboard'); 
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    refreshUserLists();
  }, [user, refreshUserLists]); // Rerun if user object itself changes (e.g., due to context update)

  const handleApprove = (userId: string) => {
    approveUser(userId);
    refreshUserLists(); // Refresh lists after approval
  };

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
        // Optionally refresh list of all users if needed, though this page doesn't display other managers
    }
    setIsCreatingManager(false);
  };

  if (authLoading || isLoadingUsers) {
    return (
      <>
        <Header title="User Approvals" />
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

  return (
    <>
      <Header title="User Approvals Management" />
      <main className="flex-1 p-6 space-y-6">
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>Pending Approvals</CardTitle>
            <CardDescription>
              Review and approve new Supplier and Transporter accounts. Customer accounts are auto-approved.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {pendingUsers.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <Info className="h-12 w-12 text-primary mb-4" />
                <p className="text-lg font-semibold text-muted-foreground">No Pending Approvals</p>
                <p className="text-sm text-muted-foreground">All new Supplier and Transporter registrations have been processed.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Username</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead className="text-center">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingUsers.map((pendingUser) => (
                      <TableRow key={pendingUser.id}>
                        <TableCell>{pendingUser.name}</TableCell>
                        <TableCell>
                           <Badge variant={pendingUser.role === 'supplier' ? 'default' : pendingUser.role === 'transporter' ? 'secondary' : 'outline'}>
                            {pendingUser.role ? pendingUser.role.charAt(0).toUpperCase() + pendingUser.role.slice(1) : 'N/A'}
                           </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-green-600 border-green-600 hover:bg-green-50 hover:text-green-700"
                            onClick={() => handleApprove(pendingUser.id)}
                          >
                            <CheckCircle className="h-4 w-4 mr-2" />
                            Approve
                          </Button>
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
            <CardDescription>Add a new manager to the system.</CardDescription>
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

        <Card className="shadow-md">
          <CardHeader>
            <CardTitle>Approved Suppliers &amp; Transporters</CardTitle>
            <CardDescription>List of already approved Suppliers and Transporters.</CardDescription>
          </CardHeader>
          <CardContent>
             {approvedUsers.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <Info className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-lg font-semibold text-muted-foreground">No Approved Users Yet</p>
                <p className="text-sm text-muted-foreground">Approve users from the pending list.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Username</TableHead>
                      <TableHead>Role</TableHead>
                       <TableHead className="text-center">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {approvedUsers.map((approvedUser) => (
                      <TableRow key={approvedUser.id}>
                        <TableCell>{approvedUser.name}</TableCell>
                        <TableCell>
                          <Badge variant={approvedUser.role === 'supplier' ? 'default' : approvedUser.role === 'transporter' ? 'secondary' : 'outline'}>
                            {approvedUser.role ? approvedUser.role.charAt(0).toUpperCase() + approvedUser.role.slice(1) : 'N/A'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                            <Badge variant="default" className="bg-green-500 hover:bg-green-600 text-white">
                                <CheckCircle className="h-4 w-4 mr-1.5" />
                                Approved
                            </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
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

// Added useCallback to satisfy useEffect dependency array requirements for refreshUserLists
import { useCallback } from 'react';
