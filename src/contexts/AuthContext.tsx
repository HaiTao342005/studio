
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
import type { StoredOrder, OrderStatus } from '@/types/transaction'; // Added OrderStatus

export type UserRole = 'supplier' | 'transporter' | 'customer' | 'manager' | null;

export interface UserShippingRates {
  tier1_0_100_km_price?: number;
  tier2_101_500_km_price_per_km?: number;
  tier3_501_1000_km_price_per_km?: number;
}

export interface User {
  id: string; // Firestore document ID
  name: string;
  role: UserRole;
  isApproved: boolean;
  address?: string;
  ethereumAddress?: string;
  // For Suppliers
  averageSupplierRating?: number; // This will be the calculated weighted average
  supplierRatingCount?: number;   // Total number of ratings received
  supplierWeightedRatingSum?: number; // Sum of (rating * weight)
  supplierTotalWeights?: number;    // Sum of all weights
  // For Transporters
  averageTransporterRating?: number;
  transporterRatingCount?: number;
  isSuspended?: boolean;
  shippingRates?: UserShippingRates;
}

export interface StoredUser extends Omit<User, 'id' | 'averageSupplierRating' | 'supplierRatingCount' | 'supplierWeightedRatingSum' | 'supplierTotalWeights' | 'averageTransporterRating' | 'transporterRatingCount' | 'isSuspended' | 'shippingRates' | 'ethereumAddress'> {
  mockPassword?: string;
  address?: string;
  ethereumAddress?: string;
  isSuspended?: boolean;
  shippingRates?: UserShippingRates;
}

interface AuthContextType {
  user: User | null;
  login: (username: string, mockPasswordAttempt: string) => void;
  signup: (username: string, mockPasswordNew: string, role: UserRole) => void;
  logout: () => void;
  isLoading: boolean;
  approveUser: (userId: string) => void;
  addManager: (newManagerUsername: string, newManagerPassword: string) => Promise<boolean>;
  updateUserProfile: (userId: string, data: { address?: string; ethereumAddress?: string }) => Promise<boolean>;
  updateTransporterShippingRates: (userId: string, rates: UserShippingRates) => Promise<boolean>;
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
    const managerDocRef = doc(db, "users", DEFAULT_MANAGER_USERNAME.toLowerCase());
    const managerSnap = await getDoc(managerDocRef);

