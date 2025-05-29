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
  ShoppingCart, // Changed from FilePlus
  History,
  CreditCard, // Changed from Network
  Menu,
  Leaf
} from 'lucide-react';

const navItems = [
  { href: '/dashboard', label: 'Overview', icon: LayoutDashboard },
  { href: '/dashboard/market-data', label: 'Market Data', icon: CandlestickChart },
  { href: '/dashboard/customer-risk', label: 'Customer Risk', icon: ShieldCheck },
  { href: '/dashboard/orders/new', label: 'New Order', icon: ShoppingCart },
  { href: '/dashboard/orders/history', label: 'Order History', icon: History },
  { href: '/dashboard/payment-tracking', label: 'Payment Tracking', icon: CreditCard },
];

function AppSidebarNav() {
  const pathname = usePathname();
  const { open } = useSidebar();

  return (
    <SidebarMenu>
      {navItems.map((item) => (
        <SidebarMenuItem key={item.href}>
          <Link href={item.href} passHref legacyBehavior>
            <SidebarMenuButton
              isActive={pathname === item.href || (pathname.startsWith(item.href) && item.href !== '/dashboard')}
              tooltip={open ? undefined : item.label}
            >
              <item.icon className="h-5 w-5" />
              <span className="truncate">{item.label}</span>
            </SidebarMenuButton>
          </Link>
        </SidebarMenuItem>
      ))}
    </SidebarMenu>
  );
}

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <SidebarProvider defaultOpen={true}>
      <div className="flex min-h-screen w-full">
        <Sidebar collapsible="icon" className="border-r">
          <SidebarHeader className="p-4">
            <Link href="/dashboard" className="flex items-center gap-2 font-semibold text-primary">
              <Leaf className="h-8 w-8" />
              {/* Applying style directly as group-data might not always work with link children for complex scenarios */}
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
        <SidebarInset className="flex flex-col bg-secondary/50"> {/* Using secondary for main content background slightly */}
          {children}
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
