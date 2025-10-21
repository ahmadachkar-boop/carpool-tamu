import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';

// Check if running as native app
export const isNativeApp = Capacitor.isNativePlatform();

// Request location permissions (native version)
export const requestNativeLocationPermission = async () => {
  try {
    console.log('📍 Requesting native location permission...');
    
    const permissions = await Geolocation.requestPermissions();
    
    if (permissions.location === 'granted') {
      console.log('✅ Permission granted!');
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

// Get current position (native version)
export const getNativePosition = async () => {
  try {
    const position = await Geolocation.getCurrentPosition({
      enableHighAccuracy: false, // Start with cell/wifi for reliability
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

// Watch position (native version) - works in background!
export const watchNativePosition = async (callback, errorCallback) => {
  try {
    const watchId = await Geolocation.watchPosition({
      enableHighAccuracy: false,
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