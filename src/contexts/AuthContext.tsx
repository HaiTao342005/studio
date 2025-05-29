
"use client";

import type { ReactNode} from 'react';
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';

export type UserRole = 'supplier' | 'transporter' | 'customer' | 'manager' | null;

interface User {
  id: string;
  name: string;
  role: UserRole;
  isApproved: boolean;
}

interface StoredUser extends User {
  mockPassword?: string;
}

interface AuthContextType {
  user: User | null;
  login: (username: string, mockPasswordAttempt: string) => void;
  signup: (username: string, mockPasswordNew: string, role: UserRole) => void;
  logout: () => void;
  isLoading: boolean;
  getAllUsers: () => StoredUser[];
  approveUser: (userId: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const CURRENT_USER_STORAGE_KEY = 'fruitflow-currentUser';
const ALL_USERS_STORAGE_KEY = 'fruitflow-allUsers';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

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

  const getStoredUsers = useCallback((): StoredUser[] => {
    try {
      const users = localStorage.getItem(ALL_USERS_STORAGE_KEY);
      return users ? JSON.parse(users) : [];
    } catch (error) {
      console.error("Failed to parse all users from localStorage", error);
      return [];
    }
  }, []);

  const saveStoredUsers = useCallback((users: StoredUser[]) => {
    localStorage.setItem(ALL_USERS_STORAGE_KEY, JSON.stringify(users));
  }, []);

  const signup = useCallback((username: string, mockPasswordNew: string, role: UserRole) => {
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

    const isManager = role === 'manager';
    const isCustomer = role === 'customer';
    const autoApproved = isManager || isCustomer;

    const newUser: StoredUser = {
      id: Date.now().toString(),
      name: username,
      role,
      mockPassword: mockPasswordNew,
      isApproved: autoApproved,
    };
    allUsers.push(newUser);
    saveStoredUsers(allUsers);

    if (autoApproved) {
      const userToSet: User = { id: newUser.id, name: newUser.name, role: newUser.role, isApproved: newUser.isApproved };
      setUser(userToSet); // Auto-login for manager and customer
      localStorage.setItem(CURRENT_USER_STORAGE_KEY, JSON.stringify(userToSet));
      toast({ title: "Sign Up Successful!", description: `Welcome, ${username}! Your ${role} account is approved and you are now logged in.` });
    } else { // Supplier or Transporter
      toast({ title: "Sign Up Successful!", description: `Account for ${username} (${role}) created. Awaiting manager approval.` });
    }
  }, [getStoredUsers, saveStoredUsers, toast]);

  const login = useCallback((username: string, mockPasswordAttempt: string) => {
     if (!username || !mockPasswordAttempt) {
      toast({ title: "Login Error", description: "Username and password are required.", variant: "destructive" });
      return;
    }
    const allUsers = getStoredUsers();
    const foundUser = allUsers.find(u => u.name.toLowerCase() === username.toLowerCase());

    if (foundUser && foundUser.mockPassword === mockPasswordAttempt) {
      if ((foundUser.role === 'supplier' || foundUser.role === 'transporter') && !foundUser.isApproved) {
        toast({ title: "Login Failed", description: "Your account as a " + foundUser.role + " is awaiting manager approval.", variant: "destructive" });
        return;
      }
      const userToSet: User = { id: foundUser.id, name: foundUser.name, role: foundUser.role, isApproved: foundUser.isApproved };
      setUser(userToSet);
      localStorage.setItem(CURRENT_USER_STORAGE_KEY, JSON.stringify(userToSet));
      toast({ title: "Login Successful!", description: `Welcome back, ${username}!` });
    } else {
      toast({ title: "Login Failed", description: "Invalid username or password.", variant: "destructive" });
    }
  }, [getStoredUsers, toast]);

  const logout = useCallback(() => {
    setUser(null);
    localStorage.removeItem(CURRENT_USER_STORAGE_KEY);
    toast({ title: "Logged Out", description: "You have been successfully logged out." });
  }, [toast]);

  const getAllUsers = useCallback((): StoredUser[] => {
    return getStoredUsers();
  }, [getStoredUsers]);

  const approveUser = useCallback((userId: string) => {
    const allUsers = getStoredUsers();
    const userIndex = allUsers.findIndex(u => u.id === userId);
    if (userIndex > -1 && (allUsers[userIndex].role === 'supplier' || allUsers[userIndex].role === 'transporter')) {
      allUsers[userIndex].isApproved = true;
      saveStoredUsers(allUsers);
      toast({ title: "User Approved", description: `User ${allUsers[userIndex].name} (${allUsers[userIndex].role}) has been approved.` });
    } else {
      toast({ title: "Error", description: "User not found or not eligible for approval.", variant: "destructive" });
    }
  }, [getStoredUsers, saveStoredUsers, toast]);


  return (
    <AuthContext.Provider value={{ user, login, signup, logout, isLoading, getAllUsers, approveUser }}>
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
