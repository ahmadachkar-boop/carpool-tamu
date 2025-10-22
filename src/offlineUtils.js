// Offline Queue Management and Connection Status

const MESSAGE_QUEUE_KEY = 'couchNav_messageQueue';
const LOCATION_CACHE_KEY = 'couchNav_lastLocation';

// Message Queue Management
export const queueMessage = (messageData) => {
  try {
    const queue = getMessageQueue();
    queue.push({
      ...messageData,
      queuedAt: Date.now(),
      id: `queued_${Date.now()}_${Math.random()}`
    });
    localStorage.setItem(MESSAGE_QUEUE_KEY, JSON.stringify(queue));
    console.log('📦 Message queued for offline sync:', messageData);
    return true;
  } catch (error) {
    console.error('❌ Error queuing message:', error);
    return false;
  }
};

export const getMessageQueue = () => {
  try {
    const queue = localStorage.getItem(MESSAGE_QUEUE_KEY);
    return queue ? JSON.parse(queue) : [];
  } catch (error) {
    console.error('❌ Error reading message queue:', error);
    return [];
  }
};

export const clearMessageQueue = () => {
  try {
    localStorage.removeItem(MESSAGE_QUEUE_KEY);
    console.log('✅ Message queue cleared');
  } catch (error) {
    console.error('❌ Error clearing queue:', error);
  }
};

export const removeQueuedMessage = (messageId) => {
  try {
    const queue = getMessageQueue();
    const filtered = queue.filter(msg => msg.id !== messageId);
    localStorage.setItem(MESSAGE_QUEUE_KEY, JSON.stringify(filtered));
    console.log('✅ Removed message from queue:', messageId);
  } catch (error) {
    console.error('❌ Error removing queued message:', error);
  }
};

// Location Caching
export const cacheLocation = (locationData) => {
  try {
    const cached = {
      ...locationData,
      cachedAt: Date.now()
    };
    localStorage.setItem(LOCATION_CACHE_KEY, JSON.stringify(cached));
    console.log('💾 Location cached:', locationData);
    return true;
  } catch (error) {
    console.error('❌ Error caching location:', error);
    return false;
  }
};

export const getCachedLocation = () => {
  try {
    const cached = localStorage.getItem(LOCATION_CACHE_KEY);
    if (!cached) return null;

    const location = JSON.parse(cached);

    // Check if cache is still valid (within 5 minutes)
    const age = Date.now() - location.cachedAt;
    const MAX_CACHE_AGE = 5 * 60 * 1000; // 5 minutes

    if (age > MAX_CACHE_AGE) {
      console.log('⚠️ Cached location too old, discarding');
      localStorage.removeItem(LOCATION_CACHE_KEY);
      return null;
    }

    console.log('📍 Using cached location:', location);
    return location;
  } catch (error) {
    console.error('❌ Error reading cached location:', error);
    return null;
  }
};

export const clearLocationCache = () => {
  try {
    localStorage.removeItem(LOCATION_CACHE_KEY);
    console.log('✅ Location cache cleared');
  } catch (error) {
    console.error('❌ Error clearing location cache:', error);
  }
};

// Connection Status Monitoring
let connectionListeners = [];
let isOnline = navigator.onLine;
let lastOnlineCheck = Date.now();

export const addConnectionListener = (callback) => {
  connectionListeners.push(callback);
  // Immediately call with current status
  callback(isOnline);

  // Return unsubscribe function
  return () => {
    connectionListeners = connectionListeners.filter(cb => cb !== callback);
  };
};

export const isConnected = () => {
  return navigator.onLine;
};

export const getConnectionStatus = () => {
  return {
    online: isOnline,
    lastCheck: lastOnlineCheck,
    type: getConnectionType()
  };
};

export const getConnectionType = () => {
  // Check for Network Information API (limited browser support)
  if ('connection' in navigator) {
    const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (conn) {
      return {
        effectiveType: conn.effectiveType || 'unknown',
        downlink: conn.downlink || null,
        rtt: conn.rtt || null,
        saveData: conn.saveData || false
      };
    }
  }
  return null;
};

// Initialize connection monitoring
const initializeConnectionMonitoring = () => {
  const handleOnline = () => {
    isOnline = true;
    lastOnlineCheck = Date.now();
    console.log('🟢 Connection restored');
    connectionListeners.forEach(callback => callback(true));
  };

  const handleOffline = () => {
    isOnline = false;
    lastOnlineCheck = Date.now();
    console.log('🔴 Connection lost');
    connectionListeners.forEach(callback => callback(false));
  };

  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);

  // Return cleanup function
  return () => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
  };
};

