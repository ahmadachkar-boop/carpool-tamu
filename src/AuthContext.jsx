import React, { createContext, useState, useEffect, useContext } from 'react';
import { auth, db } from './firebase';
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  createUserWithEmailAndPassword
} from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { authLogger } from './logger';

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

  // Function to manually refresh user profile
  const refreshUserProfile = async (uid) => {
    try {
      const docRef = doc(db, 'members', uid);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        const profile = {
          id: uid,
          ...docSnap.data()
        };
        console.log('[Auth] Profile refreshed:', profile.name, 'tempPassword:', profile.tempPassword, 'profileCompleted:', profile.profileCompleted);
        setUserProfile(profile);
        return profile;
      }
    } catch (error) {
      console.error('[Auth] Error refreshing profile:', error);
    }
  };

  useEffect(() => {
    authLogger.log('[Auth] Setting up auth listener...');
    
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      authLogger.log('[Auth] Auth state changed:', user ? `User ${user.uid}` : 'No user');
      
      setCurrentUser(user);
      
      if (user) {
        // Use real-time listener for user profile instead of one-time fetch
        const docRef = doc(db, 'members', user.uid);
        
        const unsubscribeProfile = onSnapshot(docRef, (docSnap) => {
          if (docSnap.exists()) {
            const profile = {
              id: user.uid,
              ...docSnap.data()
            };
            authLogger.log('[Auth] User profile updated:', profile.name, 'tempPassword:', profile.tempPassword, 'profileCompleted:', profile.profileCompleted);
            setUserProfile(profile);
          } else {
            authLogger.log('[Auth] No user profile found in Firestore');
            setUserProfile(null);
          }
        }, (error) => {
          console.error('[Auth] Error listening to profile:', error);
          setUserProfile(null);
        });
        
        setLoading(false);
        
        // Return cleanup function for profile listener
        return () => {
          authLogger.log('[Auth] Cleaning up profile listener');
          unsubscribeProfile();
        };
      } else {
        setUserProfile(null);
        setLoading(false);
      }
    });

    return () => {
      authLogger.log('[Auth] Cleaning up auth listener');
      unsubscribe();
    };
  }, []);

  const value = {
    currentUser,
    userProfile,
    login,
    logout,
    signup,
    refreshUserProfile
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};