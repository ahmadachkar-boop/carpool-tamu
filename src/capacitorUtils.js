import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';

// Check if running as native app
export const isNativeApp = Capacitor.isNativePlatform();

// Request "While Using" location permissions
export const requestNativeLocationPermission = async () => {
  try {
    console.log('📍 Requesting native location permission (While Using)...');
    
    const permissions = await Geolocation.requestPermissions();
    
    if (permissions.location === 'granted') {
      console.log('✅ While Using permission granted!');
      return { success: true };
    } else {
      console.log('❌ Permission denied');
      return { success: false, error: 'Permission denied' };
    }
  } catch (error) {
    console.error('Permission error:', error);
    return { success: false, error: error.message };
  }
};

// Request "Always Allow" background location permission
// NOTE: iOS requires a two-step process:
// 1. First grant "When In Use" permission (via requestNativeLocationPermission)
// 2. Then iOS may auto-prompt for "Always" after the app demonstrates background need
// 3. Or user must manually enable "Always" in iPhone Settings > App > Location
export const requestAlwaysLocationPermission = async () => {
  try {
    console.log('📍 Checking background location permission status...');

    // Check current permission state
    const currentPerms = await Geolocation.checkPermissions();
    console.log('Current location permission:', currentPerms);

    if (currentPerms.location === 'denied') {
      console.log('❌ Location permission denied - user must enable in Settings');
      return {
        success: false,
        error: 'Location permission is denied. Please enable it in Settings.',
        needsSettings: true
      };
    }

    // iOS Limitation: Cannot directly request "Always" permission
    // The Geolocation plugin can only request "When In Use"
    // For "Always" permission, iOS requires:
    // - App to already have "When In Use" permission
    // - App to demonstrate it needs background tracking
    // - Then iOS will auto-prompt, OR user must manually enable in Settings

    if (currentPerms.location === 'granted') {
      // We have "When In Use" but we don't know if we have "Always"
      // iOS doesn't expose this distinction through the Capacitor API
      console.log('✅ Location permission granted (When In Use or Always)');

      // Start using location in background - iOS will auto-prompt for "Always" if appropriate
      return {
        success: true,
        granted: true,
        message: 'Location permission granted. If using iOS, you may need to enable "Always" in Settings for background tracking.'
      };
    }

    // Permission is in "prompt" state - request it
    const permissions = await Geolocation.requestPermissions();
    console.log('📍 Permission result:', permissions);

    if (permissions.location === 'granted') {
      console.log('✅ Permission granted - iOS may prompt for "Always" after background use');
      return {
        success: true,
        granted: true,
        message: 'Permission granted. Continue using the app, and iOS may prompt for background access.'
      };
    } else {
      return {
        success: false,
        error: 'Permission denied',
        needsSettings: true
      };
    }
  } catch (error) {
    console.error('Background permission error:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

// Check current permission status
export const checkLocationPermission = async () => {
  try {
    const permissions = await Geolocation.checkPermissions();
    return permissions.location;
  } catch (error) {
    console.error('Check permission error:', error);
    return 'denied';
  }
};

// Get current position
export const getNativePosition = async () => {
  try {
    const position = await Geolocation.getCurrentPosition({
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 5000
    });
    
    return {
      success: true,
      coords: {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
        speed: position.coords.speed
      }
    };
  } catch (error) {
    console.error('Get position error:', error);
    return { success: false, error: error.message };
  }
};

// Watch position (works in background with "Always" permission!)
export const watchNativePosition = async (callback, errorCallback) => {
  try {
    const watchId = await Geolocation.watchPosition({
      enableHighAccuracy: true,
      timeout: 30000,
      maximumAge: 5000
    }, (position, err) => {
      if (err) {
        console.error('Watch error:', err);
        if (errorCallback) errorCallback(err);
        return;
      }
      
      if (position) {
        callback({
          coords: {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            speed: position.coords.speed
          }
        });
      }
    });
    
    return watchId;
  } catch (error) {
    console.error('Watch position error:', error);
    if (errorCallback) errorCallback(error);
    return null;
  }
};

// Clear watch
export const clearNativeWatch = async (watchId) => {
  if (watchId) {
    await Geolocation.clearWatch({ id: watchId });
  }
};

// Get iOS-specific settings instructions
export const getIOSSettingsInstructions = () => {
  return {
    alwaysLocation: `To enable background location tracking on iOS:

1. Open your iPhone Settings app
2. Scroll down and find "Carpool Internal"
3. Tap on it
4. Tap "Location"
5. Select "Always"
6. Return to the app

This allows the app to track your location even when it's in the background, which is essential for the couch to monitor your position during rides.`,

    notifications: `To enable notifications on iOS:

1. Open your iPhone Settings app
2. Scroll down and find "Carpool Internal"
3. Tap on it
4. Tap "Notifications"
5. Enable "Allow Notifications"
6. Choose your preferred notification style

This allows you to receive messages from the couch even when the app is in the background.`
  };
};

// IMPORTANT NOTE FOR DEVELOPERS:
// For production-grade background location tracking on iOS, consider using:
// @capacitor-community/background-geolocation
//
// The standard @capacitor/geolocation plugin has limitations:
// - Background tracking stops after ~10 minutes when app is backgrounded
// - No significant location change monitoring
// - Limited battery optimization
//
// To install the enhanced plugin:
// npm install @capacitor-community/background-geolocation
// npx cap sync
//
// This would provide:
// - Continuous background tracking (even when app is terminated)
// - Motion detection (stops tracking when stationary)
// - Better battery management
// - Geofencing support