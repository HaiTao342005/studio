
"use client";

import type { ReactNode} from 'react';
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase/config'; // db can be null if Firebase fails to init
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
  getDoc,
  FirestoreError, // Import FirestoreError
  serverTimestamp
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
    if (!db) { 
      console.info("AuthContext: Firestore (db) is not available for seedDefaultManager. Skipping.");
      // This specific console log indicates Firebase itself (db instance) is null, likely from config.ts
      return;
    }
    const usersRef = collection(db, "users");
    const managerDocRef = doc(db, "users", DEFAULT_MANAGER_USERNAME.toLowerCase());
    
    try {
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
    } catch (error: any) {
        if (error instanceof FirestoreError && (error.code === 'unavailable' || (error.message && error.message.includes('client is offline')))) {
            console.info("AuthContext: seedDefaultManager failed as Firestore client is offline.", error.message);
            toast({ title: "Network Issue", description: "Could not connect to Firebase to verify manager data. Some functions may be limited.", variant: "destructive", duration: 7000});
        } else {
            console.error("Error in seedDefaultManager (likely Firestore operation issue):", error); 
            let description = "Could not verify default manager data. Please check your Firebase project console for issues with Firestore (e.g., database creation, rules, or billing).";
            if (error.message) {
                description += ` Error: ${error.message}`;
            }
            if (error.code) {
                description += ` Code: ${error.code}`;
            }
            toast({ 
                title: "Setup Error", 
                description: description, 
                variant: "destructive",
                duration: 10000 
            });
        }
    }
  }, [toast]);

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

    const customerSupplierPurchaseCount = new Map<string, Map<string, number>>();

    const fetchAllOrdersForHistory = async () => {
      if (!db) {
          console.info("AuthContext: Firestore (db) not available for fetchAllOrdersForHistory. Skipping.");
          return;
      }
      const allOrdersQuery = query(collection(db, "orders"));
      let allOrderDocsForHistory: StoredOrder[] = [];
      try {
        const allOrdersSnap = await getDocs(allOrdersQuery);
        allOrderDocsForHistory = [];
        allOrdersSnap.forEach(doc => allOrderDocsForHistory.push({ id: doc.id, ...doc.data() } as StoredOrder));

        customerSupplierPurchaseCount.clear();
        allOrderDocsForHistory.forEach(order => {
            const countableStatuses: OrderStatus[] = ['Paid', 'Shipped', 'Delivered', 'CompletedOnChain', 'FundedOnChain', 'Awaiting Payment', 'AwaitingOnChainFunding', 'AwaitingOnChainCreation', 'Pending', 'Awaiting Supplier Confirmation'];
            if (order.customerId && order.supplierId && countableStatuses.includes(order.status) && order.status !== 'Cancelled' && order.status !== 'DisputedOnChain') {
                if (!customerSupplierPurchaseCount.has(order.customerId)) {
                    customerSupplierPurchaseCount.set(order.customerId, new Map<string, number>());
                }
                const supplierMap = customerSupplierPurchaseCount.get(order.customerId)!;
                supplierMap.set(order.supplierId, (supplierMap.get(order.supplierId) || 0) + 1);
            }
        });
      } catch (error: any) {
        if (error instanceof FirestoreError && (error.code === 'unavailable' || (error.message && error.message.includes('client is offline')))) {
            console.info("AuthContext: fetchAllOrdersForHistory failed as Firestore client is offline.", error.message);
            toast({ title: "Network Issue", description: "Could not fetch order history for rating calculation. Firebase is offline.", variant: "destructive", duration: 7000});
        } else {
            console.error("Error in fetchAllOrdersForHistory:", error);
            toast({ title: "Order History Error", description: "Could not fetch order history for rating calculation.", variant: "destructive"});
        }
        allOrderDocsForHistory = []; 
        customerSupplierPurchaseCount.clear(); 
      }
    };


    const initializeAuthContext = async () => {
        if (!db) {
          console.error("AuthContext Critical Error: Firestore (db) instance is not available. This likely means Firebase failed to initialize in firebase/config.ts, possibly due to invalid hardcoded configuration or network issues preventing SDK load. Firebase-dependent features will not work.");
          toast({
            title: "Firebase Unavailable",
            description: "The application cannot connect to Firebase. Core features will be unavailable. Please check console and Firebase configuration.",
            variant: "destructive",
            duration: 0, 
          });
          setIsLoading(false);
          setIsLoadingUsers(false);
          setUser(null); 
          localStorage.removeItem(CURRENT_USER_STORAGE_KEY); 
          return () => {}; 
        }

        try {
            await seedDefaultManager(); 

            const usersQuery = query(collection(db, "users"));
            const unsubscribeUsers = onSnapshot(usersQuery, async (querySnapshot) => {
              try {
                await fetchAllOrdersForHistory(); 

                const baseUsers: User[] = [];
                querySnapshot.forEach((docSnapshot) => {
                  const data = docSnapshot.data() as StoredUser;
                  baseUsers.push({
                      id: docSnapshot.id, name: data.name, role: data.role, isApproved: data.isApproved,
                      address: data.address, ethereumAddress: data.ethereumAddress || '',
                      isSuspended: data.isSuspended ?? false, shippingRates: data.shippingRates
                  });
                });

                const ordersRef = collection(db, "orders");
                const assessedOrdersQueryForThisSnapshot = query(ordersRef, where("assessmentSubmitted", "==", true));
                const assessedOrdersSnap = await getDocs(assessedOrdersQueryForThisSnapshot);

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

                const enrichedUsersPromises = baseUsers.map(async (u) => {
                  let userWithRatings = { ...u } as User;
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
                  if (u.role === 'supplier' && userWithRatings.supplierRatingCount >= MIN_RATINGS_FOR_SUSPENSION && userWithRatings.averageSupplierRating !== undefined && userWithRatings.averageSupplierRating < RATING_THRESHOLD_FOR_SUSPENSION) shouldSuspend = true;
                  if (u.role === 'transporter' && userWithRatings.transporterRatingCount >= MIN_RATINGS_FOR_SUSPENSION && userWithRatings.averageTransporterRating !== undefined && userWithRatings.averageTransporterRating < RATING_THRESHOLD_FOR_SUSPENSION) shouldSuspend = true;
                  
                  if (shouldSuspend && !userWithRatings.isSuspended) {
                    userWithRatings.isSuspended = true;
                    try {
                      await updateDoc(doc(db, "users", u.id), { isSuspended: true });
                      console.log(`User ${u.name} (${u.id}) automatically suspended due to low ratings.`);
                      toast({ title: user?.id === u.id ? "Account Suspended" : "User Suspended", description: `${user?.id === u.id ? 'Your account has' : `User ${u.name} has`} been automatically suspended due to consistently low ratings.`, variant: "destructive", duration: 10000});
                    } catch (suspendError) { console.error(`Failed to update suspension for user ${u.id}:`, suspendError); }
                  }
                  return userWithRatings;
                });

                const enrichedUsers = await Promise.all(enrichedUsersPromises);
                setAllUsersList(enrichedUsers);

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
              } catch (innerError: any) {
                 if (innerError instanceof FirestoreError && (innerError.code === 'unavailable' || (innerError.message && innerError.message.includes('client is offline')))) {
                    console.info("AuthContext: User data snapshot processing failed as Firestore client is offline.", innerError.message);
                    toast({ title: "Network Issue", description: "Could not update user data. Firebase is offline.", variant: "destructive", duration: 7000});
                } else {
                    console.error("Error processing user data snapshot:", innerError);
                    toast({ title: "Data Processing Error", description: "Failed to process user data.", variant: "destructive" });
                }
                if (!storedUser) setUser(null);
              } finally {
                setIsLoadingUsers(false);
                setIsLoading(false); 
              }
            }, (error) => {
              if (error instanceof FirestoreError && (error.code === 'unavailable' || (error.message && error.message.includes('client is offline')))) {
                console.info("AuthContext: onSnapshot listener for users failed as Firestore client is offline.", error.message);
                toast({ title: "Network Issue", description: "Could not connect to Firebase for live user updates. Some functions may be limited.", variant: "destructive", duration: 10000});
              } else {
                console.error("Error fetching users from Firestore (onSnapshot):", error);
                toast({ title: "Error Loading Users", description: error.message, variant: "destructive"});
              }
              setIsLoadingUsers(false);
              setIsLoading(false);
            });

            const assessedOrdersListenerQuery = query(collection(db, "orders"), where("assessmentSubmitted", "==", true));
            const unsubscribeAssessedOrders = onSnapshot(assessedOrdersListenerQuery, async (snapshot) => {
              try {
                if (allUsersList.length > 0) { 
                    console.log("Assessment update detected, recalculating ratings...");
                    await fetchAllOrdersForHistory(); 
                    const baseUsersForAssessmentUpdate = [...allUsersList]; 

                    const supplierWeightedRatingSumMap: Record<string, number> = {};
                    const supplierTotalWeightsMap: Record<string, number> = {};
                    const supplierRatingCountMap: Record<string, number> = {};
                    const transporterRatingsMap: Record<string, { total: number; count: number }> = {};

                    snapshot.forEach(orderDoc => {
                      const orderData = orderDoc.data() as StoredOrder;
                      if (orderData.supplierId && typeof orderData.supplierRating === 'number' && orderData.customerId) {
                        const purchaseCount = customerSupplierPurchaseCount.get(orderData.customerId)?.get(orderData.supplierId) || 0;
                        let weight = 0.05;
                        if (purchaseCount > 10) weight = 0.80; else if (purchaseCount >= 2) weight = 0.15;
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

                    const reEnrichedUsersPromises = baseUsersForAssessmentUpdate.map(async (u) => {
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
                      
                      let shouldSuspend = false;
                      if (userWithRatings.role === 'supplier' && userWithRatings.supplierRatingCount >= MIN_RATINGS_FOR_SUSPENSION && userWithRatings.averageSupplierRating !== undefined && userWithRatings.averageSupplierRating < RATING_THRESHOLD_FOR_SUSPENSION) shouldSuspend = true;
                      if (userWithRatings.role === 'transporter' && userWithRatings.transporterRatingCount >= MIN_RATINGS_FOR_SUSPENSION && userWithRatings.averageTransporterRating !== undefined && userWithRatings.averageTransporterRating < RATING_THRESHOLD_FOR_SUSPENSION) shouldSuspend = true;
                      
                      if (shouldSuspend && !userWithRatings.isSuspended) {
                        userWithRatings.isSuspended = true;
                        try {
                           await updateDoc(doc(db, "users", u.id), { isSuspended: true });
                           console.log(`User ${u.name} (${u.id}) automatically suspended (assessment listener).`);
                           toast({ title: user?.id === u.id ? "Account Suspended" : "User Suspended", description: `${user?.id === u.id ? 'Your account has' : `User ${u.name} has`} been automatically suspended.`, variant: "destructive", duration: 10000});
                         } catch (suspendError) { console.error(`Failed to update suspension for ${u.id} (assessment listener):`, suspendError); }
                      }
                      return userWithRatings;
                    });
                    const reEnrichedUsers = await Promise.all(reEnrichedUsersPromises);
                    setAllUsersList(reEnrichedUsers); 
                    
                    if (user) { 
                      const updatedCurrentUser = reEnrichedUsers.find(ru => ru.id === user.id);
                      if (updatedCurrentUser && JSON.stringify(updatedCurrentUser) !== JSON.stringify(user)) { 
                          setUser(updatedCurrentUser);
                          localStorage.setItem(CURRENT_USER_STORAGE_KEY, JSON.stringify(updatedCurrentUser));
                      }
                    }
                }
              } catch (assessmentError: any) {
                  if (assessmentError instanceof FirestoreError && (assessmentError.code === 'unavailable' || (assessmentError.message && assessmentError.message.includes('client is offline')))) {
                    console.info("AuthContext: Assessed orders snapshot processing failed as Firestore client is offline.", assessmentError.message);
                    toast({ title: "Network Issue", description: "Could not update ratings from new assessments. Firebase is offline.", variant: "destructive", duration: 7000});
                  } else {
                    console.error("Error processing assessed orders snapshot:", assessmentError);
                    toast({ title: "Rating Update Error", description: "Failed to update ratings from new assessments.", variant: "destructive" });
                  }
              }
            }, (error) => {
              if (error instanceof FirestoreError && (error.code === 'unavailable' || (error.message && error.message.includes('client is offline')))) {
                console.info("AuthContext: onSnapshot listener for assessed orders failed as Firestore client is offline.", error.message);
              } else {
                console.error("Error fetching assessed orders from Firestore (onSnapshot):", error);
              }
            });

            return () => {
                unsubscribeUsers();
                unsubscribeAssessedOrders();
            };

        } catch (error: any) {
            if (error instanceof FirestoreError && (error.code === 'unavailable' || (error.message && error.message.includes('client is offline')))) {
                console.info(`AuthContext: Initialization (useEffect) failed as Firestore client is offline.`, error.message);
                toast({ title: "Network Issue", description: `AuthContext initialization error: ${error.message}. Firebase might be offline.`, variant: "destructive", duration: 10000});
            } else {
                console.error('AuthContext: Unhandled error during initialization (useEffect):', error);
                toast({ title: "Initialization Error", description: `An unexpected error occurred: ${error.message || 'Unknown error'}`, variant: "destructive" });
            }
            setIsLoading(false);
            setIsLoadingUsers(false);
            setUser(null); 
            localStorage.removeItem(CURRENT_USER_STORAGE_KEY);
            return () => {}; 
        }
    };

    initializeAuthContext();

  }, [toast, logoutCallback, allUsersList, user]);


  const signup = useCallback(async (username: string, mockPasswordNew: string, role: UserRole) => {
    if (!db) {
      toast({ title: "Sign Up Error", description: "Firebase is not configured or is offline. Cannot sign up.", variant: "destructive", duration: 7000 });
      setIsLoading(false);
      return;
    }
    if (!username || !mockPasswordNew || !role) {
      toast({ title: "Sign Up Error", description: "Username, password, and role are required.", variant: "destructive" });
      setIsLoading(false);
      return;
    }
    if (role === 'manager') {
        toast({ title: "Sign Up Error", description: "Manager accounts are pre-configured or created by existing managers.", variant: "destructive" });
        setIsLoading(false);
        return;
    }

    setIsLoading(true);
    const userDocId = username.toLowerCase();
    const userDocRef = doc(db, "users", userDocId);
    
    try {
        const userDocSnap = await getDoc(userDocRef);

        if (userDocSnap.exists()) {
          toast({ title: "Sign Up Failed", description: "Username already taken. Please choose another.", variant: "destructive" });
          setIsLoading(false);
          return;
        }

        const isCustomer = role === 'customer';
        const isSupplierOrTransporter = role === 'supplier' || role === 'transporter';

        const newUserFirestoreData: StoredUser = {
          name: username, role, mockPassword: mockPasswordNew, isApproved: isCustomer, isSuspended: false,
          address: '', ethereumAddress: '',
          shippingRates: role === 'transporter' ? { tier1_0_100_km_price: 0, tier2_101_500_km_price_per_km: 0, tier3_501_1000_km_price_per_km: 0} : undefined,
        };

        await setDoc(userDocRef, newUserFirestoreData);
        const newUser: User = {
          id: userDocRef.id, name: newUserFirestoreData.name, role: newUserFirestoreData.role,
          isApproved: newUserFirestoreData.isApproved, isSuspended: newUserFirestoreData.isSuspended,
          address: newUserFirestoreData.address, ethereumAddress: newUserFirestoreData.ethereumAddress,
          shippingRates: newUserFirestoreData.shippingRates,
          supplierWeightedRatingSum: 0, supplierTotalWeights: 0, supplierRatingCount: 0,
        };

        if (isCustomer) {
          setUser(newUser);
          localStorage.setItem(CURRENT_USER_STORAGE_KEY, JSON.stringify(newUser));
          toast({ title: "Sign Up Successful!", description: `Welcome, ${username}! Your ${role} account is active and you are now logged in.` });
        } else if (isSupplierOrTransporter) {
          toast({ title: "Sign Up Successful!", description: `Account for ${username} (${role}) created. Awaiting manager approval.` });
        }
    } catch (error: any) {
        if (error instanceof FirestoreError && (error.code === 'unavailable' || (error.message && error.message.includes('client is offline')))) {
            console.info("AuthContext: Signup failed as Firestore client is offline.", error.message);
            toast({ title: "Network Issue", description: "Could not create account. Firebase is offline. Please try again later.", variant: "destructive", duration: 7000});
        } else {
            console.error("Error adding user to Firestore: ", error);
            toast({ title: "Sign Up Error", description: "Could not create account. Please try again.", variant: "destructive"});
        }
    } finally {
      setIsLoading(false);
    }
  }, [toast]); 

  const login = useCallback(async (username: string, mockPasswordAttempt: string) => {
    if (!db) {
      toast({ title: "Login Error", description: "Firebase is not configured or is offline. Cannot login.", variant: "destructive", duration: 7000 });
      setIsLoading(false);
      return;
    }
     if (!username || !mockPasswordAttempt) {
      toast({ title: "Login Error", description: "Username and password are required.", variant: "destructive" });
      setIsLoading(false);
      return;
    }
    setIsLoading(true);

    const userDocId = username.toLowerCase();
    const potentialUserFromList = allUsersList.find(u => u.id === userDocId || u.name.toLowerCase() === userDocId);

    if (potentialUserFromList) {
        const userRef = doc(db, "users", potentialUserFromList.id);
        try {
            const userSnap = await getDoc(userRef);
            if (userSnap.exists()) {
                const storedUserDocData = userSnap.data() as StoredUser;
                if (storedUserDocData.mockPassword === mockPasswordAttempt) {
                    const userToLogin = { ...potentialUserFromList };
                    if (userToLogin.isSuspended) {
                        toast({ title: "Account Suspended", description: "Your account has been suspended due to low ratings. Please contact support.", variant: "destructive", duration: 10000 });
                        setUser(null); localStorage.removeItem(CURRENT_USER_STORAGE_KEY);
                    } else if ((userToLogin.role === 'supplier' || userToLogin.role === 'transporter') && !userToLogin.isApproved) {
                        toast({ title: "Login Blocked", description: "Your account as a " + userToLogin.role + " is awaiting manager approval.", variant: "destructive", duration: 7000 });
                        setUser(null); localStorage.removeItem(CURRENT_USER_STORAGE_KEY);
                    } else {
                        setUser(userToLogin); localStorage.setItem(CURRENT_USER_STORAGE_KEY, JSON.stringify(userToLogin));
                        toast({ title: "Login Successful!", description: `Welcome back, ${userToLogin.name}!` });
                    }
                } else {
                     toast({ title: "Login Failed", description: "Invalid username or password.", variant: "destructive" });
                }
            } else {
                
                toast({ title: "Login Failed", description: "User data inconsistency. Please try again.", variant: "destructive" });
            }
        } catch (error: any) {
            if (error instanceof FirestoreError && (error.code === 'unavailable' || (error.message && error.message.includes('client is offline')))) {
                console.info("AuthContext: Login failed (getDoc) as Firestore client is offline.", error.message);
                toast({ title: "Network Issue", description: "Could not log in. Firebase is offline. Please try again later.", variant: "destructive", duration: 7000});
            } else {
                console.error("Error fetching user for login (getDoc):", error);
                toast({ title: "Login Error", description: "An error occurred while trying to log in.", variant: "destructive" });
            }
        }
    } else {
        
        const usersRef = collection(db, "users");
        const q = query(usersRef, where("name", "==", username));
        try {
            const querySnapshot = await getDocs(q);
            if (querySnapshot.empty) {
                toast({ title: "Login Failed", description: "Invalid username or password.", variant: "destructive" });
            } else {
                const userDocFromQuery = querySnapshot.docs[0];
                const userDataFromDB = userDocFromQuery.data() as StoredUser;
                if (userDataFromDB.mockPassword === mockPasswordAttempt) {
                    
                    const loggedInUser: User = {
                        id: userDocFromQuery.id, name: userDataFromDB.name, role: userDataFromDB.role,
                        isApproved: userDataFromDB.isApproved, isSuspended: userDataFromDB.isSuspended ?? false,
                        address: userDataFromDB.address || '', ethereumAddress: userDataFromDB.ethereumAddress || '',
                        shippingRates: userDataFromDB.shippingRates,
                        
                        
                    };
                    if (loggedInUser.isSuspended) {
                        toast({ title: "Account Suspended", description: "Your account has been suspended. Contact support.", variant: "destructive", duration: 10000 });
                        setUser(null); localStorage.removeItem(CURRENT_USER_STORAGE_KEY);
                    } else if ((loggedInUser.role === 'supplier' || loggedInUser.role === 'transporter') && !loggedInUser.isApproved) {
                        toast({ title: "Login Blocked", description: `Account (${loggedInUser.role}) awaiting approval.`, variant: "destructive", duration: 7000 });
                        setUser(null); localStorage.removeItem(CURRENT_USER_STORAGE_KEY);
                    } else {
                        setUser(loggedInUser); localStorage.setItem(CURRENT_USER_STORAGE_KEY, JSON.stringify(loggedInUser));
                        toast({ title: "Login Successful!", description: `Welcome back, ${loggedInUser.name}!` });
                    }
                } else {
                    toast({ title: "Login Failed", description: "Invalid username or password.", variant: "destructive" });
                }
            }
        } catch (error: any) {
            if (error instanceof FirestoreError && (error.code === 'unavailable' || (error.message && error.message.includes('client is offline')))) {
                 console.info("AuthContext: Login query failed as Firestore client is offline.", error.message);
                toast({ title: "Network Issue", description: "Could not log in. Firebase is offline. Please try again later.", variant: "destructive", duration: 7000});
            } else {
                console.error("Error during login query: ", error);
                toast({ title: "Login Error", description: "An error occurred. Please try again.", variant: "destructive"});
            }
        }
    }
    setIsLoading(false);
  }, [toast, allUsersList]);


  const approveUser = useCallback(async (userId: string) => {
    if (!db) {
      toast({ title: "Action Error", description: "Firebase is not configured or offline. Cannot approve user.", variant: "destructive", duration: 7000 });
      return;
    }
    if (user?.role !== 'manager') {
      toast({ title: "Permission Denied", description: "Only managers can approve users.", variant: "destructive" });
      return;
    }
    const userDocRef = doc(db, "users", userId);
    try {
      await updateDoc(userDocRef, { isApproved: true });
      toast({ title: "User Approved", description: `User has been approved.` });
    } catch (error: any) {
      if (error instanceof FirestoreError && (error.code === 'unavailable' || (error.message && error.message.includes('client is offline')))) {
        console.info("AuthContext: Approving user failed as Firestore client is offline.", error.message);
        toast({ title: "Network Issue", description: "Could not approve user. Firebase is offline.", variant: "destructive", duration: 7000});
      } else {
        console.error("Error approving user: ", error);
        toast({ title: "Error", description: "Could not approve user. Please try again.", variant: "destructive" });
      }
    }
  }, [user, toast]); 

  const addManager = useCallback(async (newManagerUsername: string, newManagerPassword: string): Promise<boolean> => {
    if (!db) {
      toast({ title: "Action Error", description: "Firebase is not configured or offline. Cannot add manager.", variant: "destructive", duration: 7000 });
      return false;
    }
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
    
    try {
        const managerDocSnap = await getDoc(managerDocRef);
        if (managerDocSnap.exists()) {
          toast({ title: "Creation Failed", description: "Username already taken. Please choose another.", variant: "destructive" });
          return false;
        }
        const newManagerData: StoredUser = {
          name: newManagerUsername, mockPassword: newManagerPassword, role: 'manager', isApproved: true, isSuspended: false,
          address: '1 Admin Way, Suite M, Management City', ethereumAddress: `0xNewManager${Date.now().toString(16)}`,
        };
        await setDoc(managerDocRef, newManagerData);
        toast({ title: "Manager Created", description: `Manager account for ${newManagerUsername} created successfully.` });
        return true;
    } catch (error: any) {
      if (error instanceof FirestoreError && (error.code === 'unavailable' || (error.message && error.message.includes('client is offline')))) {
        console.info("AuthContext: Adding manager failed as Firestore client is offline.", error.message);
        toast({ title: "Network Issue", description: "Could not create manager. Firebase is offline.", variant: "destructive", duration: 7000});
      } else {
        console.error("Error creating new manager: ", error);
        toast({ title: "Creation Error", description: "Could not create manager account.", variant: "destructive"});
      }
      return false;
    }
  }, [user, toast]); 

  const updateUserProfile = useCallback(async (userId: string, data: { address?: string; ethereumAddress?: string }): Promise<boolean> => {
    if (!db) {
      toast({ title: "Update Error", description: "Firebase is not configured or offline. Cannot update profile.", variant: "destructive", duration: 7000 });
      return false;
    }
    if (!user || user.id !== userId) {
        toast({ title: "Permission Denied", description: "You can only update your own profile.", variant: "destructive" });
        return false;
    }
    const userDocRef = doc(db, "users", userId);
    try {
        const updatePayload: Partial<StoredUser> = {};
        if (data.address !== undefined) updatePayload.address = data.address.trim();
        if (data.ethereumAddress !== undefined) updatePayload.ethereumAddress = data.ethereumAddress.trim();
        if (Object.keys(updatePayload).length === 0) {
            toast({ title: "No Changes", description: "No new information to save."});
            return true;
        }
        await updateDoc(userDocRef, updatePayload);
        toast({ title: "Profile Updated", description: "Your profile information has been successfully updated." });
        return true;
    } catch (error: any) {
        if (error instanceof FirestoreError && (error.code === 'unavailable' || (error.message && error.message.includes('client is offline')))) {
            console.info("AuthContext: Updating profile failed as Firestore client is offline.", error.message);
            toast({ title: "Network Issue", description: "Could not update profile. Firebase is offline.", variant: "destructive", duration: 7000});
        } else {
            console.error("Error updating user profile:", error);
            toast({ title: "Update Error", description: "Could not update your profile.", variant: "destructive"});
        }
        return false;
    }
  }, [user, toast]); 

  const updateTransporterShippingRates = useCallback(async (userId: string, rates: UserShippingRates): Promise<boolean> => {
    if (!db) {
      toast({ title: "Update Error", description: "Firebase is not configured or offline. Cannot update rates.", variant: "destructive", duration: 7000});
      return false;
    }
    if (!user || user.id !== userId || user.role !== 'transporter') {
      toast({ title: "Permission Denied", description: "You can only update your own shipping rates.", variant: "destructive"});
      return false;
    }
    const userDocRef = doc(db, "users", userId);
    try {
      await updateDoc(userDocRef, { shippingRates: rates });
      toast({ title: "Shipping Rates Updated", description: "Your shipping rates have been successfully updated."});
      return true;
    } catch (error: any) {
      if (error instanceof FirestoreError && (error.code === 'unavailable' || (error.message && error.message.includes('client is offline')))) {
          console.info("AuthContext: Updating shipping rates failed as Firestore client is offline.", error.message);
          toast({ title: "Network Issue", description: "Could not update shipping rates. Firebase is offline.", variant: "destructive", duration: 7000});
      } else {
          console.error("Error updating transporter shipping rates:", error);
          toast({ title: "Update Error", description: "Could not update shipping rates.", variant: "destructive"});
      }
      return false;
    }
  }, [user, toast]);

  return (
    <AuthContext.Provider value={{
      user, login, signup, logout: logoutCallback, isLoading,
      approveUser, addManager, updateUserProfile, updateTransporterShippingRates,
      allUsersList, isLoadingUsers
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
