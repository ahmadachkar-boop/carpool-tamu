import React, { createContext, useState, useEffect, useContext } from 'react';
import { db } from './firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { useAuth } from './AuthContext';

const ActiveNDRContext = createContext();

export const useActiveNDR = () => {
  const context = useContext(ActiveNDRContext);
  if (!context) {
    throw new Error('useActiveNDR must be used within ActiveNDRProvider');
  }
  return context;
};

export const ActiveNDRProvider = ({ children }) => {
  const [activeNDR, setActiveNDR] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { currentUser } = useAuth();

  useEffect(() => {
    // Only set up listener after auth is ready
    if (currentUser === undefined) {
      console.log('[ActiveNDR] Waiting for auth...');
      return;
    }

    console.log('[ActiveNDR] Setting up listener...');
    setLoading(true);
    
    const ndrsRef = collection(db, 'ndrs');
    const activeQuery = query(ndrsRef, where('status', '==', 'active'));

    const unsubscribe = onSnapshot(
      activeQuery,
      {
        // Include metadata changes to detect server updates
        includeMetadataChanges: true
      },
      (snapshot) => {
        // Log for debugging
        console.log('[ActiveNDR] Snapshot received:', {
          empty: snapshot.empty,
          size: snapshot.size,
          fromCache: snapshot.metadata.fromCache,
          hasPendingWrites: snapshot.metadata.hasPendingWrites
        });

        // Only update state if this is from server or a real change
        if (!snapshot.metadata.hasPendingWrites) {
          if (snapshot.empty) {
            console.log('[ActiveNDR] No active NDR found');
            setActiveNDR(null);
            setError(null);
          } else {
            const doc = snapshot.docs[0];
            const ndr = {
              id: doc.id,
              ...doc.data(),
              eventDate: doc.data().eventDate?.toDate(),
              activatedAt: doc.data().activatedAt?.toDate(),
              endedAt: doc.data().endedAt?.toDate()
            };
            console.log('[ActiveNDR] Active NDR found:', ndr.id, ndr.eventName);
            setActiveNDR(ndr);
            setError(null);
          }
          setLoading(false);
        }
      },
      (err) => {
        console.error('[ActiveNDR] Error fetching active NDR:', err);
        setError(err);
        setActiveNDR(null);
        setLoading(false);
      }
    );

    return () => {
      console.log('[ActiveNDR] Cleaning up listener');
      unsubscribe();
    };
  }, [currentUser]);

  const value = {
    activeNDR,
    loading,
    error,
    hasActiveNDR: activeNDR !== null
  };

  return (
    <ActiveNDRContext.Provider value={value}>
      {children}
    </ActiveNDRContext.Provider>
  );
};