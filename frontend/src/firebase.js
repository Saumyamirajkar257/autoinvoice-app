import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';

// Firebase configuration for invoice-project-63aba
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyCcNv873lNfULk0noSXn-MC1E1BhBc6y-0",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "invoice-project-63aba.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "invoice-project-63aba",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "invoice-project-63aba.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "349827776143",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:349827776143:web:autoinvoice"
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
