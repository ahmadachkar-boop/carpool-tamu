import { Capacitor } from '@capacitor/core';

// NOTE: To enable full haptic support, install the Haptics plugin:
// npm install @capacitor/haptics
// npx cap sync
//
// Until then, we'll use fallback vibration for native apps

let Haptics = null;
let ImpactStyle = null;
let NotificationType = null;

// Try to import Haptics if available
try {
  const hapticModule = require('@capacitor/haptics');
  Haptics = hapticModule.Haptics;
  ImpactStyle = hapticModule.ImpactStyle;
  NotificationType = hapticModule.NotificationType;
} catch (error) {
  console.log('📳 Haptics plugin not installed, using fallback vibration');
}

export const isNativeApp = Capacitor.isNativePlatform();

// Check if haptics are available
export const isHapticsAvailable = async () => {
  if (!isNativeApp) {
    // Check for web vibration API
    return 'vibrate' in navigator;
  }

  // For native apps, haptics should be available on iOS
  return true;
};

// Light haptic feedback (for button taps)
export const hapticLight = async () => {
  if (isNativeApp && Haptics && ImpactStyle) {
    try {
      await Haptics.impact({ style: ImpactStyle.Light });
    } catch (error) {
      console.log('Haptic not available:', error);
    }
  } else if ('vibrate' in navigator) {
    navigator.vibrate(10); // 10ms vibration
  }
};

// Medium haptic feedback (for selections)
export const hapticMedium = async () => {
  if (isNativeApp && Haptics && ImpactStyle) {
    try {
      await Haptics.impact({ style: ImpactStyle.Medium });
    } catch (error) {
      console.log('Haptic not available:', error);
    }
  } else if ('vibrate' in navigator) {
    navigator.vibrate(20); // 20ms vibration
  }
};

// Heavy haptic feedback (for errors/warnings)
export const hapticHeavy = async () => {
  if (isNativeApp && Haptics && ImpactStyle) {
    try {
      await Haptics.impact({ style: ImpactStyle.Heavy });
    } catch (error) {
      console.log('Haptic not available:', error);
    }
  } else if ('vibrate' in navigator) {
    navigator.vibrate(50); // 50ms vibration
  }
};

// Success notification haptic
export const hapticSuccess = async () => {
  if (isNativeApp && Haptics && NotificationType) {
    try {
      await Haptics.notification({ type: NotificationType.Success });
    } catch (error) {
      console.log('Haptic not available:', error);
    }
  } else if ('vibrate' in navigator) {
    // Pattern: short-short for success
    navigator.vibrate([10, 50, 10]);
  }
};

// Warning notification haptic
export const hapticWarning = async () => {
  if (isNativeApp && Haptics && NotificationType) {
    try {
      await Haptics.notification({ type: NotificationType.Warning });
    } catch (error) {
      console.log('Haptic not available:', error);
    }
  } else if ('vibrate' in navigator) {
    // Pattern: medium-medium for warning
    navigator.vibrate([20, 100, 20]);
  }
};

// Error notification haptic
export const hapticError = async () => {
  if (isNativeApp && Haptics && NotificationType) {
    try {
      await Haptics.notification({ type: NotificationType.Error });
    } catch (error) {
      console.log('Haptic not available:', error);
    }
  } else if ('vibrate' in navigator) {
    // Pattern: long vibration for error
    navigator.vibrate([50, 100, 50, 100, 50]);
  }
};

// Selection change haptic (subtle)
export const hapticSelection = async () => {
  if (isNativeApp && Haptics) {
    try {
      await Haptics.selectionStart();
      // Brief delay
      await new Promise(resolve => setTimeout(resolve, 50));
      await Haptics.selectionChanged();
      await new Promise(resolve => setTimeout(resolve, 50));
      await Haptics.selectionEnd();
    } catch (error) {
      console.log('Haptic not available:', error);
    }
  } else if ('vibrate' in navigator) {
    navigator.vibrate(5); // Very light tap
  }
};

// New message alert pattern
export const hapticNewMessage = async () => {
  if (isNativeApp && Haptics && ImpactStyle) {
    try {
      // Two light taps
      await Haptics.impact({ style: ImpactStyle.Light });
      await new Promise(resolve => setTimeout(resolve, 100));
      await Haptics.impact({ style: ImpactStyle.Light });
    } catch (error) {
      console.log('Haptic not available:', error);
    }
  } else if ('vibrate' in navigator) {
    // Pattern: short-pause-short
    navigator.vibrate([20, 100, 20]);
  }
};

// Message sent confirmation
export const hapticMessageSent = async () => {
  if (isNativeApp && Haptics && NotificationType) {
    try {
      await Haptics.notification({ type: NotificationType.Success });
    } catch (error) {
      console.log('Haptic not available:', error);
    }
  } else if ('vibrate' in navigator) {
    navigator.vibrate(15);
  }
};

// Location enabled
export const hapticLocationEnabled = async () => {
  if (isNativeApp && Haptics && NotificationType) {
    try {
      // Success pattern
      await Haptics.notification({ type: NotificationType.Success });
    } catch (error) {
      console.log('Haptic not available:', error);
    }
  } else if ('vibrate' in navigator) {
    navigator.vibrate([10, 50, 10, 50, 10]);
  }
};

// Export all haptic functions
export default {
  light: hapticLight,
  medium: hapticMedium,
  heavy: hapticHeavy,
  success: hapticSuccess,
  warning: hapticWarning,
  error: hapticError,
  selection: hapticSelection,
  newMessage: hapticNewMessage,
  messageSent: hapticMessageSent,
  locationEnabled: hapticLocationEnabled,
  isAvailable: isHapticsAvailable
};
