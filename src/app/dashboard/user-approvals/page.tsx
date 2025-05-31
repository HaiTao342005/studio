
"use client";

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, type UserRole, type User as AuthUser } from '@/contexts/AuthContext';
import { Header } from '@/components/dashboard/Header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, Loader2, Info, Star } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface UserForDisplay extends AuthUser {}

interface UserApprovalsPageProps {
  params: {};
  searchParams: { [key: string]: string | string[] | undefined };
}

export default function UserApprovalsPage({ params, searchParams }: UserApprovalsPageProps) {
  const { user, approveUser, isLoading: authLoading, allUsersList, isLoadingUsers: isLoadingAuthUsers } = useAuth();
  const router = useRouter();
  const [pendingUsers, setPendingUsers] = useState<UserForDisplay[]>([]);
  const [approvedUsers, setApprovedUsers] = useState<UserForDisplay[]>([]);
  const { toast } = useToast();

  const refreshUserLists = useCallback(() => {
    if (user && user.role === 'manager') {
      const pending = allUsersList.filter(u => (u.role === 'supplier' || u.role === 'transporter') && !u.isApproved);
      const approved = allUsersList.filter(u => (u.role === 'supplier' || u.role === 'transporter') && u.isApproved);
      setPendingUsers(pending);
      setApprovedUsers(approved);
    }
  }, [user, allUsersList]);


  useEffect(() => {
    if (!authLoading && (!user || user.role !== 'manager')) {
      router.replace('/dashboard'); 
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    refreshUserLists();
  }, [allUsersList, refreshUserLists]); 

  const handleApprove = async (userId: string) => {
    await approveUser(userId);
  };


  if (authLoading || isLoadingAuthUsers) {
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

  const renderRatingBadge = (ratedUser: AuthUser) => {
    let rating: number | undefined;
    let count: number | undefined;

    if (ratedUser.role === 'supplier') {
      rating = ratedUser.averageSupplierRating;
      count = ratedUser.supplierRatingCount;
    } else if (ratedUser.role === 'transporter') {
      rating = ratedUser.averageTransporterRating;
      count = ratedUser.transporterRatingCount;
    }

    if (rating !== undefined && count !== undefined && count > 0) {
      return (
        <Badge variant="outline" className="ml-2 text-xs font-normal py-0.5">
          <Star className="h-3 w-3 mr-1 text-yellow-500 fill-yellow-500" /> 
          {rating.toFixed(1)} ({count})
        </Badge>
      );
    }
    return null;
  };

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
                        <TableCell>
                          {pendingUser.name}
                          {renderRatingBadge(pendingUser)}
                        </TableCell>
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
                        <TableCell>
                          {approvedUser.name}
                          {renderRatingBadge(approvedUser)}
                        </TableCell>
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
