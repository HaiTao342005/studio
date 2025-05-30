
"use client";

import type { ReactNode} from 'react';
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase/config';
import {
  collection,
  doc,
  addDoc,
  getDocs,
  query,
  where,
  updateDoc,
  onSnapshot,
  setDoc,
  getDoc
} from 'firebase/firestore';

export type UserRole = 'supplier' | 'transporter' | 'customer' | 'manager' | null;

export interface User {
  id: string; // Firestore document ID
  name: string;
  role: UserRole;
  isApproved: boolean;
  address?: string; // New field for address
}

// StoredUser now represents the structure in Firestore
export interface StoredUser extends Omit<User, 'id'> {
  mockPassword?: string;
  address?: string; // New field for address
}

interface AuthContextType {
  user: User | null;
  login: (username: string, mockPasswordAttempt: string) => void;
  signup: (username: string, mockPasswordNew: string, role: UserRole) => void;
  logout: () => void;
  isLoading: boolean;
  approveUser: (userId: string) => void;
  addManager: (newManagerUsername: string, newManagerPassword: string) => Promise<boolean>;
  updateUserAddress: (userId: string, address: string) => Promise<boolean>; // New function
  allUsersList: User[];
  isLoadingUsers: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const CURRENT_USER_STORAGE_KEY = 'fruitflow-currentUser';
const DEFAULT_MANAGER_USERNAME = 'Nhom1';
const DEFAULT_MANAGER_PASSWORD = '123';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [allUsersList, setAllUsersList] = useState<User[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);
  const { toast } = useToast();

  const seedDefaultManager = useCallback(async () => {
    const usersRef = collection(db, "users");
    const qManager = query(usersRef, where("name", "==", DEFAULT_MANAGER_USERNAME));
    const managerSnap = await getDocs(qManager);

    if (managerSnap.empty) {
      const defaultManagerData: StoredUser = {
        name: DEFAULT_MANAGER_USERNAME,
        mockPassword: DEFAULT_MANAGER_PASSWORD,
        role: 'manager',
        isApproved: true,
        address: '1 Management Plaza, Admin City, AC 10001' // Example address
      };
      const managerDocRef = doc(db, "users", DEFAULT_MANAGER_USERNAME.toLowerCase());
      await setDoc(managerDocRef, defaultManagerData);
      console.log("Default manager seeded in Firestore.");
    } else {
      const managerDoc = managerSnap.docs[0];
      const managerData = managerDoc.data() as StoredUser;
      let updates: Partial<StoredUser> = {};
      if (managerData.mockPassword !== DEFAULT_MANAGER_PASSWORD) {
        updates.mockPassword = DEFAULT_MANAGER_PASSWORD;
      }
      if (!managerData.address) {
        updates.address = '1 Management Plaza, Admin City, AC 10001';
      }
      if (Object.keys(updates).length > 0) {
        await updateDoc(managerDoc.ref, updates);
        console.log("Default manager details updated in Firestore.");
      }
    }
  }, []);

  useEffect(() => {
    setIsLoading(true);
    let storedUser: User | null = null;
    try {
      const storedCurrentUserJson = localStorage.getItem(CURRENT_USER_STORAGE_KEY);
      if (storedCurrentUserJson) {
        storedUser = JSON.parse(storedCurrentUserJson);
      }
    } catch (error) {
      console.error("Failed to parse current user from localStorage", error);
      localStorage.removeItem(CURRENT_USER_STORAGE_KEY);
    }

    seedDefaultManager(); // Seed or update manager

    const usersQuery = query(collection(db, "users"));
    const unsubscribeUsers = onSnapshot(usersQuery, (querySnapshot) => {
      const users: User[] = [];
      querySnapshot.forEach((doc) => {
        users.push({ id: doc.id, ...(doc.data() as Omit<StoredUser, 'id'>) });
      });
      setAllUsersList(users);
      setIsLoadingUsers(false);

      // If there was a stored user, check if their details (like address) have updated in allUsersList
      // and update the local user state and localStorage if necessary.
      if (storedUser) {
        const latestUserData = users.find(u => u.id === storedUser!.id);
        if (latestUserData && JSON.stringify(latestUserData) !== JSON.stringify(storedUser)) {
          setUser(latestUserData);
          localStorage.setItem(CURRENT_USER_STORAGE_KEY, JSON.stringify(latestUserData));
        } else if (latestUserData) {
            setUser(latestUserData); // ensure user state is set if matches
        } else { // Stored user no longer exists in DB
            logout();
        }
      } else {
        setUser(null); // No stored user
      }
      setIsLoading(false); // Overall loading false after users list and potential stored user sync
    }, (error) => {
      console.error("Error fetching users from Firestore:", error);
      toast({ title: "Error Loading Users", description: error.message, variant: "destructive"});
      setIsLoadingUsers(false);
      setIsLoading(false);
    });

    return () => {
      unsubscribeUsers();
    };
  }, [seedDefaultManager, toast]);


