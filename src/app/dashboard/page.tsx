import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Header } from '@/components/dashboard/Header';
import { ArrowRight, CandlestickChart, ShieldCheck, FilePlus, History, Network } from 'lucide-react';

const featureCards = [
  {
    title: "Market Data",
    description: "View real-time global fruit market data.",
    link: "/dashboard/market-data",
    icon: CandlestickChart,
    color: "text-primary"
  },
  {
    title: "Risk Assessment",
    description: "Assess payment risks with our AI-powered tool.",
    link: "/dashboard/risk-assessment",
    icon: ShieldCheck,
    color: "text-accent"
  },
  {
    title: "New Transaction",
    description: "Enter new import/export transaction details.",
    link: "/dashboard/transactions/new",
    icon: FilePlus,
    color: "text-blue-500"
  },
  {
    title: "Transaction History",
    description: "Browse historical transaction records.",
    link: "/dashboard/transactions/history",
    icon: History,
    color: "text-purple-500"
  },
  {
    title: "Payment Flows",
    description: "Visualize payment flows between parties.",
    link: "/dashboard/payment-flows",
    icon: Network,
    color: "text-green-500"
  }
];

export default function DashboardOverviewPage() {
  return (
    <>
      <Header title="Dashboard Overview" />
      <main className="flex-1 p-6 space-y-6">
        <Card className="bg-card shadow-lg">
          <CardHeader>
            <CardTitle className="text-3xl font-bold text-primary">Welcome to NewTech</CardTitle>
            <CardDescription className="text-lg text-muted-foreground">
              Your central hub for managing fruit trade operations, market insights, and risk assessment.
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
                 <Link href={feature.link} passHref> {/* Removed legacyBehavior */}
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
