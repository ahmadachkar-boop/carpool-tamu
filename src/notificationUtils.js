import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';

export const isNativeApp = Capacitor.isNativePlatform();

// Check current notification permission status
export const checkNotificationPermission = async () => {
  if (isNativeApp) {
    try {
      const result = await LocalNotifications.checkPermissions();
      console.log('📱 Current notification permission:', result.display);
      return result.display === 'granted';
    } catch (error) {
      console.error('Error checking notification permission:', error);
      return false;
    }
  } else {
    if (!('Notification' in window)) {
      return false;
    }
    return Notification.permission === 'granted';
  }
};

// Request notification permissions
export const requestNotificationPermission = async () => {
  if (isNativeApp) {
    try {
      // First check current status
      const currentStatus = await LocalNotifications.checkPermissions();
      console.log('📱 Current status:', currentStatus.display);
      
      if (currentStatus.display === 'granted') {
        return true;
      }
      
      if (currentStatus.display === 'denied') {
        console.log('📱 Permission previously denied');
        return false;
      }
      
      // Request permission
      const result = await LocalNotifications.requestPermissions();
      console.log('📱 Permission result:', result.display);
      return result.display === 'granted';
    } catch (error) {
      console.error('Native notification permission error:', error);
      return false;
    }
  } else {
    if (!('Notification' in window)) {
      return false;
    }
    try {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    } catch (error) {
      console.error('Web notification permission error:', error);
      return false;
    }
  }
};

// Show notification
export const showNotification = async (title, body) => {
  if (isNativeApp) {
    try {
      // For immediate notifications on iOS/Android, use schedule with current time
      // This is more reliable than scheduling 100ms in the future
      const notificationId = Date.now();

      await LocalNotifications.schedule({
        notifications: [{
          title,
          body,
          id: notificationId,
          schedule: { at: new Date() }, // Trigger immediately
          sound: 'default',
          smallIcon: 'ic_stat_icon_config_sample',
          iconColor: '#79F200',
          // iOS-specific options
          attachments: [],
          actionTypeId: '',
          extra: null
        }]
      });

      console.log('✅ Native notification scheduled:', notificationId);
    } catch (error) {
      console.error('❌ Error showing native notification:', error);

      // Fallback: try showing without scheduling (some platforms support this)
      try {
        await LocalNotifications.schedule({
          notifications: [{
            title,
            body,
            id: Date.now()
          }]
        });
      } catch (fallbackError) {
        console.error('❌ Fallback notification also failed:', fallbackError);
      }
    }
  } else {
    // Web notifications
    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        const notification = new Notification(title, {
          body,
          icon: '/logo192.png',
          badge: '/logo192.png',
          tag: 'carpool-notification', // Prevents duplicate notifications
          requireInteraction: false,
          silent: false
        });

        // Auto-close after 5 seconds
        setTimeout(() => {
          notification.close();
        }, 5000);

        console.log('✅ Web notification shown');
      } catch (error) {
        console.error('❌ Error showing web notification:', error);
      }
    } else {
      console.warn('⚠️ Web notifications not available or not permitted');
    }
  }
};

// Initialize audio context (must be called from user interaction on iOS)
let audioContext = null;
let isAudioInitialized = false;

export const initializeAudioContext = () => {
  if (isAudioInitialized) {
    console.log('🔊 Audio already initialized');
    return true;
  }

  // Skip audio initialization for native apps (they use native notifications)
  if (isNativeApp) {
    console.log('🔊 Skipping web audio for native app');
    return false;
  }

  try {
    // iOS requires AudioContext to be created from user gesture
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    isAudioInitialized = true;
    console.log('✅ Audio context initialized from user gesture');

    // Resume if suspended (common on iOS)
    if (audioContext.state === 'suspended') {
      audioContext.resume().then(() => {
        console.log('✅ Audio context resumed');
      });
    }

    return true;
  } catch (error) {
    console.error('❌ Audio initialization error:', error);
    return false;
  }
};

// Play notification sound
export const playNotificationSound = async () => {
  // Native apps use system notification sounds
  if (isNativeApp) {
    return;
  }

  // Check if audio is initialized
  if (!audioContext) {
    console.warn('⚠️ Audio not initialized. Call initializeAudioContext() from a user gesture first.');
    return;
  }

  try {
    // Resume audio context if suspended (iOS requirement)
    if (audioContext.state === 'suspended') {
      await audioContext.resume();
    }

    // Create a simple notification beep
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    // Two-tone notification sound
    oscillator.frequency.value = 800; // Hz
    oscillator.type = 'sine';

    // Fade out envelope
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.5);

    console.log('🔔 Notification sound played');
  } catch (error) {
    console.error('❌ Error playing notification sound:', error);
  }
};