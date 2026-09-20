import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';

// Authentic Firebase configuration for invoice-project-63aba
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyDn-_aWL7nPUaOg3mu9BUDobBB4zbGWf0A",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "invoice-project-63aba.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "invoice-project-63aba",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "invoice-project-63aba.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "349827776143",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:349827776143:web:26f6957f1c01a1c0913afa",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-6W0SBY8NBE"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Authentication and Google Provider
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account'
});

export default app;
