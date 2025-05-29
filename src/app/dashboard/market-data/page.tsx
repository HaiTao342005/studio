import { Header } from '@/components/dashboard/Header';
import { MarketDataCard } from '@/components/dashboard/MarketDataCard';
import { AppleIcon, BananaIcon, OrangeIcon, GrapeIcon, MangoIcon } from '@/components/icons/FruitIcons';

const mockMarketData = [
  { id: '1', fruitName: 'Apples (Fuji)', price: '$2.50/kg', change: '+1.2%', trend: 'up' as const, Icon: AppleIcon },
  { id: '2', fruitName: 'Bananas (Cavendish)', price: '$0.80/kg', change: '-0.5%', trend: 'down' as const, Icon: BananaIcon },
  { id: '3', fruitName: 'Oranges (Navel)', price: '$3.10/kg', change: '+2.0%', trend: 'up' as const, Icon: OrangeIcon },
  { id: '4', fruitName: 'Grapes (Red Globe)', price: '$4.50/kg', change: '0.0%', trend: 'stable' as const, Icon: GrapeIcon },
  { id: '5', fruitName: 'Mangoes (Kent)', price: '$5.20/kg', change: '+3.5%', trend: 'up' as const, Icon: MangoIcon },
  { id: '6', fruitName: 'Pears (Bartlett)', price: '$2.80/kg', change: '-1.1%', trend: 'down' as const, Icon: AppleIcon }, // Using AppleIcon as placeholder
];

interface MarketDataPageProps {
  params: {}; // Static route
  searchParams: { [key: string]: string | string[] | undefined };
}

export default function MarketDataPage({ params, searchParams }: MarketDataPageProps) {
  return (
    <>
      <Header title="Global Fruit Market Data" />
      <main className="flex-1 p-6 space-y-6">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {mockMarketData.map((data) => (
            <MarketDataCard
              key={data.id}
              fruitName={data.fruitName}
              price={data.price}
              change={data.change}
              trend={data.trend}
              Icon={data.Icon}
            />
          ))}
        </div>
        <div className="text-center text-sm text-muted-foreground mt-8">
          <p>Data is illustrative. In a real application, this would be sourced from live global exchanges.</p>
        </div>
      </main>
    </>
  );
}
