
// Import the functions you need from the SDKs you need
import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getAuth, type Auth } from "firebase/auth";

// Your web app's Firebase configuration will be read from environment variables
const firebaseConfigValues = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID // Optional
};

let appInternal: FirebaseApp | null = null;
let dbInternal: Firestore | null = null;
let authInternal: Auth | null = null;

// Check for essential config variables first
if (!firebaseConfigValues.apiKey || !firebaseConfigValues.projectId) {
  console.error(
    "CRITICAL FIREBASE CONFIGURATION ERROR:\n" +
    "NEXT_PUBLIC_FIREBASE_API_KEY or NEXT_PUBLIC_FIREBASE_PROJECT_ID is missing in your environment variables (.env.local or .env).\n" +
    "Please ensure these are correctly set and that you have RESTARTED your Next.js development server.\n" +
    "Firebase SDK will NOT be initialized, and app functionality relying on Firebase will be affected."
  );
} else {
  try {
    if (!getApps().length) {
      appInternal = initializeApp(firebaseConfigValues as any); // Cast as any to satisfy initializeApp if some optional vars are undefined
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
