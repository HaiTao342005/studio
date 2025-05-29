
"use client";

import { useState, useEffect, type SVGProps, type ElementType } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from '@/components/ui/button';
import { Trash2 } from 'lucide-react';
import type { Transaction, TransactionStatus, StoredTransaction } from '@/types/transaction';
import { AppleIcon, BananaIcon, OrangeIcon, GrapeIcon, MangoIcon, FruitIcon } from '@/components/icons/FruitIcons';
import { format, parseISO } from 'date-fns';

const LOCAL_STORAGE_KEY = 'transactions';

const getStatusBadgeVariant = (status: TransactionStatus): "default" | "secondary" | "destructive" | "outline" => {
  switch (status) {
    case 'Completed': return 'default'; 
    case 'In Transit': return 'secondary'; 
    case 'Pending': return 'outline'; 
    case 'Cancelled': return 'destructive';
    default: return 'secondary';
  }
};

const getFruitIcon = (fruitType: string): ElementType<SVGProps<SVGSVGElement>> => {
  const lowerFruitType = fruitType.toLowerCase();
  if (lowerFruitType.includes('apple')) return AppleIcon;
  if (lowerFruitType.includes('banana')) return BananaIcon;
  if (lowerFruitType.includes('orange')) return OrangeIcon;
  if (lowerFruitType.includes('grape')) return GrapeIcon;
  if (lowerFruitType.includes('mango')) return MangoIcon;
  return FruitIcon; // Default icon
};

export function TransactionHistoryTable() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadTransactions = () => {
    setIsLoading(true);
    try {
      const storedTransactionsRaw = localStorage.getItem(LOCAL_STORAGE_KEY);
      const storedTransactions: StoredTransaction[] = storedTransactionsRaw ? JSON.parse(storedTransactionsRaw) : [];
      
      const displayTransactions: Transaction[] = storedTransactions.map(tx => ({
        ...tx,
        FruitIcon: getFruitIcon(tx.fruitType),
      })).sort((a, b) => parseISO(b.date).getTime() - parseISO(a.date).getTime()); // Sort by date, newest first

      setTransactions(displayTransactions);
    } catch (error) {
      console.error("Failed to load transactions from localStorage:", error);
      setTransactions([]); // Set to empty array on error
    }
    setIsLoading(false);
  };

  useEffect(() => {
    loadTransactions();
    // Optional: Listen for custom event to reload transactions if another component updates them
    const handleStorageChange = () => loadTransactions();
    window.addEventListener('storage', handleStorageChange); // Basic way, or use custom event for more control
    window.addEventListener('transactionsUpdated', handleStorageChange);


    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('transactionsUpdated', handleStorageChange);
    };
  }, []);

  const handleDeleteTransaction = (transactionId: string) => {
    try {
      const updatedTransactions = transactions.filter(tx => tx.id !== transactionId);
      const storedUpdatedTransactions = updatedTransactions.map(({ FruitIcon, ...rest}) => rest); // Remove FruitIcon before storing
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(storedUpdatedTransactions));
      setTransactions(updatedTransactions); // Update UI
       // Dispatch a custom event so other components (like form) can be aware if needed
      window.dispatchEvent(new CustomEvent('transactionsUpdated'));
    } catch (error) {
      console.error("Failed to delete transaction from localStorage:", error);
    }
  };

  if (isLoading) {
    return <p>Loading transaction history...</p>;
  }

  if (transactions.length === 0) {
    return <p className="text-center text-muted-foreground py-8">No transactions recorded yet. Record a new transaction to see it here.</p>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-[60px]">Icon</TableHead>
          <TableHead>Date</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Importer</TableHead>
          <TableHead>Exporter</TableHead>
          <TableHead className="text-right">Amount</TableHead>
          <TableHead className="text-right">Quantity</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="w-[80px]">Actions</TableHead>
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
            <TableCell className="text-right">{transaction.currency} {transaction.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
            <TableCell className="text-right">{transaction.quantity.toLocaleString()} {transaction.unit}</TableCell>
            <TableCell>
              <Badge variant={getStatusBadgeVariant(transaction.status)}>{transaction.status}</Badge>
            </TableCell>
            <TableCell>
              <Button variant="ghost" size="icon" onClick={() => handleDeleteTransaction(transaction.id)} aria-label="Delete transaction">
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
