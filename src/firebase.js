import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, enableIndexedDbPersistence } from 'firebase/firestore';
import { setPersistence, browserLocalPersistence } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyBI87gFec1mUSEYTqST5C_fQ2b5CGchC3A",
  authDomain: "carpool-tamu-2446c.firebaseapp.com",
  projectId: "carpool-tamu-2446c",
  storageBucket: "carpool-tamu-2446c.firebasestorage.app",
  messagingSenderId: "381590026875",
  appId: "1:381590026875:web:b8ba6bdfc2aa3f718440de"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

setPersistence(auth, browserLocalPersistence)
  .then(() => console.log('✅ Auth persistence enabled'))
  .catch((error) => console.error('❌ Auth persistence error:', error));

enableIndexedDbPersistence(db, {
  synchronizeTabs: true
})
  .then(() => console.log('✅ Firestore offline enabled'))
  .catch((err) => {
    if (err.code === 'failed-precondition') {
      console.warn('⚠️ Multiple tabs open');
    } else if (err.code === 'unimplemented') {
      console.warn('⚠️ Persistence not available');
    }
  });