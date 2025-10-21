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
export const requestAlwaysLocationPermission = async () => {
  try {
    console.log('📍 Requesting ALWAYS location permission...');
    
    // First check current status
    const currentPerms = await Geolocation.checkPermissions();
    console.log('Current location permission:', currentPerms.location);
    
    if (currentPerms.location === 'denied') {
      console.log('❌ Location permission denied - cannot request always');
      return { 
        success: false, 
        error: 'Location permission is denied. Please enable it in Settings.' 
      };
    }
    
    // Request permissions with coarseLocation: false for more accurate tracking
    const permissions = await Geolocation.requestPermissions({
      permissions: ['location', 'coarseLocation']
    });
    
    console.log('📍 Permission result:', permissions);
    
    if (permissions.location === 'granted') {
      console.log('✅ Always permission granted (or already had while using)!');
      return { success: true };
    } else {
      return { success: false, error: 'Always permission denied' };
    }
  } catch (error) {
    console.error('Always permission error:', error);
    return { success: false, error: error.message };
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