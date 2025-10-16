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
  const [currentUser, setCurrentUser] = useState(null);
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
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      
      if (user) {
        try {
          const docRef = doc(db, 'members', user.uid);
          const docSnap = await getDoc(docRef);
          
          if (docSnap.exists()) {
            setUserProfile({
              id: user.uid,
              ...docSnap.data()
            });
          } else {
            console.log('No user profile found');
            setUserProfile(null);
          }
        } catch (error) {
          console.error('Error fetching user profile:', error);
        }
      } else {
        setUserProfile(null);
      }
      
      setLoading(false);
    });

    return unsubscribe;
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
