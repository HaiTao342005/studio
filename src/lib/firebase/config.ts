
// Import the functions you need from the SDKs you need
import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getAuth, type Auth } from "firebase/auth";

// Your web app's Firebase configuration (hardcoded as per user request)
const firebaseConfig = {
  apiKey: "AIzaSyATvTpaQCEcmRWYisPERQnh63acaIvnzlc",
  authDomain: "newtech-83nd6.firebaseapp.com",
  projectId: "newtech-83nd6",
  storageBucket: "newtech-83nd6.appspot.com", // Corrected: .appspot.com is typical for storageBucket
  messagingSenderId: "19640126702",
  appId: "1:19640126702:web:15d34a0cc15682c4f577ff"
  // measurementId is optional, can be added if you have it
};

let appInternal: FirebaseApp | null = null;
let dbInternal: Firestore | null = null;
let authInternal: Auth | null = null;

// Proceed with initialization using the hardcoded config
try {
  if (!getApps().length) {
    appInternal = initializeApp(firebaseConfig);
  } else {
    appInternal = getApps()[0];
  }

  if (appInternal) {
    try {
      dbInternal = getFirestore(appInternal);
    } catch (e: any) {
      console.error("Firebase Firestore Initialization Error during getFirestore():", e.message || e);
      dbInternal = null;
    }
    try {
      authInternal = getAuth(appInternal);
    } catch (e: any) {
      console.error("Firebase Auth Initialization Error during getAuth():", e.message || e);
      authInternal = null;
    }
  }
} catch (e: any) {
  console.error("Firebase Core Initialization Error (initializeApp):", e.message || e);
  appInternal = null;
  dbInternal = null;
  authInternal = null;
}

// Export the initialized (or null on error) Firebase services
export const app = appInternal;
export const db = dbInternal;
export const auth = authInternal;
