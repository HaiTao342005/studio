
"use client";

import type { ReactNode } from 'react';
import { useState, useEffect, useCallback }
from 'react';
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { PanelLeft, LogOut, UserCircle, Wallet } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { ethers } from 'ethers';

interface HeaderProps {
  title: string;
  children?: ReactNode;
}

export function Header({ title, children }: HeaderProps) {
  const { user, logout, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [isClient, setIsClient] = useState(false);
  const [currentAccount, setCurrentAccount] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    setIsClient(true);
  }, []);

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  useEffect(() => {
    if (isClient && !authLoading && !user) {
      router.replace('/login');
    }
  }, [isClient, authLoading, user, router]);

  const connectWallet = useCallback(async () => {
    if (typeof window.ethereum !== 'undefined') {
      try {
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' }) as string[];
        if (accounts.length > 0) {
          setCurrentAccount(accounts[0]);
          toast({ title: "Wallet Connected", description: `Connected to account: ${accounts[0].substring(0, 6)}...${accounts[0].substring(accounts[0].length - 4)}` });
        } else {
          toast({ title: "Connection Failed", description: "No accounts found. Please ensure your wallet is set up.", variant: "destructive" });
        }
      } catch (error: any) {
        toast({ title: "Connection Error", description: error.message || "Failed to connect wallet.", variant: "destructive" });
        console.error("Error connecting to Metamask:", error);
      }
    } else {
      toast({ title: "Metamask Not Found", description: "Please install Metamask to use this feature.", variant: "destructive" });
    }
  }, [toast]);

  const handleDisconnect = useCallback(() => {
    setCurrentAccount(null);
    toast({ title: "Wallet Disconnected", description: "You can connect another wallet by clicking 'Connect Wallet'." });
  }, [toast]);

  useEffect(() => {
    if (typeof window.ethereum !== 'undefined') {
      const handleAccountsChanged = (accounts: string[]) => {
        if (accounts.length === 0) {
          setCurrentAccount(null);
          toast({ title: "Wallet Disconnected", description: "Metamask account disconnected or locked." });
        } else {
          setCurrentAccount(accounts[0]);
          // Optionally toast: toast({ title: "Account Switched", description: `Switched to account: ${accounts[0].substring(0,6)}...${accounts[0].substring(accounts[0].length - 4)}` });
        }
      };

      window.ethereum.on('accountsChanged', handleAccountsChanged);
      // Check initial connection status silently
      window.ethereum.request({ method: 'eth_accounts' })
        .then((accounts: any) => {
          if ((accounts as string[]).length > 0) {
            setCurrentAccount((accounts as string[])[0]);
          }
        }).catch(console.error);

      return () => {
        window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
      };
    }
  }, [toast]);


  return (
    <header className="sticky top-0 z-10 flex h-16 items-center gap-4 border-b bg-background/80 backdrop-blur-sm px-4 md:px-6">
      <div>
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
        {isClient && user ? (
          <div className="flex items-center gap-2 sm:gap-4"> {/* Adjusted gap for responsiveness */}
            <div className="text-sm text-muted-foreground border px-3 py-2 rounded-md shadow-sm bg-card">
              <UserCircle className="inline-block mr-2 h-4 w-4 text-primary" />
              {user.name} ({user.role?.charAt(0).toUpperCase() + (user.role?.slice(1) || '')})
            </div>

            {/* Wallet connect/disconnect section */}
            {currentAccount ? (
              <div className="flex items-center gap-2">
                <div className="text-sm border px-3 py-2 rounded-md shadow-sm bg-card text-green-600" title={currentAccount}>
                  <Wallet className="inline-block mr-1 sm:mr-2 h-4 w-4 text-green-500" />
                  <span className="hidden xs:inline"> {/* Show address on xs and up */}
                    {currentAccount.substring(0, 4)}...{currentAccount.substring(currentAccount.length - 4)}
                  </span>
                </div>
                <Button onClick={handleDisconnect} variant="outline" size="sm" className="shadow-sm px-2 sm:px-3" title="Disconnect Wallet">
                  <LogOut className="h-4 w-4" />
                  <span className="hidden sm:inline sm:ml-2">Disconnect</span>
                </Button>
              </div>
            ) : (
              <Button onClick={connectWallet} variant="outline" size="sm" className="shadow-sm px-2 sm:px-3" title="Connect Wallet">
                <Wallet className="h-4 w-4" />
                <span className="hidden sm:inline sm:ml-2">Connect Wallet</span>
              </Button>
            )}

            <Button onClick={handleLogout} variant="outline" size="sm" className="shadow-sm px-2 sm:px-3" title="Logout">
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline sm:ml-2">Logout</span>
            </Button>
          </div>
        ) : isClient && !authLoading ? (
           <Button onClick={() => router.push('/login')} variant="outline" className="shadow-sm">
            Sign In
          </Button>
        ) : null
        }
      </div>
    </header>
  );
}
