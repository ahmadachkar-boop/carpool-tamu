import { getMessaging, getToken, onMessage, isSupported } from 'firebase/messaging';
import { doc, setDoc, deleteDoc, getDoc } from 'firebase/firestore';
import { db } from './firebase';
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { Preferences } from '@capacitor/preferences';

const isNativeApp = Capacitor.isNativePlatform();

// VAPID key for web push notifications
// This key is loaded from environment variables for security
// Generate this in Firebase Console > Project Settings > Cloud Messaging > Web Push certificates
// Add it to your .env file as: REACT_APP_VAPID_KEY=your_key_here
const VAPID_KEY = process.env.REACT_APP_VAPID_KEY;

/**
 * Initialize Firebase Cloud Messaging for web
 * Returns messaging instance or null if not supported
 */
export const initializeFCM = async () => {
  if (isNativeApp) {
    console.log('📱 Native app detected - using Capacitor Push Notifications instead of FCM');
    return null;
  }

  // Check if VAPID key is configured
  if (!VAPID_KEY) {
    console.error('❌ VAPID_KEY not configured! Add REACT_APP_VAPID_KEY to your .env file.');
    console.error('Generate a VAPID key in Firebase Console > Project Settings > Cloud Messaging > Web Push certificates');
    return null;
  }

  try {
    const supported = await isSupported();
    if (!supported) {
      console.warn('⚠️ Firebase Messaging not supported in this browser');
      return null;
    }

    const messaging = getMessaging();
    console.log('✅ Firebase Cloud Messaging initialized');
    return messaging;
  } catch (error) {
    console.error('❌ Error initializing FCM:', error);
    return null;
  }
};

/**
 * Request notification permissions and get FCM token for web
 * @param {string} userId - User ID to associate token with
 * @param {boolean} permissionAlreadyGranted - Skip permission request if already granted
 * @returns {Promise<string|null>} FCM token or null
 */
export const requestFCMToken = async (userId, permissionAlreadyGranted = false) => {
  if (isNativeApp) {
    console.log('📱 Using native push notifications - skipping FCM token');
    return null;
  }

  try {
    const messaging = await initializeFCM();
    if (!messaging) return null;

    // Request permission only if not already granted
    if (!permissionAlreadyGranted) {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        console.log('❌ Notification permission denied');
        return null;
      }
    }

    // Verify permission is actually granted
    if (Notification.permission !== 'granted') {
      console.log('❌ Notification permission not granted');
      return null;
    }

    // Get FCM token
    const token = await getToken(messaging, { vapidKey: VAPID_KEY });
    console.log('✅ FCM token obtained:', token.substring(0, 20) + '...');

    // Save token to Firestore
    if (userId) {
      await saveFCMToken(userId, token);
    }

    return token;
  } catch (error) {
    console.error('❌ Error getting FCM token:', error);
    return null;
  }
};

/**
 * Save FCM token to Firestore for sending notifications
 * @param {string} userId - User ID
 * @param {string} token - FCM token
 */
export const saveFCMToken = async (userId, token) => {
  try {
    await setDoc(doc(db, 'fcmTokens', userId), {
      token,
      platform: 'web',
      updatedAt: new Date(),
      userId
    });
    console.log('✅ FCM token saved to Firestore');
  } catch (error) {
    console.error('❌ Error saving FCM token:', error);
  }
};

/**
 * Delete FCM token from Firestore (e.g., on logout)
 * @param {string} userId - User ID
 */
export const deleteFCMToken = async (userId) => {
  try {
    await deleteDoc(doc(db, 'fcmTokens', userId));
    console.log('✅ FCM token deleted from Firestore');
  } catch (error) {
    console.error('❌ Error deleting FCM token:', error);
  }
};

/**
 * Setup foreground message listener (when app is open)
 * @param {Function} callback - Callback to handle incoming messages
 * @returns {Function} Unsubscribe function
 */