    if (!managerSnap.exists()) {
      const defaultManagerData: StoredUser = {
        name: DEFAULT_MANAGER_USERNAME,
        mockPassword: DEFAULT_MANAGER_PASSWORD,
        role: 'manager',
        isApproved: true,
        isSuspended: false,
        address: '1 Management Plaza, Admin City, AC 10001',
        ethereumAddress: '0xManagerEthAddressPlaceholder',
      };
      await setDoc(managerDocRef, defaultManagerData);
      console.log("Default manager seeded in Firestore with ID:", managerDocRef.id);
    } else {
      const managerData = managerSnap.data() as StoredUser;
      let updates: Partial<StoredUser> = {};
      if (managerData.mockPassword !== DEFAULT_MANAGER_PASSWORD) {
        updates.mockPassword = DEFAULT_MANAGER_PASSWORD;
      }
      if (!managerData.address) {
        updates.address = '1 Management Plaza, Admin City, AC 10001';
      }
       if (managerData.ethereumAddress === undefined || managerData.ethereumAddress === '') {
        updates.ethereumAddress = '0xManagerEthAddressPlaceholder';
      }
      if (managerData.isSuspended === undefined) {
        updates.isSuspended = false;
      }
      if (Object.keys(updates).length > 0) {
        await updateDoc(managerDocRef, updates);
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

    // Fetch all orders once to build purchase history.
    // This could be further optimized if performance becomes an issue for very large order sets.
    const allOrdersQuery = query(collection(db, "orders"));
    let allOrderDocsForHistory: StoredOrder[] = [];
    const customerSupplierPurchaseCount = new Map<string, Map<string, number>>();

    const fetchAllOrdersForHistory = async () => {
        const allOrdersSnap = await getDocs(allOrdersQuery);
        allOrderDocsForHistory = [];
        allOrdersSnap.forEach(doc => allOrderDocsForHistory.push({ id: doc.id, ...doc.data() } as StoredOrder));

        customerSupplierPurchaseCount.clear();
        allOrderDocsForHistory.forEach(order => {
            const countableStatuses: OrderStatus[] = ['Paid', 'Shipped', 'Delivered', 'CompletedOnChain', 'FundedOnChain', 'Awaiting Payment', 'AwaitingOnChainFunding', 'AwaitingOnChainCreation', 'Pending', 'AwaitingSupplierConfirmation'];
            if (order.customerId && order.supplierId && countableStatuses.includes(order.status) && order.status !== 'Cancelled' && order.status !== 'DisputedOnChain') {
                if (!customerSupplierPurchaseCount.has(order.customerId)) {
                    customerSupplierPurchaseCount.set(order.customerId, new Map<string, number>());
                }
                const supplierMap = customerSupplierPurchaseCount.get(order.customerId)!;
                supplierMap.set(order.supplierId, (supplierMap.get(order.supplierId) || 0) + 1);
            }
        });
    };

    const usersQuery = query(collection(db, "users"));
    const unsubscribeUsers = onSnapshot(usersQuery, async (querySnapshot) => {
      await fetchAllOrdersForHistory(); // Refresh purchase history map when users change (or for the first time)

      const baseUsers: User[] = [];
      querySnapshot.forEach((docSnapshot) => {
        const data = docSnapshot.data() as StoredUser;
        baseUsers.push({
            id: docSnapshot.id,
            name: data.name,
            role: data.role,
            isApproved: data.isApproved,
            address: data.address,
            ethereumAddress: data.ethereumAddress || '',
            isSuspended: data.isSuspended ?? false,
            shippingRates: data.shippingRates
        });
      });

      const ordersRef = collection(db, "orders");
      const assessedOrdersQuery = query(ordersRef, where("assessmentSubmitted", "==", true));
      const assessedOrdersSnap = await getDocs(assessedOrdersQuery); // This doesn't need to be onSnapshot if users snapshot triggers re-calc

      const supplierWeightedRatingSumMap: Record<string, number> = {};
      const supplierTotalWeightsMap: Record<string, number> = {};
      const supplierRatingCountMap: Record<string, number> = {};
      const transporterRatingsMap: Record<string, { total: number; count: number }> = {};


      assessedOrdersSnap.forEach(orderDoc => {
        const orderData = orderDoc.data() as StoredOrder;

        // Supplier Weighted Rating
        if (orderData.supplierId && typeof orderData.supplierRating === 'number' && orderData.customerId) {
          const purchaseCount = customerSupplierPurchaseCount.get(orderData.customerId)?.get(orderData.supplierId) || 0;
          let weight = 0.05; // Default for first time (purchaseCount is 1 for the current order being assessed)
          if (purchaseCount > 10) { // The current order is part of this count
            weight = 0.80;
          } else if (purchaseCount >= 2) { // This order makes it the 2nd to 10th
            weight = 0.15;
          }
          // else if purchaseCount is 1 (this order), weight remains 0.05

          supplierWeightedRatingSumMap[orderData.supplierId] = (supplierWeightedRatingSumMap[orderData.supplierId] || 0) + (orderData.supplierRating * weight);
          supplierTotalWeightsMap[orderData.supplierId] = (supplierTotalWeightsMap[orderData.supplierId] || 0) + weight;
          supplierRatingCountMap[orderData.supplierId] = (supplierRatingCountMap[orderData.supplierId] || 0) + 1;
        }

        // Transporter Simple Average Rating (as per current design)
        if (orderData.transporterId && typeof orderData.transporterRating === 'number') {
          transporterRatingsMap[orderData.transporterId] = transporterRatingsMap[orderData.transporterId] || { total: 0, count: 0 };
          transporterRatingsMap[orderData.transporterId].total += orderData.transporterRating;
          transporterRatingsMap[orderData.transporterId].count += 1;
        }
      });

      const enrichedUsersPromises = baseUsers.map(async (u) => {
        let userWithRatings = { ...u } as User; // Ensure type compatibility

        const sWeightedRatingSum = supplierWeightedRatingSumMap[u.id] || 0;
        const sTotalWeights = supplierTotalWeightsMap[u.id] || 0;
        const sRatingCount = supplierRatingCountMap[u.id] || 0;

        userWithRatings.supplierWeightedRatingSum = sWeightedRatingSum;
        userWithRatings.supplierTotalWeights = sTotalWeights;
        userWithRatings.averageSupplierRating = sTotalWeights > 0 ? sWeightedRatingSum / sTotalWeights : undefined;
        userWithRatings.supplierRatingCount = sRatingCount;

        const tRatingData = transporterRatingsMap[u.id];
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
            if (user?.id === u.id) {
                 toast({ title: "Account Suspended", description: `Your account has been automatically suspended due to consistently low ratings.`, variant: "destructive", duration: 10000});
            } else {
                 toast({ title: "User Suspended", description: `User ${u.name} has been automatically suspended due to consistently low ratings.`, variant: "destructive", duration: 10000});
            }
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

    // Also need a listener for assessed orders to trigger recalculation if an assessment is submitted
    // after initial load.
    const assessedOrdersListenerQuery = query(collection(db, "orders"), where("assessmentSubmitted", "==", true));
    const unsubscribeAssessedOrders = onSnapshot(assessedOrdersListenerQuery, async (snapshot) => {
        if (!isLoadingUsers && allUsersList.length > 0) { // Only re-calculate if users are already loaded
            console.log("New assessment submitted, recalculating ratings...");
            // This will re-trigger the user snapshot logic by causing a state change
            // or we can explicitly call a recalculation function.
            // For simplicity, we can trigger a re-fetch of users by making a superficial change
            // or better, abstract the rating calculation to a function and call it.
            // Let's try to simulate a re-evaluation for now, by just re-setting a dummy state,
            // or more cleanly, re-fetch users or re-run parts of the user snapshot logic.
            // The most robust way is to re-trigger the main effect or parts of it.
            // For now, the user snapshot will run if any user doc changes.
            // If only an order changes (new assessment), the user snapshot might not rerun.
            // So, it's better to make the rating calculation part of the assessedOrders listener too.
            // OR, have the assessment submission trigger a refresh of the user data.

            // For now, let's assume the user snapshot will handle it, or make it more explicit.
            // A simpler approach: if the user list exists, simulate a usersQuery snapshot to re-run its logic.
            // This is a bit hacky. Better would be to lift rating calc into a shared func.
            // For now, let's rely on the fact that changing an order for assessment
            // will likely make the UI re-render and if `user` object changes, things refresh.
            // This part might need further refinement if ratings don't update immediately after assessment.
            // The most direct way is to re-run the user enrichment logic here.
             await fetchAllOrdersForHistory(); // Re-fetch order history
             // Re-process baseUsers with new ratings
             const baseUsers = [...allUsersList]; // Use a copy of the current user list

             const assessedOrdersSnap = await getDocs(assessedOrdersQuery); // Re-fetch assessed orders

             const supplierWeightedRatingSumMap: Record<string, number> = {};
             const supplierTotalWeightsMap: Record<string, number> = {};
             const supplierRatingCountMap: Record<string, number> = {};
             const transporterRatingsMap: Record<string, { total: number; count: number }> = {};

             assessedOrdersSnap.forEach(orderDoc => {
                const orderData = orderDoc.data() as StoredOrder;
                if (orderData.supplierId && typeof orderData.supplierRating === 'number' && orderData.customerId) {
                  const purchaseCount = customerSupplierPurchaseCount.get(orderData.customerId)?.get(orderData.supplierId) || 0;
                  let weight = 0.05;
                  if (purchaseCount > 10) weight = 0.80;
                  else if (purchaseCount >= 2) weight = 0.15;
                  supplierWeightedRatingSumMap[orderData.supplierId] = (supplierWeightedRatingSumMap[orderData.supplierId] || 0) + (orderData.supplierRating * weight);
                  supplierTotalWeightsMap[orderData.supplierId] = (supplierTotalWeightsMap[orderData.supplierId] || 0) + weight;
                  supplierRatingCountMap[orderData.supplierId] = (supplierRatingCountMap[orderData.supplierId] || 0) + 1;
                }
                if (orderData.transporterId && typeof orderData.transporterRating === 'number') {
                  transporterRatingsMap[orderData.transporterId] = transporterRatingsMap[orderData.transporterId] || { total: 0, count: 0 };
                  transporterRatingsMap[orderData.transporterId].total += orderData.transporterRating;
                  transporterRatingsMap[orderData.transporterId].count += 1;
                }
              });

              const reEnrichedUsersPromises = baseUsers.map(async (u) => {
                let userWithRatings = { ...u };
                const sWeightedRatingSum = supplierWeightedRatingSumMap[u.id] || 0;
                const sTotalWeights = supplierTotalWeightsMap[u.id] || 0;
                const sRatingCount = supplierRatingCountMap[u.id] || 0;
                userWithRatings.supplierWeightedRatingSum = sWeightedRatingSum;
                userWithRatings.supplierTotalWeights = sTotalWeights;
                userWithRatings.averageSupplierRating = sTotalWeights > 0 ? sWeightedRatingSum / sTotalWeights : undefined;
                userWithRatings.supplierRatingCount = sRatingCount;

                const tRatingData = transporterRatingsMap[u.id];
                userWithRatings.averageTransporterRating = tRatingData && tRatingData.count > 0 ? tRatingData.total / tRatingData.count : undefined;
                userWithRatings.transporterRatingCount = tRatingData ? tRatingData.count : 0;
                // Suspension logic remains the same
                return userWithRatings;
              });
              const reEnrichedUsers = await Promise.all(reEnrichedUsersPromises);
              setAllUsersList(reEnrichedUsers);
              if (user) {
                const updatedCurrentUser = reEnrichedUsers.find(ru => ru.id === user.id);
                if (updatedCurrentUser) {
                    setUser(updatedCurrentUser);
                    localStorage.setItem(CURRENT_USER_STORAGE_KEY, JSON.stringify(updatedCurrentUser));
                }
              }
        }
    });


    return () => {
      unsubscribeUsers();
      unsubscribeAssessedOrders();
    };
  }, [seedDefaultManager, toast, logoutCallback, user?.id, isLoadingUsers]); // Added isLoadingUsers to dependencies to ensure rating calc runs after users are loaded


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
    const userDocId = username.toLowerCase();
    const userDocRef = doc(db, "users", userDocId);
    const userDocSnap = await getDoc(userDocRef);


    if (userDocSnap.exists()) {
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
      isSuspended: false,
      address: '',
      ethereumAddress: '',
      shippingRates: role === 'transporter' ? { tier1_0_100_km_price: 0, tier2_101_500_km_price_per_km: 0, tier3_501_1000_km_price_per_km: 0} : undefined,
    };

    try {
      await setDoc(userDocRef, newUserFirestoreData);
      const newUser: User = {
        id: userDocRef.id,
        name: newUserFirestoreData.name,
        role: newUserFirestoreData.role,
        isApproved: newUserFirestoreData.isApproved,
        isSuspended: newUserFirestoreData.isSuspended,
        address: newUserFirestoreData.address,
        ethereumAddress: newUserFirestoreData.ethereumAddress,
        shippingRates: newUserFirestoreData.shippingRates,
        // Initial rating fields
        supplierWeightedRatingSum: 0,
        supplierTotalWeights: 0,
        supplierRatingCount: 0,
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

    const userDocId = username.toLowerCase();
    const potentialUser = allUsersList.find(u => u.id === userDocId || u.name.toLowerCase() === userDocId);

    if (potentialUser) {
        const userRef = doc(db, "users", potentialUser.id);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
            const storedUserDocData = userSnap.data() as StoredUser;
            if (storedUserDocData.mockPassword === mockPasswordAttempt) {
                if (potentialUser.isSuspended) {
                    toast({ title: "Account Suspended", description: "Your account has been suspended due to low ratings. Please contact support.", variant: "destructive", duration: 10000 });
                    setUser(null);
                    localStorage.removeItem(CURRENT_USER_STORAGE_KEY);
                } else if ((potentialUser.role === 'supplier' || potentialUser.role === 'transporter') && !potentialUser.isApproved) {
                    toast({ title: "Login Blocked", description: "Your account as a " + potentialUser.role + " is awaiting manager approval.", variant: "destructive", duration: 7000 });
                    setUser(null);
                    localStorage.removeItem(CURRENT_USER_STORAGE_KEY);
                } else {
                    setUser(potentialUser); // potentialUser already has rating data from allUsersList
                    localStorage.setItem(CURRENT_USER_STORAGE_KEY, JSON.stringify(potentialUser));
                    toast({ title: "Login Successful!", description: `Welcome back, ${potentialUser.name}!` });
                }
            } else {
                 toast({ title: "Login Failed", description: "Invalid username or password.", variant: "destructive" });
            }
        } else {
            toast({ title: "Login Failed", description: "User data not found.", variant: "destructive" });
        }
    } else {
        const usersRef = collection(db, "users");
        const q = query(usersRef, where("name", "==", username));
        try {
            const querySnapshot = await getDocs(q);
            if (querySnapshot.empty) {
                toast({ title: "Login Failed", description: "Invalid username or password (query).", variant: "destructive" });
                setIsLoading(false);
                return;
            }
            const userDocFromQuery = querySnapshot.docs[0];
            const userDataFromDB = userDocFromQuery.data() as StoredUser;

            if (userDataFromDB.mockPassword === mockPasswordAttempt) {
                const loggedInUserEnriched = allUsersList.find(u => u.id === userDocFromQuery.id) || {
                    id: userDocFromQuery.id,
                    name: userDataFromDB.name,
                    role: userDataFromDB.role,
                    isApproved: userDataFromDB.isApproved,
                    isSuspended: userDataFromDB.isSuspended ?? false,
                    address: userDataFromDB.address || '',
                    ethereumAddress: userDataFromDB.ethereumAddress || '',
                    shippingRates: userDataFromDB.shippingRates,
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
                    toast({ title: "Login Successful!", description: `Welcome back, ${loggedInUserEnriched.name}!` });
                }
            } else {
                toast({ title: "Login Failed", description: "Invalid username or password (pass mismatch).", variant: "destructive" });
            }
        } catch (error) {
            console.error("Error during login query: ", error);
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

    const managerDocId = newManagerUsername.toLowerCase();
    const managerDocRef = doc(db, "users", managerDocId);
    const managerDocSnap = await getDoc(managerDocRef);

    if (managerDocSnap.exists()) {
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
      ethereumAddress: `0xNewManager${Date.now().toString(16)}`,
    };
    try {
      await setDoc(managerDocRef, newManagerData);
      toast({ title: "Manager Created", description: `Manager account for ${newManagerUsername} created successfully.` });
      return true;
    } catch (error) {
      console.error("Error creating new manager: ", error);
      toast({ title: "Creation Error", description: "Could not create manager account.", variant: "destructive"});
      return false;
    }
  }, [user, toast]);

  const updateUserProfile = useCallback(async (userId: string, data: { address?: string; ethereumAddress?: string }): Promise<boolean> => {
    if (!user || user.id !== userId) {
        toast({ title: "Permission Denied", description: "You can only update your own profile.", variant: "destructive" });
        return false;
    }
    const userDocRef = doc(db, "users", userId);
    try {
        const updatePayload: Partial<StoredUser> = {};
        if (data.address !== undefined) {
            updatePayload.address = data.address.trim();
        }
        if (data.ethereumAddress !== undefined) {
            updatePayload.ethereumAddress = data.ethereumAddress.trim();
        }

        if (Object.keys(updatePayload).length === 0) {
            toast({ title: "No Changes", description: "No new information to save."});
            return true;
        }

        await updateDoc(userDocRef, updatePayload);

        const updatedUserForState = {
            ...user,
            ...(updatePayload.address !== undefined && { address: updatePayload.address }),
            ...(updatePayload.ethereumAddress !== undefined && { ethereumAddress: updatePayload.ethereumAddress })
        };
        setUser(updatedUserForState);
        localStorage.setItem(CURRENT_USER_STORAGE_KEY, JSON.stringify(updatedUserForState));
        setAllUsersList(prevList => prevList.map(u => u.id === userId ? { ...u, ...updatedUserForState} : u));


        toast({ title: "Profile Updated", description: "Your profile information has been successfully updated." });
        return true;
    } catch (error) {
        console.error("Error updating user profile:", error);
        toast({ title: "Update Error", description: "Could not update your profile.", variant: "destructive"});
        return false;
    }
  }, [user, toast]);

  const updateTransporterShippingRates = useCallback(async (userId: string, rates: UserShippingRates): Promise<boolean> => {
    if (!user || user.id !== userId || user.role !== 'transporter') {
      toast({ title: "Permission Denied", description: "You can only update your own shipping rates.", variant: "destructive"});
      return false;
    }
    const userDocRef = doc(db, "users", userId);
    try {
      await updateDoc(userDocRef, { shippingRates: rates });
      const updatedUserForState = { ...user, shippingRates: rates };
      setUser(updatedUserForState);
      localStorage.setItem(CURRENT_USER_STORAGE_KEY, JSON.stringify(updatedUserForState));
      setAllUsersList(prevList => prevList.map(u => u.id === userId ? { ...u, shippingRates: rates } : u));

      toast({ title: "Shipping Rates Updated", description: "Your shipping rates have been successfully updated."});
      return true;
    } catch (error) {
      console.error("Error updating shipping rates: ", error);
      toast({ title: "Update Error", description: "Could not update shipping rates.", variant: "destructive"});
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
      updateUserProfile,
      updateTransporterShippingRates,
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

