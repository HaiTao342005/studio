
"use client";

import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Header } from '@/components/dashboard/Header';
import { ArrowRight, CandlestickChart, ShieldCheck, ShoppingCart, History, CreditCard, UserCircle, Truck, PackageSearch, ClipboardList, FileText, UserCheck } from 'lucide-react';
import { useAuth, type UserRole } from '@/contexts/AuthContext';

const managerFeatures = [
  { title: "User Approvals", description: "Approve users and manage manager accounts.", link: "/dashboard/user-approvals", icon: UserCheck, color: "text-teal-500" },
  { title: "Order History", description: "View all customer orders.", link: "/dashboard/transactions/history", icon: History, color: "text-purple-500" },
  { title: "Payment Tracking", description: "Track payment statuses for all orders.", link: "/dashboard/payment-flows", icon: CreditCard, color: "text-green-500" },
  { title: "Market Data", description: "View global fruit market data.", link: "/dashboard/market-data", icon: CandlestickChart, color: "text-primary" },
  { title: "Customer Risk", description: "Assess payment risks for customers.", link: "/dashboard/risk-assessment", icon: ShieldCheck, color: "text-accent" },
  { title: "New Order", description: "Create new customer orders if needed.", link: "/dashboard/transactions/new", icon: ShoppingCart, color: "text-blue-500" },
];

const supplierFeatures = [
  { title: "Market Data", description: "View real-time global fruit market data.", link: "/dashboard/market-data", icon: CandlestickChart, color: "text-primary" },
  { title: "Customer Payment Risk", description: "Assess payment risks for your customers.", link: "/dashboard/risk-assessment", icon: ShieldCheck, color: "text-accent" },
  { title: "New Order", description: "Enter new customer order details.", link: "/dashboard/transactions/new", icon: ShoppingCart, color: "text-blue-500" },
  { title: "Order History", description: "Browse historical order records.", link: "/dashboard/transactions/history", icon: History, color: "text-purple-500" },
  { title: "Payment Tracking", description: "Visualize and track payment statuses.", link: "/dashboard/payment-flows", icon: CreditCard, color: "text-green-500" }
];

const transporterFeatures = [
  { title: "Manage Shipments", description: "View and update active shipments.", link: "/dashboard/shipments", icon: Truck, color: "text-primary" },
  { title: "Proof of Delivery", description: "Upload and manage delivery proofs.", link: "/dashboard/delivery-proof", icon: PackageSearch, color: "text-orange-500" },
];

const customerFeatures = [
  { title: "My Orders", description: "View your order history and status.", link: "/dashboard/my-orders", icon: ClipboardList, color: "text-primary" },
  { title: "Make a Payment", description: "Access payment options for outstanding orders.", link: "/dashboard/my-payments", icon: CreditCard, color: "text-green-500" },
  { title: "My Documents", description: "Download invoices and shipping documents.", link: "/dashboard/my-documents", icon: FileText, color: "text-indigo-500" },
];


interface FeatureCard {
  title: string;
  description: string;
  link: string;
  icon: React.ElementType;
  color: string;
}

const getRoleSpecificFeatures = (role: UserRole): FeatureCard[] => {
  switch (role) {
    case 'manager':
      return managerFeatures;
    case 'supplier':
      return supplierFeatures;
    case 'transporter':
      return transporterFeatures;
    case 'customer':
      return customerFeatures;
    default:
      return [];
  }
};

interface DashboardOverviewPageProps {
  params: {};
  searchParams: { [key: string]: string | string[] | undefined };
}

export default function DashboardOverviewPage({ params, searchParams }: DashboardOverviewPageProps) {
  const { user } = useAuth();

  if (!user || !user.role) {
    return (
      <>
        <Header title="Dashboard Overview" />
        <main className="flex-1 p-6">
          <p>Loading user information or role not set...</p>
        </main>
      </>
    );
  }

  const featureCards = getRoleSpecificFeatures(user.role);
  const roleName = user.role.charAt(0).toUpperCase() + user.role.slice(1);

  return (
    <>
      <Header title={`${roleName} Dashboard Overview`} />
      <main className="flex-1 p-6 space-y-6">
        <Card className="bg-card shadow-lg">
          <CardHeader>
            <CardTitle className="text-3xl font-bold text-primary">Welcome to FruitFlow, {user.name}!</CardTitle>
            <CardDescription className="text-lg text-muted-foreground">
              Your dedicated {user.role} portal for managing fruit trade operations.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p>Navigate through the sections using the sidebar or the quick links below to get started.</p>
          </CardContent>
        </Card>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {featureCards.map((feature) => (
            <Card key={feature.title} className="flex flex-col justify-between shadow-md hover:shadow-lg transition-shadow duration-300">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xl font-semibold">{feature.title}</CardTitle>
                <feature.icon className={`h-6 w-6 ${feature.color}`} />
              </CardHeader>
              <CardContent>
                <CardDescription>{feature.description}</CardDescription>
              </CardContent>
              <CardContent className="pt-0">
                 <Link href={feature.link} passHref>
                  <Button asChild variant="outline" className="w-full text-primary border-primary hover:bg-primary/10">
                    <>
                      Go to {feature.title} <ArrowRight className="ml-2 h-4 w-4" />
                    </>
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>

        {featureCards.length === 0 && (
          <Card>
            <CardContent className="pt-6">
              <p className="text-muted-foreground">No specific features available for your role at the moment, or your role is not recognized.</p>
            </CardContent>
          </Card>
        )}
      </main>
    </>
  );
}
