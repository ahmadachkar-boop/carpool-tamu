import React, { createContext, useState, useEffect, useContext } from 'react';
import { auth, db } from './firebase';
import { 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  createUserWithEmailAndPassword 
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';

const AuthContext = createContext();

export const useAuth = () => {
  return useContext(AuthContext);
};

export const AuthProvider = ({ children }) => {
  // Initialize as undefined to distinguish between "not loaded" and "no user"
  const [currentUser, setCurrentUser] = useState(undefined);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const login = async (email, password) => {
    return signInWithEmailAndPassword(auth, email, password);
  };

  const logout = async () => {
    setUserProfile(null);
    return signOut(auth);
  };

  const signup = async (email, password, profileData) => {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    await setDoc(doc(db, 'members', user.uid), {
      ...profileData,
      email: email,
      createdAt: new Date(),
      status: 'active',
      points: 0,
      nightsWorked: 0,
      phoneRoomShifts: 0
    });

    return user;
  };

  useEffect(() => {
    console.log('[Auth] Setting up auth listener...');
    
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      console.log('[Auth] Auth state changed:', user ? `User ${user.uid}` : 'No user');
      
      setCurrentUser(user);
      
      if (user) {
        try {
          const docRef = doc(db, 'members', user.uid);
          const docSnap = await getDoc(docRef);
          
          if (docSnap.exists()) {
            const profile = {
              id: user.uid,
              ...docSnap.data()
            };
            console.log('[Auth] User profile loaded:', profile.name, profile.role);
            setUserProfile(profile);
          } else {
            console.log('[Auth] No user profile found in Firestore');
            setUserProfile(null);
          }
        } catch (error) {
          console.error('[Auth] Error fetching user profile:', error);
          setUserProfile(null);
        }
      } else {
        setUserProfile(null);
      }
      
      setLoading(false);
    });

    return () => {
      console.log('[Auth] Cleaning up auth listener');
      unsubscribe();
    };
  }, []);

  const value = {
    currentUser,
    userProfile,
    login,
    logout,
    signup
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};