import React, { useState, useEffect, useRef } from 'react';
import { db } from '../firebase';
import { collection, addDoc, query, where, onSnapshot, orderBy, updateDoc, doc, Timestamp, getDocs } from 'firebase/firestore';
import { useActiveNDR } from '../ActiveNDRContext';
import { useAuth } from '../AuthContext';
import { MapPin, Send, Navigation, Phone, User, Car, Clock, AlertCircle, MessageSquare, CheckCircle, Bell, BellOff, X } from 'lucide-react';
import { GoogleMap } from '@react-google-maps/api';
import { useGoogleMaps } from '../GoogleMapsProvider';

const CouchNavigator = () => {
  const { activeNDR, loading: ndrLoading } = useActiveNDR();
  const { userProfile } = useAuth();
  const { isLoaded: googleMapsLoaded, loadError: googleMapsError } = useGoogleMaps();
  const [viewMode, setViewMode] = useState('couch');
  const [selectedCar, setSelectedCar] = useState(null);
  const [carNumber, setCarNumber] = useState('');
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [carLocations, setCarLocations] = useState({});
  const [locationEnabled, setLocationEnabled] = useState(false);
  const [locationError, setLocationError] = useState('');
  const [activeRides, setActiveRides] = useState([]);
  const [availableCars, setAvailableCars] = useState([]);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [updateInterval, setUpdateInterval] = useState(5000);
  const [debugStatus, setDebugStatus] = useState('');
  const [showDebug, setShowDebug] = useState(false);
  const [lastLocationUpdate, setLastLocationUpdate] = useState(null);
  const messagesEndRef = useRef(null);
  const locationWatchId = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef({});
  const lastMessageCountRef = useRef(0);
  const notificationAudioRef = useRef(null);
  const lastLocationRef = useRef(null);
  const locationUpdateTimerRef = useRef(null);

  // Detect platform
  const [platformInfo, setPlatformInfo] = useState({
    isIOS: false,
    isAndroid: false,
    isMobile: false,
    isPWA: false
  });

  useEffect(() => {
    const userAgent = navigator.userAgent || navigator.vendor || window.opera;
    const isIOS = /iPad|iPhone|iPod/.test(userAgent);
    const isAndroid = /android/i.test(userAgent);
    const isMobile = isIOS || isAndroid;
    const isPWA = window.matchMedia('(display-mode: standalone)').matches || 
                  window.navigator.standalone === true;

    setPlatformInfo({ isIOS, isAndroid, isMobile, isPWA });

    if (isMobile && 'Notification' in window) {
      if (Notification.permission === 'default') {
        console.log('Notification permission not yet requested');
      } else if (Notification.permission === 'granted') {
        setNotificationsEnabled(true);
      }
    }
  }, []);

  // Initialize notification sound
  useEffect(() => {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    notificationAudioRef.current = audioContext;
  }, []);

  // Play notification sound
  const playNotificationSound = () => {
    if (!notificationAudioRef.current) return;
    
    try {
      const audioContext = notificationAudioRef.current;
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

  const mapContainerStyle = {
    width: '100%',
    height: '400px',
    borderRadius: '12px'
  };

  const mapOptions = {
    disableDefaultUI: false,
    zoomControl: true,
    mapTypeControl: false,
    streetViewControl: false,
    fullscreenControl: true
  };

  const onMapLoad = (map) => {
    mapRef.current = map;
  };

  // Update markers when car locations change - FIXED to use standard Marker
  useEffect(() => {
    if (!mapRef.current || !googleMapsLoaded) return;

    // Clear existing markers
    Object.values(markersRef.current).forEach(marker => {
      if (marker && marker.setMap) {
        marker.setMap(null);
      }
    });
    markersRef.current = {};

    // Add new markers using standard Marker (not AdvancedMarkerElement)
    Object.entries(carLocations).forEach(([carNum, location]) => {
      if (!location.latitude || !location.longitude) return;

      try {
        const marker = new window.google.maps.Marker({
          map: mapRef.current,
          position: {
            lat: location.latitude,
            lng: location.longitude
          },
          title: `Car ${carNum}`,
          icon: {
            path: window.google.maps.SymbolPath.CIRCLE,
            scale: 10,
            fillColor: '#4285F4',
            fillOpacity: 1,
            strokeColor: '#ffffff',
            strokeWeight: 2
          },
          label: {
            text: String(carNum),
            color: '#ffffff',
            fontSize: '12px',
            fontWeight: 'bold'
          }
        });

        markersRef.current[carNum] = marker;
      } catch (error) {
        console.error('Error creating marker:', error);
      }
    });

    return () => {
      Object.values(markersRef.current).forEach(marker => {
        if (marker && marker.setMap) {
          marker.setMap(null);
        }
      });
    };
  }, [carLocations, googleMapsLoaded]);

  // Scroll to bottom of messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Load available cars from NDR
  useEffect(() => {
    if (!activeNDR) return;

    const loadCars = async () => {
      try {
        const ndrQuery = query(collection(db, 'ndrs'), where('id', '==', activeNDR.id));
        const ndrDoc = await getDocs(ndrQuery);
        if (!ndrDoc.empty) {
          const cars = ndrDoc.docs[0].data().cars || [];
          setAvailableCars(cars);
        }
      } catch (error) {
        console.error('Error loading cars:', error);
      }
    };

    loadCars();
  }, [activeNDR]);

  // Listen to messages with proper integer conversion and iOS PWA support
  useEffect(() => {
    if (!activeNDR || !selectedCar) {
      console.log('Message listener not active:', { activeNDR: !!activeNDR, selectedCar });
      setMessages([]);
      lastMessageCountRef.current = 0;
      return;
    }

    const carNum = parseInt(selectedCar, 10);

    console.log('🔵 Setting up message listener:', {
      ndrId: activeNDR.id,
      carNumber: carNum,
      carNumberType: typeof carNum,
      viewMode
    });

    const messagesRef = collection(db, 'couchMessages');
    const messagesQuery = query(
      messagesRef,
      where('ndrId', '==', activeNDR.id),
      where('carNumber', '==', carNum),
      orderBy('timestamp', 'asc')
    );

    const unsubscribe = onSnapshot(
      messagesQuery,
      { includeMetadataChanges: true },
      (snapshot) => {
        if (snapshot.metadata.hasPendingWrites) {
          console.log('📝 Skipping pending writes...');
          return;
        }

        console.log('📨 Message snapshot received:', {
          numDocs: snapshot.docs.length,
          fromCache: snapshot.metadata.fromCache,
          viewMode,
          carNumber: carNum
        });
        
        const msgs = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            timestamp: data.timestamp?.toDate()
          };
        });
        
        console.log('Processed messages:', msgs.length);
        
        // Play notification sound if new message received
        if (lastMessageCountRef.current > 0 && msgs.length > lastMessageCountRef.current) {
          const newMessage = msgs[msgs.length - 1];
          const isFromOtherParty = (viewMode === 'couch' && newMessage.sender === 'navigator') ||
                                    (viewMode === 'navigator' && newMessage.sender === 'couch');
          
          if (isFromOtherParty) {
            playNotificationSound();
            
            if (notificationsEnabled && document.hidden) {
              try {
                new Notification('New Message', {
                  body: `${newMessage.senderName}: ${newMessage.message.substring(0, 50)}${newMessage.message.length > 50 ? '...' : ''}`,
                  icon: '/logo192.png',
                  tag: `message-${newMessage.id}`,
                  requireInteraction: false,
                  silent: false
                });
              } catch (error) {
                console.error('Error showing notification:', error);
              }
            }
          }
        }
        
        lastMessageCountRef.current = msgs.length;
        setMessages(msgs);
      },
      (error) => {
        console.error('❌ Message listener error:', error);
        
        if (error.code === 'failed-precondition') {
          console.error('🔴 FIRESTORE INDEX REQUIRED!');
          setDebugStatus('❌ Database index missing');
        } else if (error.code === 'unavailable') {
          console.error('🔴 Network unavailable');
          setDebugStatus('❌ Network error');
        } else {
          setDebugStatus(`❌ Error: ${error.message}`);
        }
      }
    );

    return () => {
      console.log('🔴 Cleaning up message listener for car:', carNum);
      unsubscribe();
    };
  }, [activeNDR, selectedCar, viewMode, notificationsEnabled]);

  // Listen to all car locations with iOS PWA support
  useEffect(() => {
    if (!activeNDR || viewMode !== 'couch') return;

    const locationsRef = collection(db, 'carLocations');
    const locationsQuery = query(
      locationsRef,
      where('ndrId', '==', activeNDR.id)
    );

    const unsubscribe = onSnapshot(
      locationsQuery,
      { includeMetadataChanges: true },
      (snapshot) => {
        if (!snapshot.metadata.hasPendingWrites) {
          const locations = {};
          snapshot.docs.forEach(doc => {
            const data = doc.data();
            locations[data.carNumber] = {
              ...data,
              updatedAt: data.updatedAt?.toDate()
            };
          });
          console.log('📍 Car locations updated:', locations);
          setCarLocations(locations);
        }
      }
    );

    return () => unsubscribe();
  }, [activeNDR, viewMode]);

  // Load active rides with proper integer conversion and iOS PWA support
  useEffect(() => {
    if (!activeNDR || !selectedCar) {
      setActiveRides([]);
      return;
    }

    const carNum = parseInt(selectedCar, 10);

    const ridesRef = collection(db, 'rides');
    const ridesQuery = query(
      ridesRef,
      where('ndrId', '==', activeNDR.id),
      where('carNumber', '==', carNum),
      where('status', 'in', ['active', 'pending'])
    );

    const unsubscribe = onSnapshot(
      ridesQuery,
      { includeMetadataChanges: true },
      (snapshot) => {
        if (!snapshot.metadata.hasPendingWrites) {
          const rides = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            requestedAt: doc.data().requestedAt?.toDate()
          }));
          setActiveRides(rides);
        }
      }
    );

    return () => unsubscribe();
  }, [activeNDR, selectedCar]);

  // Calculate distance between two points
  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371e3;
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c;
  };

  // Update location to Firestore - FIXED with immediate write and better error handling
  const updateLocationToFirestore = async (position) => {
    if (!activeNDR || !selectedCar) {
      console.log('⏭️ Skipping location update - missing activeNDR or selectedCar');
      return;
    }

    const { latitude, longitude, speed, accuracy } = position.coords;
    
    console.log(`📍 Location: ${latitude.toFixed(6)}, ${longitude.toFixed(6)} (±${accuracy}m)`);

    // More lenient distance-based filtering (only after first successful write)
    if (lastLocationRef.current && lastLocationRef.current.lastWriteSuccess) {
      const distance = calculateDistance(
        lastLocationRef.current.latitude,
        lastLocationRef.current.longitude,
        latitude,
        longitude
      );

      // Only filter if movement is minimal AND accuracy is good
      if (distance < 30 && accuracy < 100) {
        console.log(`⏭️ Skipping update - movement only ${Math.round(distance)}m`);
        return;
      }
      
      console.log(`📏 Moved ${Math.round(distance)}m since last update`);
    } else {
      console.log('🆕 First location update or previous write failed - forcing write');
    }

    // Adaptive polling based on speed
    let newInterval = 5000;
    if (speed !== null && speed !== undefined) {
      if (speed > 20) {
        newInterval = 3000; // Fast movement
      } else if (speed > 5) {
        newInterval = 5000; // Medium speed
      } else if (speed > 1) {
        newInterval = 10000; // Slow movement
      } else {
        newInterval = 30000; // Stationary
      }
      console.log(`🏃 Speed: ${speed.toFixed(1)} m/s, interval: ${newInterval}ms`);
    }

    if (newInterval !== updateInterval) {
      setUpdateInterval(newInterval);
    }

    try {
      const locationsRef = collection(db, 'carLocations');
      const carNum = parseInt(selectedCar, 10);
      
      console.log(`💾 Updating Firestore for car ${carNum}...`);
      
      const existingQuery = query(
        locationsRef,
        where('ndrId', '==', activeNDR.id),
        where('carNumber', '==', carNum)
      );
      
      const existingDocs = await getDocs(existingQuery);
      
      if (existingDocs.empty) {
        await addDoc(locationsRef, {
          ndrId: activeNDR.id,
          carNumber: carNum,
          latitude,
          longitude,
          accuracy,
          updatedAt: Timestamp.now()
        });
        console.log('✅ Location document created');
      } else {
        const docRef = doc(db, 'carLocations', existingDocs.docs[0].id);
        await updateDoc(docRef, {
          latitude,
          longitude,
          accuracy,
          updatedAt: Timestamp.now()
        });
        console.log('✅ Location updated in Firestore');
      }
      
      // Only update lastLocationRef AFTER successful write
      lastLocationRef.current = { 
        latitude, 
        longitude, 
        lastWriteSuccess: true 
      };
      
      // Update UI to show last successful update
      setLastLocationUpdate(new Date());
      
      // Clear any previous errors
      setLocationError('');
      
    } catch (error) {
      console.error('❌ Error updating location to Firestore:', error);
      
      // Mark write as failed so next update will retry
      if (lastLocationRef.current) {
        lastLocationRef.current.lastWriteSuccess = false;
      }
      
      setDebugStatus('⚠️ Firestore update failed - will retry');
      setTimeout(() => setDebugStatus(''), 3000);
    }
  };

  // Location tracking for navigator - FIXED for iOS PWA
  useEffect(() => {
    if (viewMode !== 'navigator' || !selectedCar || !locationEnabled || !activeNDR) {
      if (locationUpdateTimerRef.current) {
        clearInterval(locationUpdateTimerRef.current);
        locationUpdateTimerRef.current = null;
      }
      if (locationWatchId.current) {
        navigator.geolocation.clearWatch(locationWatchId.current);
        locationWatchId.current = null;
      }
      return;
    }

    console.log('🚗 Starting location tracking for car:', selectedCar);

    const handleError = (error) => {
      console.error('❌ watchPosition error:', error.code, error.message);
      
      if (error.code === 2) {
        console.warn('⚠️ Position temporarily unavailable, will retry...');
        return;
      }
      
      if (error.code === 3) {
        console.warn('⚠️ Location timeout, will retry...');
        return;
      }
      
      if (error.code === 1) {
        setLocationError('❌ Location permission was revoked');
        setLocationEnabled(false);
      }
    };

    const watchOptions = {
      enableHighAccuracy: false,
      timeout: 30000,
      maximumAge: 5000
    };

    console.log('📍 Starting watchPosition with options:', watchOptions);

    locationWatchId.current = navigator.geolocation.watchPosition(
      (position) => {
        console.log('✅ Location update received:', position.coords.latitude, position.coords.longitude);
        updateLocationToFirestore(position);
      },
      handleError,
      watchOptions
    );

    const handleVisibilityChange = () => {
      if (document.hidden) {
        console.log('📱 App backgrounded');
      } else {
        console.log('📱 App foregrounded');
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      console.log('🔴 Cleaning up location tracking');
      if (locationWatchId.current) {
        navigator.geolocation.clearWatch(locationWatchId.current);
        locationWatchId.current = null;
      }
      if (locationUpdateTimerRef.current) {
        clearInterval(locationUpdateTimerRef.current);
        locationUpdateTimerRef.current = null;
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [viewMode, selectedCar, locationEnabled, activeNDR]);

  // Check if location permission is already granted/denied
  const checkLocationPermission = async () => {
    if ('permissions' in navigator) {
      try {
        const result = await navigator.permissions.query({ name: 'geolocation' });
        console.log('📍 Permission state:', result.state);
        return result.state;
      } catch (error) {
        console.log('Permissions API not available:', error);
        return 'prompt';
      }
    }
    return 'prompt';
  };

  const requestLocationPermission = async () => {
    if (!navigator.geolocation) {
      setLocationError('❌ Geolocation is not supported by your device');
      return;
    }

    setLocationError('');
    setDebugStatus('📍 Checking permission...');
    
    const permissionState = await checkLocationPermission();
    console.log('Current permission state:', permissionState);
    
    if (permissionState === 'denied') {
      let errorMessage = '⚠️ Location access is blocked. ';
      if (platformInfo.isIOS) {
        if (platformInfo.isPWA) {
          errorMessage += '\n\n📱 To enable:\n1. Go to iPhone Settings\n2. Scroll down and find this app\n3. Tap Location\n4. Select "While Using"';
        } else {
          errorMessage += '\n\n🌐 To enable:\n1. Go to iPhone Settings\n2. Safari → Location\n3. Select "Ask" or "Allow"';
        }
      }
      setLocationError(errorMessage);
      setDebugStatus('❌ Permission blocked');
      return;
    }

    setDebugStatus('📍 Requesting location...');
    console.log('🔔 Requesting geolocation - popup should appear!');
    
    const tryGetLocation = (highAccuracy, attempt = 1) => {
      return new Promise((resolve, reject) => {
        console.log(`Attempt ${attempt} with highAccuracy: ${highAccuracy}`);
        
        navigator.geolocation.getCurrentPosition(
          (position) => {
            console.log('✅ Location obtained!', position);
            resolve(position);
          },
          (error) => {
            console.error(`❌ Attempt ${attempt} failed:`, error);
            reject(error);
          },
          {
            enableHighAccuracy: highAccuracy,
            timeout: attempt === 1 ? 15000 : 30000,
            maximumAge: 0
          }
        );
      });
    };

    try {
      // Attempt 1: High accuracy
      const position = await tryGetLocation(true, 1);
      console.log('✅ Location permission granted!', position);
      
      // CRITICAL FIX: Write initial location to Firestore immediately
      await updateLocationToFirestore(position);
      
      setLocationEnabled(true);
      setDebugStatus('✅ Location enabled!');
      setLocationError('');
      setTimeout(() => setDebugStatus(''), 3000);
      
    } catch (error1) {
      console.error('❌ High accuracy failed, trying low accuracy...', error1);
      
      try {
        const position = await tryGetLocation(false, 2);
        console.log('✅ Location obtained with low accuracy!', position);
        
        // CRITICAL FIX: Write initial location to Firestore immediately
        await updateLocationToFirestore(position);
        
        setLocationEnabled(true);
        setDebugStatus('✅ Location enabled (low accuracy)');
        setLocationError('⚠️ Using WiFi/cell tower location (less accurate). For better accuracy, go outside or near a window.');
        setTimeout(() => setLocationError(''), 8000);
        
      } catch (error2) {
        console.error('❌ Both attempts failed:', error2);
        handleLocationError(error2);
      }
    }
  };

  const handleLocationError = (error) => {
    console.error('Location error code:', error.code);
    console.error('Location error message:', error.message);
    
    let errorMessage = '';
    let instructions = '';
    
    switch(error.code) {
      case 1:
        errorMessage = '🚫 Location permission was denied';
        if (platformInfo.isIOS) {
          if (platformInfo.isPWA) {
            instructions = '\n\n📱 To fix:\n1. Close this app\n2. iPhone Settings → [This App]\n3. Location → "While Using"\n4. Reopen app';
          } else {
            instructions = '\n\n🌐 To fix:\n1. iPhone Settings → Safari\n2. Location → "Ask" or "Allow"\n3. Refresh page';
          }
        }
        break;
        
      case 2:
        errorMessage = '📍 Unable to determine your location';
        instructions = '\n\n⚠️ This usually means:\n\n';
        instructions += '1️⃣ Location Services are OFF\n';
        instructions += '   • iPhone Settings → Privacy & Security\n';
        instructions += '   • Location Services → Toggle ON (green)\n\n';
        instructions += '2️⃣ No GPS signal\n';
        instructions += '   • Go outside or near a window\n';
        instructions += '   • Wait 30 seconds for GPS to lock\n\n';
        instructions += '3️⃣ Airplane mode is ON\n';
        instructions += '   • Swipe down and check airplane icon\n\n';
        instructions += '4️⃣ Poor signal area\n';
        instructions += '   • Try again in a different location';
        break;
        
      case 3:
        errorMessage = '⏱️ Location request timed out';
        instructions = '\n\nTry again:\n• Make sure you\'re not in airplane mode\n• Go outside for better GPS signal\n• Wait a moment and try again';
        break;
        
      default:
        errorMessage = '❌ Location error occurred';
        instructions = '\n\nError details: ' + (error.message || 'Unknown error');
    }
    
    setLocationError(errorMessage + instructions);
    setLocationEnabled(false);
    setDebugStatus('❌ Location failed');
  };

  const requestNotificationPermission = async () => {
    if (!('Notification' in window)) {
      alert('Notifications not supported');
      return false;
    }

    try {
      const permission = await Notification.requestPermission();
      const granted = permission === 'granted';
      setNotificationsEnabled(granted);
      
      if (granted) {
        new Notification('Notifications Enabled', {
          body: 'You will now receive message updates',
          icon: '/logo192.png',
          tag: 'test-notification'
        });
      }
      
      return granted;
    } catch (error) {
      console.error('Notification error:', error);
      return false;
    }
  };

  // Send message with proper integer conversion
  const sendMessage = async () => {
    if (!newMessage.trim()) {
      setDebugStatus('❌ Message is empty');
      setTimeout(() => setDebugStatus(''), 2000);
      return;
    }
    
    if (!selectedCar) {
      setDebugStatus('❌ No car selected');
      setTimeout(() => setDebugStatus(''), 2000);
      return;
    }
    
    if (!activeNDR) {
      setDebugStatus('❌ No active NDR');
      setTimeout(() => setDebugStatus(''), 2000);
      return;
    }

    if (sendingMessage) return;

    setSendingMessage(true);
    setDebugStatus('📤 Sending...');

    const carNum = parseInt(selectedCar, 10);

    const messageData = {
      ndrId: activeNDR.id,
      carNumber: carNum,
      sender: viewMode,
      senderName: userProfile?.name || (viewMode === 'couch' ? 'Couch' : 'Navigator'),
      message: newMessage.trim(),
      timestamp: Timestamp.now()
    };

    console.log('✉️ Sending:', messageData);

    try {
      const docRef = await addDoc(collection(db, 'couchMessages'), messageData);
      console.log('✅ SUCCESS! Doc ID:', docRef.id);
      
      setDebugStatus('✅ Sent!');
      setNewMessage('');
      
      setTimeout(() => setDebugStatus(''), 2000);
    } catch (error) {
      console.error('❌ SEND ERROR:', error);
      
      let errorMsg = 'Failed: ';
      if (error.code === 'permission-denied') {
        errorMsg += 'Permission denied';
      } else if (error.code === 'unavailable') {
        errorMsg += 'Network unavailable';
      } else {
        errorMsg += error.message;
      }
      
      setDebugStatus(`❌ ${errorMsg}`);
      setTimeout(() => setDebugStatus(''), 5000);
    } finally {
      setSendingMessage(false);
    }
  };

  if (ndrLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-[#79F200] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!activeNDR) {
    return (
      <div className="space-y-6 p-4">
        <h2 className="text-3xl font-bold text-gray-900">Couch Navigator</h2>
        <div className="bg-yellow-50 border-2 border-yellow-400 rounded-xl p-8 text-center">
          <AlertCircle className="mx-auto mb-4 text-yellow-600" size={64} />
          <h3 className="text-xl font-bold text-gray-800 mb-2">No Active NDR</h3>
          <p className="text-gray-600">
            This system requires an active NDR. Directors should activate an NDR from the NDR Reports page.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {platformInfo.isMobile && !platformInfo.isPWA && (
        <div className="bg-blue-600 text-white p-3 text-center text-sm">
          📱 For best experience, add this app to your home screen
        </div>
      )}

      <div className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            <h1 className="text-xl md:text-2xl font-bold text-gray-900 flex items-center gap-2">
              <MessageSquare size={24} className="text-[#79F200]" />
              Couch Navigator
            </h1>
            <div className="flex gap-2 items-center">
              <button
                onClick={() => setShowDebug(!showDebug)}
                className="p-2 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition text-xs"
                title="Toggle debug"
              >
                🐛
              </button>
              
              <button
                onClick={requestNotificationPermission}
                className={`p-2 rounded-lg transition ${
                  notificationsEnabled
                    ? 'bg-green-100 text-green-700'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {notificationsEnabled ? <Bell size={18} /> : <BellOff size={18} />}
              </button>
              <button
                onClick={() => {
                  setViewMode('couch');
                  setLocationEnabled(false);
                }}
                className={`px-4 py-2 rounded-lg font-semibold text-sm transition ${
                  viewMode === 'couch'
                    ? 'bg-[#79F200] text-gray-900'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                🛋️ Couch
              </button>
              <button
                onClick={() => setViewMode('navigator')}
                className={`px-4 py-2 rounded-lg font-semibold text-sm transition ${
                  viewMode === 'navigator'
                    ? 'bg-[#79F200] text-gray-900'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                🧭 Navigator
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {showDebug && (
          <div className="mb-6 bg-gray-900 text-green-400 rounded-xl p-4 font-mono text-xs">
            <div className="flex justify-between items-center mb-2">
              <h3 className="font-bold text-white">🔍 Debug Panel</h3>
              <button
                onClick={() => setShowDebug(false)}
                className="text-white hover:text-red-400"
              >
                ✕
              </button>
            </div>
            <div className="space-y-1">
              <div className={selectedCar ? 'text-green-400' : 'text-red-400'}>
                Selected Car: {selectedCar || 'NONE'} {selectedCar && `(Type: ${typeof selectedCar})`}
                {typeof selectedCar === 'string' && <span className="text-red-400 ml-2">⚠️ SHOULD BE NUMBER!</span>}
              </div>
              <div>View Mode: {viewMode}</div>
              <div>Active NDR: {activeNDR?.id || 'none'}</div>
              <div>User: {userProfile?.name || 'loading...'}</div>
              <div>Messages Loaded: {messages.length}</div>
              <div>Location: {locationEnabled ? '🟢 Enabled' : '🔴 Disabled'}</div>
              <div>Platform: {platformInfo.isPWA ? 'PWA' : 'Browser'} | {platformInfo.isIOS ? 'iOS' : platformInfo.isAndroid ? 'Android' : 'Desktop'}</div>
              <div>Network: {navigator.onLine ? '🟢 Online' : '🔴 Offline'}</div>
              {locationEnabled && lastLocationUpdate && (
                <div className="text-green-400">
                  Last Firestore Write: {lastLocationUpdate.toLocaleTimeString()}
                </div>
              )}
              {locationEnabled && lastLocationRef.current && (
                <div className="text-blue-400">
                  Current Position: {lastLocationRef.current.latitude?.toFixed(6)}, {lastLocationRef.current.longitude?.toFixed(6)}
                  {lastLocationRef.current.lastWriteSuccess === false && <span className="text-red-400 ml-2">⚠️ Last write failed</span>}
                </div>
              )}
              {debugStatus && (
                <div className="text-yellow-300 mt-2 bg-gray-800 p-2 rounded">
                  Status: {debugStatus}
                </div>
              )}
            </div>
          </div>
        )}

        {viewMode === 'couch' ? (
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Car size={20} />
                Select Car to Communicate
              </h2>
              <select
                value={selectedCar || ''}
                onChange={(e) => {
                  const value = e.target.value;
                  const carNum = value ? parseInt(value, 10) : null;
                  setSelectedCar(carNum);
                  console.log('🛋️ Couch selected car:', carNum, 'Type:', typeof carNum);
                }}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-[#79F200] focus:border-[#79F200] text-gray-900 font-medium"
              >
                <option value="">Select a car...</option>
                {Array.from({ length: activeNDR.availableCars || 0 }, (_, i) => i + 1).map(num => (
                  <option key={num} value={num}>
                    Car {num} {availableCars.find(c => c.carNumber === num) ? `- ${availableCars.find(c => c.carNumber === num).driverName}` : ''}
                  </option>
                ))}
              </select>
            </div>

            {selectedCar && (
              <>
                {googleMapsLoaded && carLocations[selectedCar] && (
                  <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
                    <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                      <Navigation size={20} className="text-blue-600" />
                      Live Location - Car {selectedCar}
                    </h3>
                    <GoogleMap
                      mapContainerStyle={mapContainerStyle}
                      center={{
                        lat: carLocations[selectedCar].latitude,
                        lng: carLocations[selectedCar].longitude
                      }}
                      zoom={15}
                      onLoad={onMapLoad}
                      options={mapOptions}
                    />
                    <p className="text-xs text-gray-500 mt-2 flex items-center gap-1">
                      <Clock size={12} />
                      Last updated: {carLocations[selectedCar].updatedAt?.toLocaleTimeString() || 'Unknown'}
                    </p>
                  </div>
                )}

                {!carLocations[selectedCar] && (
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                    <p className="text-sm text-blue-800">
                      📍 Waiting for Car {selectedCar} navigator to enable location sharing...
                    </p>
                  </div>
                )}

                <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
                  <h3 className="text-lg font-bold text-gray-900 mb-4">
                    Active Rides for Car {selectedCar}
                  </h3>
                  {activeRides.length === 0 ? (
                    <p className="text-gray-500 text-center py-4">No active rides</p>
                  ) : (
                    <div className="space-y-3">
                      {activeRides.map(ride => (
                        <div key={ride.id} className="border-2 border-gray-200 rounded-xl p-4">
                          <div className="flex items-start justify-between">
                            <div>
                              <p className="font-bold text-gray-900">{ride.name}</p>
                              <p className="text-sm text-gray-600">{ride.phone}</p>
                              <div className="mt-2 space-y-1 text-sm">
                                <p className="flex items-center gap-1">
                                  <MapPin size={14} className="text-green-600" />
                                  <span className="font-medium">Pickup:</span> {ride.pickup}
                                </p>
                                {ride.dropoffs?.map((dropoff, idx) => (
                                  <p key={idx} className="flex items-center gap-1">
                                    <MapPin size={14} className="text-red-600" />
                                    <span className="font-medium">Drop {idx + 1}:</span> {dropoff}
                                  </p>
                                ))}
                              </div>
                            </div>
                            <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                              ride.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                            }`}>
                              {ride.status}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
                  <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <MessageSquare size={20} />
                    Messages with Car {selectedCar}
                  </h3>
                  
                  <div className="h-80 overflow-y-auto mb-4 space-y-3 p-4 bg-gray-50 rounded-xl">
                    {messages.length === 0 ? (
                      <p className="text-center text-gray-500 py-8">No messages yet</p>
                    ) : (
                      messages.map(msg => (
                        <div
                          key={msg.id}
                          className={`flex ${msg.sender === 'couch' ? 'justify-end' : 'justify-start'}`}
                        >
                          <div
                            className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                              msg.sender === 'couch'
                                ? 'bg-[#79F200] text-gray-900'
                                : 'bg-white border border-gray-200 text-gray-900'
                            }`}
                          >
                            <p className="text-xs font-semibold mb-1 opacity-70">
                              {msg.sender === 'couch' ? 'You (Couch)' : msg.senderName}
                            </p>
                            <p className="text-sm">{msg.message}</p>
                            <p className="text-xs opacity-60 mt-1">
                              {msg.timestamp?.toLocaleTimeString()}
                            </p>
                          </div>
                        </div>
                      ))
                    )}
                    <div ref={messagesEndRef} />
                  </div>

                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                      placeholder="Type a message..."
                      className="flex-1 px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-[#79F200] focus:border-[#79F200] outline-none"
                    />
                    <button
                      onClick={sendMessage}
                      disabled={sendingMessage || !newMessage.trim()}
                      className="px-6 py-3 bg-[#79F200] text-gray-900 rounded-xl font-bold hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      {sendingMessage ? (
                        <div className="w-5 h-5 border-2 border-gray-900 border-t-transparent rounded-full animate-spin"></div>
                      ) : (
                        <Send size={18} />
                      )}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            {!selectedCar && (
              <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
                <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <Car size={20} />
                  Select Your Car Number
                </h2>
                
                <select
                  value={selectedCar || ''}
                  onChange={(e) => {
                    const value = e.target.value;
                    const carNum = value ? parseInt(value, 10) : null;
                    if (carNum) {
                      setSelectedCar(carNum);
                      setCarNumber(value);
                      console.log('🧭 Navigator selected car:', carNum, 'Type:', typeof carNum);
                      setDebugStatus(`✅ Connected as Car ${carNum}`);
                      setTimeout(() => setDebugStatus(''), 2000);
                    }
                  }}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-600 focus:border-blue-600 text-gray-900 font-medium"
                >
                  <option value="">Select your car number...</option>
                  {Array.from({ length: activeNDR.availableCars || 20 }, (_, i) => i + 1).map(num => (
                    <option key={num} value={num}>
                      Car {num} {availableCars.find(c => c.carNumber === num) ? `- ${availableCars.find(c => c.carNumber === num).driverName}` : ''}
                    </option>
                  ))}
                </select>
                
                <p className="text-sm text-gray-500 mt-3">
                  💡 Select the car number you're driving to enable messaging with the couch
                </p>
              </div>
            )}

            {selectedCar && (
              <div className="bg-blue-50 border-2 border-blue-400 rounded-xl p-4 flex items-center justify-between">
                <div>
                  <p className="font-bold text-blue-900">Connected as Car {selectedCar}</p>
                  <p className="text-sm text-blue-700">You can now send and receive messages</p>
                </div>
                <button
                  onClick={() => {
                    console.log('Disconnecting from car:', selectedCar);
                    setCarNumber('');
                    setSelectedCar(null);
                    setLocationEnabled(false);
                    setLastLocationUpdate(null);
                    setDebugStatus('🔴 Disconnected');
                    setTimeout(() => setDebugStatus(''), 2000);
                  }}
                  className="px-3 py-1 bg-red-100 text-red-700 rounded text-sm font-bold hover:bg-red-200"
                >
                  Disconnect
                </button>
              </div>
            )}

            {selectedCar && (
              <>
                {platformInfo.isMobile && (
                  <div className="bg-yellow-50 border border-yellow-300 rounded-xl p-4">
                    <p className="text-sm text-yellow-800 font-medium">
                      ⚠️ <strong>Important:</strong> Location tracking will stop when you lock your phone or switch apps. 
                      {!platformInfo.isPWA && ' For better tracking, add this app to your home screen.'}
                    </p>
                    {platformInfo.isIOS && (
                      <p className="text-xs text-yellow-700 mt-2">
                        📱 <strong>iOS Note:</strong> If location isn't working, go to Settings → Privacy & Security → Location Services → Safari Websites → Allow
                      </p>
                    )}
                  </div>
                )}

                <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
                  <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <Navigation size={20} className="text-blue-600" />
                    Location Sharing
                  </h3>
                  
                  {!locationEnabled ? (
                    <div className="space-y-3">
                      <div className="bg-blue-50 border-2 border-blue-400 rounded-lg p-4">
                        <p className="text-sm text-blue-900 font-medium mb-2">
                          📍 Location sharing allows the couch to track your position in real-time.
                        </p>
                        <p className="text-xs text-blue-700">
                          When you tap the button below, your iPhone will show a popup asking for permission.
                        </p>
                      </div>
                      
                      {platformInfo.isIOS && (
                        <div className="bg-purple-50 border border-purple-300 rounded-lg p-3">
                          <p className="text-xs text-purple-900 font-bold mb-2">
                            🍎 IMPORTANT: Check System Settings First
                          </p>
                          <p className="text-xs text-purple-800 mb-2">
                            Before clicking the button, make sure Location Services are enabled:
                          </p>
                          <ol className="text-xs text-purple-800 space-y-1 ml-4 list-decimal">
                            <li><strong>iPhone Settings</strong> (gear icon)</li>
                            <li><strong>Privacy & Security</strong></li>
                            <li><strong>Location Services</strong></li>
                            <li>Toggle must be <strong>ON (green)</strong></li>
                          </ol>
                          <div className="mt-2 pt-2 border-t border-purple-200">
                            <p className="text-xs text-purple-700 italic">
                              💡 If the toggle is OFF, turn it ON first, then come back here and try again.
                            </p>
                          </div>
                        </div>
                      )}
                      
                      <button
                        onClick={requestLocationPermission}
                        className="w-full py-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl font-bold text-lg hover:from-blue-700 hover:to-blue-800 transition flex items-center justify-center gap-3 shadow-lg"
                        style={{
                          touchAction: 'manipulation',
                          WebkitTapHighlightColor: 'rgba(59, 130, 246, 0.3)'
                        }}
                      >
                        <Navigation size={24} />
                        Enable Location Sharing
                      </button>
                      
                      <div className="bg-gray-100 border border-gray-300 rounded-lg p-3">
                        <p className="text-xs text-gray-700 font-medium mb-1">
                          What happens when you click:
                        </p>
                        <ol className="text-xs text-gray-600 space-y-1 ml-4 list-decimal">
                          <li>iOS shows permission popup</li>
                          <li>Tap <strong>"Allow"</strong></li>
                          <li>App gets your GPS location</li>
                          <li>Green checkmark appears ✅</li>
                          <li>Location sent to couch immediately</li>
                        </ol>
                      </div>
                      
                      {locationError && (
                        <div className="bg-red-50 border-2 border-red-300 rounded-lg p-4">
                          <p className="text-sm text-red-900 font-bold mb-2">⚠️ Location Access Issue</p>
                          <p className="text-sm text-red-800 whitespace-pre-line">{locationError}</p>
                          
                          {platformInfo.isIOS && (
                            <div className="mt-3 pt-3 border-t border-red-200">
                              <p className="text-xs text-red-700 font-medium mb-2">
                                Quick diagnostic:
                              </p>
                              <button
                                onClick={async () => {
                                  const state = await checkLocationPermission();
                                  alert(`Permission state: ${state}\n\nIf "denied", you must enable it in iPhone Settings.`);
                                }}
                                className="text-xs bg-red-100 hover:bg-red-200 text-red-800 px-3 py-2 rounded font-medium"
                              >
                                Check Permission Status
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-green-600 bg-green-50 border-2 border-green-400 rounded-lg p-4">
                        <CheckCircle size={28} />
                        <div className="flex-1">
                          <p className="font-bold text-green-900">Location Tracking Active</p>
                          <p className="text-xs text-green-700 mt-1">Using WiFi/Cell tower positioning (works indoors)</p>
                          {lastLocationUpdate && (
                            <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                              <Clock size={12} />
                              Last sent: {lastLocationUpdate.toLocaleTimeString()}
                            </p>
                          )}
                        </div>
                      </div>
                      
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                        <p className="text-xs text-blue-800 font-medium mb-2">
                          📊 Tracking Info:
                        </p>
                        <ul className="text-xs text-blue-700 space-y-1 ml-4 list-disc">
                          <li>Updates every {updateInterval / 1000} seconds (adaptive)</li>
                          <li>Position shared with couch in real-time</li>
                          <li>Keep screen unlocked for best results</li>
                        </ul>
                      </div>
                      
                      {platformInfo.isMobile && (
                        <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-3">
                          <p className="text-xs text-yellow-800">
                            ⚠️ <strong>Mobile Note:</strong> Tracking stops when phone is locked or app is backgrounded (iOS limitation).
                          </p>
                        </div>
                      )}
                      
                      <button
                        onClick={() => {
                          setLocationEnabled(false);
                          setLastLocationUpdate(null);
                          setDebugStatus('📍 Location sharing stopped');
                          setTimeout(() => setDebugStatus(''), 2000);
                        }}
                        className="w-full py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition flex items-center justify-center gap-2"
                      >
                        <X size={20} />
                        Stop Sharing Location
                      </button>
                    </div>
                  )}
                </div>

                <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
                  <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <MessageSquare size={20} />
                    Messages with Couch
                  </h3>
                  
                  <div className="h-80 overflow-y-auto mb-4 space-y-3 p-4 bg-gray-50 rounded-xl">
                    {messages.length === 0 ? (
                      <p className="text-center text-gray-500 py-8">No messages yet</p>
                    ) : (
                      messages.map(msg => (
                        <div
                          key={msg.id}
                          className={`flex ${msg.sender === 'navigator' ? 'justify-end' : 'justify-start'}`}
                        >
                          <div
                            className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                              msg.sender === 'navigator'
                                ? 'bg-blue-600 text-white'
                                : 'bg-white border border-gray-200 text-gray-900'
                            }`}
                          >
                            <p className="text-xs font-semibold mb-1 opacity-70">
                              {msg.sender === 'navigator' ? 'You (Navigator)' : msg.senderName}
                            </p>
                            <p className="text-sm">{msg.message}</p>
                            <p className="text-xs opacity-60 mt-1">
                              {msg.timestamp?.toLocaleTimeString()}
                            </p>
                          </div>
                        </div>
                      ))
                    )}
                    <div ref={messagesEndRef} />
                  </div>

                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                      placeholder="Type a message..."
                      className="flex-1 px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-600 focus:border-blue-600 outline-none"
                    />
                    <button
                      onClick={sendMessage}
                      disabled={sendingMessage || !newMessage.trim()}
                      className="px-6 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      {sendingMessage ? (
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      ) : (
                        <Send size={18} />
                      )}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default CouchNavigator;