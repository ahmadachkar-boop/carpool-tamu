import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, enableIndexedDbPersistence } from 'firebase/firestore';
import { setPersistence, browserLocalPersistence } from 'firebase/auth';

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
// Enable auth persistence for PWA
setPersistence(auth, browserLocalPersistence)
  .then(() => console.log('✅ Auth persistence enabled'))
  .catch((error) => console.error('❌ Auth persistence error:', error));

// Initialize Firestore with standard configuration
export const db = getFirestore(app);
// Enable Firestore offline for PWA
enableIndexedDbPersistence(db)
  .then(() => console.log('✅ Firestore offline enabled'))
  .catch((err) => {
    if (err.code === 'failed-precondition') {
      console.warn('⚠️ Multiple tabs open');
    } else if (err.code === 'unimplemented') {
      console.warn('⚠️ Persistence not available');
    }
  });

// Enable offline persistence for consistent behavior across devices
enableIndexedDbPersistence(db).catch((err) => {
  if (err.code === 'failed-precondition') {
    console.warn('Multiple tabs open, persistence can only be enabled in one tab at a time.');
  } else if (err.code === 'unimplemented') {
    console.warn('The current browser does not support persistence.');
  }
});