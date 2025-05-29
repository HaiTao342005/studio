
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
const DEFAULT_MANAGER_USERNAME = 'manager';
const DEFAULT_MANAGER_PASSWORD = 'password';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const getStoredUsers = useCallback((): StoredUser[] => {
    try {
      const usersString = localStorage.getItem(ALL_USERS_STORAGE_KEY);
      let users: StoredUser[] = usersString ? JSON.parse(usersString) : [];
      
      // Ensure a default manager account exists
      const managerExists = users.some(u => u.role === 'manager' && u.name === DEFAULT_MANAGER_USERNAME);
      if (!managerExists) {
        const defaultManager: StoredUser = {
          id: 'default-manager-001', // Static ID for the default manager
          name: DEFAULT_MANAGER_USERNAME,
          mockPassword: DEFAULT_MANAGER_PASSWORD,
          role: 'manager',
          isApproved: true,
        };
        users.push(defaultManager);
        localStorage.setItem(ALL_USERS_STORAGE_KEY, JSON.stringify(users)); // Save back if modified
      }
      return users;
    } catch (error) {
      console.error("Failed to parse or seed users from localStorage", error);
      // Attempt to clear corrupted data and re-seed
      localStorage.removeItem(ALL_USERS_STORAGE_KEY);
      const defaultManager: StoredUser = {
          id: 'default-manager-001',
          name: DEFAULT_MANAGER_USERNAME,
          mockPassword: DEFAULT_MANAGER_PASSWORD,
          role: 'manager',
          isApproved: true,
        };
      localStorage.setItem(ALL_USERS_STORAGE_KEY, JSON.stringify([defaultManager]));
      return [defaultManager];
    }
  }, []);

  useEffect(() => {
    try {
      const storedCurrentUser = localStorage.getItem(CURRENT_USER_STORAGE_KEY);
      if (storedCurrentUser) {
        setUser(JSON.parse(storedCurrentUser));
      }
      // Initialize user list and ensure manager exists (getStoredUsers handles seeding)
      getStoredUsers(); 
    } catch (error) {
      console.error("Failed to parse current user from localStorage", error);
      localStorage.removeItem(CURRENT_USER_STORAGE_KEY);
    }
    setIsLoading(false);
  }, [getStoredUsers]);


  const saveStoredUsers = useCallback((users: StoredUser[]) => {
    localStorage.setItem(ALL_USERS_STORAGE_KEY, JSON.stringify(users));
  }, []);

  const signup = useCallback((username: string, mockPasswordNew: string, role: UserRole) => {
    if (!username || !mockPasswordNew || !role || role === 'manager') { // Prevent manager signup via this form
      toast({ title: "Sign Up Error", description: "Username, password, and a valid role (Supplier, Transporter, or Customer) are required.", variant: "destructive" });
      return;
    }
    const allUsers = getStoredUsers();
    const existingUser = allUsers.find(u => u.name.toLowerCase() === username.toLowerCase());

    if (existingUser) {
      toast({ title: "Sign Up Failed", description: "Username already taken. Please choose another.", variant: "destructive" });
      return;
    }

    const isCustomer = role === 'customer';
    // Suppliers & Transporters need approval, Customers are auto-approved
    const autoApproved = isCustomer; 

    const newUser: StoredUser = {
      id: Date.now().toString(), // Simple unique ID for mock
      name: username,
      role,
      mockPassword: mockPasswordNew,
      isApproved: autoApproved,
    };
    allUsers.push(newUser);
    saveStoredUsers(allUsers);

    if (autoApproved) { // Only customers are auto-approved and logged in here
      const userToSet: User = { id: newUser.id, name: newUser.name, role: newUser.role, isApproved: newUser.isApproved };
      setUser(userToSet); 
      localStorage.setItem(CURRENT_USER_STORAGE_KEY, JSON.stringify(userToSet));
      toast({ title: "Sign Up Successful!", description: `Welcome, ${username}! Your ${role} account is active and you are now logged in.` });
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
        setUser(null); // Ensure user is not set if approval is pending
        localStorage.removeItem(CURRENT_USER_STORAGE_KEY);
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
       // Force re-render or update relevant components if needed.
       // For this mock system, a page refresh on the approvals page might be simplest
       // or trigger a state update that causes a re-fetch/re-filter of users.
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
