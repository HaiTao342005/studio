"use client";

import type { ElementType, SVGProps } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface MarketDataCardProps {
  fruitName: string;
  price: string;
  change: string;
  trend: 'up' | 'down' | 'stable';
  Icon: ElementType<SVGProps<SVGSVGElement>>; // Use ElementType for component type
}

export function MarketDataCard({ fruitName, price, change, trend, Icon }: MarketDataCardProps) {
  const trendIcon = trend === 'up' ? <TrendingUp className="h-5 w-5 text-green-500" /> :
                    trend === 'down' ? <TrendingDown className="h-5 w-5 text-red-500" /> :
                    <Minus className="h-5 w-5 text-gray-500" />;
  const trendColor = trend === 'up' ? 'text-green-500' :
                     trend === 'down' ? 'text-red-500' :
                     'text-gray-500';

  return (
    <Card className="shadow-md hover:shadow-lg transition-shadow duration-300">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-lg font-medium text-primary">{fruitName}</CardTitle>
        <Icon className="h-8 w-8 text-accent" data-ai-hint={`${fruitName.toLowerCase()}`} />
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold">{price}</div>
        <p className={`text-xs ${trendColor} flex items-center`}>
          {trendIcon}
          <span className="ml-1">{change} from last period</span>
        </p>
      </CardContent>
      <CardFooter>
        <p className="text-xs text-muted-foreground">Last updated: Just now</p>
      </CardFooter>
    </Card>
  );
}
