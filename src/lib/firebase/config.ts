
// Import the functions you need from the SDKs you need
import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getAuth, type Auth } from "firebase/auth";

// Your web app's Firebase configuration
const firebaseConfigValues = {
  apiKey: "AIzaSyATvTpaQCEcmRWYisPERQnh63acaIvnzlc",
  authDomain: "newtech-83nd6.firebaseapp.com",
  projectId: "newtech-83nd6",
  storageBucket: "newtech-83nd6.appspot.com", // Corrected to .appspot.com, common for config
  messagingSenderId: "19640126702",
  appId: "1:19640126702:web:15d34a0cc15682c4f577ff"
  // measurementId is optional and not provided, so it will be undefined
};

let appInternal: FirebaseApp | null = null;
let dbInternal: Firestore | null = null;
let authInternal: Auth | null = null;

// Check if essential config values are present (even if hardcoded, good practice for future changes)
if (!firebaseConfigValues.apiKey || !firebaseConfigValues.projectId) {
  console.error(
    "CRITICAL FIREBASE CONFIGURATION ERROR:\n" +
    "Hardcoded apiKey or projectId is missing or empty in src/lib/firebase/config.ts.\n" +
    "Firebase SDK will NOT be initialized, and app functionality relying on Firebase will be affected."
  );
} else {
  try {
    if (!getApps().length) {
      appInternal = initializeApp(firebaseConfigValues);
    } else {
      appInternal = getApps()[0];
    }

    if (appInternal) {
      try {
        dbInternal = getFirestore(appInternal);
      } catch (e: any) {
        console.error("Firebase Firestore Initialization Error during getFirestore():", e.message || e);
        dbInternal = null; // Ensure db is null on error
      }
      try {
        authInternal = getAuth(appInternal); // Initialize Firebase Auth
      } catch (e: any) {
        console.error("Firebase Auth Initialization Error during getAuth():", e.message || e);
        authInternal = null; // Ensure auth is null on error
      }
    }
  } catch (e: any) {
    console.error("Firebase Core Initialization Error (initializeApp):", e.message || e);
    // Ensure all are null if core initialization fails
    appInternal = null;
    dbInternal = null;
    authInternal = null;
  }
}

// Export the initialized (or null on error) Firebase services
export const app = appInternal;
export const db = dbInternal;
export const auth = authInternal;