  const signup = useCallback(async (username: string, mockPasswordNew: string, role: UserRole) => {
    if (!username || !mockPasswordNew || !role) {
      toast({ title: "Sign Up Error", description: "Username, password, and role are required.", variant: "destructive" });
      return;
    }
    if (role === 'manager') {
        toast({ title: "Sign Up Error", description: "Manager accounts are pre-configured or created by existing managers.", variant: "destructive" });
        return;
    }

    setIsLoading(true);
    const usersRef = collection(db, "users");
    const q = query(usersRef, where("name", "==", username));
    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
      toast({ title: "Sign Up Failed", description: "Username already taken. Please choose another.", variant: "destructive" });
      setIsLoading(false);
      return;
    }

    const isCustomer = role === 'customer';
    const isSupplierOrTransporter = role === 'supplier' || role === 'transporter';

    const newUserFirestoreData: StoredUser = {
      name: username,
      role,
      mockPassword: mockPasswordNew,
      isApproved: isCustomer, // Customers auto-approved
      address: '', // Initialize with empty address
    };

    try {
      const docRef = await addDoc(usersRef, newUserFirestoreData);
      const newUser: User = { id: docRef.id, ...newUserFirestoreData };

      if (isCustomer) {
        setUser(newUser);
        localStorage.setItem(CURRENT_USER_STORAGE_KEY, JSON.stringify(newUser));
        toast({ title: "Sign Up Successful!", description: `Welcome, ${username}! Your ${role} account is active and you are now logged in.` });
      } else if (isSupplierOrTransporter) {
        toast({ title: "Sign Up Successful!", description: `Account for ${username} (${role}) created. Awaiting manager approval.` });
      }
    } catch (error) {
      console.error("Error adding user to Firestore: ", error);
      toast({ title: "Sign Up Error", description: "Could not create account. Please try again.", variant: "destructive"});
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  const login = useCallback(async (username: string, mockPasswordAttempt: string) => {
     if (!username || !mockPasswordAttempt) {
      toast({ title: "Login Error", description: "Username and password are required.", variant: "destructive" });
      return;
    }
    setIsLoading(true);
    const usersRef = collection(db, "users");
    const q = query(usersRef, where("name", "==", username));

    try {
      const querySnapshot = await getDocs(q);
      if (querySnapshot.empty) {
        toast({ title: "Login Failed", description: "Invalid username or password.", variant: "destructive" });
        setIsLoading(false);
        return;
      }

      const userDoc = querySnapshot.docs[0];
      const userData = userDoc.data() as StoredUser;

      if (userData.mockPassword === mockPasswordAttempt) {
        const loggedInUser: User = { id: userDoc.id, name: userData.name, role: userData.role, isApproved: userData.isApproved, address: userData.address || '' };

        if ((loggedInUser.role === 'supplier' || loggedInUser.role === 'transporter') && !loggedInUser.isApproved) {
          toast({ title: "Login Blocked", description: "Your account as a " + loggedInUser.role + " is awaiting manager approval.", variant: "destructive", duration: 7000 });
          setUser(null);
          localStorage.removeItem(CURRENT_USER_STORAGE_KEY);
        } else {
          setUser(loggedInUser);
          localStorage.setItem(CURRENT_USER_STORAGE_KEY, JSON.stringify(loggedInUser));
          toast({ title: "Login Successful!", description: `Welcome back, ${username}!` });
        }
      } else {
        toast({ title: "Login Failed", description: "Invalid username or password.", variant: "destructive" });
      }
    } catch (error) {
      console.error("Error during login: ", error);
      toast({ title: "Login Error", description: "An error occurred. Please try again.", variant: "destructive"});
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  const logout = useCallback(() => {
    setUser(null);
    localStorage.removeItem(CURRENT_USER_STORAGE_KEY);
    toast({ title: "Logged Out", description: "You have been successfully logged out." });
  }, [toast]);

  const approveUser = useCallback(async (userId: string) => {
    if (user?.role !== 'manager') {
      toast({ title: "Permission Denied", description: "Only managers can approve users.", variant: "destructive" });
      return;
    }
    const userDocRef = doc(db, "users", userId);
    try {
      await updateDoc(userDocRef, { isApproved: true });
      toast({ title: "User Approved", description: `User has been approved.` });
    } catch (error) {
      console.error("Error approving user: ", error);
      toast({ title: "Error", description: "Could not approve user. Please try again.", variant: "destructive" });
    }
  }, [user, toast]);

  const addManager = useCallback(async (newManagerUsername: string, newManagerPassword: string): Promise<boolean> => {
    if (user?.role !== 'manager') {
        toast({ title: "Permission Denied", description: "Only managers can create new manager accounts.", variant: "destructive" });
        return false;
    }
    if (!newManagerUsername || !newManagerPassword) {
      toast({ title: "Creation Error", description: "New manager username and password are required.", variant: "destructive" });
      return false;
    }

    const usersRef = collection(db, "users");
    const q = query(usersRef, where("name", "==", newManagerUsername));
    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
      toast({ title: "Creation Failed", description: "Username already taken. Please choose another.", variant: "destructive" });
      return false;
    }

    const newManagerData: StoredUser = {
      name: newManagerUsername,
      mockPassword: newManagerPassword,
      role: 'manager',
      isApproved: true,
      address: '1 Admin Way, Suite M, Management City', // Default address for new managers
    };
    try {
      const managerDocRef = doc(db, "users", newManagerUsername.toLowerCase());
      await setDoc(managerDocRef, newManagerData);
      toast({ title: "Manager Created", description: `Manager account for ${newManagerUsername} created successfully.` });
      return true;
    } catch (error) {
      console.error("Error creating new manager: ", error);
      toast({ title: "Creation Error", description: "Could not create manager account.", variant: "destructive"});
      return false;
    }
  }, [user, toast]);

  const updateUserAddress = useCallback(async (userId: string, address: string): Promise<boolean> => {
    if (!user || user.id !== userId) {
        toast({ title: "Permission Denied", description: "You can only update your own address.", variant: "destructive" });
        return false;
    }
    const userDocRef = doc(db, "users", userId);
    try {
        await updateDoc(userDocRef, { address: address });
        // Update local user state as well so UI reflects change immediately
        setUser(prevUser => prevUser ? { ...prevUser, address: address } : null);
        // Update localStorage
        const storedUser = localStorage.getItem(CURRENT_USER_STORAGE_KEY);
        if (storedUser) {
            const parsedUser: User = JSON.parse(storedUser);
            if (parsedUser.id === userId) {
                parsedUser.address = address;
                localStorage.setItem(CURRENT_USER_STORAGE_KEY, JSON.stringify(parsedUser));
            }
        }
        toast({ title: "Address Updated", description: "Your address has been successfully updated." });
        return true;
    } catch (error) {
        console.error("Error updating user address:", error);
        toast({ title: "Update Error", description: "Could not update your address.", variant: "destructive"});
        return false;
    }
  }, [user, toast]);


  return (
    <AuthContext.Provider value={{
      user,
      login,
      signup,
      logout,
      isLoading,
      approveUser,
      addManager,
      updateUserAddress, // Add new function
      allUsersList,
      isLoadingUsers
    }}>
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

    