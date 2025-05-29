
"use client";

import type { ReactNode } from 'react';
import { useState, useEffect } from 'react';
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Wallet, PanelLeft, LogOut, UserCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';

interface HeaderProps {
  title: string;
  children?: ReactNode;
}

export function Header({ title, children }: HeaderProps) {
  const { toast } = useToast();
  const { user, logout } = useAuth();
  const router = useRouter();

  const handleLogout = () => {
    logout();
    toast({ title: 'Logged Out', description: 'You have been successfully logged out.' });
    router.push('/login');
  };

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
        {user ? (
          <div className="flex items-center gap-2">
            <div className="text-sm text-muted-foreground border px-3 py-2 rounded-md shadow-sm bg-card">
              <UserCircle className="inline-block mr-2 h-4 w-4 text-primary" />
              {user.name} ({user.role?.charAt(0).toUpperCase() + (user.role?.slice(1) || '')})
            </div>
            <Button onClick={handleLogout} variant="outline" size="sm" className="shadow-sm" title="Logout">
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </div>
        ) : (
           <Button onClick={() => router.push('/login')} variant="outline" className="shadow-sm">
            Sign In
          </Button>
        )
        }
      </div>
    </header>
  );
}
