// Message Read Receipts and Typing Indicators

import { doc, updateDoc, setDoc, getDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';

// Message Status Constants
export const MESSAGE_STATUS = {
  SENT: 'sent',
  DELIVERED: 'delivered',
  READ: 'read'
};

// Mark message as delivered
export const markMessageDelivered = async (messageId) => {
  try {
    const messageRef = doc(db, 'couchMessages', messageId);
    await updateDoc(messageRef, {
      deliveredAt: serverTimestamp(),
      status: MESSAGE_STATUS.DELIVERED
    });
    console.log('✅ Message marked as delivered:', messageId);
  } catch (error) {
    // If the document doesn't have status field yet, that's okay
    console.log('Note: Could not mark message as delivered:', error.message);
  }
};

// Mark message as read
export const markMessageRead = async (messageId) => {
  try {
    const messageRef = doc(db, 'couchMessages', messageId);
    await updateDoc(messageRef, {
      readAt: serverTimestamp(),
      status: MESSAGE_STATUS.READ
    });
    console.log('✅ Message marked as read:', messageId);
  } catch (error) {
    console.log('Note: Could not mark message as read:', error.message);
  }
};

// Typing Status Management
const TYPING_TIMEOUT = 3000; // 3 seconds

// Set typing status for a car
export const setTypingStatus = async (ndrId, carNumber, sender, isTyping) => {
  try {
    const typingRef = doc(db, 'typingStatus', `${ndrId}_${carNumber}_${sender}`);

    if (isTyping) {
      await setDoc(typingRef, {
        ndrId,
        carNumber,
        sender, // 'couch' or 'navigator'
        typing: true,
        updatedAt: serverTimestamp()
      }, { merge: true });
    } else {
      await setDoc(typingRef, {
        typing: false,
        updatedAt: serverTimestamp()
      }, { merge: true });
    }
  } catch (error) {
    console.error('Error setting typing status:', error);
  }
};

// Listen to typing status
export const listenToTypingStatus = (ndrId, carNumber, sender, callback) => {
  // Listen to the OTHER person's typing status
  const otherSender = sender === 'couch' ? 'navigator' : 'couch';
  const typingRef = doc(db, 'typingStatus', `${ndrId}_${carNumber}_${otherSender}`);

  const unsubscribe = onSnapshot(typingRef, (snapshot) => {
    if (snapshot.exists()) {
      const data = snapshot.data();

      // Check if typing status is recent (within last 5 seconds)
      const now = Date.now();
      const updatedAt = data.updatedAt?.toDate?.()?.getTime() || 0;
      const isRecent = (now - updatedAt) < 5000;

      callback(data.typing === true && isRecent);
    } else {
      callback(false);
    }
  }, (error) => {
    console.error('Error listening to typing status:', error);
    callback(false);
  });

  return unsubscribe;
};

// Debounced typing indicator
let typingTimeout = null;

export const handleTypingIndicator = (ndrId, carNumber, sender, isTyping) => {
  // Clear existing timeout
  if (typingTimeout) {
    clearTimeout(typingTimeout);
  }

  // Set typing status
  setTypingStatus(ndrId, carNumber, sender, isTyping);

  if (isTyping) {
    // Auto-clear typing status after timeout
    typingTimeout = setTimeout(() => {
      setTypingStatus(ndrId, carNumber, sender, false);
    }, TYPING_TIMEOUT);
  }
};

// Get message status display
export const getMessageStatusDisplay = (message, viewMode) => {
  // Only show status for messages sent by current user
  const isSentByMe = (viewMode === 'navigator' && message.sender === 'navigator') ||
                      (viewMode === 'couch' && message.sender === 'couch');

  if (!isSentByMe) {
    return null;
  }

  if (message.status === MESSAGE_STATUS.READ && message.readAt) {
    return {
      icon: '✓✓',
      color: 'text-blue-600',
      tooltip: `Read at ${message.readAt.toDate().toLocaleTimeString()}`
    };
  }

  if (message.status === MESSAGE_STATUS.DELIVERED && message.deliveredAt) {
    return {
      icon: '✓✓',
      color: 'text-gray-400',
      tooltip: `Delivered at ${message.deliveredAt.toDate().toLocaleTimeString()}`
    };
  }

  return {
    icon: '✓',
    color: 'text-gray-300',
    tooltip: 'Sent'
  };
};
