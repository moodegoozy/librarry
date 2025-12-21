// Import the functions you need from the SDKs you need
import { initializeApp } from 'firebase/app';
import { getAnalytics } from 'firebase/analytics';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getStorage } from 'firebase/storage';

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDHPIK1mVfOXz6iAYXRX-9uxUEMkEX8iqQ",
  authDomain: "jabouri-digital-library.firebaseapp.com",
  projectId: "jabouri-digital-library",
  storageBucket: "jabouri-digital-library.firebasestorage.app",
  messagingSenderId: "199178934886",
  appId: "1:199178934886:web:f0b39f8f50327acd7c6ba7",
  measurementId: "G-S610YMCGJJ"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);
export { analytics };
export default app;
