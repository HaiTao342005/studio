
"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, type UserRole, type StoredUser } from '@/contexts/AuthContext';
import { Header } from '@/components/dashboard/Header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Loader2, Info, Users, CheckCircle, XCircle } from 'lucide-react';

interface ManageUsersPageProps {
  params: {};
  searchParams: { [key: string]: string | string[] | undefined };
}

export default function ManageUsersPage({ params, searchParams }: ManageUsersPageProps) {
  const { user, getAllUsers, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [allUsersList, setAllUsersList] = useState<StoredUser[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);

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

  const getRoleBadgeVariant = (role: UserRole): "default" | "secondary" | "outline" => {
    switch (role) {
      case 'manager': return 'default'; // Or a specific color for manager
      case 'supplier': return 'secondary';
      case 'transporter': return 'outline';
      case 'customer': return 'outline'; // Consider a different color for customer if needed
      default: return 'outline';
    }
  };
  
  const getApprovalBadge = (isApproved: boolean) => {
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
              View all users in the system, their roles, and approval status.
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
                      {/* Add more columns like "Actions" for future enhancements e.g., Edit/Deactivate */}
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
                          {getApprovalBadge(listedUser.isApproved)}
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

// Ensure StoredUser type is exported from AuthContext if not already
// For this page, StoredUser needs: id, name, role, isApproved
