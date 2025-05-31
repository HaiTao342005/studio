
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
  Users,
  Leaf,
  PackageSearch,
  ClipboardList,
  FileText,
  UserCheck,
  PackagePlus,
  Search,
  UserCircle, 
  Route,
  AlertTriangle, // For suspension
} from 'lucide-react';
import { useAuth, type UserRole } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import {useEffect} from 'react';


type NavItem = {
  href: string;
  label: string;
  icon: React.ElementType;
  roles: UserRole[];
};

const allNavItems: NavItem[] = [
  { href: '/dashboard', label: 'Overview', icon: LayoutDashboard, roles: ['supplier', 'transporter', 'customer', 'manager'] },
  { href: '/dashboard/profile', label: 'My Profile', icon: UserCircle, roles: ['supplier', 'customer'] }, 
  // Manager specific
  { href: '/dashboard/user-approvals', label: 'User Approvals', icon: UserCheck, roles: ['manager'] },
  { href: '/dashboard/manage-users', label: 'Manage Users', icon: Users, roles: ['manager'] },
  // Supplier specific (also now accessible by manager)
  { href: '/dashboard/market-data', label: 'Market Data', icon: CandlestickChart, roles: ['supplier', 'manager'] },
  { href: '/dashboard/risk-assessment', label: 'Customer Risk', icon: ShieldCheck, roles: ['supplier', 'manager'] },
  { href: '/dashboard/transactions/history', label: 'Order History', icon: History, roles: ['supplier', 'manager'] },
  { href: '/dashboard/payment-flows', label: 'Payment Tracking', icon: CreditCard, roles: ['supplier', 'manager'] },
  { href: '/dashboard/my-products', label: 'My Products', icon: PackagePlus, roles: ['supplier'] },
  // Transporter specific
  { href: '/dashboard/shipments', label: 'Manage Shipments', icon: Truck, roles: ['transporter'] },
  { href: '/dashboard/delivery-proof', label: 'Proof of Delivery', icon: PackageSearch, roles: ['transporter'] },
  { href: '/dashboard/distance-calculator', label: 'Distance Calculator', icon: Route, roles: ['transporter'] },
  // Customer specific
  { href: '/dashboard/find-products', label: 'Find Products', icon: Search, roles: ['customer'] },
  { href: '/dashboard/my-orders', label: 'My Orders', icon: ClipboardList, roles: ['customer'] },
  { href: '/dashboard/my-payments', label: 'My Payments', icon: CreditCard, roles: ['customer'] },
  { href: '/dashboard/my-documents', label: 'My Documents', icon: FileText, roles: ['customer'] },
];

function AppSidebarNav() {
  const pathname = usePathname();
  const { open } = useSidebar();
  const { user } = useAuth();

  if (!user || !user.role || user.isSuspended) { // Hide nav if suspended
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
            <Link href={item.href}>
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
  const { user, isLoading, logout } = useAuth(); // Added logout
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace('/login');
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

  if (user.isSuspended) {
    return (
      <div className="flex min-h-screen w-full flex-col items-center justify-center bg-destructive/10 p-6 text-center">
        <AlertTriangle className="h-16 w-16 text-destructive mb-6" />
        <h1 className="text-2xl font-semibold text-destructive mb-2">Account Suspended</h1>
        <p className="text-muted-foreground mb-4">Your account has been suspended due to consistently low ratings.</p>
        <p className="text-sm text-muted-foreground">Please contact support for further assistance.</p>
        <Button 
          onClick={() => {
            logout(); // Call logout from AuthContext
            router.push('/login');
          }} 
          className="mt-6"
          variant="destructive"
        >
          Logout
        </Button>
      </div>
    );
  }


  if (!user.isApproved && (user.role === 'supplier' || user.role === 'transporter')) {
    return (
      <div className="flex min-h-screen w-full flex-col items-center justify-center bg-secondary/50 p-6 text-center">
        <Leaf className="h-16 w-16 text-primary mb-6" />
        <h1 className="text-2xl font-semibold text-primary mb-2">Account Pending Approval</h1>
        <p className="text-muted-foreground mb-4">Your account as a {user.role} is currently awaiting manager approval.</p>
        <p className="text-sm text-muted-foreground">Please check back later or contact support if you have questions.</p>
        <Button 
         onClick={() => {
            logout(); // Call logout from AuthContext
            router.push('/login');
          }} 
        className="mt-6"
        >
            Logout
        </Button>
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

    