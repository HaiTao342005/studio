
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Header } from '@/components/dashboard/Header';
import { ArrowRight, CandlestickChart, ShieldCheck, ShoppingCart, History, CreditCard } from 'lucide-react';

const featureCards = [
  {
    title: "Market Data",
    description: "View real-time global fruit market data.",
    link: "/dashboard/market-data",
    icon: CandlestickChart,
    color: "text-primary"
  },
  {
    title: "Customer Payment Risk",
    description: "Assess payment risks for your customers.",
    link: "/dashboard/risk-assessment", // Corrected link
    icon: ShieldCheck,
    color: "text-accent"
  },
  {
    title: "New Order",
    description: "Enter new customer order details.",
    link: "/dashboard/transactions/new", // Corrected link
    icon: ShoppingCart,
    color: "text-blue-500"
  },
  {
    title: "Order History",
    description: "Browse historical order records.",
    link: "/dashboard/transactions/history", // Corrected link
    icon: History,
    color: "text-purple-500"
  },
  {
    title: "Payment Tracking",
    description: "Visualize and track payment statuses.",
    link: "/dashboard/payment-flows", // Corrected link
    icon: CreditCard,
    color: "text-green-500"
  }
];

interface DashboardOverviewPageProps {
  params: {}; // Static route
  searchParams: { [key: string]: string | string[] | undefined };
}

export default function DashboardOverviewPage({ params, searchParams }: DashboardOverviewPageProps) {
  return (
    <>
      <Header title="Dashboard Overview" />
      <main className="flex-1 p-6 space-y-6">
        <Card className="bg-card shadow-lg">
          <CardHeader>
            <CardTitle className="text-3xl font-bold text-primary">Welcome to FruitFlow</CardTitle>
            <CardDescription className="text-lg text-muted-foreground">
              Your platform for fruit trade operations, market insights, and transaction management.
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
      </main>
    </>
  );
}
