
"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, type UserRole } from '@/contexts/AuthContext';
import { Header } from '@/components/dashboard/Header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle, Loader2, Info } from 'lucide-react';

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
  const { user, getAllUsers, approveUser, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [pendingUsers, setPendingUsers] = useState<StoredUserForDisplay[]>([]);
  const [approvedUsers, setApprovedUsers] = useState<StoredUserForDisplay[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);

  useEffect(() => {
    if (!authLoading && (!user || user.role !== 'manager')) {
      router.replace('/dashboard'); // Redirect if not manager or not logged in
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user && user.role === 'manager') {
      setIsLoadingUsers(true);
      const allUsers = getAllUsers();
      const pending = allUsers.filter(u => (u.role === 'supplier' || u.role === 'customer' || u.role === 'transporter') && !u.isApproved)
                              .map(u => ({ id: u.id, name: u.name, role: u.role, isApproved: u.isApproved }));
      const approved = allUsers.filter(u => (u.role === 'supplier' || u.role === 'customer' || u.role === 'transporter') && u.isApproved)
                               .map(u => ({ id: u.id, name: u.name, role: u.role, isApproved: u.isApproved }));
      setPendingUsers(pending);
      setApprovedUsers(approved);
      setIsLoadingUsers(false);
    }
  }, [user, getAllUsers]);

  const handleApprove = (userId: string) => {
    approveUser(userId);
    // Refresh the list after approval
    const allUsers = getAllUsers();
      const pending = allUsers.filter(u => (u.role === 'supplier' || u.role === 'customer' || u.role === 'transporter') && !u.isApproved)
                              .map(u => ({ id: u.id, name: u.name, role: u.role, isApproved: u.isApproved }));
      const approved = allUsers.filter(u => (u.role === 'supplier' || u.role === 'customer' || u.role === 'transporter') && u.isApproved)
                               .map(u => ({ id: u.id, name: u.name, role: u.role, isApproved: u.isApproved }));
    setPendingUsers(pending);
    setApprovedUsers(approved);
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
    return ( // Fallback for non-managers, though redirect should handle this
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
              Review and approve new Supplier and Customer accounts.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {pendingUsers.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <Info className="h-12 w-12 text-primary mb-4" />
                <p className="text-lg font-semibold text-muted-foreground">No Pending Approvals</p>
                <p className="text-sm text-muted-foreground">All new user registrations have been processed.</p>
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
                           <Badge variant={pendingUser.role === 'supplier' ? 'default' : pendingUser.role === 'customer' ? 'secondary' : 'outline'}>
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
                          {/* Future: Add Reject button */}
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
            <CardTitle>Approved Users</CardTitle>
            <CardDescription>List of already approved Suppliers and Customers.</CardDescription>
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
                          <Badge variant={approvedUser.role === 'supplier' ? 'default' : approvedUser.role === 'customer' ? 'secondary' : 'outline'}>
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
