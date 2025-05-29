
"use client";

import type { ReactNode} from 'react';
import { createContext, useContext, useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast'; // Import useToast

export type UserRole = 'supplier' | 'transporter' | 'customer' | null;

interface User {
  id: string; 
  name: string; 
  role: UserRole;
}

// Interface for stored user data, including a mock password
interface StoredUser extends User {
  mockPassword?: string; // Optional for users created before this change
}

interface AuthContextType {
  user: User | null;
  login: (username: string, mockPasswordAttempt: string) => void;
  signup: (username: string, mockPasswordNew: string, role: UserRole) => void;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const CURRENT_USER_STORAGE_KEY = 'fruitflow-currentUser';
const ALL_USERS_STORAGE_KEY = 'fruitflow-allUsers';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast(); // Initialize toast

  useEffect(() => {
    try {
      const storedCurrentUser = localStorage.getItem(CURRENT_USER_STORAGE_KEY);
      if (storedCurrentUser) {
        setUser(JSON.parse(storedCurrentUser));
      }
    } catch (error) {
      console.error("Failed to parse current user from localStorage", error);
      localStorage.removeItem(CURRENT_USER_STORAGE_KEY);
    }
    setIsLoading(false);
  }, []);

  const getStoredUsers = (): StoredUser[] => {
    try {
      const users = localStorage.getItem(ALL_USERS_STORAGE_KEY);
      return users ? JSON.parse(users) : [];
    } catch (error) {
      console.error("Failed to parse all users from localStorage", error);
      return [];
    }
  };

  const saveStoredUsers = (users: StoredUser[]) => {
    localStorage.setItem(ALL_USERS_STORAGE_KEY, JSON.stringify(users));
  };

  const signup = (username: string, mockPasswordNew: string, role: UserRole) => {
    if (!username || !mockPasswordNew || !role) {
      toast({ title: "Sign Up Error", description: "All fields are required for sign up.", variant: "destructive" });
      return;
    }
    const allUsers = getStoredUsers();
    const existingUser = allUsers.find(u => u.name.toLowerCase() === username.toLowerCase());

    if (existingUser) {
      toast({ title: "Sign Up Failed", description: "Username already taken. Please choose another.", variant: "destructive" });
      return;
    }

    const newUser: StoredUser = { 
      id: Date.now().toString(), 
      name: username, 
      role, 
      mockPassword: mockPasswordNew 
    };
    allUsers.push(newUser);
    saveStoredUsers(allUsers);

    // Log in the new user
    const userToSet: User = { id: newUser.id, name: newUser.name, role: newUser.role };
    setUser(userToSet);
    localStorage.setItem(CURRENT_USER_STORAGE_KEY, JSON.stringify(userToSet));
    toast({ title: "Sign Up Successful!", description: `Welcome, ${username}! You are now logged in as a ${role}.` });
  };

  const login = (username: string, mockPasswordAttempt: string) => {
     if (!username || !mockPasswordAttempt) {
      toast({ title: "Login Error", description: "Username and password are required.", variant: "destructive" });
      return;
    }
    const allUsers = getStoredUsers();
    const foundUser = allUsers.find(u => u.name.toLowerCase() === username.toLowerCase());

    if (foundUser && foundUser.mockPassword === mockPasswordAttempt) {
      const userToSet: User = { id: foundUser.id, name: foundUser.name, role: foundUser.role };
      setUser(userToSet);
      localStorage.setItem(CURRENT_USER_STORAGE_KEY, JSON.stringify(userToSet));
      toast({ title: "Login Successful!", description: `Welcome back, ${username}!` });
    } else if (foundUser && !foundUser.mockPassword) {
      // Handle users created before password system - allow login by role if they exist
      // This part is tricky without knowing the original role. We'll assume old users need to sign up again.
      toast({ title: "Login Failed", description: "This account was created before password support. Please sign up again with a password.", variant: "destructive" });
    }
    
    else {
      toast({ title: "Login Failed", description: "Invalid username or password.", variant: "destructive" });
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem(CURRENT_USER_STORAGE_KEY);
    toast({ title: "Logged Out", description: "You have been successfully logged out." });
  };

  return (
    <AuthContext.Provider value={{ user, login, signup, logout, isLoading }}>
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
