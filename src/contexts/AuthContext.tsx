
"use client";

import type { ReactNode} from 'react';
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase/config'; // Import Firestore instance
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
}

// StoredUser now represents the structure in Firestore
export interface StoredUser extends Omit<User, 'id'> { // id will be the doc id
  mockPassword?: string; // For mock auth; in real app, use Firebase Auth
}

interface AuthContextType {
  user: User | null;
  login: (username: string, mockPasswordAttempt: string) => void;
  signup: (username: string, mockPasswordNew: string, role: UserRole) => void;
  logout: () => void;
  isLoading: boolean;
  getAllUsers: () => StoredUser[]; // This might become async or rely on a listener
  approveUser: (userId: string) => void;
  addManager: (newManagerUsername: string, newManagerPassword: string) => Promise<boolean>; 
  // User list for real-time updates
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
    const qManager = query(usersRef, where("role", "==", "manager"));
    const managerSnap = await getDocs(qManager);

    let defaultManagerExists = false;
    managerSnap.forEach(doc => {
      if (doc.data().name === DEFAULT_MANAGER_USERNAME) {
        defaultManagerExists = true;
        // Ensure password is correct if manager exists (for mock system)
        if (doc.data().mockPassword !== DEFAULT_MANAGER_PASSWORD) {
          updateDoc(doc.ref, { mockPassword: DEFAULT_MANAGER_PASSWORD });
        }
      }
    });

    if (!defaultManagerExists) {
      // Check if a user with "Nhom1" already exists (maybe as non-manager)
      const qSpecificUser = query(usersRef, where("name", "==", DEFAULT_MANAGER_USERNAME));
      const specificUserSnap = await getDocs(qSpecificUser);

      if (specificUserSnap.empty) {
        const defaultManagerData: StoredUser = {
          name: DEFAULT_MANAGER_USERNAME,
          mockPassword: DEFAULT_MANAGER_PASSWORD,
          role: 'manager',
          isApproved: true,
        };
        // Use username as doc ID for predictable default manager ID
        const managerDocRef = doc(db, "users", DEFAULT_MANAGER_USERNAME.toLowerCase());
        await setDoc(managerDocRef, defaultManagerData);
        console.log("Default manager seeded in Firestore.");
      } else {
         // If user Nhom1 exists but isn't manager, or password wrong, update it.
         const existingDoc = specificUserSnap.docs[0];
         await updateDoc(existingDoc.ref, {
           role: 'manager',
           isApproved: true,
           mockPassword: DEFAULT_MANAGER_PASSWORD,
         });
         console.log("Updated existing Nhom1 user to be default manager.");
      }
    }
  }, []);

  // Initial load: Check localStorage for current user, seed manager, setup Firestore listener for all users
  useEffect(() => {
    setIsLoading(true);
    try {
      const storedCurrentUser = localStorage.getItem(CURRENT_USER_STORAGE_KEY);
      if (storedCurrentUser) {
        setUser(JSON.parse(storedCurrentUser));
      }
    } catch (error) {
      console.error("Failed to parse current user from localStorage", error);
      localStorage.removeItem(CURRENT_USER_STORAGE_KEY);
    }
    
    seedDefaultManager().then(() => {
      setIsLoading(false); // Manager seeding complete
    });

    // Real-time listener for all users
    const usersQuery = query(collection(db, "users"));
    const unsubscribe = onSnapshot(usersQuery, (querySnapshot) => {
      const users: User[] = [];
      querySnapshot.forEach((doc) => {
        users.push({ id: doc.id, ...(doc.data() as Omit<StoredUser, 'id'>) });
      });
      setAllUsersList(users);
      setIsLoadingUsers(false);
    }, (error) => {
      console.error("Error fetching users from Firestore:", error);
      toast({ title: "Error Loading Users", description: error.message, variant: "destructive"});
      setIsLoadingUsers(false);
    });

    return () => unsubscribe(); // Cleanup listener

  }, [seedDefaultManager, toast]);


  const signup = useCallback(async (username: string, mockPasswordNew: string, role: UserRole) => {
    if (!username || !mockPasswordNew || !role) {
      toast({ title: "Sign Up Error", description: "Username, password, and role are required.", variant: "destructive" });
      return;
    }
    if (role === 'manager') {
        toast({ title: "Sign Up Error", description: "Manager accounts are pre-configured. Please sign in or contact an admin.", variant: "destructive" });
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

    const isSupplierOrTransporter = role === 'supplier' || role === 'transporter';
    const isCustomer = role === 'customer';
    
    const newUserFirestoreData: StoredUser = {
      name: username,
      role,
      mockPassword: mockPasswordNew, // Storing mock password for this demo
      isApproved: isCustomer, // Customers auto-approved, S/T need approval
    };

    try {
      const docRef = await addDoc(usersRef, newUserFirestoreData);
      const newUser: User = { id: docRef.id, ...newUserFirestoreData };
      
      if (isCustomer) { // Auto-login customer
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
    // Firestore queries are case-sensitive. For case-insensitive, you'd store a normalized field (e.g., lowercase username)
    // For this mock, we'll assume exact match or handle it by fetching and filtering client-side (less ideal for large datasets)
    // Here, let's query by exact username for simplicity.
    const q = query(usersRef, where("name", "==", username));
    
    try {
      const querySnapshot = await getDocs(q);
      if (querySnapshot.empty) {
        toast({ title: "Login Failed", description: "Invalid username or password.", variant: "destructive" });
        setIsLoading(false);
        return;
      }

      const userDoc = querySnapshot.docs[0]; // Assuming username is unique
      const userData = userDoc.data() as StoredUser;

      if (userData.mockPassword === mockPasswordAttempt) {
        const loggedInUser: User = { id: userDoc.id, name: userData.name, role: userData.role, isApproved: userData.isApproved };
        
        if ((loggedInUser.role === 'supplier' || loggedInUser.role === 'transporter') && !loggedInUser.isApproved) {
          toast({ title: "Login Blocked", description: "Your account as a " + loggedInUser.role + " is awaiting manager approval.", variant: "destructive" });
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

  // This is now fulfilled by allUsersList and isLoadingUsers from the onSnapshot listener
  const getAllUsers = useCallback((): User[] => {
    return allUsersList;
  }, [allUsersList]);

  const approveUser = useCallback(async (userId: string) => {
    if (user?.role !== 'manager') {
      toast({ title: "Permission Denied", description: "Only managers can approve users.", variant: "destructive" });
      return;
    }
    const userDocRef = doc(db, "users", userId);
    try {
      await updateDoc(userDocRef, { isApproved: true });
      // The real-time listener will update allUsersList, triggering UI refresh.
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
      isApproved: true, // Managers are auto-approved
    };
    try {
      // Use username as doc ID for new managers created by existing manager for predictability, if desired
      // Or let Firestore auto-generate ID with addDoc
      const managerDocRef = doc(db, "users", newManagerUsername.toLowerCase());
      await setDoc(managerDocRef, newManagerData);
      // Real-time listener will update allUsersList
      toast({ title: "Manager Created", description: `Manager account for ${newManagerUsername} created successfully.` });
      return true;
    } catch (error) {
      console.error("Error creating new manager: ", error);
      toast({ title: "Creation Error", description: "Could not create manager account.", variant: "destructive"});
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
      getAllUsers, // Kept for components that might call it, though allUsersList is preferred for real-time
      approveUser, 
      addManager,
      allUsersList, // Provide the real-time list
      isLoadingUsers // And its loading state
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

    