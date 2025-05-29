
"use client";

import type { ReactNode } from 'react';
import { useState, useEffect } from 'react';
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { PanelLeft, LogOut, UserCircle, Wallet } from 'lucide-react'; // Wallet icon for consistency if added back
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';

interface HeaderProps {
  title: string;
  children?: ReactNode;
}

export function Header({ title, children }: HeaderProps) {
  const { user, logout, isLoading: authLoading } = useAuth(); // Renamed isLoading to authLoading
  const router = useRouter();
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const handleLogout = () => {
    logout();
    router.push('/login'); // AuthContext toast will show
  };
  
  // Effect to redirect to login if user is null after loading and on client
  useEffect(() => {
    if (isClient && !authLoading && !user) {
      router.replace('/login');
    }
  }, [isClient, authLoading, user, router]);


  return (
    <header className="sticky top-0 z-10 flex h-16 items-center gap-4 border-b bg-background/80 backdrop-blur-sm px-4 md:px-6">
      <div> 
        <SidebarTrigger asChild>
          <Button variant="outline" size="icon" className="shrink-0 md:hidden"> {/* Hidden on md and up by default */}
            <PanelLeft /> 
            <span className="sr-only">Toggle navigation menu</span>
          </Button>
        </SidebarTrigger>
      </div>
      <h1 className="text-2xl font-semibold text-primary">{title}</h1>
      <div className="ml-auto flex items-center gap-4">
        {children}
        {isClient && user ? (
          <div className="flex items-center gap-2">
            <div className="text-sm text-muted-foreground border px-3 py-2 rounded-md shadow-sm bg-card">
              <UserCircle className="inline-block mr-2 h-4 w-4 text-primary" />
              {user.name} ({user.role?.charAt(0).toUpperCase() + (user.role?.slice(1) || '')})
            </div>
            <Button onClick={handleLogout} variant="outline" size="sm" className="shadow-sm" title="Logout">
              <LogOut className="h-4 w-4 mr-0 sm:mr-2" /> {/* Icon only on small screens */}
              <span className="hidden sm:inline">Logout</span>
            </Button>
          </div>
        ) : isClient && !authLoading ? ( // Show sign-in only if not loading and no user
           <Button onClick={() => router.push('/login')} variant="outline" className="shadow-sm">
            Sign In
          </Button>
        ) : null 
        }
      </div>
    </header>
  );
}
