
"use client";

import type { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarInset,
  useSidebar,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  LayoutDashboard,
  CandlestickChart,
  ShieldCheck,
  ShoppingCart,
  History,
  CreditCard,
  Truck,
  Users, // For Transporter: Manage Users (now also for Manager) / General User Management
  Leaf,
  PackageSearch, // For Transporter: View Shipments
  ClipboardList, // For Customer: My Orders
  FileText, // For Customer: Invoices/Docs
  UserCheck, // For Manager: User Approvals
} from 'lucide-react';
import { useAuth, type UserRole } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import {useEffect} from 'react';


type NavItem = {
  href: string;
  label: string;
  icon: React.ElementType;
  roles: UserRole[]; // Roles that can see this item
};

const allNavItems: NavItem[] = [
  { href: '/dashboard', label: 'Overview', icon: LayoutDashboard, roles: ['supplier', 'transporter', 'customer', 'manager'] },
  // Manager specific
  { href: '/dashboard/user-approvals', label: 'User Approvals', icon: UserCheck, roles: ['manager'] },
  { href: '/dashboard/manage-users', label: 'Manage Users', icon: Users, roles: ['manager'] }, // New: Manager can manage all users
  // Supplier specific (also now accessible by manager)
  { href: '/dashboard/market-data', label: 'Market Data', icon: CandlestickChart, roles: ['supplier', 'manager'] },
  { href: '/dashboard/risk-assessment', label: 'Customer Risk', icon: ShieldCheck, roles: ['supplier', 'manager'] },
  { href: '/dashboard/transactions/new', label: 'New Order', icon: ShoppingCart, roles: ['supplier', 'manager'] },
  { href: '/dashboard/transactions/history', label: 'Order History', icon: History, roles: ['supplier', 'manager'] },
  { href: '/dashboard/payment-flows', label: 'Payment Tracking', icon: CreditCard, roles: ['supplier', 'manager'] },
  // Transporter specific
  { href: '/dashboard/shipments', label: 'Manage Shipments', icon: Truck, roles: ['transporter'] },
  { href: '/dashboard/delivery-proof', label: 'Proof of Delivery', icon: PackageSearch, roles: ['transporter'] },
  // Customer specific
  { href: '/dashboard/my-orders', label: 'My Orders', icon: ClipboardList, roles: ['customer'] },
  { href: '/dashboard/my-payments', label: 'My Payments', icon: CreditCard, roles: ['customer'] },
  { href: '/dashboard/my-documents', label: 'My Documents', icon: FileText, roles: ['customer'] },
];

function AppSidebarNav() {
  const pathname = usePathname();
  const { open } = useSidebar();
  const { user } = useAuth();

  if (!user || !user.role) { // Ensure user and role exist
    return null;
  }

  const visibleNavItems = allNavItems.filter(item => item.roles.includes(user.role));

  return (
    <SidebarMenu>
      {visibleNavItems.map((item) => (
        <SidebarMenuItem key={item.href}>
          <SidebarMenuButton
            asChild
            isActive={pathname === item.href || (pathname.startsWith(item.href) && item.href !== '/dashboard')}
            tooltip={open ? undefined : item.label}
          >
            <Link href={item.href} passHref>
              <>
                <item.icon className="h-5 w-5" />
                <span className="truncate">{item.label}</span>
              </>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
      ))}
    </SidebarMenu>
  );
}

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace('/login');
    } else if (!isLoading && user && !user.isApproved && (user.role === 'supplier' || user.role === 'transporter')) {
      // Handled further down, this is just an early check if needed for other logic
    }
  }, [user, isLoading, router]);

  if (isLoading || !user) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-secondary/50">
        <Leaf className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-4 text-lg text-muted-foreground">Loading FruitFlow...</p>
      </div>
    );
  }

  // If a supplier or transporter is logged in but not approved, show a pending approval message.
  if (!user.isApproved && (user.role === 'supplier' || user.role === 'transporter')) {
    return (
      <div className="flex min-h-screen w-full flex-col items-center justify-center bg-secondary/50 p-6 text-center">
        <Leaf className="h-16 w-16 text-primary mb-6" />
        <h1 className="text-2xl font-semibold text-primary mb-2">Account Pending Approval</h1>
        <p className="text-muted-foreground mb-4">Your account as a {user.role} is currently awaiting manager approval.</p>
        <p className="text-sm text-muted-foreground">Please check back later or contact support if you have questions.</p>
        <Button onClick={() => router.push('/login')} className="mt-6">Go to Login</Button>
      </div>
    );
  }
  
  return (
    <SidebarProvider defaultOpen={true}>
      <div className="flex min-h-screen w-full">
        <Sidebar collapsible="icon" className="border-r">
          <SidebarHeader className="p-4">
            <Link href="/dashboard" className="flex items-center gap-2 font-semibold text-primary">
              <Leaf className="h-8 w-8" />
              <span className="text-xl group-data-[collapsible=icon]:hidden">FruitFlow</span>
            </Link>
          </SidebarHeader>
          <Separator />
          <SidebarContent>
            <ScrollArea className="h-full">
               <AppSidebarNav />
            </ScrollArea>
          </SidebarContent>
        </Sidebar>
        <SidebarInset className="flex flex-col bg-secondary/50">
          {children}
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
