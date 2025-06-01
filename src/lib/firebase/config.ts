
// Import the functions you need from the SDKs you need
import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getFirestore, type Firestore } from "firebase/firestore"; // Added Firestore type
import { getAuth, type Auth } from "firebase/auth"; // Added Auth type

const firebaseConfigValues = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
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
  // appInternal, dbInternal, authInternal remain null
} else {
  // Proceed with initialization only if essential keys appear to be present
  try {
    if (!getApps().length) {
      appInternal = initializeApp(firebaseConfigValues);
    } else {
      appInternal = getApps()[0];
    }

    // Attempt to get Firestore and Auth, catching errors if appInternal is valid
    if (appInternal) {
      try {
        dbInternal = getFirestore(appInternal);
      } catch (e: any) {
        console.error("Firebase Firestore Initialization Error during getFirestore():", e.message || e);
        dbInternal = null; // Ensure db is null on error
      }
      try {
        authInternal = getAuth(appInternal); // This is where (auth/invalid-api-key) can occur
      } catch (e: any) {
        console.error("Firebase Auth Initialization Error during getAuth():", e.message || e);
        authInternal = null; // Ensure auth is null on error
      }
    }
  } catch (e: any) {
    // Catch errors from initializeApp itself (e.g., malformed projectId)
    console.error("Firebase Core Initialization Error (initializeApp):", e.message || e);
    console.error(
      "Ensure all NEXT_PUBLIC_FIREBASE_... variables are correctly set in .env.local (or .env) and the server is RESTARTED."
    );
    appInternal = null; // Ensure app is also null if initializeApp fails
    dbInternal = null;
    authInternal = null;
  }
}

// Export the potentially null values.
// Other parts of the app (like AuthContext) will need to handle these being null.
export const app = appInternal;
export const db = dbInternal;
export const auth = authInternal;
    