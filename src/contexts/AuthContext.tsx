
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
import type { StoredOrder } from '@/types/transaction';

export type UserRole = 'supplier' | 'transporter' | 'customer' | 'manager' | null;

export interface User {
  id: string; // Firestore document ID
  name: string;
  role: UserRole;
  isApproved: boolean;
  address?: string;
  averageSupplierRating?: number;
  supplierRatingCount?: number;
  averageTransporterRating?: number;
  transporterRatingCount?: number;
  isSuspended?: boolean; // New field
}

export interface StoredUser extends Omit<User, 'id' | 'averageSupplierRating' | 'supplierRatingCount' | 'averageTransporterRating' | 'transporterRatingCount' | 'isSuspended'> {
  mockPassword?: string;
  address?: string;
  isSuspended?: boolean; // New field
}

interface AuthContextType {
  user: User | null;
  login: (username: string, mockPasswordAttempt: string) => void;
  signup: (username: string, mockPasswordNew: string, role: UserRole) => void;
  logout: () => void;
  isLoading: boolean;
  approveUser: (userId: string) => void;
  addManager: (newManagerUsername: string, newManagerPassword: string) => Promise<boolean>;
  updateUserAddress: (userId: string, address: string) => Promise<boolean>;
  allUsersList: User[];
  isLoadingUsers: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const CURRENT_USER_STORAGE_KEY = 'fruitflow-currentUser';
const DEFAULT_MANAGER_USERNAME = 'Nhom1';
const DEFAULT_MANAGER_PASSWORD = '123';
const MIN_RATINGS_FOR_SUSPENSION = 10;
const RATING_THRESHOLD_FOR_SUSPENSION = 1.5;

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
        isSuspended: false,
        address: '1 Management Plaza, Admin City, AC 10001'
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
      if (managerData.isSuspended === undefined) {
        updates.isSuspended = false;
      }
      if (Object.keys(updates).length > 0) {
        await updateDoc(managerDoc.ref, updates);
        console.log("Default manager details updated in Firestore.");
      }
    }
  }, []);

  const logoutCallback = useCallback(() => {
    setUser(null);
    localStorage.removeItem(CURRENT_USER_STORAGE_KEY);
    toast({ title: "Logged Out", description: "You have been successfully logged out." });
  }, [toast]);

  useEffect(() => {
    setIsLoading(true);
    setIsLoadingUsers(true);
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

    seedDefaultManager();

    const usersQuery = query(collection(db, "users"));
    const unsubscribeUsers = onSnapshot(usersQuery, async (querySnapshot) => {
      const baseUsers: User[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data() as StoredUser;
        baseUsers.push({ 
            id: doc.id, 
            name: data.name,
            role: data.role,
            isApproved: data.isApproved,
            address: data.address,
            isSuspended: data.isSuspended ?? false 
        });
      });

      const ordersRef = collection(db, "orders");
      const assessedOrdersQuery = query(ordersRef, where("assessmentSubmitted", "==", true));
      const assessedOrdersSnap = await getDocs(assessedOrdersQuery);

      const supplierRatingsMap: Record<string, { total: number; count: number }> = {};
      const transporterRatingsMap: Record<string, { total: number; count: number }> = {};

      assessedOrdersSnap.forEach(orderDoc => {
        const orderData = orderDoc.data() as StoredOrder;
        if (orderData.supplierId && typeof orderData.supplierRating === 'number') {
          supplierRatingsMap[orderData.supplierId] = supplierRatingsMap[orderData.supplierId] || { total: 0, count: 0 };
          supplierRatingsMap[orderData.supplierId].total += orderData.supplierRating;
          supplierRatingsMap[orderData.supplierId].count += 1;
        }
        if (orderData.transporterId && typeof orderData.transporterRating === 'number') {
          transporterRatingsMap[orderData.transporterId] = transporterRatingsMap[orderData.transporterId] || { total: 0, count: 0 };
          transporterRatingsMap[orderData.transporterId].total += orderData.transporterRating;
          transporterRatingsMap[orderData.transporterId].count += 1;
        }
      });

      const enrichedUsersPromises = baseUsers.map(async (u) => {
        let userWithRatings = { ...u };
        const sRatingData = supplierRatingsMap[u.id];
        const tRatingData = transporterRatingsMap[u.id];

        userWithRatings.averageSupplierRating = sRatingData && sRatingData.count > 0 ? sRatingData.total / sRatingData.count : undefined;
        userWithRatings.supplierRatingCount = sRatingData ? sRatingData.count : 0;
        userWithRatings.averageTransporterRating = tRatingData && tRatingData.count > 0 ? tRatingData.total / tRatingData.count : undefined;
        userWithRatings.transporterRatingCount = tRatingData ? tRatingData.count : 0;
        
        let shouldSuspend = false;
        if (u.role === 'supplier' && userWithRatings.supplierRatingCount >= MIN_RATINGS_FOR_SUSPENSION && userWithRatings.averageSupplierRating !== undefined && userWithRatings.averageSupplierRating < RATING_THRESHOLD_FOR_SUSPENSION) {
          shouldSuspend = true;
        }
        if (u.role === 'transporter' && userWithRatings.transporterRatingCount >= MIN_RATINGS_FOR_SUSPENSION && userWithRatings.averageTransporterRating !== undefined && userWithRatings.averageTransporterRating < RATING_THRESHOLD_FOR_SUSPENSION) {
          shouldSuspend = true;
        }

        if (shouldSuspend && !userWithRatings.isSuspended) {
          userWithRatings.isSuspended = true;
          try {
            await updateDoc(doc(db, "users", u.id), { isSuspended: true });
            console.log(`User ${u.name} (${u.id}) automatically suspended due to low ratings.`);
            toast({ title: "Account Suspended", description: `User ${u.name} has been automatically suspended due to consistently low ratings.`, variant: "destructive", duration: 10000});
          } catch (error) {
            console.error(`Failed to update suspension status for user ${u.id}:`, error);
          }
        }
        return userWithRatings;
      });

      const enrichedUsers = await Promise.all(enrichedUsersPromises);
      setAllUsersList(enrichedUsers);
      setIsLoadingUsers(false);

      if (storedUser) {
        const latestUserData = enrichedUsers.find(u => u.id === storedUser!.id);
        if (latestUserData && JSON.stringify(latestUserData) !== JSON.stringify(storedUser)) {
          setUser(latestUserData);
          localStorage.setItem(CURRENT_USER_STORAGE_KEY, JSON.stringify(latestUserData));
        } else if (latestUserData) {
            setUser(latestUserData);
        } else {
            logoutCallback();
        }
      } else {
        setUser(null);
      }
      setIsLoading(false);
    }, (error) => {
      console.error("Error fetching users from Firestore:", error);
      toast({ title: "Error Loading Users", description: error.message, variant: "destructive"});
      setIsLoadingUsers(false);
      setIsLoading(false);
    });

    return () => {
      unsubscribeUsers();
    };
  }, [seedDefaultManager, toast, logoutCallback]);


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
      isApproved: isCustomer,
      isSuspended: false, // New users are not suspended
      address: '',
    };

    try {
      const docRef = await addDoc(usersRef, newUserFirestoreData);
      const newUser: User = { 
        id: docRef.id, 
        name: newUserFirestoreData.name,
        role: newUserFirestoreData.role,
        isApproved: newUserFirestoreData.isApproved,
        isSuspended: newUserFirestoreData.isSuspended,
        address: newUserFirestoreData.address,
      };

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
    
    const potentialUser = allUsersList.find(u => u.name === username);
    const storedUserDocData = potentialUser ? (await getDoc(doc(db, "users", potentialUser.id))).data() as StoredUser : null;

    if (potentialUser && storedUserDocData && storedUserDocData.mockPassword === mockPasswordAttempt) {
        if (potentialUser.isSuspended) {
          toast({ title: "Account Suspended", description: "Your account has been suspended due to low ratings. Please contact support.", variant: "destructive", duration: 10000 });
          setUser(null);
          localStorage.removeItem(CURRENT_USER_STORAGE_KEY);
        } else if ((potentialUser.role === 'supplier' || potentialUser.role === 'transporter') && !potentialUser.isApproved) {
          toast({ title: "Login Blocked", description: "Your account as a " + potentialUser.role + " is awaiting manager approval.", variant: "destructive", duration: 7000 });
          setUser(null);
          localStorage.removeItem(CURRENT_USER_STORAGE_KEY);
        } else {
          setUser(potentialUser); 
          localStorage.setItem(CURRENT_USER_STORAGE_KEY, JSON.stringify(potentialUser));
          toast({ title: "Login Successful!", description: `Welcome back, ${username}!` });
        }
    } else {
        // Fallback if allUsersList wasn't fully populated yet or user not found in it.
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
            const userDataFromDB = userDoc.data() as StoredUser;

            if (userDataFromDB.mockPassword === mockPasswordAttempt) {
                const loggedInUserEnriched = allUsersList.find(u => u.id === userDoc.id) || { 
                    id: userDoc.id, 
                    name: userDataFromDB.name, 
                    role: userDataFromDB.role, 
                    isApproved: userDataFromDB.isApproved, 
                    isSuspended: userDataFromDB.isSuspended ?? false,
                    address: userDataFromDB.address || '' 
                };

                if (loggedInUserEnriched.isSuspended) {
                    toast({ title: "Account Suspended", description: "Your account has been suspended due to low ratings. Please contact support.", variant: "destructive", duration: 10000 });
                    setUser(null);
                    localStorage.removeItem(CURRENT_USER_STORAGE_KEY);
                } else if ((loggedInUserEnriched.role === 'supplier' || loggedInUserEnriched.role === 'transporter') && !loggedInUserEnriched.isApproved) {
                    toast({ title: "Login Blocked", description: "Your account as a " + loggedInUserEnriched.role + " is awaiting manager approval.", variant: "destructive", duration: 7000 });
                    setUser(null);
                    localStorage.removeItem(CURRENT_USER_STORAGE_KEY);
                } else {
                    setUser(loggedInUserEnriched);
                    localStorage.setItem(CURRENT_USER_STORAGE_KEY, JSON.stringify(loggedInUserEnriched));
                    toast({ title: "Login Successful!", description: `Welcome back, ${username}!` });
                }
            } else {
                toast({ title: "Login Failed", description: "Invalid username or password.", variant: "destructive" });
            }
        } catch (error) {
            console.error("Error during login: ", error);
            toast({ title: "Login Error", description: "An error occurred. Please try again.", variant: "destructive"});
        }
    }
    setIsLoading(false);
  }, [toast, allUsersList]);


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
      isSuspended: false,
      address: '1 Admin Way, Suite M, Management City',
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
        const updatedUser = { ...user, address: address };
        setUser(updatedUser);
        localStorage.setItem(CURRENT_USER_STORAGE_KEY, JSON.stringify(updatedUser));
        
        setAllUsersList(prevList => prevList.map(u => u.id === userId ? updatedUser : u));

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
      logout: logoutCallback,
      isLoading,
      approveUser,
      addManager,
      updateUserAddress,
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

    