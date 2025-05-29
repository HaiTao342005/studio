
"use client";

import type { ReactNode } from 'react';
import { useState, useEffect } from 'react';
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Wallet, PanelLeft } from 'lucide-react'; // Added Wallet

interface HeaderProps {
  title: string;
  children?: ReactNode;
}

export function Header({ title, children }: HeaderProps) {
  const { toast } = useToast();
  const [currentAccount, setCurrentAccount] = useState<string | null>(null);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    // Check if already connected on component mount (optional)
    const checkIfWalletIsConnected = async () => {
      if (typeof window.ethereum !== 'undefined') {
        try {
          const accounts = await window.ethereum.request({ method: 'eth_accounts' });
          if (accounts && accounts.length > 0) {
            setCurrentAccount(accounts[0]);
          }
        } catch (error) {
          console.warn('Could not get accounts on load:', error);
        }
      }
    };
    checkIfWalletIsConnected();
  }, []);

  const connectWallet = async () => {
    if (typeof window.ethereum !== 'undefined') {
      try {
        // Request account access
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        if (accounts && accounts.length > 0) {
          setCurrentAccount(accounts[0]);
          console.log('Connected account:', accounts[0]);
          toast({ title: 'Wallet Connected', description: `Account: ${accounts[0].substring(0,6)}...${accounts[0].substring(accounts[0].length - 4)}` });

          // You would typically initialize ethers provider here
          // import { BrowserProvider } from 'ethers';
          // const provider = new BrowserProvider(window.ethereum);
          // const signer = await provider.getSigner();
          // console.log('Signer:', signer);

        } else {
          toast({ title: 'Connection Failed', description: 'No accounts found.', variant: 'destructive' });
        }
      } catch (error: any) {
        console.error('Error connecting to Metamask:', error);
        toast({ title: 'Connection Error', description: error.message || 'Failed to connect wallet.', variant: 'destructive' });
      }
    } else {
      toast({ title: 'Metamask Not Found', description: 'Please install Metamask to connect your wallet.', variant: 'destructive' });
      // Consider adding a link to Metamask website: https://metamask.io/download/
    }
  };

  return (
    <header className="sticky top-0 z-10 flex h-16 items-center gap-4 border-b bg-background/80 backdrop-blur-sm px-4 md:px-6">
      <div className="md:hidden">
        <SidebarTrigger asChild>
          <Button variant="outline" size="icon" className="shrink-0">
            <PanelLeft /> 
            <span className="sr-only">Toggle navigation menu</span>
          </Button>
        </SidebarTrigger>
      </div>
      <h1 className="text-2xl font-semibold text-primary">{title}</h1>
      <div className="ml-auto flex items-center gap-4">
        {children}
        {isClient && currentAccount ? (
          <div className="text-sm text-muted-foreground border px-3 py-2 rounded-md shadow-sm bg-card">
            <Wallet className="inline-block mr-2 h-4 w-4 text-green-500" />
            Connected: {currentAccount.substring(0, 6)}...{currentAccount.substring(currentAccount.length - 4)}
          </div>
        ) : isClient ? (
          <Button onClick={connectWallet} variant="outline" className="shadow-sm">
            <Wallet className="mr-2 h-4 w-4" />
            Connect Wallet
          </Button>
        ) : (
          <Button variant="outline" className="shadow-sm" disabled>
            <Wallet className="mr-2 h-4 w-4" />
            Loading...
          </Button>
        )
        }
      </div>
    </header>
  );
}
