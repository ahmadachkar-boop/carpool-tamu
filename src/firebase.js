import { initializeApp } from 'firebase/app';
import { getAuth, indexedDBLocalPersistence, initializeAuth } from 'firebase/auth';
import { getFirestore, initializeFirestore, persistentLocalCache, persistentSingleTabManager } from 'firebase/firestore';
import { Capacitor } from '@capacitor/core';
import { firebaseLogger } from './logger';

const firebaseConfig = {
  apiKey: "AIzaSyBI87gFec1mUSEYTqST5C_fQ2b5CGchC3A",
  authDomain: "carpool-tamu-2446c.firebaseapp.com",
  projectId: "carpool-tamu-2446c",
  storageBucket: "carpool-tamu-2446c.firebasestorage.app",
  messagingSenderId: "381590026875",
  appId: "1:381590026875:web:b8ba6bdfc2aa3f718440de"
};

const app = initializeApp(firebaseConfig);

// Initialize Auth differently for native vs web
let auth;
if (Capacitor.isNativePlatform()) {
  // Native platform (iOS/Android) - use initializeAuth to avoid popup/redirect issues
  firebaseLogger.log('🔧 Initializing Firebase Auth for Native platform');
  auth = initializeAuth(app, {
    persistence: indexedDBLocalPersistence
  });
} else {
  // Web platform - use standard getAuth
  firebaseLogger.log('🔧 Initializing Firebase Auth for Web platform');
  auth = getAuth(app);
}

// Initialize Firestore with new cache API (works on both platforms)
let db;
try {
  db = initializeFirestore(app, {
    localCache: persistentLocalCache({
      tabManager: persistentSingleTabManager()
    })
  });
  firebaseLogger.log('✅ Firestore initialized with persistent cache');
} catch (error) {
  // Fallback if already initialized
  firebaseLogger.log('⚠️ Firestore already initialized, using existing instance');
  db = getFirestore(app);
}

export { auth, db };