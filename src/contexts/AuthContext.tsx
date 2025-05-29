
"use client";

import type { ReactNode} from 'react';
import { createContext, useContext, useState, useEffect } from 'react';

export type UserRole = 'supplier' | 'transporter' | 'customer' | null;

interface User {
  id: string; // Could be Firebase UID in a real app
  name: string; // Username or display name
  role: UserRole;
}

interface AuthContextType {
  user: User | null;
  login: (username: string, role: UserRole) => void;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true); // To handle initial load from localStorage

  useEffect(() => {
    // Try to load user from localStorage on initial mount
    try {
      const storedUser = localStorage.getItem('fruitflow-user');
      if (storedUser) {
        setUser(JSON.parse(storedUser));
      }
    } catch (error) {
      console.error("Failed to parse user from localStorage", error);
      localStorage.removeItem('fruitflow-user');
    }
    setIsLoading(false);
  }, []);

  const login = (username: string, role: UserRole) => {
    if (role) {
      const newUser: User = { id: Date.now().toString(), name: username, role }; // Mock user
      setUser(newUser);
      localStorage.setItem('fruitflow-user', JSON.stringify(newUser));
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('fruitflow-user');
    // In a real app with Firebase, you'd also call Firebase signOut
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
