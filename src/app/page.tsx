
"use client"; // Needs to be client for useRouter and useAuth

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Leaf } from 'lucide-react';

export default function HomePage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading) {
      if (user) {
        router.replace('/dashboard');
      } else {
        router.replace('/login');
      }
    }
  }, [user, isLoading, router]);

  // Display a loading state while checking auth status
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-primary/30 via-background to-accent/30 p-4">
      <Leaf className="h-24 w-24 text-primary mb-6 animate-pulse" />
      <h1 className="text-4xl font-bold text-primary mb-2">FruitFlow</h1>
      <p className="text-xl text-muted-foreground mb-8">Loading your trading experience...</p>
      <div className="relative flex h-5 w-1/2 max-w-xs items-center justify-center overflow-hidden rounded-full bg-secondary">
        <div className="absolute h-full w-1/2 animate-linear-progress rounded-full bg-primary"></div>
      </div>
      <style jsx global>{`
        @keyframes linear-progress {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        .animate-linear-progress {
          animation: linear-progress 1.5s infinite linear;
        }
      `}</style>
    </div>
  );
}