// Auto-initialize on import
let cleanupConnectionMonitoring = initializeConnectionMonitoring();

// Export cleanup for testing
export const cleanup = () => {
  if (cleanupConnectionMonitoring) {
    cleanupConnectionMonitoring();
  }
};

// Firestore Connection Status
let firestoreConnected = true;
let firestoreListeners = [];

export const setFirestoreConnected = (connected) => {
  if (firestoreConnected !== connected) {
    firestoreConnected = connected;
    console.log(`🔥 Firestore ${connected ? 'connected' : 'disconnected'}`);
    firestoreListeners.forEach(callback => callback(connected));
  }
};

export const isFirestoreConnected = () => {
  return firestoreConnected;
};

export const addFirestoreConnectionListener = (callback) => {
  firestoreListeners.push(callback);
  callback(firestoreConnected);

  return () => {
    firestoreListeners = firestoreListeners.filter(cb => cb !== callback);
  };
};

// Sync Status
export const getSyncStatus = () => {
  const queuedMessages = getMessageQueue().length;
  const hasCache = getCachedLocation() !== null;

  return {
    online: isOnline,
    firestoreConnected,
    queuedMessages,
    hasCachedLocation: hasCache,
    needsSync: queuedMessages > 0
  };
};

// Auto-Sync Functionality
let syncCallback = null;
let isSyncing = false;

export const setSyncCallback = (callback) => {
  syncCallback = callback;
  console.log('✅ Auto-sync callback registered');
};

export const syncQueuedMessages = async (sendFunction) => {
  if (isSyncing) {
    console.log('⏸️ Sync already in progress');
    return { success: false, reason: 'already_syncing' };
  }

  if (!isOnline || !firestoreConnected) {
    console.log('⏸️ Cannot sync - offline or Firestore disconnected');
    return { success: false, reason: 'offline' };
  }

  const queue = getMessageQueue();
  if (queue.length === 0) {
    console.log('✅ No messages to sync');
    return { success: true, synced: 0 };
  }

  isSyncing = true;
  console.log(`🔄 Starting sync of ${queue.length} queued messages...`);

  const results = {
    success: 0,
    failed: 0,
    errors: []
  };

  for (const queuedMessage of queue) {
    try {
      // Call the provided send function (should be addDoc from Firebase)
      await sendFunction(queuedMessage);

      // Remove successfully sent message from queue
      removeQueuedMessage(queuedMessage.id);
      results.success++;

      console.log(`✅ Synced message: ${queuedMessage.message.substring(0, 30)}...`);
    } catch (error) {
      console.error(`❌ Failed to sync message:`, error);
      results.failed++;
      results.errors.push({
        message: queuedMessage,
        error: error.message
      });

      // If we get permission denied or other fatal errors, stop syncing
      if (error.code === 'permission-denied') {
        console.error('❌ Permission denied - stopping sync');
        break;
      }
    }
  }

  isSyncing = false;

  console.log(`🔄 Sync complete: ${results.success} sent, ${results.failed} failed`);

  return {
    success: true,
    synced: results.success,
    failed: results.failed,
    errors: results.errors
  };
};

export const isSyncInProgress = () => {
  return isSyncing;
};

// App Resume Detection
let visibilityListeners = [];
let appResumeListeners = [];

export const addAppResumeListener = (callback) => {
  appResumeListeners.push(callback);

  return () => {
    appResumeListeners = appResumeListeners.filter(cb => cb !== callback);
  };
};

const handleVisibilityChange = () => {
  if (!document.hidden) {
    console.log('📱 App resumed from background');
    appResumeListeners.forEach(callback => callback());

    // Trigger sync callback if registered and online
    if (syncCallback && isOnline && firestoreConnected) {
      const queue = getMessageQueue();
      if (queue.length > 0) {
        console.log('🔄 Auto-triggering sync after app resume');
        syncCallback();
      }
    }
  }
};

// Initialize visibility monitoring
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', handleVisibilityChange);
}

// Cleanup visibility monitoring
export const cleanupVisibilityMonitoring = () => {
  if (typeof document !== 'undefined') {
    document.removeEventListener('visibilitychange', handleVisibilityChange);
  }
};
