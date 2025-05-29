"use client";

import type { ReactNode } from 'react';
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";

interface HeaderProps {
  title: string;
  children?: ReactNode;
}

export function Header({ title, children }: HeaderProps) {
  return (
    <header className="sticky top-0 z-10 flex h-16 items-center gap-4 border-b bg-background/80 backdrop-blur-sm px-4 md:px-6">
      <div className="md:hidden">
        <SidebarTrigger asChild>
          <Button variant="outline" size="icon" className="shrink-0">
            <span className="sr-only">Toggle navigation menu</span>
          </Button>
        </SidebarTrigger>
      </div>
      <h1 className="text-2xl font-semibold text-primary">{title}</h1>
      <div className="ml-auto flex items-center gap-4">
        {children}
      </div>
    </header>
  );
}
