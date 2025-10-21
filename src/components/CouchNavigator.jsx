import React, { useState, useEffect, useRef } from 'react';
import { db } from '../firebase';
import { collection, addDoc, query, where, onSnapshot, orderBy, updateDoc, doc, Timestamp, getDocs } from 'firebase/firestore';
import { useActiveNDR } from '../ActiveNDRContext';
import { useAuth } from '../AuthContext';
import { MapPin, Send, Navigation, Phone, User, Car, Clock, AlertCircle, MessageSquare, CheckCircle, Bell, BellOff } from 'lucide-react';
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
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.3);
    } catch (error) {
      console.error('Error playing notification sound:', error);
    }
  };

  // Map configuration
  const mapContainerStyle = {
    width: '100%',
    height: '400px'
  };

  const bcsCenter = {
    lat: 30.6280,
    lng: -96.3344
  };

  // Map options with mapId for Advanced Markers
  const mapOptions = {
    mapId: 'COUCH_NAVIGATOR_MAP',
    disableDefaultUI: false,
    zoomControl: true,
    mapTypeControl: false,
    streetViewControl: false,
    fullscreenControl: true,
  };

  // Handle map load
  const onMapLoad = (map) => {
    mapRef.current = map;
  };

  // Update markers when car locations change
  useEffect(() => {
    if (!mapRef.current || !googleMapsLoaded || !window.google?.maps?.marker) return;

    const { AdvancedMarkerElement } = window.google.maps.marker;

    // Clean up old markers
    Object.values(markersRef.current).forEach(marker => {
      if (marker && marker.map) {
        marker.map = null;
      }
    });
    markersRef.current = {};

    // Create markers for all car locations
    Object.entries(carLocations).forEach(([carNum, location]) => {
      if (!location.latitude || !location.longitude) return;

      try {
        const marker = new AdvancedMarkerElement({
          map: mapRef.current,
          position: {
            lat: location.latitude,
            lng: location.longitude
          },
          title: `Car ${carNum}`
        });

        markersRef.current[carNum] = marker;
      } catch (error) {
        console.error('Error creating marker:', error);
      }
    });

    // Cleanup on unmount
    return () => {
      Object.values(markersRef.current).forEach(marker => {
        if (marker && marker.map) {
          marker.map = null;
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

  // Listen to messages for selected car
  useEffect(() => {
    if (!activeNDR || !selectedCar) {
      console.log('Message listener not active:', { activeNDR: !!activeNDR, selectedCar });
      setMessages([]);
      lastMessageCountRef.current = 0;
      return;
    }

    console.log('🔵 Setting up message listener:', {
      ndrId: activeNDR.id,
      carNumber: selectedCar,
      carNumberType: typeof selectedCar,
      viewMode
    });

    const messagesRef = collection(db, 'couchMessages');
    const messagesQuery = query(
      messagesRef,
      where('ndrId', '==', activeNDR.id),
      where('carNumber', '==', selectedCar),
      orderBy('timestamp', 'asc')
    );

    const unsubscribe = onSnapshot(
      messagesQuery,
      (snapshot) => {
        console.log('📨 Message snapshot received:', {
          numDocs: snapshot.docs.length,
          viewMode,
          carNumber: selectedCar
        });
        
        const msgs = snapshot.docs.map(doc => {
          const data = doc.data();
          console.log('Message doc:', {
            id: doc.id,
            sender: data.sender,
            carNumber: data.carNumber,
            message: data.message
          });
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
          
          console.log('New message check:', {
            isFromOtherParty,
            viewMode,
            messageSender: newMessage.sender
          });
          
          if (isFromOtherParty) {
            playNotificationSound();
            
            // Show browser notification if permitted and app is backgrounded
            if (notificationsEnabled && document.hidden) {
              try {
                new Notification('New Message', {
                  body: `${newMessage.senderName}: ${newMessage.message.substring(0, 50)}${newMessage.message.length > 50 ? '...' : ''}`,
                  icon: '/logo192.png',
                  tag: `message-${newMessage.id}`,
                  requireInteraction: false
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
        console.error('Error code:', error.code);
        console.error('Error message:', error.message);
        
        if (error.code === 'failed-precondition') {
          console.error('🔴 FIRESTORE INDEX REQUIRED!');
          console.error('Create index at:', error.message);
          alert('Database index required. Check console for link to create it.');
        }
      }
    );

    return () => {
      console.log('🔴 Cleaning up message listener for car:', selectedCar);
      unsubscribe();
    };
  }, [activeNDR, selectedCar, viewMode, notificationsEnabled]);

  // Listen to all car locations (for couch view)
  useEffect(() => {
    if (!activeNDR || viewMode !== 'couch') return;

    const locationsRef = collection(db, 'carLocations');
    const locationsQuery = query(
      locationsRef,
      where('ndrId', '==', activeNDR.id)
    );

    const unsubscribe = onSnapshot(locationsQuery, (snapshot) => {
      const locations = {};
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        locations[data.carNumber] = {
          ...data,
          updatedAt: data.updatedAt?.toDate()
        };
      });
      setCarLocations(locations);
    });

    return () => unsubscribe();
  }, [activeNDR, viewMode]);

  // Load active rides for selected car
  useEffect(() => {
    if (!activeNDR || !selectedCar) {
      setActiveRides([]);
      return;
    }

    const ridesRef = collection(db, 'rides');
    const ridesQuery = query(
      ridesRef,
      where('ndrId', '==', activeNDR.id),
      where('carNumber', '==', parseInt(selectedCar)),
      where('status', 'in', ['active', 'pending'])
    );

    const unsubscribe = onSnapshot(ridesQuery, (snapshot) => {
      const rides = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        requestedAt: doc.data().requestedAt?.toDate()
      }));
      setActiveRides(rides);
    });

    return () => unsubscribe();
  }, [activeNDR, selectedCar]);

  // Calculate distance between two points (Haversine formula)
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

  // Adaptive location tracking based on movement
  const updateLocationToFirestore = async (position) => {
    if (!activeNDR || !carNumber) return;

    const { latitude, longitude, speed } = position.coords;

    // Distance-based filtering
    if (lastLocationRef.current) {
      const distance = calculateDistance(
        lastLocationRef.current.latitude,
        lastLocationRef.current.longitude,
        latitude,
        longitude
      );

      if (distance < 50) {
        console.log('Movement < 50m, skipping update');
        return;
      }
    }

    // Adaptive polling based on speed
    let newInterval = 5000;
    if (speed) {
      if (speed > 20) {
        newInterval = 3000;
      } else if (speed > 5) {
        newInterval = 5000;
      } else if (speed > 1) {
        newInterval = 10000;
      } else {
        newInterval = 30000;
      }
    }

    if (newInterval !== updateInterval) {
      setUpdateInterval(newInterval);
    }

    lastLocationRef.current = { latitude, longitude };

    try {
      const locationsRef = collection(db, 'carLocations');
      const existingQuery = query(
        locationsRef,
        where('ndrId', '==', activeNDR.id),
        where('carNumber', '==', parseInt(carNumber))
      );
      
      const existingDocs = await getDocs(existingQuery);
      
      if (existingDocs.empty) {
        await addDoc(locationsRef, {
          ndrId: activeNDR.id,
          carNumber: parseInt(carNumber),
          latitude,
          longitude,
          updatedAt: Timestamp.now()
        });
        console.log('Location created in Firestore');
      } else {
        const docRef = doc(db, 'carLocations', existingDocs.docs[0].id);
        await updateDoc(docRef, {
          latitude,
          longitude,
          updatedAt: Timestamp.now()
        });
        console.log('Location updated in Firestore');
      }
    } catch (error) {
      console.error('Error updating location:', error);
    }
  };

  // Location tracking for navigator
  useEffect(() => {
    if (viewMode !== 'navigator' || !carNumber || !locationEnabled || !activeNDR) {
      if (locationUpdateTimerRef.current) {
        clearInterval(locationUpdateTimerRef.current);
        locationUpdateTimerRef.current = null;
      }
      return;
    }

    const handleError = (error) => {
      console.error('Location error:', error);
      setLocationError('Unable to get location: ' + error.message);
      setLocationEnabled(false);
    };

    locationWatchId.current = navigator.geolocation.watchPosition(
      updateLocationToFirestore,
      handleError,
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );

    const handleVisibilityChange = () => {
      if (document.hidden) {
        console.log('App backgrounded - location tracking will be limited');
        if (lastLocationRef.current) {
          console.log('Sending final location update before background');
        }
      } else {
        console.log('App foregrounded - location tracking resumed');
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      if (locationWatchId.current) {
        navigator.geolocation.clearWatch(locationWatchId.current);
      }
      if (locationUpdateTimerRef.current) {
        clearInterval(locationUpdateTimerRef.current);
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [viewMode, carNumber, locationEnabled, activeNDR, updateInterval]);

  const requestLocationPermission = () => {
    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported by your browser');
      return;
    }

    setLocationError('');
    navigator.geolocation.getCurrentPosition(
      () => {
        setLocationEnabled(true);
        console.log('Location permission granted');
      },
      (error) => {
        setLocationError('Location permission denied: ' + error.message);
        setLocationEnabled(false);
        console.error('Location error:', error);
      },
      {
        enableHighAccuracy: true
      }
    );
  };

  // Request notification permission
  const requestNotificationPermission = async () => {
    if (!('Notification' in window)) {
      alert('This browser does not support notifications');
      return false;
    }

    try {
      const permission = await Notification.requestPermission();
      const granted = permission === 'granted';
      setNotificationsEnabled(granted);
      
      if (granted) {
        new Notification('Notifications Enabled', {
          body: 'You will now receive updates about messages and rides',
          icon: '/logo192.png',
          tag: 'test-notification'
        });
      }
      
      return granted;
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      return false;
    }
  };

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

    if (sendingMessage) {
      setDebugStatus('⏳ Already sending...');
      return;
    }

    setSendingMessage(true);
    setDebugStatus('📤 Sending message...');

    const messageData = {
      ndrId: activeNDR.id,
      carNumber: selectedCar,
      sender: viewMode,
      senderName: userProfile?.name || (viewMode === 'couch' ? 'Couch' : 'Navigator'),
      message: newMessage.trim(),
      timestamp: Timestamp.now()
    };

    console.log('✉️ Attempting to send:', messageData);

    try {
      const docRef = await addDoc(collection(db, 'couchMessages'), messageData);
      console.log('✅ SUCCESS! Doc ID:', docRef.id);
      
      setDebugStatus('✅ Message sent!');
      setNewMessage('');
      
      setTimeout(() => setDebugStatus(''), 2000);
    } catch (error) {
      console.error('❌ SEND ERROR:', error);
      
      let errorMsg = 'Failed to send: ';
      if (error.code === 'permission-denied') {
        errorMsg += 'Permission denied. Check if you are logged in.';
      } else if (error.code === 'failed-precondition') {
        errorMsg += 'Database index missing. Check console for link.';
      } else {
        errorMsg += error.message;
      }
      
      setDebugStatus('❌ ' + errorMsg);
      alert(errorMsg);
      
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
          📱 For best experience with background location, add this app to your home screen
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
                title="Toggle debug info"
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
                title={notificationsEnabled ? 'Notifications enabled' : 'Enable notifications'}
              >
                {notificationsEnabled ? <Bell size={18} /> : <BellOff size={18} />}
              </button>
              <button
                onClick={() => {
                  console.log('Switching to couch view');
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
                onClick={() => {
                  console.log('Switching to navigator view');
                  setViewMode('navigator');
                }}
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
              <h3 className="font-bold text-white">Debug Info</h3>
              <button
                onClick={() => setShowDebug(false)}
                className="text-white hover:text-red-400"
              >
                ✕
              </button>
            </div>
            <div className="space-y-1">
              <div className="text-yellow-400 font-bold">📊 EXPECTED BEHAVIOR:</div>
              <div className="text-white text-xs mb-2">
                Couch: Selected Car should have value, Car Number Input should be empty<br/>
                Navigator: BOTH Selected Car AND Car Number Input should have same value
              </div>
              <div className={selectedCar ? 'text-green-400' : 'text-red-400'}>
                ✓ Selected Car: {selectedCar || 'NONE - NOT CONNECTED!'} {selectedCar ? '(Type: ' + typeof selectedCar + ')' : ''}
              </div>
              <div className={carNumber ? 'text-green-400' : 'text-gray-500'}>
                ✓ Car Number Input: {carNumber || 'empty'} {carNumber ? '(Type: ' + typeof carNumber + ')' : ''}
              </div>
              <div>View: {viewMode}</div>
              <div>Active NDR: {activeNDR ? activeNDR.id : 'none'}</div>
              <div>User: {userProfile?.name || 'loading...'}</div>
              <div>Auth UID: {userProfile ? 'yes' : 'no'}</div>
              <div>Messages Loaded: {messages.length}</div>
              <div>Sending: {sendingMessage ? 'YES' : 'NO'}</div>
              <div>Google Maps: {googleMapsLoaded ? '✅ Loaded' : googleMapsError ? '❌ Error' : '⏳ Loading'}</div>
              <div>Platform: {platformInfo.isMobile ? 'Mobile' : 'Desktop'} {platformInfo.isIOS ? 'iOS' : platformInfo.isAndroid ? 'Android' : ''}</div>
              <div>PWA: {platformInfo.isPWA ? 'Yes' : 'No'}</div>
              {debugStatus && (
                <div className="text-yellow-300 mt-2">
                  Last Status: {debugStatus}
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
                  const carNum = value ? parseInt(value) : null;
                  setSelectedCar(carNum);
                  console.log('🛋️ Couch selected car:', carNum, 'Type:', typeof carNum);
                }}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-[#79F200] focus:border-[#79F200] text-gray-900 font-medium"
              >
                <option value="">Select a car...</option>
                {Array.from({ length: activeNDR.availableCars || 0 }, (_, i) => i + 1).map(num => (
                  <option key={num} value={num}>
                    Car {num} {availableCars.find(c => c.carNumber === num) ? 
                      `- ${availableCars.find(c => c.carNumber === num).driverName}` : ''}
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
                      zoom={14}
                      onLoad={onMapLoad}
                      options={mapOptions}
                    />
                    <p className="text-xs text-gray-500 mt-2 flex items-center gap-1">
                      <Clock size={12} />
                      Last updated: {carLocations[selectedCar].updatedAt?.toLocaleTimeString() || 'Unknown'}
                    </p>
                  </div>
                )}

                {googleMapsError && (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                    <p className="text-sm text-red-800">
                      ⚠️ Error loading Google Maps. Please check your API key and refresh the page.
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
                        <div key={ride.id} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <p className="font-bold text-gray-900">{ride.patronName}</p>
                              <p className="text-sm text-gray-600">{ride.phone}</p>
                            </div>
                            <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                              ride.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'
                            }`}>
                              {ride.status.toUpperCase()}
                            </span>
                          </div>
                          <div className="space-y-1 text-sm">
                            <p className="flex items-start gap-2">
                              <MapPin size={14} className="text-green-600 mt-0.5 flex-shrink-0" />
                              <span><strong>Pickup:</strong> {ride.pickup}</span>
                            </p>
                            {(ride.dropoffs || [ride.dropoff]).map((dropoff, idx) => (
                              <p key={idx} className="flex items-start gap-2">
                                <MapPin size={14} className="text-red-600 mt-0.5 flex-shrink-0" />
                                <span><strong>Dropoff {(ride.dropoffs || [ride.dropoff]).length > 1 ? idx + 1 : ''}:</strong> {dropoff}</span>
                              </p>
                            ))}
                            <p className="text-gray-600">
                              <strong>Riders:</strong> {ride.riders}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
                  <div className="bg-[#79F200] p-4">
                    <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                      <MessageSquare size={20} />
                      Messages with Car {selectedCar}
                    </h3>
                  </div>

                  <div className="h-96 overflow-y-auto p-4 space-y-3 bg-gray-50">
                    {messages.length === 0 ? (
                      <p className="text-center text-gray-500 py-8">No messages yet. Start the conversation!</p>
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
                              {msg.sender === 'couch' ? '🛋️ Couch' : '🧭 Navigator'} - {msg.senderName}
                            </p>
                            <p className="text-sm break-words">{msg.message}</p>
                            <p className="text-xs opacity-60 mt-1">
                              {msg.timestamp?.toLocaleTimeString()}
                            </p>
                          </div>
                        </div>
                      ))
                    )}
                    <div ref={messagesEndRef} />
                  </div>

                  <div className="p-4 bg-white border-t border-gray-200">
                    {debugStatus && (
                      <div className="mb-3 p-2 bg-blue-50 border border-blue-200 rounded text-sm text-blue-900 text-center">
                        {debugStatus}
                      </div>
                    )}
                    
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        onKeyPress={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey && !sendingMessage) {
                            e.preventDefault();
                            sendMessage();
                          }
                        }}
                        placeholder="Type a message..."
                        disabled={sendingMessage}
                        className="flex-1 px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-[#79F200] focus:border-[#79F200] outline-none disabled:bg-gray-100 disabled:cursor-not-allowed"
                      />
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          console.log('🖱️ Send button clicked');
                          sendMessage();
                        }}
                        onTouchEnd={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          console.log('👆 Send button touched');
                          sendMessage();
                        }}
                        disabled={!newMessage.trim() || sendingMessage}
                        className="px-6 py-3 bg-[#79F200] text-gray-900 rounded-xl font-bold hover:shadow-lg transition flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
                        style={{ touchAction: 'manipulation' }}
                      >
                        {sendingMessage ? (
                          <div className="w-5 h-5 border-2 border-gray-900 border-t-transparent rounded-full animate-spin"></div>
                        ) : (
                          <Send size={18} />
                        )}
                        {!sendingMessage && 'Send'}
                      </button>
                    </div>
                    
                    {showDebug && (
                      <button
                        onClick={() => {
                          console.log('Test button clicked!');
                          alert('Button works! Check console.');
                        }}
                        className="w-full mt-2 p-2 bg-blue-500 text-white rounded text-sm"
                      >
                        🧪 Test Touch (should show alert)
                      </button>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            {!carNumber && (
              <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
                <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <Car size={20} />
                  Enter Your Car Number
                </h2>
                
                {/* Show current state for debugging */}
                {showDebug && (
                  <div className="mb-3 p-2 bg-yellow-50 border border-yellow-300 rounded text-xs">
                    <div>carNumber state: "{carNumber}" (type: {typeof carNumber})</div>
                    <div>selectedCar state: {selectedCar === null ? 'null' : selectedCar}</div>
                    <div>Button should be: {!carNumber || parseInt(carNumber) < 1 ? 'DISABLED' : 'ENABLED'}</div>
                  </div>
                )}
                
                <input
                  type="number"
                  min="1"
                  max={activeNDR.availableCars || 10}
                  placeholder="Enter car number..."
                  value={carNumber}
                  onChange={(e) => {
                    const value = e.target.value;
                    setCarNumber(value);
                    setDebugStatus(`Input changed: "${value}" (type: ${typeof value})`);
                    console.log('📝 Car number input changed:', value, 'Type:', typeof value);
                  }}
                  onFocus={() => console.log('📝 Input focused')}
                  onBlur={() => console.log('📝 Input blurred')}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-[#79F200] focus:border-[#79F200] text-gray-900 font-medium text-lg"
                />
                
                {/* Add a big, obvious test area */}
                <div className="mt-3 p-3 bg-red-50 border-2 border-red-500 rounded-xl">
                  <p className="text-sm font-bold text-red-900 mb-2">🚨 TAP TEST AREA - Does this work?</p>
                  <button
                    onMouseDown={() => console.log('🖱️ MOUSEDOWN on test button')}
                    onMouseUp={() => console.log('🖱️ MOUSEUP on test button')}
                    onTouchStart={() => console.log('👆 TOUCHSTART on test button')}
                    onTouchEnd={() => console.log('👆 TOUCHEND on test button')}
                    onClick={() => {
                      console.log('🖱️ CLICK on test button');
                      alert('TEST BUTTON WORKS! ✅');
                    }}
                    className="w-full p-4 bg-red-500 text-white rounded-lg font-bold text-lg"
                  >
                    TAP HERE FIRST - Test Button
                  </button>
                </div>
                
                {/* Connect button with ALL event handlers */}
                <button
                  onMouseDown={(e) => {
                    console.log('🖱️ MOUSEDOWN on Connect button');
                    setDebugStatus('🖱️ Mouse down detected');
                  }}
                  onMouseUp={(e) => {
                    console.log('🖱️ MOUSEUP on Connect button');
                    setDebugStatus('🖱️ Mouse up detected');
                  }}
                  onTouchStart={(e) => {
                    console.log('👆 TOUCHSTART on Connect button');
                    setDebugStatus('👆 Touch start detected');
                  }}
                  onTouchEnd={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log('👆 TOUCHEND on Connect button - ATTEMPTING CONNECTION');
                    setDebugStatus('👆 Touch end - connecting...');
                    
                    const carNum = parseInt(carNumber);
                    console.log('Parsed car number:', carNum, 'from:', carNumber);
                    
                    if (carNumber && carNum > 0) {
                      console.log('✅ SETTING selectedCar to:', carNum);
                      setSelectedCar(carNum);
                      setDebugStatus(`✅ Connected! selectedCar set to ${carNum}`);
                    } else {
                      console.log('❌ Invalid:', carNumber, 'parsed to:', carNum);
                      setDebugStatus('❌ Invalid car number');
                      alert('Please enter a valid car number (1 or higher)');
                    }
                  }}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log('🖱️ CLICK on Connect button - ATTEMPTING CONNECTION');
                    setDebugStatus('🖱️ Click - connecting...');
                    
                    const carNum = parseInt(carNumber);
                    console.log('Parsed car number:', carNum, 'from:', carNumber);
                    
                    if (carNumber && carNum > 0) {
                      console.log('✅ SETTING selectedCar to:', carNum);
                      setSelectedCar(carNum);
                      setDebugStatus(`✅ Connected! selectedCar set to ${carNum}`);
                    } else {
                      console.log('❌ Invalid:', carNumber, 'parsed to:', carNum);
                      setDebugStatus('❌ Invalid car number');
                      alert('Please enter a valid car number (1 or higher)');
                    }
                  }}
                  disabled={!carNumber || parseInt(carNumber) < 1}
                  className="w-full mt-3 px-6 py-4 bg-[#79F200] text-gray-900 rounded-xl font-bold text-lg hover:shadow-lg transition disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
                  style={{ 
                    touchAction: 'manipulation',
                    WebkitTapHighlightColor: 'rgba(121, 242, 0, 0.3)'
                  }}
                >
                  🚀 CONNECT AS CAR {carNumber || '?'}
                </button>
                
                <div className="mt-2 text-xs text-gray-600 text-center">
                  If button doesn't work, try test button above first
                </div>
                
                {/* Alternative: Direct link that forces connection */}
                {showDebug && carNumber && (
                  <button
                    onClick={() => {
                      const num = parseInt(carNumber);
                      console.log('🔧 FORCE CONNECT via debug button:', num);
                      setSelectedCar(num);
                      setDebugStatus('🔧 Force connected via debug');
                    }}
                    className="w-full mt-2 p-2 bg-purple-600 text-white rounded text-sm font-bold"
                  >
                    🔧 DEBUG: Force Connect (bypass touch)
                  </button>
                )}
              </div>
            )}

            {carNumber && selectedCar && (
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
                  }}
                  className="px-3 py-1 bg-red-100 text-red-700 rounded text-sm font-bold hover:bg-red-200"
                >
                  Disconnect
                </button>
              </div>
            )}

            {carNumber && (
              <>
                {platformInfo.isMobile && (
                  <div className="bg-yellow-50 border border-yellow-300 rounded-xl p-4">
                    <p className="text-sm text-yellow-800 font-medium">
                      ⚠️ <strong>Important:</strong> Location tracking will stop when you lock your phone or switch apps. 
                      {!platformInfo.isPWA && ' For better tracking, add this app to your home screen.'}
                    </p>
                    <p className="text-xs text-yellow-700 mt-2">
                      Update interval: {updateInterval / 1000}s (adaptive based on speed)
                    </p>
                  </div>
                )}

                <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
                  <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <Navigation size={20} className="text-blue-600" />
                    Location Sharing
                  </h3>
                  
                  {!locationEnabled ? (
                    <div className="space-y-3">
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <p className="text-sm text-blue-800 mb-3">
                          📍 Enable location sharing so the couch can track your position in real-time.
                          {platformInfo.isMobile && (
                            <span className="block mt-2 text-xs">
                              Note: Keep the app open and screen unlocked for continuous tracking on mobile.
                            </span>
                          )}
                        </p>
                        <button
                          onClick={requestLocationPermission}
                          className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition flex items-center justify-center gap-2"
                        >
                          <Navigation size={18} />
                          Enable Location Sharing
                        </button>
                      </div>
                      {locationError && (
                        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                          <p className="text-sm text-red-700">{locationError}</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3">
                        <CheckCircle className="text-green-600 flex-shrink-0" size={24} />
                        <div className="flex-1">
                          <p className="text-sm font-bold text-green-900">Location Sharing Active</p>
                          <p className="text-xs text-green-700">The couch can now see your live location</p>
                        </div>
                        <button
                          onClick={() => setLocationEnabled(false)}
                          className="px-3 py-1 bg-red-100 text-red-700 rounded text-xs font-bold hover:bg-red-200"
                        >
                          Stop
                        </button>
                      </div>
                      {lastLocationRef.current && (
                        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-xs text-gray-600">
                          <p>Last update: {new Date().toLocaleTimeString()}</p>
                          <p>Lat: {lastLocationRef.current.latitude.toFixed(6)}</p>
                          <p>Lng: {lastLocationRef.current.longitude.toFixed(6)}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
                  <h3 className="text-lg font-bold text-gray-900 mb-4">Your Active Rides</h3>
                  {activeRides.length === 0 ? (
                    <p className="text-gray-500 text-center py-4">No active rides assigned</p>
                  ) : (
                    <div className="space-y-3">
                      {activeRides.map(ride => (
                        <div key={ride.id} className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-lg p-4 border-2 border-blue-200">
                          <div className="flex justify-between items-start mb-3">
                            <div>
                              <p className="font-bold text-gray-900 text-lg">{ride.patronName}</p>
                              <a href={`tel:${ride.phone}`} className="text-sm text-blue-600 hover:underline flex items-center gap-1">
                                <Phone size={14} />
                                {ride.phone}
                              </a>
                            </div>
                            <span className="px-3 py-1 rounded-full text-xs font-bold bg-green-500 text-white">
                              {ride.riders} {ride.riders === 1 ? 'RIDER' : 'RIDERS'}
                            </span>
                          </div>
                          <div className="space-y-2">
                            <div className="bg-white rounded-lg p-3 border border-green-300">
                              <p className="text-xs font-semibold text-green-700 mb-1">📍 PICKUP</p>
                              <p className="text-sm font-medium text-gray-900">{ride.pickup}</p>
                            </div>
                            {(ride.dropoffs || [ride.dropoff]).map((dropoff, idx) => (
                              <div key={idx} className="bg-white rounded-lg p-3 border border-red-300">
                                <p className="text-xs font-semibold text-red-700 mb-1">
                                  🎯 DROPOFF {(ride.dropoffs || [ride.dropoff]).length > 1 ? idx + 1 : ''}
                                </p>
                                <p className="text-sm font-medium text-gray-900">{dropoff}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
                  <div className="bg-[#79F200] p-4">
                    <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                      <MessageSquare size={20} />
                      Messages with Couch
                    </h3>
                  </div>

                  <div className="h-96 overflow-y-auto p-4 space-y-3 bg-gray-50">
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
                              {msg.sender === 'navigator' ? '🧭 You' : '🛋️ Couch'} - {msg.senderName}
                            </p>
                            <p className="text-sm break-words">{msg.message}</p>
                            <p className="text-xs opacity-60 mt-1">
                              {msg.timestamp?.toLocaleTimeString()}
                            </p>
                          </div>
                        </div>
                      ))
                    )}
                    <div ref={messagesEndRef} />
                  </div>

                  <div className="p-4 bg-white border-t border-gray-200">
                    {debugStatus && (
                      <div className="mb-3 p-2 bg-blue-50 border border-blue-200 rounded text-sm text-blue-900 text-center">
                        {debugStatus}
                      </div>
                    )}
                    
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        onKeyPress={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey && !sendingMessage) {
                            e.preventDefault();
                            sendMessage();
                          }
                        }}
                        placeholder="Type a message..."
                        disabled={sendingMessage}
                        className="flex-1 px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-lg disabled:bg-gray-100 disabled:cursor-not-allowed"
                      />
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          console.log('🖱️ Navigator send button clicked');
                          sendMessage();
                        }}
                        onTouchEnd={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          console.log('👆 Navigator send button touched');
                          sendMessage();
                        }}
                        disabled={!newMessage.trim() || sendingMessage}
                        className="px-6 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
                        style={{ touchAction: 'manipulation' }}
                      >
                        {sendingMessage ? (
                          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        ) : (
                          <Send size={18} />
                        )}
                      </button>
                    </div>
                    
                    {showDebug && (
                      <button
                        onClick={() => {
                          console.log('Navigator test button clicked!');
                          alert('Navigator button works! Check console.');
                        }}
                        className="w-full mt-2 p-2 bg-purple-500 text-white rounded text-sm"
                      >
                        🧪 Test Touch (should show alert)
                      </button>
                    )}
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