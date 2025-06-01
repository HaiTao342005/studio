
// Import the functions you need from the SDKs you need
import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getAuth, type Auth } from "firebase/auth";
import { getAnalytics, type Analytics } from "firebase/analytics"; // Added Analytics

// Your web app's Firebase configuration
const firebaseConfigValues = {
  apiKey: "AIzaSyAl1Kfw-Sw3ai7eXvOSQtBg3yAXbNytUA0",
  authDomain: "newtech-be296.firebaseapp.com",
  projectId: "newtech-be296",
  storageBucket: "newtech-be296.firebasestorage.app", // Using the value you provided
  messagingSenderId: "917915587691",
  appId: "1:917915587691:web:2a3b3cdd58b780a90a0d2e",
  measurementId: "G-WQTHVCW367"
};

let appInternal: FirebaseApp | null = null;
let dbInternal: Firestore | null = null;
let authInternal: Auth | null = null;
let analyticsInternal: Analytics | null = null;

// Check if essential config values are present
if (!firebaseConfigValues.apiKey || !firebaseConfigValues.projectId) {
  console.error(
    "CRITICAL FIREBASE CONFIGURATION ERROR:\n" +
    "The hardcoded apiKey or projectId is missing or empty in src/lib/firebase/config.ts.\n" +
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
        dbInternal = null;
      }
      try {
        authInternal = getAuth(appInternal);
      } catch (e: any) {
        console.error("Firebase Auth Initialization Error during getAuth():", e.message || e);
        authInternal = null;
      }
      try {
        // Check if window is defined (for server-side rendering compatibility if Analytics isn't needed server-side)
        if (typeof window !== "undefined") {
          analyticsInternal = getAnalytics(appInternal);
        }
      } catch (e: any) {
        console.error("Firebase Analytics Initialization Error during getAnalytics():", e.message || e);
        analyticsInternal = null;
      }
    }
  } catch (e: any) {
    console.error("Firebase Core Initialization Error (initializeApp):", e.message || e);
    appInternal = null;
    dbInternal = null;
    authInternal = null;
    analyticsInternal = null;
  }
}

export const app = appInternal;
export const db = dbInternal;
export const auth = authInternal;
export const analytics = analyticsInternal;
