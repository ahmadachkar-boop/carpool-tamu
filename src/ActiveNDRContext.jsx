import React, { createContext, useState, useEffect, useContext } from 'react';
import { db } from './firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';

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

  useEffect(() => {
    const ndrsRef = collection(db, 'ndrs');
    const activeQuery = query(ndrsRef, where('status', '==', 'active'));

    const unsubscribe = onSnapshot(
      activeQuery,
      (snapshot) => {
        console.log('Active NDR snapshot:', snapshot.empty, snapshot.docs.length);
        if (snapshot.empty) {
          setActiveNDR(null);
        } else {
          const ndr = {
            id: snapshot.docs[0].id,
            ...snapshot.docs[0].data(),
            eventDate: snapshot.docs[0].data().eventDate?.toDate()
          };
          console.log('Active NDR found:', ndr);
          setActiveNDR(ndr);
        }
        setLoading(false);
      },
      (error) => {
        console.error('Error fetching active NDR:', error);
        setActiveNDR(null);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  return (
    <ActiveNDRContext.Provider value={{ activeNDR, loading }}>
      {children}
    </ActiveNDRContext.Provider>
  );
};