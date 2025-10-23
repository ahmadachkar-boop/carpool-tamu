// Message Read Receipts and Typing Indicators

import { doc, updateDoc, setDoc, getDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';
import { messagesLogger } from './logger';

// Message Status Constants
export const MESSAGE_STATUS = {
  SENT: 'sent',
  DELIVERED: 'delivered',
  READ: 'read'
};

// Mark message as delivered
export const markMessageDelivered = async (messageId) => {
  if (!messageId) {
    console.warn('No messageId provided to markMessageDelivered');
    return;
  }

  try {
    const messageRef = doc(db, 'couchMessages', messageId);
    await updateDoc(messageRef, {
      deliveredAt: serverTimestamp(),
      status: MESSAGE_STATUS.DELIVERED
    });
    messagesLogger.log('✅ Message marked as delivered:', messageId);
  } catch (error) {
    // If the document doesn't have status field yet, that's okay
    messagesLogger.log('Note: Could not mark message as delivered:', error.message);
  }
};

// Mark message as read
export const markMessageRead = async (messageId) => {
  if (!messageId) {
    console.warn('No messageId provided to markMessageRead');
    return;
  }

  try {
    const messageRef = doc(db, 'couchMessages', messageId);
    await updateDoc(messageRef, {
      readAt: serverTimestamp(),
      status: MESSAGE_STATUS.READ
    });
    messagesLogger.log('✅ Message marked as read:', messageId);
  } catch (error) {
    messagesLogger.log('Note: Could not mark message as read:', error.message);
  }
};

// Typing Status Management
const TYPING_TIMEOUT = 3000; // 3 seconds

// Set typing status for a car
export const setTypingStatus = async (ndrId, carNumber, sender, isTyping) => {
  if (!ndrId || !carNumber || !sender) {
    console.warn('Missing parameters for setTypingStatus');
    return;
  }

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
  if (!ndrId || !carNumber || !sender || !callback) {
    console.warn('Missing parameters for listenToTypingStatus');
    return () => {}; // Return empty unsubscribe function
  }

  try {
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
  } catch (error) {
    console.error('Error setting up typing listener:', error);
    return () => {}; // Return empty unsubscribe function
  }
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
  if (!message || !viewMode) {
    return null;
  }

  // Only show status for messages sent by current user
  const isSentByMe = (viewMode === 'navigator' && message.sender === 'navigator') ||
                      (viewMode === 'couch' && message.sender === 'couch');

  if (!isSentByMe) {
    return null;
  }

  try {
    if (message.status === MESSAGE_STATUS.READ && message.readAt) {
      return {
        icon: '✓✓',
        color: 'text-blue-600',
        tooltip: `Read at ${message.readAt.toDate?.().toLocaleTimeString() || 'N/A'}`
      };
    }

    if (message.status === MESSAGE_STATUS.DELIVERED && message.deliveredAt) {
      return {
        icon: '✓✓',
        color: 'text-gray-400',
        tooltip: `Delivered at ${message.deliveredAt.toDate?.().toLocaleTimeString() || 'N/A'}`
      };
    }

    return {
      icon: '✓',
      color: 'text-gray-300',
      tooltip: 'Sent'
    };
  } catch (error) {
    console.error('Error getting message status display:', error);
    return {
      icon: '✓',
      color: 'text-gray-300',
      tooltip: 'Sent'
    };
  }
};
