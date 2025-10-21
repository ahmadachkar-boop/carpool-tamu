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
      await LocalNotifications.schedule({
        notifications: [{
          title,
          body,
          id: Date.now(),
          schedule: { at: new Date(Date.now() + 100) },
          sound: 'default',
          smallIcon: 'ic_stat_icon_config_sample',
          iconColor: '#79F200'
        }]
      });
    } catch (error) {
      console.error('Error showing native notification:', error);
    }
  } else {
    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification(title, {
          body,
          icon: '/logo192.png',
          badge: '/logo192.png'
        });
      } catch (error) {
        console.error('Error showing web notification:', error);
      }
    }
  }
};

// Play notification sound
export const playNotificationSound = (() => {
  let audioContext = null;
  let isInitialized = false;

  const initAudio = () => {
    if (!isInitialized) {
      try {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        isInitialized = true;
        console.log('✅ Audio initialized');
      } catch (error) {
        console.error('Audio initialization error:', error);
      }
    }
  };

  return () => {
    if (!audioContext) {
      initAudio();
    }

    if (!audioContext) return;

    try {
      if (audioContext.state === 'suspended') {
        audioContext.resume();
      }

      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.frequency.value = 800;
      oscillator.type = 'sine';

      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.5);
    } catch (error) {
      console.error('Error playing notification sound:', error);
    }
  };
})();