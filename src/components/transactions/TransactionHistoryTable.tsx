"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import type { Transaction, TransactionStatus } from '@/types/transaction';
import { AppleIcon, BananaIcon, OrangeIcon, GrapeIcon, MangoIcon, FruitIcon } from '@/components/icons/FruitIcons';
import { format, parseISO } from 'date-fns';

const mockTransactions: Transaction[] = [
  { id: 'txn_001', date: '2024-07-15T10:30:00Z', fruitType: 'Fuji Apples', importer: 'Global Fruits Inc.', exporter: 'Orchard Fresh Ltd.', amount: 12500, currency: 'USD', quantity: 5000, unit: 'kg', status: 'Completed', FruitIcon: AppleIcon },
  { id: 'txn_002', date: '2024-07-18T14:00:00Z', fruitType: 'Cavendish Bananas', importer: 'EuroFruit Importers', exporter: 'Tropical Best Produce', amount: 8200, currency: 'USD', quantity: 10, unit: 'ton', status: 'In Transit', FruitIcon: BananaIcon },
  { id: 'txn_003', date: '2024-07-20T09:15:00Z', fruitType: 'Navel Oranges', importer: 'AsiaFruit Co.', exporter: 'Citrus Grove Exports', amount: 22000, currency: 'USD', quantity: 800, unit: 'box', status: 'Pending', FruitIcon: OrangeIcon },
  { id: 'txn_004', date: '2024-06-25T16:45:00Z', fruitType: 'Red Globe Grapes', importer: 'FreshMarket LLC', exporter: 'Vineyard Supreme', amount: 15500, currency: 'USD', quantity: 20, unit: 'pallet', status: 'Completed', FruitIcon: GrapeIcon },
  { id: 'txn_005', date: '2024-07-22T11:00:00Z', fruitType: 'Kent Mangoes', importer: 'Exotic Fruits R Us', exporter: 'SunRipe Mangoes', amount: 18000, currency: 'USD', quantity: 3000, unit: 'kg', status: 'Cancelled', FruitIcon: MangoIcon },
];

const getStatusBadgeVariant = (status: TransactionStatus): "default" | "secondary" | "destructive" | "outline" => {
  switch (status) {
    case 'Completed': return 'default'; // Primary color (greenish in our theme)
    case 'In Transit': return 'secondary'; // Greyish
    case 'Pending': return 'outline'; // Uses foreground text color with border
    case 'Cancelled': return 'destructive'; // Red
    default: return 'secondary';
  }
};

export function TransactionHistoryTable() {
  // In a real app, transactions would be fetched or passed as props
  const transactions = mockTransactions;

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-[100px]">Fruit</TableHead>
          <TableHead>Date</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Importer</TableHead>
          <TableHead>Exporter</TableHead>
          <TableHead className="text-right">Amount</TableHead>
          <TableHead className="text-right">Quantity</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {transactions.map((transaction) => (
          <TableRow key={transaction.id}>
            <TableCell>
              {transaction.FruitIcon ? <transaction.FruitIcon className="h-6 w-6 text-accent" /> : <FruitIcon className="h-6 w-6 text-gray-400" />}
            </TableCell>
            <TableCell>{format(parseISO(transaction.date), "MMM d, yyyy")}</TableCell>
            <TableCell className="font-medium">{transaction.fruitType}</TableCell>
            <TableCell>{transaction.importer}</TableCell>
            <TableCell>{transaction.exporter}</TableCell>
            <TableCell className="text-right">{transaction.currency} {transaction.amount.toLocaleString()}</TableCell>
            <TableCell className="text-right">{transaction.quantity.toLocaleString()} {transaction.unit}</TableCell>
            <TableCell>
              <Badge variant={getStatusBadgeVariant(transaction.status)}>{transaction.status}</Badge>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
