import { 
  isNativeApp, 
  requestNativeLocationPermission, 
  getNativePosition, 
  watchNativePosition,
  clearNativeWatch,
  requestAlwaysLocationPermission
} from '../capacitorUtils';
import React, { useState, useEffect, useRef } from 'react';
import { db } from '../firebase';
import { collection, addDoc, query, where, onSnapshot, orderBy, updateDoc, doc, Timestamp, getDocs, deleteDoc, getDoc } from 'firebase/firestore';
import { useActiveNDR } from '../ActiveNDRContext';
import { useAuth } from '../AuthContext';
import { MapPin, Send, Navigation, Phone, User, Car, Clock, AlertCircle, MessageSquare, CheckCircle, Bell, BellOff, X } from 'lucide-react';
import { GoogleMap } from '@react-google-maps/api';
import { useGoogleMaps } from '../GoogleMapsProvider';
import { requestNotificationPermission, showNotification, playNotificationSound, checkNotificationPermission } from '../notificationUtils';
import { Capacitor } from '@capacitor/core';

const CouchNavigator = () => {
  useEffect(() => {
    console.log('🔔 Platform check:', {
      isNativeApp,
      capacitorPlatform: Capacitor.getPlatform(),
      capacitorNative: Capacitor.isNativePlatform()
    });
  }, []);
  
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
  const [routeInfo, setRouteInfo] = useState(null);
  const [eta, setEta] = useState(null);
  
  const messagesEndRef = useRef(null);
  const locationWatchId = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef({});
  const lastMessageCountRef = useRef(0);
  const lastLocationRef = useRef(null);
  const locationUpdateTimerRef = useRef(null);
  const directionsRendererRef = useRef(null);
  const routePolylineRef = useRef(null);
  const lastRenderedRouteRef = useRef(null);

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
      if (Notification.permission === 'granted') {
        setNotificationsEnabled(true);
      }
    }
  }, []);

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
    fullscreenControl: true,
    gestureHandling: 'greedy'
  };

  const onMapLoad = (map) => {
    console.log('🗺️ Map loaded!');
    mapRef.current = map;
    
    // Set initial center and zoom only on first load
    if (selectedCar && carLocations[selectedCar]) {
      map.setCenter({
        lat: carLocations[selectedCar].latitude,
        lng: carLocations[selectedCar].longitude
      });
      map.setZoom(16);
    }
  };

  const clearRoute = () => {
    if (directionsRendererRef.current) {
      directionsRendererRef.current.setMap(null);
      directionsRendererRef.current = null;
    }
    if (routePolylineRef.current) {
      routePolylineRef.current.setMap(null);
      routePolylineRef.current = null;
    }
    setRouteInfo(null);
    lastRenderedRouteRef.current = null;
  };

  const renderRoute = async (pickup, dropoffs, shouldFitBounds = false) => {
    if (!mapRef.current || !googleMapsLoaded || !window.google?.maps?.DirectionsService) {
      console.log('⏭️ Cannot render route - map not ready');
      return;
    }

    clearRoute();

    const directionsService = new window.google.maps.DirectionsService();
    const directionsRenderer = new window.google.maps.DirectionsRenderer({
      map: mapRef.current,
      suppressMarkers: false,
      polylineOptions: {
        strokeColor: '#4285F4',
        strokeWeight: 5,
        strokeOpacity: 0.7
      }
    });

    directionsRendererRef.current = directionsRenderer;

    const waypoints = dropoffs.slice(0, -1).map(dropoff => ({
      location: dropoff,
      stopover: true
    }));

    const request = {
      origin: pickup,
      destination: dropoffs[dropoffs.length - 1],
      waypoints: waypoints,
      travelMode: window.google.maps.TravelMode.DRIVING,
      optimizeWaypoints: true
    };

    try {
      const result = await directionsService.route(request);
      directionsRenderer.setDirections(result);
      console.log('✅ Route rendered successfully');
      
      let totalDuration = 0;
      let totalDistance = 0;
      result.routes[0].legs.forEach(leg => {
        totalDuration += leg.duration.value;
        totalDistance += leg.distance.value;
      });

      const etaDate = new Date(Date.now() + totalDuration * 1000);
      
      setRouteInfo({
        duration: totalDuration,
        durationText: Math.round(totalDuration / 60) + ' min',
        distance: totalDistance,
        distanceText: (totalDistance / 1609.34).toFixed(1) + ' mi',
        eta: etaDate
      });

      console.log('📍 Route info:', {
        duration: totalDuration,
        distance: totalDistance,
        eta: etaDate
      });
      
      // Only fit bounds on initial route load, not on updates
      if (shouldFitBounds) {
        const bounds = new window.google.maps.LatLngBounds();
        result.routes[0].legs.forEach(leg => {
          bounds.extend(leg.start_location);
          bounds.extend(leg.end_location);
        });
        mapRef.current.fitBounds(bounds);
      }
    } catch (error) {
      console.log('⚠️ Route rendering failed (API may need a few minutes to activate):', error.message);
      setRouteInfo(null);
    }
  };

  const calculateETAFromCarLocation = async (carNum) => {
    if (!carLocations[carNum] || !activeRides.length || !googleMapsLoaded || !window.google?.maps?.DirectionsService) {
      setEta(null);
      return;
    }

    const carLocation = carLocations[carNum];
    const ride = activeRides[0];
    
    const destination = ride.status === 'pending' ? ride.pickup : ride.dropoffs[0];

    const directionsService = new window.google.maps.DirectionsService();
    
    const request = {
      origin: { lat: carLocation.latitude, lng: carLocation.longitude },
      destination: destination,
      travelMode: window.google.maps.TravelMode.DRIVING
    };

    try {
      const result = await directionsService.route(request);
      const leg = result.routes[0].legs[0];
      
      const etaDate = new Date(Date.now() + leg.duration.value * 1000);
      
      setEta({
        duration: leg.duration.value,
        durationText: leg.duration.text,
        distance: leg.distance.value,
        distanceText: leg.distance.text,
        eta: etaDate,
        destination: ride.status === 'pending' ? 'Pickup' : 'Dropoff'
      });

      console.log('🕐 ETA calculated:', {
        durationText: leg.duration.text,
        distanceText: leg.distance.text,
        eta: etaDate.toLocaleTimeString()
      });
    } catch (error) {
      console.log('⚠️ ETA calculation failed:', error.message);
      setEta(null);
    }
  };

  const centerMapOnCar = (carNum) => {
    if (!mapRef.current || !carLocations[carNum]) return;
    
    const location = carLocations[carNum];
    mapRef.current.panTo({
      lat: location.latitude,
      lng: location.longitude
    });
    mapRef.current.setZoom(16);
  };

  // MODIFIED: Update markers smoothly without recreating
  useEffect(() => {
    console.log('🗺️ Marker update triggered:', {
      hasMap: !!mapRef.current,
      googleMapsLoaded,
      selectedCar,
      viewMode,
      carLocations
    });

    if (!mapRef.current || !googleMapsLoaded || !window.google?.maps?.Marker) {
      console.log('⏭️ Not ready yet');
      return;
    }

    // Only clear markers when view mode or selected car changes, not on location updates
    const shouldRecreateMarkers = !markersRef.current[selectedCar] || Object.keys(markersRef.current).length === 0;

    if (viewMode === 'navigator' && selectedCar) {
      const location = carLocations[selectedCar];
      if (location && location.latitude && location.longitude) {
        try {
          // Update existing marker position or create new one
          if (markersRef.current[selectedCar]) {
            // Smoothly update position
            markersRef.current[selectedCar].setPosition({
              lat: location.latitude,
              lng: location.longitude
            });
            console.log(`✅ Updated marker position for car ${selectedCar}`);
          } else {
            // Create new marker
            const marker = new window.google.maps.Marker({
              map: mapRef.current,
              position: {
                lat: location.latitude,
                lng: location.longitude
              },
              title: `Car ${selectedCar}`,
              icon: {
                path: window.google.maps.SymbolPath.CIRCLE,
                scale: 12,
                fillColor: '#4285F4',
                fillOpacity: 1,
                strokeColor: '#ffffff',
                strokeWeight: 3
              },
              label: {
                text: String(selectedCar),
                color: '#ffffff',
                fontSize: '14px',
                fontWeight: 'bold'
              }
            });

            markersRef.current[selectedCar] = marker;
            console.log(`✅ Marker created for car ${selectedCar}`);
            
            // Only center on initial marker creation
            centerMapOnCar(selectedCar);
          }
        } catch (error) {
          console.error(`❌ Error with marker:`, error);
        }
      }

      if (activeRides.length > 0) {
        const ride = activeRides[0];
        if (ride.pickup && ride.dropoffs) {
          const routeKey = `${ride.pickup}-${ride.dropoffs.join('-')}`;
          const isNewRoute = lastRenderedRouteRef.current !== routeKey;
          renderRoute(ride.pickup, ride.dropoffs, isNewRoute);
          lastRenderedRouteRef.current = routeKey;
        }
      }
    } else if (viewMode === 'couch' && selectedCar) {
      const location = carLocations[selectedCar];
      if (location && location.latitude && location.longitude) {
        try {
          // Update existing marker position or create new one
          if (markersRef.current[selectedCar]) {
            markersRef.current[selectedCar].setPosition({
              lat: location.latitude,
              lng: location.longitude
            });
            console.log(`✅ Updated marker position for car ${selectedCar} (couch view)`);
          } else {
            const marker = new window.google.maps.Marker({
              map: mapRef.current,
              position: {
                lat: location.latitude,
                lng: location.longitude
              },
              title: `Car ${selectedCar}`,
              icon: {
                path: window.google.maps.SymbolPath.CIRCLE,
                scale: 12,
                fillColor: '#4285F4',
                fillOpacity: 1,
                strokeColor: '#ffffff',
                strokeWeight: 3
              },
              label: {
                text: String(selectedCar),
                color: '#ffffff',
                fontSize: '14px',
                fontWeight: 'bold'
              }
            });

            markersRef.current[selectedCar] = marker;
            console.log(`✅ Marker created for car ${selectedCar} (couch view)`);
            
            // Only center on initial marker creation
            centerMapOnCar(selectedCar);
          }
        } catch (error) {
          console.error(`❌ Error with marker:`, error);
        }
      }

      if (activeRides.length > 0) {
        const ride = activeRides[0];
        if (ride.pickup && ride.dropoffs) {
          const routeKey = `${ride.pickup}-${ride.dropoffs.join('-')}`;
          const isNewRoute = lastRenderedRouteRef.current !== routeKey;
          renderRoute(ride.pickup, ride.dropoffs, isNewRoute);
          lastRenderedRouteRef.current = routeKey;
        }
      }
    } else if (viewMode === 'couch' && !selectedCar) {
      // Clear all markers and recreate for overview
      Object.values(markersRef.current).forEach(marker => {
        if (marker && marker.setMap) {
          marker.setMap(null);
        }
      });
      markersRef.current = {};

      Object.entries(carLocations).forEach(([carNum, location]) => {
        if (!location.latitude || !location.longitude) return;

        try {
          const actualCarNumber = location.carNumber || parseInt(carNum, 10);
          const marker = new window.google.maps.Marker({
            map: mapRef.current,
            position: {
              lat: location.latitude,
              lng: location.longitude
            },
            title: `Car ${actualCarNumber}`,
            icon: {
              path: window.google.maps.SymbolPath.CIRCLE,
              scale: 10,
              fillColor: '#4285F4',
              fillOpacity: 1,
              strokeColor: '#ffffff',
              strokeWeight: 2
            },
            label: {
              text: String(actualCarNumber),
              color: '#ffffff',
              fontSize: '12px',
              fontWeight: 'bold'
            }
          });

          markersRef.current[actualCarNumber] = marker;
        } catch (error) {
          console.error(`❌ Error creating marker for car ${carNum}:`, error);
        }
      });
    }

    console.log('✅ Total markers now:', Object.keys(markersRef.current).length);
  }, [carLocations, googleMapsLoaded, selectedCar, viewMode, activeRides]);

  // Calculate ETA when car location or rides update (removed auto-centering)
  useEffect(() => {
    if (selectedCar && carLocations[selectedCar] && activeRides.length > 0) {
      calculateETAFromCarLocation(selectedCar);
    }
  }, [carLocations, selectedCar, viewMode, activeRides]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (!activeNDR) {
      console.log('⏭️ No active NDR, skipping car load');
      return;
    }

    console.log('🚗 Loading cars for NDR:', activeNDR.id);

    const loadCars = async () => {
      try {
        const ndrDocRef = doc(db, 'ndrs', activeNDR.id);
        const ndrDoc = await getDoc(ndrDocRef);
        
        console.log('📄 NDR document exists:', ndrDoc.exists());
        
        if (ndrDoc.exists()) {
          const ndrData = ndrDoc.data();
          console.log('📋 NDR Data:', {
            hasCars: !!ndrData.cars,
            carsLength: ndrData.cars?.length,
            availableCars: ndrData.availableCars,
            cars: ndrData.cars,
            assignments: ndrData.assignments
          });
          
          let cars = [];
          
          if (ndrData.cars && ndrData.cars.length > 0) {
            cars = ndrData.cars;
          } 
          else if (ndrData.availableCars) {
            cars = Array.from({ length: ndrData.availableCars }, (_, i) => ({
              carNumber: i + 1,
              driverName: null
            }));
          }
          else if (ndrData.assignments?.cars) {
            const carNumbers = Object.keys(ndrData.assignments.cars).map(n => parseInt(n));
            cars = carNumbers.map(num => ({
              carNumber: num,
              driverName: null
            }));
          }
          
          setAvailableCars(cars);
          console.log('✅ Set availableCars state to:', cars);
        } else {
          console.log('❌ No NDR document found with ID:', activeNDR.id);
        }
      } catch (error) {
        console.error('❌ Error loading cars:', error);
      }
    };

    loadCars();
  }, [activeNDR]);

  useEffect(() => {
    if (!activeNDR) return;

    const locationsQuery = query(
      collection(db, 'carLocations'),
      where('ndrId', '==', activeNDR.id)
    );

    const unsubscribe = onSnapshot(locationsQuery, (snapshot) => {
      const locations = {};
      snapshot.forEach((doc) => {
        const data = doc.data();
        const carNum = data.carNumber;
        
        if (viewMode === 'couch' || (viewMode === 'navigator' && selectedCar && carNum === parseInt(selectedCar))) {
          locations[carNum] = {
            latitude: data.latitude,
            longitude: data.longitude,
            accuracy: data.accuracy,
            updatedAt: data.updatedAt?.toDate(),
            carNumber: carNum
          };
        }
      });
      
      console.log('📍 Updated car locations:', locations);
      setCarLocations(locations);
    });

    return () => unsubscribe();
  }, [activeNDR, viewMode, selectedCar]);

  useEffect(() => {
    if (!activeNDR || !selectedCar) {
      console.log('Message listener not active');
      return;
    }

    const carNum = parseInt(selectedCar, 10);
    console.log(`📨 Setting up message listener for car ${carNum}`);

    const messagesQuery = query(
      collection(db, 'couchMessages'),
      where('ndrId', '==', activeNDR.id),
      where('carNumber', '==', carNum),
      orderBy('timestamp', 'asc')
    );

    const unsubscribe = onSnapshot(
      messagesQuery,
      (snapshot) => {
        const msgs = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            sender: data.sender,
            senderName: data.senderName || (data.sender === 'couch' ? 'Couch' : `Car ${carNum}`),
            message: data.message,
            timestamp: data.timestamp?.toDate()
          };
        });
        
        console.log(`📬 Received ${msgs.length} messages for car ${carNum}`);
        setMessages(msgs);

        if (msgs.length > lastMessageCountRef.current && lastMessageCountRef.current > 0) {
          const latestMessage = msgs[msgs.length - 1];
          if ((viewMode === 'navigator' && latestMessage.sender === 'couch') ||
              (viewMode === 'couch' && latestMessage.sender === 'navigator')) {
            showNotification('New Message', latestMessage.message);
            playNotificationSound();
          }
        }
        lastMessageCountRef.current = msgs.length;
      },
      (error) => {
        console.error('❌ Error listening to messages:', error);
      }
    );

    return () => unsubscribe();
  }, [activeNDR, selectedCar, viewMode]);

  useEffect(() => {
    if (!activeNDR) return;
    
    if (viewMode === 'navigator' && !selectedCar) return;

    let ridesQuery;
    if (viewMode === 'couch' && selectedCar) {
      ridesQuery = query(
        collection(db, 'rides'),
        where('ndrId', '==', activeNDR.id),
        where('carNumber', '==', parseInt(selectedCar, 10)),
        where('status', 'in', ['active', 'pending'])
      );
    } else if (viewMode === 'navigator' && selectedCar) {
      ridesQuery = query(
        collection(db, 'rides'),
        where('ndrId', '==', activeNDR.id),
        where('carNumber', '==', parseInt(selectedCar, 10)),
        where('status', '==', 'active')
      );
    } else {
      return;
    }

    const unsubscribe = onSnapshot(
      ridesQuery,
      (snapshot) => {
        if (snapshot.empty) {
          console.log('No active rides found');
          setActiveRides([]);
          clearRoute();
          setEta(null);
        } else {
          const rides = snapshot.docs.map(doc => ({
            id: doc.id,
            name: doc.data().patronName,
            phone: doc.data().phone,
            pickup: doc.data().pickup,
            dropoffs: doc.data().dropoffs || [doc.data().dropoff],
            riders: doc.data().riders,
            status: doc.data().status
          }));
          setActiveRides(rides);
        }
      }
    );

    return () => unsubscribe();
  }, [activeNDR, selectedCar, viewMode]);

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

  const updateLocationToFirestore = async (position) => {
    if (!activeNDR || !selectedCar) {
      console.log('⏭️ Skipping location update');
      return;
    }

    const { latitude, longitude, speed, accuracy } = position.coords;
    
    console.log(`📍 Location: ${latitude.toFixed(6)}, ${longitude.toFixed(6)} (±${accuracy}m)`);

    if (lastLocationRef.current && lastLocationRef.current.lastWriteSuccess) {
      const distance = calculateDistance(
        lastLocationRef.current.latitude,
        lastLocationRef.current.longitude,
        latitude,
        longitude
      );

      if (distance < 30 && accuracy < 100) {
        console.log(`⏭️ Skipping update - movement only ${Math.round(distance)}m`);
        return;
      }
      
      console.log(`📏 Moved ${Math.round(distance)}m since last update`);
    }

    let newInterval = 5000;
    if (speed !== null && speed !== undefined) {
      if (speed > 20) {
        newInterval = 3000;
      } else if (speed > 5) {
        newInterval = 5000;
      } else if (speed > 1) {
        newInterval = 10000;
      } else {
        newInterval = 30000;
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
      
      lastLocationRef.current = { 
        latitude, 
        longitude, 
        lastWriteSuccess: true 
      };
      
      setLastLocationUpdate(new Date());
      setLocationError('');
      
    } catch (error) {
      console.error('❌ Error updating location to Firestore:', error);
      
      if (lastLocationRef.current) {
        lastLocationRef.current.lastWriteSuccess = false;
      }
      
      setDebugStatus('⚠️ Firestore update failed - will retry');
      setTimeout(() => setDebugStatus(''), 3000);
    }
  };

  useEffect(() => {
    if (viewMode !== 'navigator' || !locationEnabled || !selectedCar || !activeNDR) {
      console.log('Location tracking inactive');
      return;
    }

    console.log('🎯 Starting location tracking...');

    const handleError = (error) => {
      console.error('Location error:', error);
      let errorMessage = 'Location error: ';
      
      switch(error.code) {
        case error.PERMISSION_DENIED:
          errorMessage += 'Permission denied';
          break;
        case error.POSITION_UNAVAILABLE:
          errorMessage += 'Position unavailable';
          break;
        case error.TIMEOUT:
          errorMessage += 'Request timeout';
          break;
        default:
          errorMessage += 'Unknown error';
      }
      
      setLocationError(errorMessage);
      setDebugStatus(errorMessage);
    };

    if (isNativeApp) {
      console.log('🔵 Using NATIVE location tracking');
      
      const watchId = watchNativePosition(
        (position) => {
          console.log('✅ NATIVE location update:', position.coords);
          updateLocationToFirestore(position);
        },
        handleError
      );

      locationWatchId.current = watchId;

      return () => {
        console.log('🔴 Cleaning up NATIVE location tracking');
        if (locationWatchId.current) {
          clearNativeWatch(locationWatchId.current);
          locationWatchId.current = null;
        }
      };
    }

    console.log('🌐 Using WEB location tracking');
    
    const watchOptions = {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0
    };

    navigator.geolocation.getCurrentPosition(
      (position) => {
        console.log('✅ Initial WEB position:', position.coords);
        updateLocationToFirestore(position);
      },
      handleError,
      watchOptions
    );

    locationWatchId.current = navigator.geolocation.watchPosition(
      (position) => {
        console.log('✅ WEB location update:', position.coords);
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
      console.log('🔴 Cleaning up WEB location tracking');
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
    
    if (isNativeApp) {
      console.log('🔵 Using NATIVE location API');
      
      const permissionResult = await requestNativeLocationPermission();
      
      if (permissionResult.success) {
        const positionResult = await getNativePosition();
        
        if (positionResult.success) {
          console.log('✅ Native location obtained!', positionResult.coords);
          
          await updateLocationToFirestore(positionResult);
          
          setLocationEnabled(true);
          setDebugStatus('✅ Native location enabled!');
          setLocationError('');
          setTimeout(() => setDebugStatus(''), 3000);
          return;
        }
      }
      
      setLocationError('❌ Failed to get native location permission');
      setDebugStatus('❌ Permission failed');
      return;
    }
    
    console.log('🌐 Using WEB location API');
    
    const permissionState = await checkLocationPermission();
    console.log('Current permission state:', permissionState);
    
    if (permissionState === 'denied') {
      let errorMessage = '⚠️ Location access is blocked. ';
      if (platformInfo.isIOS) {
        errorMessage += 'Go to Settings > Privacy > Location Services to enable.';
      } else {
        errorMessage += 'Check your browser settings.';
      }
      setLocationError(errorMessage);
      return;
    }

    try {
      console.log('Requesting initial position...');
      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          resolve,
          reject,
          {
            enableHighAccuracy: true,
            timeout: 15000,
            maximumAge: 0
          }
        );
      });

      console.log('✅ Got initial position:', position.coords);
      
      await updateLocationToFirestore(position);

      setLocationEnabled(true);
      setDebugStatus('✅ Location enabled!');
      setLocationError('');
      setTimeout(() => setDebugStatus(''), 3000);
      
    } catch (error) {
      console.error('Error getting location:', error);
      
      let errorMessage = '❌ Location error: ';
      
      if (error.code === 1) {
        if (platformInfo.isIOS) {
          errorMessage = '⚠️ Permission denied. Go to iPhone Settings > Privacy > Location Services and enable for Safari/Chrome.';
        } else {
          errorMessage = '⚠️ Permission denied. Check your browser settings.';
        }
      } else if (error.code === 2) {
        errorMessage += 'Position unavailable. Check your device GPS.';
      } else if (error.code === 3) {
        errorMessage += 'Request timeout. Try again.';
      } else {
        errorMessage += error.message;
      }
      
      setLocationError(errorMessage);
      setDebugStatus(errorMessage);
    }
  };

  const stopLocationSharing = async () => {
    if (!activeNDR || !selectedCar) return;

    try {
      const locationsRef = collection(db, 'carLocations');
      const carNum = parseInt(selectedCar, 10);
      
      const existingQuery = query(
        locationsRef,
        where('ndrId', '==', activeNDR.id),
        where('carNumber', '==', carNum)
      );
      
      const existingDocs = await getDocs(existingQuery);
      
      if (!existingDocs.empty) {
        await deleteDoc(doc(db, 'carLocations', existingDocs.docs[0].id));
        console.log('✅ Location document deleted');
      }

      await addDoc(collection(db, 'couchMessages'), {
        ndrId: activeNDR.id,
        carNumber: carNum,
        sender: 'navigator',
        senderName: `Car ${carNum}`,
        message: '📍 Location sharing stopped',
        timestamp: Timestamp.now()
      });

      setLocationEnabled(false);
      setLastLocationUpdate(null);
      setEta(null);
      setDebugStatus('📍 Location sharing stopped');
      setTimeout(() => setDebugStatus(''), 2000);
    } catch (error) {
      console.error('Error stopping location sharing:', error);
      setDebugStatus('❌ Error stopping location');
      setTimeout(() => setDebugStatus(''), 3000);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedCar || !activeNDR) {
      console.log('Message send blocked');
      return;
    }

    setSendingMessage(true);
    
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
      <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-4 sm:p-6 mb-6">
        <div className="flex flex-col gap-3 mb-4">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
            Couch Navigator
          </h1>
          
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setViewMode('couch')}
              className={`px-3 sm:px-4 py-2 rounded-lg font-semibold text-xs sm:text-sm transition whitespace-nowrap ${
                viewMode === 'couch'
                  ? 'bg-[#79F200] text-gray-900'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              🛋️ Couch
            </button>
            <button
              onClick={() => setViewMode('navigator')}
              className={`px-3 sm:px-4 py-2 rounded-lg font-semibold text-xs sm:text-sm transition whitespace-nowrap ${
                viewMode === 'navigator'
                  ? 'bg-[#79F200] text-gray-900'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              🚗 Navigator
            </button>
            
            <button
              onClick={async () => {
                if (!notificationsEnabled) {
                  const granted = await requestNotificationPermission();
                  setNotificationsEnabled(granted);
                  if (granted) {
                    await showNotification('Notifications Enabled', 'You will now receive message updates');
                  }
                } else {
                  setNotificationsEnabled(false);
                }
              }}
              className={`px-3 sm:px-4 py-2 rounded-lg font-semibold text-xs sm:text-sm transition whitespace-nowrap flex items-center gap-2 ${
                notificationsEnabled
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {notificationsEnabled ? <Bell size={16} /> : <BellOff size={16} />}
              <span className="hidden sm:inline">Notifications</span>
            </button>
            
            <button
              onClick={() => setShowDebug(!showDebug)}
              className="px-3 sm:px-4 py-2 rounded-lg font-semibold text-xs sm:text-sm bg-gray-800 text-white hover:bg-gray-700 transition whitespace-nowrap"
            >
              🔍 Debug
            </button>
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
              </div>
              <div>View Mode: {viewMode}</div>
              <div>Active NDR: {activeNDR?.id || 'none'}</div>
              <div>Available Cars: {availableCars.length} loaded</div>
              <div className="text-xs text-blue-300">
                Cars Data: {JSON.stringify(availableCars.slice(0, 2))}
              </div>
              <div>Messages Loaded: {messages.length}</div>
              <div>Location: {locationEnabled ? '🟢 Enabled' : '🔴 Disabled'}</div>
              {eta && (
                <div className="text-purple-300">
                  ETA: {eta.durationText} to {eta.destination}
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

        {viewMode === 'navigator' ? (
          <div className="space-y-6">
            {!selectedCar ? (
              <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <Car size={20} />
                  Select Your Car
                </h3>
                <select
                  value={carNumber}
                  onChange={(e) => {
                    const num = e.target.value;
                    setCarNumber(num);
                    if (num) {
                      setSelectedCar(num);
                      console.log('Selected car:', num);
                    }
                  }}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-600 focus:border-blue-600 outline-none text-gray-900"
                >
                  <option value="">Choose your car number...</option>
                  {availableCars.map(car => (
                    <option key={car.carNumber} value={car.carNumber}>
                      Car {car.carNumber}
                      {car.driverName ? ` - ${car.driverName}` : ''}
                    </option>
                  ))}
                </select>
                
                <p className="text-sm text-gray-500 mt-3">
                  💡 Select the car number you're driving to enable messaging with the couch
                </p>
              </div>
            ) : (
              <>
                <div className="bg-blue-50 border-2 border-blue-400 rounded-xl p-4 flex items-center justify-between">
                  <div>
                    <p className="font-bold text-blue-900">Connected as Car {selectedCar}</p>
                    <p className="text-sm text-blue-700">You can now send and receive messages</p>
                  </div>
                  <button
                    onClick={async () => {
                      console.log('Disconnecting from car:', selectedCar);
                      if (locationEnabled) {
                        await stopLocationSharing();
                      }
                      // Clear markers
                      Object.values(markersRef.current).forEach(marker => {
                        if (marker && marker.setMap) {
                          marker.setMap(null);
                        }
                      });
                      markersRef.current = {};
                      setCarNumber('');
                      setSelectedCar(null);
                      setLocationEnabled(false);
                      setLastLocationUpdate(null);
                      setEta(null);
                      setDebugStatus('🔴 Disconnected');
                      setTimeout(() => setDebugStatus(''), 2000);
                    }}
                    className="px-3 py-1 bg-red-100 text-red-700 rounded text-sm font-bold hover:bg-red-200"
                  >
                    Disconnect
                  </button>
                </div>

                {activeRides.length > 0 && (
                  <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
                    <h3 className="text-lg font-bold text-gray-900 mb-4">
                      Your Active Ride
                    </h3>
                    {activeRides.map(ride => (
                      <div key={ride.id} className="space-y-3">
                        <div className="border-2 border-green-200 bg-green-50 rounded-xl p-4">
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
                            <span className="px-3 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700">
                              {ride.status}
                            </span>
                          </div>
                        </div>
                        
                        {eta && (
                          <div className="bg-blue-50 border-2 border-blue-400 rounded-xl p-4">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-xs font-semibold text-blue-800 uppercase">
                                  ETA to {eta.destination}
                                </p>
                                <p className="text-2xl font-bold text-blue-900 mt-1">
                                  {eta.eta.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </p>
                                <p className="text-sm text-blue-700 mt-1">
                                  {eta.durationText} • {eta.distanceText}
                                </p>
                              </div>
                              <Clock size={32} className="text-blue-600" />
                            </div>
                          </div>
                        )}
                        
                        {routeInfo && (
                          <div className="bg-purple-50 border border-purple-300 rounded-xl p-4">
                            <p className="text-xs font-semibold text-purple-800 uppercase mb-2">
                              Total Route
                            </p>
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-lg font-bold text-purple-900">
                                  {routeInfo.durationText}
                                </p>
                                <p className="text-sm text-purple-700">
                                  {routeInfo.distanceText} total
                                </p>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
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
                          When you tap the button below, your device will ask for permission.
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
                        </div>
                      )}
                      
                      <button
                        onClick={requestLocationPermission}
                        className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition flex items-center justify-center gap-2"
                      >
                        <Navigation size={20} />
                        Enable Location Sharing
                      </button>

                      {locationError && (
                        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                          <p className="text-xs text-red-800">{locationError}</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                        <p className="text-sm text-green-800 font-medium flex items-center gap-2">
                          <CheckCircle size={16} />
                          Location sharing is active
                        </p>
                        {lastLocationUpdate && (
                          <p className="text-xs text-green-700 mt-1">
                            Last update: {lastLocationUpdate.toLocaleTimeString()}
                          </p>
                        )}
                      </div>

                      {platformInfo.isIOS && isNativeApp && (
                        <div className="bg-purple-50 border border-purple-300 rounded-lg p-3">
                          <p className="text-xs text-purple-900 font-bold mb-2">
                            📱 Enable Background Tracking (Optional)
                          </p>
                          <p className="text-xs text-purple-800 mb-2">
                            For continuous tracking when the app is in the background, enable "Always" permission.
                          </p>
                          <button
                            onClick={async () => {
                              const result = await requestAlwaysLocationPermission();
                              if (result.success) {
                                alert('✅ Background tracking enabled!');
                              } else {
                                alert('ℹ️ To enable: Settings > Carpool Internal > Location > Always');
                              }
                            }}
                            className="w-full py-2 bg-purple-600 text-white rounded-lg font-bold hover:bg-purple-700 transition text-sm"
                          >
                            Enable Background Tracking
                          </button>
                        </div>
                      )}
                      
                      <button
                        onClick={stopLocationSharing}
                        className="w-full py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition flex items-center justify-center gap-2"
                      >
                        <X size={20} />
                        Stop Sharing Location
                      </button>
                    </div>
                  )}
                </div>

                {googleMapsLoaded && carLocations[selectedCar] && (
                  <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                        <Navigation size={20} className="text-blue-600" />
                        Your Location{activeRides.length > 0 ? ' & Route' : ''}
                      </h3>
                      <button
                        onClick={() => centerMapOnCar(selectedCar)}
                        className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 transition flex items-center gap-2"
                      >
                        <Navigation size={16} />
                        Recenter
                      </button>
                    </div>
                    <GoogleMap
                      mapContainerStyle={mapContainerStyle}
                      defaultCenter={{
                        lat: carLocations[selectedCar].latitude,
                        lng: carLocations[selectedCar].longitude
                      }}
                      defaultZoom={16}
                      onLoad={onMapLoad}
                      options={mapOptions}
                    />
                    <p className="text-xs text-gray-500 mt-2 flex items-center gap-1">
                      <Clock size={12} />
                      Last updated: {carLocations[selectedCar].updatedAt?.toLocaleTimeString() || 'Unknown'}
                    </p>
                  </div>
                )}

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
                              {msg.sender === 'navigator' ? 'You' : msg.senderName}
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
        ) : (
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">
                Select Car to Monitor
              </h3>
              <select
                value={selectedCar || ''}
                onChange={(e) => setSelectedCar(e.target.value || null)}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-600 focus:border-blue-600 outline-none text-gray-900"
              >
                <option value="">Select a car...</option>
                {availableCars.map(car => (
                  <option key={car.carNumber} value={car.carNumber}>
                    Car {car.carNumber}
                    {car.driverName ? ` - ${car.driverName}` : ''}
                  </option>
                ))}
              </select>
            </div>

            {selectedCar && (
              <>
                {googleMapsLoaded && carLocations[selectedCar] && (
                  <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                        <Navigation size={20} className="text-blue-600" />
                        Live Location - Car {selectedCar}
                      </h3>
                      <button
                        onClick={() => centerMapOnCar(selectedCar)}
                        className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 transition flex items-center gap-2"
                      >
                        <Navigation size={16} />
                        Recenter
                      </button>
                    </div>
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
                        <div key={ride.id} className="space-y-3">
                          <div className="border-2 border-gray-200 rounded-xl p-4">
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
                          
                          {eta && carLocations[selectedCar] && (
                            <div className="bg-blue-50 border-2 border-blue-400 rounded-xl p-4">
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="text-xs font-semibold text-blue-800 uppercase">
                                    Car {selectedCar} ETA to {eta.destination}
                                  </p>
                                  <p className="text-2xl font-bold text-blue-900 mt-1">
                                    {eta.eta.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  </p>
                                  <p className="text-sm text-blue-700 mt-1">
                                    {eta.durationText} • {eta.distanceText}
                                  </p>
                                </div>
                                <Clock size={32} className="text-blue-600" />
                              </div>
                            </div>
                          )}
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