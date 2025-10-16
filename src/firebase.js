import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, initializeFirestore, CACHE_SIZE_UNLIMITED } from 'firebase/firestore';

// PASTE YOUR CONFIG HERE (replace the example below)
const firebaseConfig = {
  apiKey: "AIzaSyBI87gFec1mUSEYTqST5C_fQ2b5CGchC3A",
  authDomain: "carpool-tamu-2446c.firebaseapp.com",
  projectId: "carpool-tamu-2446c",
  storageBucket: "carpool-tamu-2446c.firebasestorage.app",
  messagingSenderId: "381590026875",
  appId: "1:381590026875:web:b8ba6bdfc2aa3f718440de"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Initialize Firestore with cache disabled to prevent internal errors
export const db = initializeFirestore(app, {
  cacheSizeBytes: CACHE_SIZE_UNLIMITED
});