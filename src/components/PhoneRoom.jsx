import React, { useState, useEffect, useRef } from 'react';
import { db, auth } from '../firebase';
import { collection, addDoc, query, onSnapshot, where, Timestamp, getDocs } from 'firebase/firestore';
import { useActiveNDR } from '../ActiveNDRContext';
import { AlertCircle, Phone, MapPin, Users, Send, CheckCircle, XCircle, Shield, AlertTriangle, Plus, X, Clock, TrendingUp } from 'lucide-react';
import { useGoogleMaps } from '../GoogleMapsProvider';

const PhoneRoom = () => {
  const { activeNDR, loading } = useActiveNDR();
  const { isLoaded, loadError } = useGoogleMaps();
  
  const formatPhoneNumber = (value) => {
    const cleaned = value.replace(/\D/g, '');
    const limited = cleaned.slice(0, 10);
    
    if (limited.length <= 3) {
      return limited;
    } else if (limited.length <= 6) {
      return `(${limited.slice(0, 3)}) ${limited.slice(3)}`;
    } else {
      return `(${limited.slice(0, 3)}) ${limited.slice(3, 6)}-${limited.slice(6)}`;
    }
  };

  const getActiveBlacklists = (blacklists, type) => {
    if (!activeNDR) return [];
    
    return blacklists.filter(item => {
      if (item.scope === 'permanent') return true;
      if (item.scope === 'temporary') {
        return item.ndrId === activeNDR.id;
      }
      return false;
    });
  };

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    pickup: '',
    dropoffs: [''],
    riders: 1
  });
  const [submitLoading, setSubmitLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');
  const [currentUser, setCurrentUser] = useState(null);
  
  // NEW: Common locations tracking
  const [commonLocations, setCommonLocations] = useState([]);
  const [showCommonPickups, setShowCommonPickups] = useState(false);
  const [showCommonDropoffs, setShowCommonDropoffs] = useState([false]);
  
  // NEW: Duplicate caller detection
  const [duplicateCallerWarning, setDuplicateCallerWarning] = useState(null);
  
  // NEW: Estimated wait time
  const [estimatedWaitTime, setEstimatedWaitTime] = useState(null);
  const [calculatingWait, setCalculatingWait] = useState(false);
  
  const [showBlacklistModal, setShowBlacklistModal] = useState(false);
  const [showBlacklistViewer, setShowBlacklistViewer] = useState(false);
  const [blacklistRequest, setBlacklistRequest] = useState({
    type: 'address',
    value: '',
    reason: '',
    scope: 'permanent',
    appliesToPickup: true,
    appliesToDropoff: true
  });
  const [blacklistedAddresses, setBlacklistedAddresses] = useState([]);
  const [blacklistedPhones, setBlacklistedPhones] = useState([]);
  const [blacklistLoading, setBlacklistLoading] = useState(false);
  const [blacklistAddressSuggestions, setBlacklistAddressSuggestions] = useState([]);
  const [showBlacklistSuggestions, setShowBlacklistSuggestions] = useState(false);
  const blacklistAddressRef = useRef(null);
  const [viewerTab, setViewerTab] = useState('addresses');
  
  const [pickupSuggestions, setPickupSuggestions] = useState([]);
  const [dropoffSuggestions, setDropoffSuggestions] = useState([[]]);
  const [showPickupSuggestions, setShowPickupSuggestions] = useState(false);
  const [showDropoffSuggestions, setShowDropoffSuggestions] = useState([false]);
  const pickupRef = useRef(null);
  const dropoffRefs = useRef([]);
  const autocompleteService = useRef(null);

  const BCS_CENTER = { lat: 30.6280, lng: -96.3344 };
  const VALID_ZIP_CODES = ['77801', '77802', '77803', '77807', '77808', '77840', '77841', '77842', '77843', '77844', '77845'];
  const VALID_CITIES = ['bryan', 'college station', 'college-station'];

  const getMockBCSAddresses = (input) => {
    const mockAddresses = [
      '123 University Dr, College Station, TX 77840',
      '456 Texas Ave, Bryan, TX 77801',
      '789 George Bush Dr, College Station, TX 77840',
      '101 Main St, Bryan, TX 77801'
    ];
    return mockAddresses.filter(addr => 
      addr.toLowerCase().includes(input.toLowerCase())
    );
  };

  // NEW: Load common locations from tonight's rides
  useEffect(() => {
    if (!activeNDR) return;

    const ridesRef = collection(db, 'rides');
    const ridesQuery = query(ridesRef, where('ndrId', '==', activeNDR.id));

    const unsubscribe = onSnapshot(ridesQuery, (snapshot) => {
      const locations = {};
      
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        
        // Count pickups
        if (data.pickup) {
          locations[data.pickup] = (locations[data.pickup] || 0) + 1;
        }
        
        // Count dropoffs
        if (data.dropoffs) {
          data.dropoffs.forEach(dropoff => {
            locations[dropoff] = (locations[dropoff] || 0) + 1;
          });
        } else if (data.dropoff) {
          locations[data.dropoff] = (locations[data.dropoff] || 0) + 1;
        }
      });

      // Sort by frequency and take top 10
      const sortedLocations = Object.entries(locations)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([address, count]) => ({ address, count }));

      setCommonLocations(sortedLocations);
    });

    return () => unsubscribe();
  }, [activeNDR]);

  // NEW: Check for duplicate caller when phone number changes
  useEffect(() => {
    const checkDuplicateCaller = async () => {
      if (!activeNDR || !formData.phone || formData.phone.length < 14) {
        setDuplicateCallerWarning(null);
        return;
      }

      try {
        const ridesRef = collection(db, 'rides');
        const ridesQuery = query(
          ridesRef,
          where('ndrId', '==', activeNDR.id),
          where('phone', '==', formData.phone)
        );
        
        const snapshot = await getDocs(ridesQuery);
        
        if (!snapshot.empty) {
          const previousRides = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            requestedAt: doc.data().requestedAt?.toDate()
          }));

          setDuplicateCallerWarning({
            count: previousRides.length,
            rides: previousRides
          });
        } else {
          setDuplicateCallerWarning(null);
        }
      } catch (error) {
        console.error('Error checking duplicate caller:', error);
      }
    };

    const debounce = setTimeout(checkDuplicateCaller, 500);
    return () => clearTimeout(debounce);
  }, [formData.phone, activeNDR]);

  // NEW: Calculate estimated wait time using REAL routing
  useEffect(() => {
    const calculateWaitTime = async () => {
      if (!activeNDR || !formData.pickup) {
        setEstimatedWaitTime(null);
        return;
      }

      // If Google Maps not loaded, use simple fallback
      if (!isLoaded || !window.google) {
        console.log('Google Maps not loaded, using fallback calculation');
        setCalculatingWait(true);
        
        try {
          const ridesRef = collection(db, 'rides');
          const pendingQuery = query(
            ridesRef,
            where('ndrId', '==', activeNDR.id),
            where('status', '==', 'pending')
          );
          const pendingSnapshot = await getDocs(pendingQuery);
          const pendingCount = pendingSnapshot.size;
          
          const availableCars = activeNDR.availableCars || 0;
          const avgWait = 15 + (pendingCount * 3);
          
          setEstimatedWaitTime({
            min: Math.max(10, avgWait - 5),
            max: avgWait + 10,
            pendingCount,
            availableCars,
            freeCars: 0,
            fallback: true,
            reason: 'Google Maps unavailable'
          });
        } catch (error) {
          console.error('Error in fallback calculation:', error);
          setEstimatedWaitTime({
            min: 15,
            max: 30,
            pendingCount: 0,
            availableCars: activeNDR.availableCars || 0,
            freeCars: 0,
            fallback: true
          });
        } finally {
          setCalculatingWait(false);
        }
        return;
      }

      setCalculatingWait(true);

      try {
        const directionsService = new window.google.maps.DirectionsService();
        const ridesRef = collection(db, 'rides');
        
        // Get pending rides count
        const pendingQuery = query(
          ridesRef,
          where('ndrId', '==', activeNDR.id),
          where('status', '==', 'pending')
        );
        const pendingSnapshot = await getDocs(pendingQuery);
        const pendingCount = pendingSnapshot.size;

        // Get active rides with full route info
        const activeQuery = query(
          ridesRef,
          where('ndrId', '==', activeNDR.id),
          where('status', '==', 'active')
        );
        const activeSnapshot = await getDocs(activeQuery);
        
        // Get car locations
        const carLocationsRef = collection(db, 'carLocations');
        const carLocationsQuery = query(
          carLocationsRef,
          where('ndrId', '==', activeNDR.id)
        );
        const carLocationsSnapshot = await getDocs(carLocationsQuery);
        const carLocations = {};
        carLocationsSnapshot.docs.forEach(doc => {
          const data = doc.data();
          carLocations[data.carNumber] = data;
        });

        const availableCars = activeNDR.availableCars || 0;
        const activeRides = activeSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        // Calculate when each car will be available
        const carAvailability = [];

        for (let carNum = 1; carNum <= availableCars; carNum++) {
          const activeRide = activeRides.find(r => r.carNumber === carNum);
          const location = carLocations[carNum];

          if (!activeRide) {
            // Car is free - calculate time to reach pickup
            if (location && location.latitude && location.longitude) {
              try {
                const result = await new Promise((resolve, reject) => {
                  directionsService.route(
                    {
                      origin: { lat: location.latitude, lng: location.longitude },
                      destination: formData.pickup,
                      travelMode: window.google.maps.TravelMode.DRIVING,
                      drivingOptions: {
                        departureTime: new Date(),
                        trafficModel: 'bestguess'
                      }
                    },
                    (result, status) => {
                      if (status === 'OK') resolve(result);
                      else reject(status);
                    }
                  );
                });

                const durationInTraffic = result.routes[0].legs[0].duration_in_traffic || result.routes[0].legs[0].duration;
                const minutesToPickup = Math.ceil(durationInTraffic.value / 60);
                
                carAvailability.push({
                  carNumber: carNum,
                  availableInMinutes: minutesToPickup,
                  isFree: true
                });
              } catch (error) {
                console.error(`Error routing free car ${carNum}:`, error);
                // Fallback: assume 10 min for free car
                carAvailability.push({
                  carNumber: carNum,
                  availableInMinutes: 10,
                  isFree: true
                });
              }
            } else {
              // No location data, assume 10 min
              carAvailability.push({
                carNumber: carNum,
                availableInMinutes: 10,
                isFree: true
              });
            }
          } else {
            // Car is busy - calculate remaining route time
            try {
              const waypoints = [];
              const dropoffs = activeRide.dropoffs || [activeRide.dropoff];
              
              // Determine current position
              let origin;
              if (activeRide.pickedUpAt) {
                // Already picked up, heading to dropoffs
                origin = activeRide.pickup;
              } else if (location && location.latitude && location.longitude) {
                // En route to pickup
                origin = { lat: location.latitude, lng: location.longitude };
                waypoints.push({ location: activeRide.pickup, stopover: true });
              } else {
                // No location, use pickup
                origin = activeRide.pickup;
              }

              // Add all dropoffs
              dropoffs.forEach((dropoff, idx) => {
                if (idx < dropoffs.length - 1) {
                  waypoints.push({ location: dropoff, stopover: true });
                }
              });

              const finalDropoff = dropoffs[dropoffs.length - 1];

              // Calculate time to complete current ride + time to new pickup
              const currentRouteResult = await new Promise((resolve, reject) => {
                directionsService.route(
                  {
                    origin: origin,
                    destination: finalDropoff,
                    waypoints: waypoints,
                    travelMode: window.google.maps.TravelMode.DRIVING,
                    drivingOptions: {
                      departureTime: new Date(),
                      trafficModel: 'bestguess'
                    }
                  },
                  (result, status) => {
                    if (status === 'OK') resolve(result);
                    else reject(status);
                  }
                );
              });

              let totalCurrentRouteTime = 0;
              currentRouteResult.routes[0].legs.forEach(leg => {
                const duration = leg.duration_in_traffic || leg.duration;
                totalCurrentRouteTime += duration.value;
              });

              // Add 2 minutes buffer per stop for pickup/dropoff
              const bufferMinutes = (waypoints.length + 1) * 2;
              const currentRouteMinutes = Math.ceil(totalCurrentRouteTime / 60) + bufferMinutes;

              // Now calculate from final dropoff to new pickup
              const toNewPickupResult = await new Promise((resolve, reject) => {
                directionsService.route(
                  {
                    origin: finalDropoff,
                    destination: formData.pickup,
                    travelMode: window.google.maps.TravelMode.DRIVING,
                    drivingOptions: {
                      departureTime: new Date(Date.now() + totalCurrentRouteTime * 1000),
                      trafficModel: 'bestguess'
                    }
                  },
                  (result, status) => {
                    if (status === 'OK') resolve(result);
                    else reject(status);
                  }
                );
              });

              const toNewPickupDuration = toNewPickupResult.routes[0].legs[0].duration_in_traffic || toNewPickupResult.routes[0].legs[0].duration;
              const toNewPickupMinutes = Math.ceil(toNewPickupDuration.value / 60);

              const totalAvailableInMinutes = currentRouteMinutes + toNewPickupMinutes;

              carAvailability.push({
                carNumber: carNum,
                availableInMinutes: totalAvailableInMinutes,
                isFree: false
              });
            } catch (error) {
              console.error(`Error routing busy car ${carNum}:`, error);
              // Fallback: assume 20 min to complete + 10 min to pickup
              carAvailability.push({
                carNumber: carNum,
                availableInMinutes: 30,
                isFree: false
              });
            }
          }
        }

        // Find the car that will arrive soonest
        if (carAvailability.length > 0) {
          carAvailability.sort((a, b) => a.availableInMinutes - b.availableInMinutes);
          const fastestCar = carAvailability[0];
          
          // Add queue position impact
          const queueDelayPerRide = 2; // 2 min overhead per ride in queue
          const queueDelay = pendingCount * queueDelayPerRide;
          
          const estimatedMinutes = fastestCar.availableInMinutes + queueDelay;
          const minWait = Math.max(5, estimatedMinutes - 3);
          const maxWait = estimatedMinutes + 5;

          setEstimatedWaitTime({
            min: minWait,
            max: maxWait,
            pendingCount,
            availableCars,
            freeCars: carAvailability.filter(c => c.isFree).length,
            fastestCar: fastestCar.carNumber,
            usingRealRouting: true
          });
        } else {
          // Fallback if no cars
          setEstimatedWaitTime({
            min: 15,
            max: 25,
            pendingCount,
            availableCars,
            freeCars: 0
          });
        }
      } catch (error) {
        console.error('Error calculating wait time:', error);
        // Fallback calculation - fetch pending count separately
        try {
          const ridesRef = collection(db, 'rides');
          const pendingQuery = query(
            ridesRef,
            where('ndrId', '==', activeNDR.id),
            where('status', '==', 'pending')
          );
          const pendingSnapshot = await getDocs(pendingQuery);
          const pendingCount = pendingSnapshot.size;
          const avgWait = 15 + (pendingCount * 5);
          
          setEstimatedWaitTime({
            min: Math.max(10, avgWait - 5),
            max: avgWait + 10,
            pendingCount,
            availableCars: activeNDR.availableCars || 0,
            freeCars: 0,
            fallback: true
          });
        } catch (fallbackError) {
          console.error('Error in fallback calculation:', fallbackError);
          // Ultimate fallback - just show generic estimate
          setEstimatedWaitTime({
            min: 15,
            max: 30,
            pendingCount: 0,
            availableCars: activeNDR.availableCars || 0,
            freeCars: 0,
            fallback: true
          });
        }
      } finally {
        setCalculatingWait(false);
      }
    };

    const debounce = setTimeout(calculateWaitTime, 1500);
    return () => clearTimeout(debounce);
  }, [formData.pickup, activeNDR, isLoaded]);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(user => {
      setCurrentUser(user);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (isLoaded && window.google) {
      autocompleteService.current = new window.google.maps.places.AutocompleteService();
    }
  }, [isLoaded]);

  useEffect(() => {
    const addressBlacklistQuery = query(
      collection(db, 'addressBlacklist'),
      where('status', '==', 'approved')
    );

    const unsubscribe = onSnapshot(addressBlacklistQuery, (snapshot) => {
      const addresses = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setBlacklistedAddresses(addresses);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const phoneBlacklistQuery = query(
      collection(db, 'phoneBlacklist'),
      where('status', '==', 'approved')
    );

    const unsubscribe = onSnapshot(phoneBlacklistQuery, (snapshot) => {
      const phones = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setBlacklistedPhones(phones);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (pickupRef.current && !pickupRef.current.contains(event.target)) {
        setShowPickupSuggestions(false);
        setShowCommonPickups(false);
      }
      
      dropoffRefs.current.forEach((ref, index) => {
        if (ref && !ref.contains(event.target)) {
          const newShowSuggestions = [...showDropoffSuggestions];
          newShowSuggestions[index] = false;
          setShowDropoffSuggestions(newShowSuggestions);
          
          const newShowCommon = [...showCommonDropoffs];
          newShowCommon[index] = false;
          setShowCommonDropoffs(newShowCommon);
        }
      });

      if (blacklistAddressRef.current && !blacklistAddressRef.current.contains(event.target)) {
        setShowBlacklistSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showDropoffSuggestions, showCommonDropoffs]);

  const fetchAddressSuggestions = (input, callback) => {
    if (!input || input.length < 3) {
      callback([]);
      return;
    }

    if (!isLoaded || !autocompleteService.current) {
      const mockResults = getMockBCSAddresses(input);
      callback(mockResults);
      return;
    }

    autocompleteService.current.getPlacePredictions(
      {
        input,
        location: new window.google.maps.LatLng(BCS_CENTER.lat, BCS_CENTER.lng),
        radius: 20000,
        componentRestrictions: { country: 'us' }
      },
      (predictions, status) => {
        if (status === window.google.maps.places.PlacesServiceStatus.OK && predictions) {
          const filteredPredictions = predictions
            .map(p => p.description)
            .filter(desc => {
              const lower = desc.toLowerCase();
              return VALID_ZIP_CODES.some(zip => lower.includes(zip)) ||
                     VALID_CITIES.some(city => lower.includes(city));
            });
          callback(filteredPredictions);
        } else {
          const mockResults = getMockBCSAddresses(input);
          callback(mockResults);
        }
      }
    );
  };

  const handlePickupChange = (value) => {
    setFormData({ ...formData, pickup: value });
    
    if (value.length >= 3) {
      fetchAddressSuggestions(value, (suggestions) => {
        setPickupSuggestions(suggestions);
        setShowPickupSuggestions(true);
        setShowCommonPickups(false);
      });
    } else {
      setPickupSuggestions([]);
      setShowPickupSuggestions(false);
    }
  };

  const selectPickupSuggestion = (address) => {
    setFormData({ ...formData, pickup: address });
    setShowPickupSuggestions(false);
    setShowCommonPickups(false);
    setPickupSuggestions([]);
  };

  const handleDropoffChange = (index, value) => {
    const newDropoffs = [...formData.dropoffs];
    newDropoffs[index] = value;
    setFormData({ ...formData, dropoffs: newDropoffs });
    
    fetchAddressSuggestions(value, (suggestions) => {
      const newSuggestions = [...dropoffSuggestions];
      newSuggestions[index] = suggestions;
      setDropoffSuggestions(newSuggestions);
    });
    
    const newShowSuggestions = [...showDropoffSuggestions];
    newShowSuggestions[index] = true;
    setShowDropoffSuggestions(newShowSuggestions);
    
    const newShowCommon = [...showCommonDropoffs];
    newShowCommon[index] = false;
    setShowCommonDropoffs(newShowCommon);
  };

  const selectDropoffSuggestion = (index, address) => {
    const newDropoffs = [...formData.dropoffs];
    newDropoffs[index] = address;
    setFormData({ ...formData, dropoffs: newDropoffs });
    
    const newShowSuggestions = [...showDropoffSuggestions];
    newShowSuggestions[index] = false;
    setShowDropoffSuggestions(newShowSuggestions);
    
    const newSuggestions = [...dropoffSuggestions];
    newSuggestions[index] = [];
    setDropoffSuggestions(newSuggestions);
    
    const newShowCommon = [...showCommonDropoffs];
    newShowCommon[index] = false;
    setShowCommonDropoffs(newShowCommon);
  };

  const addDropoff = () => {
    setFormData({
      ...formData,
      dropoffs: [...formData.dropoffs, '']
    });
    setDropoffSuggestions([...dropoffSuggestions, []]);
    setShowDropoffSuggestions([...showDropoffSuggestions, false]);
    setShowCommonDropoffs([...showCommonDropoffs, false]);
  };

  const removeDropoff = (index) => {
    if (formData.dropoffs.length === 1) return;
    
    const newDropoffs = formData.dropoffs.filter((_, i) => i !== index);
    const newSuggestions = dropoffSuggestions.filter((_, i) => i !== index);
    const newShowSuggestions = showDropoffSuggestions.filter((_, i) => i !== index);
    const newShowCommon = showCommonDropoffs.filter((_, i) => i !== index);
    
    setFormData({ ...formData, dropoffs: newDropoffs });
    setDropoffSuggestions(newSuggestions);
    setShowDropoffSuggestions(newShowSuggestions);
    setShowCommonDropoffs(newShowCommon);
  };

  const handleSubmit = async () => {
    if (!formData.name || !formData.phone || !formData.pickup || formData.dropoffs.some(d => !d)) {
      setMessage('Please fill in all fields');
      setMessageType('error');
      return;
    }

    const phoneDigits = formData.phone.replace(/\D/g, '');
    if (phoneDigits.length !== 10) {
      setMessage('Please enter a valid 10-digit phone number');
      setMessageType('error');
      return;
    }

    setSubmitLoading(true);
    setMessage('Verifying information...');
    setMessageType('info');

    try {
      const phoneBlacklistRef = collection(db, 'phoneBlacklist');
      const phoneBlacklistQuery = query(
        phoneBlacklistRef,
        where('phone', '==', formData.phone),
        where('status', '==', 'approved')
      );
      const phoneSnapshot = await getDocs(phoneBlacklistQuery);
      
      const activePhoneBlacklist = getActiveBlacklists(
        phoneSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })),
        'phone'
      );

      if (activePhoneBlacklist.length > 0) {
        setMessage(`This phone number is blacklisted: ${activePhoneBlacklist[0].reason}`);
        setMessageType('error');
        setSubmitLoading(false);
        return;
      }

      const addressBlacklistRef = collection(db, 'addressBlacklist');
      const activeAddressBlacklist = getActiveBlacklists(blacklistedAddresses, 'address');

      for (const item of activeAddressBlacklist) {
        if (item.appliesToPickup && formData.pickup.toLowerCase().includes(item.address.toLowerCase())) {
          setMessage(`Pickup location is blacklisted: ${item.reason}`);
          setMessageType('error');
          setSubmitLoading(false);
          return;
        }
        
        if (item.appliesToDropoff) {
          for (const dropoff of formData.dropoffs) {
            if (dropoff.toLowerCase().includes(item.address.toLowerCase())) {
              setMessage(`Dropoff location is blacklisted: ${item.reason}`);
              setMessageType('error');
              setSubmitLoading(false);
              return;
            }
          }
        }
      }

      const rideData = {
        ndrId: activeNDR.id,
        patronName: formData.name.trim(),
        phone: formData.phone,
        pickup: formData.pickup.trim(),
        dropoffs: formData.dropoffs.map(d => d.trim()),
        riders: parseInt(formData.riders),
        status: 'pending',
        requestedAt: Timestamp.now(),
        requestedBy: currentUser?.uid || 'anonymous'
      };

      await addDoc(collection(db, 'rides'), rideData);

      setMessage('Ride request submitted successfully!');
      setMessageType('success');
      
      setFormData({
        name: '',
        phone: '',
        pickup: '',
        dropoffs: [''],
        riders: 1
      });
      setDuplicateCallerWarning(null);
      setEstimatedWaitTime(null);

      setTimeout(() => {
        setMessage('');
        setMessageType('');
      }, 3000);

    } catch (error) {
      console.error('Error submitting request:', error);
      setMessage('Error submitting request. Please try again.');
      setMessageType('error');
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleBlacklistValueChange = (value) => {
    setBlacklistRequest({ ...blacklistRequest, value });
    
    if (blacklistRequest.type === 'address' && value.length >= 3) {
      fetchAddressSuggestions(value, (suggestions) => {
        setBlacklistAddressSuggestions(suggestions);
      });
    }
  };

  const selectBlacklistAddressSuggestion = (address) => {
    setBlacklistRequest({ ...blacklistRequest, value: address });
    setShowBlacklistSuggestions(false);
    setBlacklistAddressSuggestions([]);
  };

  const submitBlacklistRequest = async (e) => {
    e.preventDefault();

    if (!blacklistRequest.value || !blacklistRequest.reason) {
      alert('Please fill in all required fields');
      return;
    }

    setBlacklistLoading(true);

    try {
      const collectionName = blacklistRequest.type === 'address' ? 'addressBlacklist' : 'phoneBlacklist';
      
      const requestData = {
        [blacklistRequest.type === 'address' ? 'address' : 'phone']: blacklistRequest.value,
        reason: blacklistRequest.reason,
        scope: blacklistRequest.scope,
        status: 'pending',
        requestedAt: Timestamp.now(),
        requestedBy: currentUser?.uid || 'anonymous',
        requestedByName: currentUser?.displayName || 'Staff Member'
      };

      if (blacklistRequest.type === 'address') {
        requestData.appliesToPickup = blacklistRequest.appliesToPickup;
        requestData.appliesToDropoff = blacklistRequest.appliesToDropoff;
      }

      if (blacklistRequest.scope === 'temporary') {
        requestData.ndrId = activeNDR.id;
      }

      await addDoc(collection(db, collectionName), requestData);

      alert('Blacklist request submitted! Waiting for director approval.');
      
      setBlacklistRequest({
        type: 'address',
        value: '',
        reason: '',
        scope: 'permanent',
        appliesToPickup: true,
        appliesToDropoff: true
      });
      setShowBlacklistModal(false);
    } catch (error) {
      console.error('Error submitting blacklist request:', error);
      alert('Error submitting request: ' + error.message);
    } finally {
      setBlacklistLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 p-4 md:p-0">
        <h2 className="text-3xl md:text-4xl font-bold text-gray-900">Phone Room</h2>
        <div className="bg-white p-12 rounded-2xl shadow-xl text-center">
          <div className="w-16 h-16 border-4 border-[#79F200] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!activeNDR) {
    return (
      <div className="space-y-6 p-4 md:p-0">
        <h2 className="text-3xl md:text-4xl font-bold text-gray-900">Phone Room</h2>
        <div className="bg-yellow-50 border-2 border-yellow-400 rounded-2xl p-8 text-center">
          <AlertCircle className="mx-auto mb-4 text-yellow-600" size={64} />
          <h3 className="text-xl font-bold text-gray-800 mb-2">No Active NDR</h3>
          <p className="text-gray-600 mb-4">
            Phone Room is currently unavailable. A director must activate an NDR from the NDR Reports page before you can add phone requests.
          </p>
          <p className="text-sm text-gray-600">
            Directors: Go to NDR Reports and activate an Operating Night event to enable Phone Room.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-0">
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <div>
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900">Phone Room</h2>
          <p className="text-gray-600 mt-1">Log incoming ride requests</p>
        </div>
        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center">
          <button
            onClick={() => setShowBlacklistViewer(true)}
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-900 rounded-xl transition font-medium text-sm flex items-center justify-center gap-2 border-2 border-gray-300"
          >
            <Shield size={16} />
            View Blacklists
          </button>
          <button
            onClick={() => setShowBlacklistModal(true)}
            className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-xl transition font-medium text-sm flex items-center justify-center gap-2 shadow-lg"
          >
            <AlertTriangle size={16} />
            Request Blacklist
          </button>
          <div className="bg-[#79F200] px-6 py-3 rounded-xl shadow-lg">
            <p className="text-sm font-medium text-gray-900">Active NDR</p>
            <p className="text-base md:text-lg font-bold text-gray-900">{activeNDR.eventName}</p>
          </div>
        </div>
      </div>
      
      <div className="bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden">
        <div className="bg-[#79F200] p-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-lg">
              <Phone className="text-[#79F200]" size={24} />
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-900">New Request</h3>
              <p className="text-gray-900/80 text-sm font-medium">Enter caller information below</p>
            </div>
          </div>
        </div>

        <div className="p-6 md:p-8">
          {!isLoaded && !loadError && (
            <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-xl flex items-center gap-3">
              <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
              <div>
                <p className="text-sm text-blue-800 font-medium">Loading Google Maps...</p>
                <p className="text-xs text-blue-600 mt-1">This may take a few seconds. You can still submit requests.</p>
              </div>
            </div>
          )}

          {loadError && (
            <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-xl">
              <div className="flex items-start gap-3">
                <AlertCircle className="text-yellow-600 flex-shrink-0 mt-0.5" size={20} />
                <div>
                  <p className="text-sm text-yellow-800 font-medium">
                    Google Maps failed to load
                  </p>
                  <p className="text-xs text-yellow-700 mt-1">
                    Address autocomplete unavailable. You can still type addresses manually and submit requests.
                  </p>
                  <p className="text-xs text-yellow-600 mt-2">
                    <strong>Error:</strong> {loadError.message || 'Unknown error'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {message && (
            <div className={`mb-6 p-4 rounded-xl flex items-start gap-3 ${
              messageType === 'error' 
                ? 'bg-red-50 border border-red-200' 
                : messageType === 'success'
                ? 'bg-green-50 border border-green-200'
                : 'bg-blue-50 border border-blue-200'
            }`}>
              {messageType === 'error' ? (
                <XCircle className="text-red-500 flex-shrink-0 mt-0.5" size={20} />
              ) : messageType === 'success' ? (
                <CheckCircle className="text-green-500 flex-shrink-0 mt-0.5" size={20} />
              ) : (
                <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin flex-shrink-0"></div>
              )}
              <p className={`text-sm font-medium ${
                messageType === 'error' ? 'text-red-700' : messageType === 'success' ? 'text-green-700' : 'text-blue-700'
              }`}>{message}</p>
            </div>
          )}

          <div className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                <Users size={16} />
                Patron Name
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-[#79F200] focus:border-[#79F200] transition outline-none text-gray-900"
                placeholder="John Doe"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                <Phone size={16} />
                Phone Number
              </label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({...formData, phone: formatPhoneNumber(e.target.value)})}
                maxLength="14"
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-[#79F200] focus:border-[#79F200] transition outline-none text-gray-900"
                placeholder="(555) 123-4567"
              />
            </div>

            {/* NEW: Duplicate Caller Warning */}
            {duplicateCallerWarning && (
              <div className="bg-red-50 border-2 border-red-500 rounded-xl p-4 animate-pulse">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="text-red-600 flex-shrink-0 mt-0.5" size={24} />
                  <div className="flex-1">
                    <p className="font-bold text-red-900 text-lg mb-2">
                      ⚠️ DUPLICATE CALLER DETECTED
                    </p>
                    <p className="text-red-800 font-semibold mb-2">
                      This phone number has already requested {duplicateCallerWarning.count} ride{duplicateCallerWarning.count > 1 ? 's' : ''} tonight:
                    </p>
                    <div className="space-y-2">
                      {duplicateCallerWarning.rides.map((ride, idx) => (
                        <div key={idx} className="bg-white rounded-lg p-3 border border-red-300">
                          <p className="text-sm font-semibold text-gray-900">
                            {ride.patronName} - {ride.requestedAt?.toLocaleTimeString()}
                          </p>
                          <p className="text-sm text-gray-700">
                            Status: <span className="font-bold capitalize">{ride.status}</span>
                          </p>
                          {ride.status === 'cancelled' && ride.cancellationReason && (
                            <p className="text-xs text-gray-600">
                              Cancelled: {ride.cancellationReason}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                    <p className="text-red-900 font-bold mt-3 text-sm">
                      🚫 POLICY: Only ONE ride request per person per night
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* NEW: Estimated Wait Time with Real Routing */}
            {estimatedWaitTime && !duplicateCallerWarning && (
              <div className="bg-blue-50 border-2 border-blue-400 rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Clock size={24} className="text-blue-600" />
                    <div>
                      <p className="text-xs font-semibold text-blue-800 uppercase flex items-center gap-2">
                        Estimated Wait Time
                        {estimatedWaitTime.usingRealRouting && (
                          <span className="bg-green-500 text-white text-[10px] px-2 py-0.5 rounded-full">
                            LIVE ROUTING
                          </span>
                        )}
                        {estimatedWaitTime.fallback && (
                          <span className="bg-yellow-500 text-white text-[10px] px-2 py-0.5 rounded-full">
                            ESTIMATE
                          </span>
                        )}
                      </p>
                      <p className="text-2xl font-bold text-blue-900">
                        {estimatedWaitTime.min}-{estimatedWaitTime.max} minutes
                      </p>
                      {estimatedWaitTime.fastestCar && (
                        <p className="text-xs text-blue-700 mt-1">
                          Fastest: Car {estimatedWaitTime.fastestCar}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-blue-700">In Queue: {estimatedWaitTime.pendingCount}</p>
                    <p className="text-xs text-blue-700">Free Cars: {estimatedWaitTime.freeCars}/{estimatedWaitTime.availableCars}</p>
                  </div>
                </div>
              </div>
            )}

            {calculatingWait && !estimatedWaitTime && (
              <div className="bg-gray-50 border border-gray-300 rounded-xl p-4 flex items-center gap-3">
                <div className="w-5 h-5 border-2 border-gray-500 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-sm text-gray-600">Calculating wait time with live traffic data...</p>
              </div>
            )}

            <div className="relative" ref={pickupRef}>
              <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                <MapPin size={16} />
                Pickup Location
              </label>
              <input
                type="text"
                value={formData.pickup}
                onChange={(e) => handlePickupChange(e.target.value)}
                onFocus={() => {
                  if (commonLocations.length > 0 && !formData.pickup) {
                    setShowCommonPickups(true);
                  }
                }}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-[#79F200] focus:border-[#79F200] transition outline-none text-gray-900"
                placeholder="Start typing address..."
              />
              
              {/* NEW: Common Pickups */}
              {showCommonPickups && commonLocations.length > 0 && (
                <div className="absolute z-10 w-full mt-2 bg-white border-2 border-[#79F200] rounded-xl shadow-2xl max-h-80 overflow-y-auto">
                  <div className="p-3 bg-[#79F200] sticky top-0">
                    <p className="text-sm font-bold text-gray-900 flex items-center gap-2">
                      <TrendingUp size={16} />
                      Common Locations Tonight
                    </p>
                  </div>
                  {commonLocations.map((location, index) => (
                    <div
                      key={index}
                      onClick={() => {
                        selectPickupSuggestion(location.address);
                        setShowCommonPickups(false);
                      }}
                      className="px-4 py-3 hover:bg-[#79F200]/20 cursor-pointer transition flex items-center justify-between border-b border-gray-100 last:border-0"
                    >
                      <div className="flex items-center gap-2 flex-1">
                        <MapPin size={16} className="text-[#79F200] flex-shrink-0" />
                        <span className="text-sm text-gray-900">{location.address}</span>
                      </div>
                      <span className="text-xs font-bold text-gray-600 bg-gray-200 px-2 py-1 rounded-full">
                        {location.count}x
                      </span>
                    </div>
                  ))}
                </div>
              )}
              
              {showPickupSuggestions && pickupSuggestions.length > 0 && (
                <div className="absolute z-10 w-full mt-2 bg-white border-2 border-[#79F200] rounded-xl shadow-2xl max-h-64 overflow-y-auto">
                  {pickupSuggestions.map((suggestion, index) => (
                    <div
                      key={index}
                      onClick={() => selectPickupSuggestion(suggestion)}
                      className="px-4 py-3 hover:bg-[#79F200]/20 cursor-pointer transition flex items-center gap-2 border-b border-gray-100 last:border-0"
                    >
                      <MapPin size={16} className="text-[#79F200]" />
                      <span className="text-sm text-gray-900">{suggestion}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <MapPin size={16} />
                  Dropoff Location(s)
                </span>
                <button
                  type="button"
                  onClick={addDropoff}
                  className="px-3 py-1 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-lg transition text-xs font-bold flex items-center gap-1"
                >
                  <Plus size={14} />
                  Add Stop
                </button>
              </label>
              
              {formData.dropoffs.map((dropoff, index) => (
                <div key={index} className="mb-3">
                  <div className="flex gap-2">
                    <div 
                      className="relative flex-1"
                      ref={(el) => (dropoffRefs.current[index] = el)}
                    >
                      <input
                        type="text"
                        value={dropoff}
                        onChange={(e) => handleDropoffChange(index, e.target.value)}
                        onFocus={() => {
                          if (commonLocations.length > 0 && !dropoff) {
                            const newShowCommon = [...showCommonDropoffs];
                            newShowCommon[index] = true;
                            setShowCommonDropoffs(newShowCommon);
                          }
                        }}
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-[#79F200] focus:border-[#79F200] transition outline-none text-gray-900"
                        placeholder={`Dropoff ${formData.dropoffs.length > 1 ? index + 1 : ''} address...`}
                      />
                      
                      {/* NEW: Common Dropoffs */}
                      {showCommonDropoffs[index] && commonLocations.length > 0 && (
                        <div className="absolute z-10 w-full mt-2 bg-white border-2 border-[#79F200] rounded-xl shadow-2xl max-h-80 overflow-y-auto">
                          <div className="p-3 bg-[#79F200] sticky top-0">
                            <p className="text-sm font-bold text-gray-900 flex items-center gap-2">
                              <TrendingUp size={16} />
                              Common Locations Tonight
                            </p>
                          </div>
                          {commonLocations.map((location, locIndex) => (
                            <div
                              key={locIndex}
                              onClick={() => {
                                selectDropoffSuggestion(index, location.address);
                                const newShowCommon = [...showCommonDropoffs];
                                newShowCommon[index] = false;
                                setShowCommonDropoffs(newShowCommon);
                              }}
                              className="px-4 py-3 hover:bg-[#79F200]/20 cursor-pointer transition flex items-center justify-between border-b border-gray-100 last:border-0"
                            >
                              <div className="flex items-center gap-2 flex-1">
                                <MapPin size={16} className="text-[#79F200] flex-shrink-0" />
                                <span className="text-sm text-gray-900">{location.address}</span>
                              </div>
                              <span className="text-xs font-bold text-gray-600 bg-gray-200 px-2 py-1 rounded-full">
                                {location.count}x
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                      
                      {showDropoffSuggestions[index] && dropoffSuggestions[index]?.length > 0 && (
                        <div className="absolute z-10 w-full mt-2 bg-white border-2 border-[#79F200] rounded-xl shadow-2xl max-h-64 overflow-y-auto">
                          {dropoffSuggestions[index].map((suggestion, suggestionIndex) => (
                            <div
                              key={suggestionIndex}
                              onClick={() => selectDropoffSuggestion(index, suggestion)}
                              className="px-4 py-3 hover:bg-[#79F200]/20 cursor-pointer transition flex items-center gap-2 border-b border-gray-100 last:border-0"
                            >
                              <MapPin size={16} className="text-[#79F200]" />
                              <span className="text-sm text-gray-900">{suggestion}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    {formData.dropoffs.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeDropoff(index)}
                        className="px-3 py-3 bg-red-100 hover:bg-red-200 text-red-700 rounded-xl transition flex items-center justify-center"
                      >
                        <X size={18} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                <Users size={16} />
                Number of Riders
              </label>
              <input
                type="number"
                min="1"
                max="10"
                value={formData.riders}
                onChange={(e) => setFormData({...formData, riders: parseInt(e.target.value) || 1})}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-[#79F200] focus:border-[#79F200] transition outline-none text-gray-900"
              />
            </div>

            <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4">
              <p className="text-sm text-blue-800 font-medium flex items-start gap-2">
                <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
                <span>
                  You can add multiple dropoff locations for this ride. Addresses outside the service area will be rejected.
                </span>
              </p>
            </div>

            <button
              onClick={handleSubmit}
              disabled={submitLoading || (duplicateCallerWarning !== null)}
              className="w-full py-4 bg-[#79F200] text-gray-900 rounded-xl hover:shadow-lg hover:shadow-[#79F200]/30 transform hover:scale-[1.02] transition font-bold text-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-3"
            >
              {submitLoading ? (
                <>
                  <div className="w-5 h-5 border-2 border-gray-900 border-t-transparent rounded-full animate-spin"></div>
                  Processing...
                </>
              ) : duplicateCallerWarning ? (
                <>
                  <AlertTriangle size={20} />
                  Cannot Submit - Duplicate Caller
                </>
              ) : (
                <>
                  <Send size={20} />
                  Submit Request
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Blacklist Request Modal */}
      {showBlacklistModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="bg-gradient-to-r from-orange-500 to-red-500 p-6 rounded-t-2xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center">
                    <AlertTriangle className="text-orange-500" size={24} />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white">Request Blacklist</h3>
                    <p className="text-white/90 text-sm">Requires director approval</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowBlacklistModal(false)}
                  className="text-white hover:bg-white/20 rounded-lg p-2 transition"
                >
                  <X size={24} />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-5">
              <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
                <p className="text-sm text-yellow-800">
                  <strong>Note:</strong> This request will be pending until a director approves it. 
                  Only approved entries will be blocked.
                </p>
              </div>

              <form onSubmit={submitBlacklistRequest} className="space-y-5">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Type *
                  </label>
                  <select
                    value={blacklistRequest.type}
                    onChange={(e) => setBlacklistRequest({ ...blacklistRequest, type: e.target.value, value: '' })}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition outline-none text-gray-900"
                  >
                    <option value="address">Address</option>
                    <option value="phone">Phone Number</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Scope *
                  </label>
                  <select
                    value={blacklistRequest.scope}
                    onChange={(e) => setBlacklistRequest({ ...blacklistRequest, scope: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition outline-none text-gray-900"
                  >
                    <option value="permanent">Permanent (All events)</option>
                    <option value="temporary">Temporary (This event only)</option>
                  </select>
                </div>

                <div className="relative" ref={blacklistAddressRef}>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    {blacklistRequest.type === 'address' ? 'Address' : 'Phone Number'} *
                  </label>
                  <input
                    type="text"
                    value={blacklistRequest.value}
                    onChange={(e) => {
                      const value = blacklistRequest.type === 'phone' ? 
                        formatPhoneNumber(e.target.value) : e.target.value;
                      handleBlacklistValueChange(value);
                    }}
                    onFocus={() => blacklistRequest.type === 'address' && setShowBlacklistSuggestions(true)}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition outline-none text-gray-900"
                    maxLength={blacklistRequest.type === 'phone' ? 14 : undefined}
                    placeholder={blacklistRequest.type === 'address' ? 
                      'Start typing address...' : 
                      '(555) 123-4567'}
                    required
                  />
                  
                  {showBlacklistSuggestions && blacklistAddressSuggestions.length > 0 && (
                    <div className="absolute z-10 w-full mt-2 bg-white border-2 border-orange-500 rounded-xl shadow-2xl max-h-64 overflow-y-auto">
                      {blacklistAddressSuggestions.map((suggestion, index) => (
                        <div
                          key={index}
                          onClick={() => selectBlacklistAddressSuggestion(suggestion)}
                          className="px-4 py-3 hover:bg-orange-50 cursor-pointer transition flex items-center gap-2 border-b border-gray-100 last:border-0"
                        >
                          <MapPin size={16} className="text-orange-500" />
                          <span className="text-sm text-gray-900">{suggestion}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {blacklistRequest.type === 'address' && (
                  <div className="space-y-3">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Apply To:
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={blacklistRequest.appliesToPickup}
                        onChange={(e) => setBlacklistRequest({ ...blacklistRequest, appliesToPickup: e.target.checked })}
                        className="w-5 h-5 rounded border-gray-300"
                      />
                      <span className="text-sm text-gray-700">Pickup Locations</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={blacklistRequest.appliesToDropoff}
                        onChange={(e) => setBlacklistRequest({ ...blacklistRequest, appliesToDropoff: e.target.checked })}
                        className="w-5 h-5 rounded border-gray-300"
                      />
                      <span className="text-sm text-gray-700">Dropoff Locations</span>
                    </label>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Reason *
                  </label>
                  <textarea
                    value={blacklistRequest.reason}
                    onChange={(e) => setBlacklistRequest({ ...blacklistRequest, reason: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition outline-none text-gray-900 min-h-24"
                    placeholder="Explain why this should be blacklisted..."
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={blacklistLoading}
                  className="w-full py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-xl transition font-bold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {blacklistLoading ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Submitting...
                    </>
                  ) : (
                    <>
                      <Send size={18} />
                      Submit Request
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Blacklist Viewer Modal */}
      {showBlacklistViewer && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="bg-gradient-to-r from-gray-800 to-gray-900 p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center">
                    <Shield className="text-gray-800" size={24} />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white">Active Blacklists</h3>
                    <p className="text-white/90 text-sm">View currently blocked addresses and phone numbers</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowBlacklistViewer(false)}
                  className="text-white hover:bg-white/20 rounded-lg p-2 transition"
                >
                  <X size={24} />
                </button>
              </div>
            </div>

            {activeNDR && (
              <div className="border-b border-gray-200 px-6 py-3 bg-gray-50">
                <div className="flex gap-2">
                  <button
                    onClick={() => setViewerTab('addresses')}
                    className={`px-4 py-2 rounded-lg font-semibold transition ${
                      viewerTab === 'addresses'
                        ? 'bg-white text-gray-900 shadow'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    Addresses ({getActiveBlacklists(blacklistedAddresses, 'address').filter(a => a.status === 'approved').length})
                  </button>
                  <button
                    onClick={() => setViewerTab('phones')}
                    className={`px-4 py-2 rounded-lg font-semibold transition ${
                      viewerTab === 'phones'
                        ? 'bg-white text-gray-900 shadow'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    Phone Numbers ({getActiveBlacklists(blacklistedPhones, 'phone').filter(p => p.status === 'approved').length})
                  </button>
                </div>
              </div>
            )}

            <div className="flex-1 overflow-y-auto p-6">
              {viewerTab === 'addresses' ? (
                <div className="space-y-3">
                  {getActiveBlacklists(blacklistedAddresses, 'address').filter(a => a.status === 'approved').length === 0 ? (
                    <p className="text-center text-gray-500 py-8">No blocked addresses for this event</p>
                  ) : (
                    getActiveBlacklists(blacklistedAddresses, 'address')
                      .filter(a => a.status === 'approved')
                      .map((item) => (
                        <div key={item.id} className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <MapPin size={18} className="text-red-600 flex-shrink-0" />
                              <p className="font-bold text-gray-900">{item.address}</p>
                            </div>
                            <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                              item.scope === 'temporary' ? 'bg-orange-100 text-orange-800' : 'bg-red-100 text-red-800'
                            }`}>
                              {item.scope === 'temporary' ? 'TEMP' : 'PERM'}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600 mb-2">
                            <strong>Reason:</strong> {item.reason}
                          </p>
                          <div className="flex gap-2 text-xs text-gray-500">
                            {item.appliesToPickup && (
                              <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded">Pickup</span>
                            )}
                            {item.appliesToDropoff && (
                              <span className="bg-purple-100 text-purple-700 px-2 py-1 rounded">Dropoff</span>
                            )}
                          </div>
                          {item.approvedBy && (
                            <p className="text-xs text-gray-500 mt-2">
                              Approved by {item.approvedBy} on {item.approvedAt?.toDate().toLocaleDateString()}
                            </p>
                          )}
                        </div>
                      ))
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  {getActiveBlacklists(blacklistedPhones, 'phone').filter(p => p.status === 'approved').length === 0 ? (
                    <p className="text-center text-gray-500 py-8">No blocked phone numbers for this event</p>
                  ) : (
                    getActiveBlacklists(blacklistedPhones, 'phone')
                      .filter(p => p.status === 'approved')
                      .map((item) => (
                        <div key={item.id} className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                          <div className="flex items-start justify-between">
                            <div>
                              <div className="flex items-center gap-2 mb-2">
                                <Phone size={18} className="text-red-600" />
                                <p className="font-bold text-gray-900">{item.phone}</p>
                                <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                                  item.scope === 'temporary' ? 'bg-orange-100 text-orange-800' : 'bg-red-100 text-red-800'
                                }`}>
                                  {item.scope === 'temporary' ? 'TEMP' : 'PERM'}
                                </span>
                              </div>
                              <p className="text-sm text-gray-600 mb-2">
                                <strong>Reason:</strong> {item.reason}
                              </p>
                              {item.approvedBy && (
                                <p className="text-xs text-gray-500">
                                  Approved by {item.approvedBy} on {item.approvedAt?.toDate().toLocaleDateString()}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      ))
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PhoneRoom;