export const setupForegroundMessageListener = async (callback) => {
  if (isNativeApp) {
    console.log('📱 Native app - foreground messages handled by Capacitor');
    return () => {};
  }

  try {
    const messaging = await initializeFCM();
    if (!messaging) return () => {};

    const unsubscribe = onMessage(messaging, (payload) => {
      console.log('📨 Foreground message received:', payload);
      callback(payload);
    });

    return unsubscribe;
  } catch (error) {
    console.error('❌ Error setting up foreground listener:', error);
    return () => {};
  }
};

/**
 * Initialize Capacitor Push Notifications for native apps (iOS/Android)
 * @param {string} userId - User ID to associate token with
 */
export const initializeNativePushNotifications = async (userId) => {
  if (!isNativeApp) {
    console.log('🌐 Web platform - use FCM instead');
    return;
  }

  try {
    console.log('📱 Initializing native push notifications...');

    // Request permission
    let permStatus = await PushNotifications.checkPermissions();

    if (permStatus.receive === 'prompt') {
      permStatus = await PushNotifications.requestPermissions();
    }

    if (permStatus.receive !== 'granted') {
      console.log('❌ Push notification permission denied');
      return;
    }

    // Register with APNs/FCM
    await PushNotifications.register();
    console.log('✅ Registered for push notifications');

    // iOS: Read FCM token from UserDefaults (set by AppDelegate)
    if (Capacitor.getPlatform() === 'ios' && userId) {
      // Wait for AppDelegate to save the token to UserDefaults
      setTimeout(async () => {
        try {
          const { value } = await Preferences.get({ key: 'FCMToken' });

          if (value) {
            console.log('✅ Found FCM token in UserDefaults:', value.substring(0, 20) + '...');

            // Save to Firestore
            await setDoc(doc(db, 'fcmTokens', userId), {
              token: value,
              platform: 'ios',
              updatedAt: new Date(),
              userId
            });
            console.log('✅ FCM token automatically saved to Firestore!');
          } else {
            console.log('⚠️ No FCM token found in UserDefaults yet, will retry...');

            // Retry after another 2 seconds
            setTimeout(async () => {
              const { value: retryValue } = await Preferences.get({ key: 'FCMToken' });
              if (retryValue && userId) {
                console.log('✅ Found FCM token on retry:', retryValue.substring(0, 20) + '...');
                await setDoc(doc(db, 'fcmTokens', userId), {
                  token: retryValue,
                  platform: 'ios',
                  updatedAt: new Date(),
                  userId
                });
                console.log('✅ FCM token saved to Firestore on retry!');
              }
            }, 2000);
          }
        } catch (error) {
          console.error('❌ Error reading FCM token from UserDefaults:', error);
        }
      }, 2000); // Wait 2 seconds for AppDelegate to initialize
    }

    // Listen for registration success (fallback for Android or if iOS method fails)
    PushNotifications.addListener('registration', async (token) => {
      console.log('✅ Push registration success, token:', token.value.substring(0, 20) + '...');

      // Save APNs/FCM token to Firestore
      if (userId) {
        await setDoc(doc(db, 'fcmTokens', userId), {
          token: token.value,
          platform: Capacitor.getPlatform(), // 'ios' or 'android'
          updatedAt: new Date(),
          userId
        });
        console.log('✅ Native push token saved to Firestore via registration event');
      }
    });

    // Listen for registration errors
    PushNotifications.addListener('registrationError', (error) => {
      console.error('❌ Push registration error:', error);
    });

    // Listen for push notifications received
    PushNotifications.addListener('pushNotificationReceived', (notification) => {
      console.log('📨 Push notification received:', notification);
      // You can handle the notification here if needed
    });

    // Listen for notification actions
    PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
      console.log('🔔 Push notification action performed:', notification);
      // Handle notification tap
    });

  } catch (error) {
    console.error('❌ Error initializing native push notifications:', error);
  }
};

/**
 * Remove all push notification listeners (cleanup)
 */
export const cleanupNativePushNotifications = async () => {
  if (!isNativeApp) return;

  try {
    await PushNotifications.removeAllListeners();
    console.log('✅ Push notification listeners removed');
  } catch (error) {
    console.error('❌ Error cleaning up push notifications:', error);
  }
};