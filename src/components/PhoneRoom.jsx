import React, { useState, useEffect, useRef } from 'react';
import { db, auth } from '../firebase';
import { collection, addDoc, query, onSnapshot, where, Timestamp, orderBy } from 'firebase/firestore';
import { useActiveNDR } from '../ActiveNDRContext';
import { AlertCircle, Phone, MapPin, Users, Send, CheckCircle, XCircle, Shield, AlertTriangle } from 'lucide-react';
import { useLoadScript } from '@react-google-maps/api';

const libraries = ['places'];
const GOOGLE_API_KEY = process.env.REACT_APP_GOOGLE_PLACES_API_KEY;

const PhoneRoom = () => {
  const { activeNDR, loading } = useActiveNDR();
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    pickup: '',
    dropoff: '',
    riders: 1
  });
  const [submitLoading, setSubmitLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');
  const [currentUser, setCurrentUser] = useState(null);
  
  // Blacklist states
  const [showBlacklistModal, setShowBlacklistModal] = useState(false);
  const [showBlacklistViewer, setShowBlacklistViewer] = useState(false);
  const [blacklistRequest, setBlacklistRequest] = useState({
    address: '',
    reason: ''
  });
  const [blacklistedAddresses, setBlacklistedAddresses] = useState([]);
  const [blacklistLoading, setBlacklistLoading] = useState(false);
  const [blacklistAddressSuggestions, setBlacklistAddressSuggestions] = useState([]);
  const [showBlacklistSuggestions, setShowBlacklistSuggestions] = useState(false);
  const blacklistAddressRef = useRef(null);
  
  // Autocomplete states
  const [pickupSuggestions, setPickupSuggestions] = useState([]);
  const [dropoffSuggestions, setDropoffSuggestions] = useState([]);
  const [showPickupSuggestions, setShowPickupSuggestions] = useState(false);
  const [showDropoffSuggestions, setShowDropoffSuggestions] = useState(false);
  const pickupRef = useRef(null);
  const dropoffRef = useRef(null);
  const autocompleteService = useRef(null);

  // Load Google Maps Script
  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: GOOGLE_API_KEY,
    libraries: libraries,
  });

  // Bryan/College Station center coordinates
  const BCS_CENTER = { lat: 30.6280, lng: -96.3344 };
  
  // Valid Bryan/College Station zip codes
  const VALID_ZIP_CODES = ['77801', '77802', '77803', '77807', '77808', '77840', '77841', '77842', '77843', '77844', '77845'];
  const VALID_CITIES = ['bryan', 'college station', 'college-station'];

  // Verify address is actually in Bryan/College Station using geocoding
  const verifyAddressInBCS = async (address) => {
    if (!address || address.trim().length === 0) {
      return { valid: false, reason: 'Address is empty' };
    }
    
    // Basic text validation first
    const lowerAddress = address.toLowerCase();
    
    const hasValidCity = VALID_CITIES.some(city => lowerAddress.includes(city));
    const hasValidZip = VALID_ZIP_CODES.some(zip => lowerAddress.includes(zip));
    
    // First check: Must have Bryan/College Station in name OR valid zip
    if (!hasValidCity && !hasValidZip) {
      return { 
        valid: false, 
        reason: 'Address must include "Bryan" or "College Station" or a valid local zip code (77801-77845)' 
      };
    }

    // If Google Maps is loaded, verify with geocoding
    if (isLoaded && window.google) {
      try {
        const geocoder = new window.google.maps.Geocoder();
        const result = await new Promise((resolve, reject) => {
          geocoder.geocode({ address: address }, (results, status) => {
            if (status === 'OK' && results[0]) {
              resolve(results[0]);
            } else {
              reject(new Error('Geocoding failed: ' + status));
            }
          });
        });

        const location = result.geometry.location;
        const lat = location.lat();
        const lng = location.lng();

        // Check if address components include Bryan or College Station city
        const addressComponents = result.address_components;
        
        const cityComponent = addressComponents.find(component => 
          component.types.includes('locality')
        );
        
        const zipComponent = addressComponents.find(component => 
          component.types.includes('postal_code')
        );
        
        const city = cityComponent?.long_name?.toLowerCase() || '';
        const zip = zipComponent?.long_name || '';
        
        const isBryanOrCS = VALID_CITIES.some(validCity => city.includes(validCity));
        const hasValidZipCode = VALID_ZIP_CODES.includes(zip);

        console.log('Address verification:', {
          address,
          city,
          zip,
          isBryanOrCS,
          hasValidZipCode,
          coordinates: { lat, lng }
        });

        // Must have Bryan/College Station in city name OR valid zip code
        if (!isBryanOrCS && !hasValidZipCode) {
          return { 
            valid: false, 
            reason: 'Address must be within Bryan or College Station city limits (detected city: ' + (city || 'unknown') + ', zip: ' + (zip || 'unknown') + ')'
          };
        }

        return { valid: true, coordinates: { lat, lng } };
      } catch (error) {
        console.error('Geocoding error:', error);
        // If geocoding fails, fall back to text validation
        return { 
          valid: hasValidCity || hasValidZip,
          reason: hasValidCity || hasValidZip ? null : 'Unable to verify address location'
        };
      }
    }

    // Fallback if Google Maps not loaded
    return { 
      valid: hasValidCity || hasValidZip,
      reason: hasValidCity || hasValidZip ? null : 'Address must be in Bryan/College Station area'
    };
  };

  // Check if address is blacklisted
  const isAddressBlacklisted = (address) => {
    const normalizedInput = address.toLowerCase().trim();
    
    return blacklistedAddresses.some(blacklisted => {
      const normalizedBlacklisted = blacklisted.address.toLowerCase().trim();
      // Check if the addresses are similar (exact match or contains)
      return normalizedInput.includes(normalizedBlacklisted) || 
             normalizedBlacklisted.includes(normalizedInput) ||
             normalizedInput === normalizedBlacklisted;
    });
  };

  // DEBUG: Log API key and loading status
  useEffect(() => {
    console.log('=== GOOGLE PLACES DEBUG ===');
    console.log('API Key exists:', !!GOOGLE_API_KEY);
    console.log('API Key first 10 chars:', GOOGLE_API_KEY?.substring(0, 10));
    console.log('Is Loaded:', isLoaded);
    console.log('Load Error:', loadError);
    console.log('========================');
  }, [isLoaded, loadError]);

  // Fetch current user information
  useEffect(() => {
    const fetchCurrentUser = async () => {
      if (auth.currentUser) {
        const userDoc = await new Promise((resolve) => {
          const unsubscribe = onSnapshot(
            query(collection(db, 'members'), where('__name__', '==', auth.currentUser.uid)),
            (snapshot) => {
              unsubscribe();
              if (!snapshot.empty) {
                resolve(snapshot.docs[0].data());
              } else {
                resolve(null);
              }
            }
          );
        });
        setCurrentUser(userDoc);
      }
    };
    fetchCurrentUser();
  }, []);

  // Initialize Google Places Autocomplete Service
  useEffect(() => {
    if (isLoaded && window.google) {
      autocompleteService.current = new window.google.maps.places.AutocompleteService();
      console.log('Google Places API loaded successfully');
    }
  }, [isLoaded]);

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (pickupRef.current && !pickupRef.current.contains(event.target)) {
        setShowPickupSuggestions(false);
      }
      if (dropoffRef.current && !dropoffRef.current.contains(event.target)) {
        setShowDropoffSuggestions(false);
      }
      if (blacklistAddressRef.current && !blacklistAddressRef.current.contains(event.target)) {
        setShowBlacklistSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch blacklisted addresses
  useEffect(() => {
    const blacklistQuery = query(
      collection(db, 'addressBlacklist'),
      where('status', '==', 'approved')
    );

    const unsubscribe = onSnapshot(blacklistQuery, (snapshot) => {
      const addresses = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setBlacklistedAddresses(addresses);
      console.log('Loaded blacklisted addresses:', addresses.length);
    });

    return () => unsubscribe();
  }, []);

  // Fetch address suggestions from Google Places API
  const fetchAddressSuggestions = async (input, setSuggestions) => {
    if (!input || input.length < 3) {
      setSuggestions([]);
      return;
    }

    if (!isLoaded || !autocompleteService.current) {
      console.log('Google Places API not loaded yet');
      setSuggestions(getMockBCSAddresses(input));
      return;
    }

    try {
      const request = {
        input: input,
        componentRestrictions: { country: 'us' },
        location: new window.google.maps.LatLng(BCS_CENTER.lat, BCS_CENTER.lng),
        radius: 50000, // Show wider area (50km) for suggestions
        // Don't use strictBounds - let users see all addresses
      };

      autocompleteService.current.getPlacePredictions(request, (predictions, status) => {
        console.log('Google Places Status:', status);
        
        if (status === window.google.maps.places.PlacesServiceStatus.OK && predictions) {
          // Show all suggestions - let validation handle rejections
          const allSuggestions = predictions
            .map(prediction => prediction.description)
            .slice(0, 10); // Show more results since we're not filtering
          
          console.log('All suggestions:', allSuggestions.length);
          setSuggestions(allSuggestions);
        } else if (status === window.google.maps.places.PlacesServiceStatus.ZERO_RESULTS) {
          console.log('No results from Google');
          setSuggestions([]);
        } else {
          console.log('Google Places API error:', status);
          console.log('Falling back to mock addresses');
          setSuggestions(getMockBCSAddresses(input));
        }
      });
    } catch (error) {
      console.error('Error fetching Google suggestions:', error);
      setSuggestions(getMockBCSAddresses(input));
    }
  };

  // Mock address suggestions for Bryan/College Station area (fallback)
  const getMockBCSAddresses = (input) => {
    const lowerInput = input.toLowerCase();
    
    const bcsAddresses = [
      'Texas A&M University, College Station, TX 77843',
      'Memorial Student Center, College Station, TX 77843',
      'Kyle Field, College Station, TX 77843',
      'Reed Arena, College Station, TX 77843',
      'Evans Library, College Station, TX 77843',
      'Zachry Engineering Center, College Station, TX 77843',
      'Northgate, College Station, TX 77840',
      '200 University Dr, College Station, TX 77840',
      '300 Patricia St, College Station, TX 77840',
      'Post Oak Mall, College Station, TX 77845',
      '1500 Harvey Rd, College Station, TX 77840',
      'Target, College Station, TX 77840',
      'HEB Plus, College Station, TX 77845',
      'Walmart Supercenter, College Station, TX 77845',
      'Century Square, College Station, TX 77840',
      'The District, College Station, TX 77845',
      '1000 University Oaks, College Station, TX 77840',
      '2000 Dartmouth St, College Station, TX 77840',
      '3000 Longmire Dr, College Station, TX 77845',
      '4000 College Main, College Station, TX 77845',
      '5000 Rock Prairie Rd, College Station, TX 77845',
      '1000 E Villa Maria Rd, Bryan, TX 77802',
      '2000 Briarcrest Dr, Bryan, TX 77802',
      '3000 Texas Ave, Bryan, TX 77802',
      '4000 S College Ave, Bryan, TX 77801',
      'Baylor Scott & White, College Station, TX 77845',
      'CHI St Joseph Health, Bryan, TX 77802',
      'Easterwood Airport, College Station, TX 77845',
    ];

    return bcsAddresses
      .filter(addr => addr.toLowerCase().includes(lowerInput))
      .slice(0, 8);
  };

  const handlePickupChange = (value) => {
    setFormData({...formData, pickup: value});
    fetchAddressSuggestions(value, setPickupSuggestions);
    setShowPickupSuggestions(true);
  };

  const handleDropoffChange = (value) => {
    setFormData({...formData, dropoff: value});
    fetchAddressSuggestions(value, setDropoffSuggestions);
    setShowDropoffSuggestions(true);
  };

  const selectPickupSuggestion = (address) => {
    setFormData({...formData, pickup: address});
    setShowPickupSuggestions(false);
    setPickupSuggestions([]);
  };

  const selectDropoffSuggestion = (address) => {
    setFormData({...formData, dropoff: address});
    setShowDropoffSuggestions(false);
    setDropoffSuggestions([]);
  };

  const handleBlacklistAddressChange = (value) => {
    setBlacklistRequest({...blacklistRequest, address: value});
    fetchAddressSuggestions(value, setBlacklistAddressSuggestions);
    setShowBlacklistSuggestions(true);
  };

  const selectBlacklistSuggestion = (address) => {
    setBlacklistRequest({...blacklistRequest, address: address});
    setShowBlacklistSuggestions(false);
    setBlacklistAddressSuggestions([]);
  };

  // Show loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-[#79F200] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading Phone Room...</p>
        </div>
      </div>
    );
  }

  // Show error if Google Maps failed to load
  if (loadError) {
    console.error('Google Maps load error:', loadError);
  }

  // Show gate if no active NDR
  if (!activeNDR) {
    return (
      <div className="space-y-6 p-4 md:p-0">
        <h2 className="text-3xl md:text-4xl font-bold text-gray-900">Phone Room</h2>
        <div className="bg-gradient-to-br from-yellow-50 to-orange-50 border-2 border-yellow-400 rounded-2xl p-6 md:p-8 text-center shadow-xl">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-yellow-400 rounded-full mb-4">
            <AlertCircle className="text-white" size={32} />
          </div>
          <h3 className="text-2xl md:text-3xl font-bold text-gray-900 mb-3">No Active NDR</h3>
          <p className="text-gray-700 mb-4 max-w-2xl mx-auto text-sm md:text-base">
            Phone Room is currently unavailable. A director must activate an NDR from the NDR Reports page before you can add phone requests.
          </p>
          <p className="text-sm text-gray-600">
            Directors: Go to NDR Reports and activate an Operating Night event to enable Phone Room.
          </p>
        </div>
      </div>
    );
  }

  const handleSubmit = async () => {
    if (!formData.name || !formData.phone || !formData.pickup || !formData.dropoff) {
      setMessage('Please fill in all fields');
      setMessageType('error');
      return;
    }

    setSubmitLoading(true);
    setMessage('Verifying addresses...');
    setMessageType('info');

    try {
      // Check if pickup address is blacklisted
      if (isAddressBlacklisted(formData.pickup)) {
        setMessage('⛔ Pickup address is blacklisted and cannot be used');
        setMessageType('error');
        setSubmitLoading(false);
        return;
      }

      // Check if dropoff address is blacklisted
      if (isAddressBlacklisted(formData.dropoff)) {
        setMessage('⛔ Dropoff address is blacklisted and cannot be used');
        setMessageType('error');
        setSubmitLoading(false);
        return;
      }

      // Validate pickup address is in Bryan/College Station
      const pickupValidation = await verifyAddressInBCS(formData.pickup);
      if (!pickupValidation.valid) {
        setMessage(`Pickup address rejected: ${pickupValidation.reason}`);
        setMessageType('error');
        setSubmitLoading(false);
        return;
      }

      // Validate dropoff address is in Bryan/College Station
      const dropoffValidation = await verifyAddressInBCS(formData.dropoff);
      if (!dropoffValidation.valid) {
        setMessage(`Dropoff address rejected: ${dropoffValidation.reason}`);
        setMessageType('error');
        setSubmitLoading(false);
        return;
      }

      setMessage('Checking phone blacklist...');

      // Check phone blacklist
      const blacklistRef = collection(db, 'blacklist');
      const blacklistQuery = query(blacklistRef, where('number', '==', formData.phone));
      const blacklistSnapshot = await new Promise((resolve) => {
        const unsubscribe = onSnapshot(blacklistQuery, (snapshot) => {
          unsubscribe();
          resolve(snapshot);
        });
      });

      if (!blacklistSnapshot.empty) {
        setMessage('This phone number is blocked');
        setMessageType('error');
        setSubmitLoading(false);
        return;
      }

      setMessage('Submitting request...');

      await addDoc(collection(db, 'rides'), {
        patronName: formData.name,
        phone: formData.phone,
        pickup: formData.pickup,
        dropoff: formData.dropoff,
        riders: formData.riders,
        status: 'pending',
        carNumber: null,
        assignedDriver: null,
        requestedAt: Timestamp.now(),
        completedAt: null,
        willingToCombine: false,
        carInfo: null,
        requestType: 'phone',
        ndrId: activeNDR.id,
        eventId: activeNDR.eventId,
        // Store verified coordinates if available
        pickupCoordinates: pickupValidation.coordinates || null,
        dropoffCoordinates: dropoffValidation.coordinates || null
      });

      setMessage('Request submitted successfully!');
      setMessageType('success');
      setFormData({ name: '', phone: '', pickup: '', dropoff: '', riders: 1 });
      
      setTimeout(() => {
        setMessage('');
        setMessageType('');
      }, 3000);
    } catch (error) {
      console.error('Error submitting request:', error);
      setMessage('Error submitting request: ' + error.message);
      setMessageType('error');
    } finally {
      setSubmitLoading(false);
    }
  };

  // Handle blacklist request submission
  const handleBlacklistRequest = async () => {
    if (!blacklistRequest.address || !blacklistRequest.reason) {
      setMessage('Please enter both address and reason for blacklist request');
      setMessageType('error');
      return;
    }

    setBlacklistLoading(true);

    try {
      await addDoc(collection(db, 'addressBlacklist'), {
        address: blacklistRequest.address,
        reason: blacklistRequest.reason,
        status: 'pending',
        requestedAt: Timestamp.now(),
        requestedBy: currentUser?.name || auth.currentUser?.email || 'Unknown User',
        requestedByUid: auth.currentUser?.uid || null,
        approvedAt: null,
        approvedBy: null
      });

      setMessage('Blacklist request submitted! Awaiting director approval.');
      setMessageType('success');
      setBlacklistRequest({ address: '', reason: '' });
      setShowBlacklistModal(false);

      setTimeout(() => {
        setMessage('');
        setMessageType('');
      }, 3000);
    } catch (error) {
      console.error('Error submitting blacklist request:', error);
      setMessage('Error submitting blacklist request: ' + error.message);
      setMessageType('error');
    } finally {
      setBlacklistLoading(false);
    }
  };

  return (
    <div className="space-y-6 p-4 md:p-0">
      {/* Header */}
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
            View Blacklisted Addresses
          </button>
          <button
            onClick={() => setShowBlacklistModal(true)}
            className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-xl transition font-medium text-sm flex items-center justify-center gap-2 shadow-lg"
          >
            <AlertTriangle size={16} />
            Request Address Blacklist
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
              <p className="text-sm text-blue-800 font-medium">Loading Google Maps...</p>
            </div>
          )}

          {loadError && (
            <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-xl">
              <p className="text-sm text-yellow-800 font-medium">
                ⚠️ Google Maps failed to load. Using basic address validation.
              </p>
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
                onChange={(e) => setFormData({...formData, phone: e.target.value})}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-[#79F200] focus:border-[#79F200] transition outline-none text-gray-900"
                placeholder="(555) 123-4567"
              />
            </div>

            <div className="relative" ref={pickupRef}>
              <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                <MapPin size={16} />
                Pickup Location
              </label>
              <input
                type="text"
                value={formData.pickup}
                onChange={(e) => handlePickupChange(e.target.value)}
                onFocus={() => setShowPickupSuggestions(true)}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-[#79F200] focus:border-[#79F200] transition outline-none text-gray-900"
                placeholder="Start typing address in Bryan/College Station..."
                autoComplete="off"
              />
              {showPickupSuggestions && pickupSuggestions.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white border-2 border-gray-200 rounded-xl shadow-xl max-h-60 overflow-y-auto">
                  {pickupSuggestions.map((suggestion, index) => (
                    <div
                      key={index}
                      onClick={() => selectPickupSuggestion(suggestion)}
                      className="px-4 py-3 hover:bg-[#79F200]/10 cursor-pointer transition flex items-start gap-2 border-b border-gray-100 last:border-0"
                    >
                      <MapPin size={16} className="text-[#79F200] mt-1 flex-shrink-0" />
                      <span className="text-sm text-gray-900">{suggestion}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="relative" ref={dropoffRef}>
              <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                <MapPin size={16} />
                Dropoff Location
              </label>
              <input
                type="text"
                value={formData.dropoff}
                onChange={(e) => handleDropoffChange(e.target.value)}
                onFocus={() => setShowDropoffSuggestions(true)}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-[#79F200] focus:border-[#79F200] transition outline-none text-gray-900"
                placeholder="Start typing address in Bryan/College Station..."
                autoComplete="off"
              />
              {showDropoffSuggestions && dropoffSuggestions.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white border-2 border-gray-200 rounded-xl shadow-xl max-h-60 overflow-y-auto">
                  {dropoffSuggestions.map((suggestion, index) => (
                    <div
                      key={index}
                      onClick={() => selectDropoffSuggestion(suggestion)}
                      className="px-4 py-3 hover:bg-[#79F200]/10 cursor-pointer transition flex items-start gap-2 border-b border-gray-100 last:border-0"
                    >
                      <MapPin size={16} className="text-[#79F200] mt-1 flex-shrink-0" />
                      <span className="text-sm text-gray-900">{suggestion}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                <Users size={16} />
                Number of Riders
              </label>
              <input
                type="number"
                min="1"
                max="8"
                value={formData.riders}
                onChange={(e) => setFormData({...formData, riders: parseInt(e.target.value) || 1})}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-[#79F200] focus:border-[#79F200] transition outline-none text-gray-900"
              />
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <p className="text-sm text-blue-800 font-medium flex items-start gap-2">
                <span className="text-lg">ℹ️</span>
                <span>
                  <strong>Service Area:</strong> Only addresses within Bryan or College Station city limits (zip codes 77801-77845) will be accepted.
                  {isLoaded && ' Addresses are verified using Google Maps geocoding when you submit.'} 
                  You can select any address from suggestions, but addresses outside the service area will be rejected.
                </span>
              </p>
            </div>

            <button
              onClick={handleSubmit}
              disabled={submitLoading}
              className="w-full py-4 bg-[#79F200] text-gray-900 rounded-xl hover:shadow-lg hover:shadow-[#79F200]/30 transform hover:scale-[1.02] transition font-bold text-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-3"
            >
              {submitLoading ? (
                <>
                  <div className="w-5 h-5 border-2 border-gray-900/30 border-t-gray-900 rounded-full animate-spin"></div>
                  <span>Submitting...</span>
                </>
              ) : (
                <>
                  <Send size={20} />
                  <span>Submit Phone Request</span>
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
            <div className="bg-orange-500 p-6 rounded-t-2xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center">
                    <AlertTriangle className="text-orange-500" size={24} />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white">Request Address Blacklist</h3>
                    <p className="text-white/90 text-sm">Requires director approval</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowBlacklistModal(false)}
                  className="text-white hover:bg-white/20 rounded-lg p-2 transition"
                >
                  <XCircle size={24} />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
                <p className="text-sm text-yellow-800">
                  <strong>Note:</strong> This request will be pending until a director approves it. 
                  Only approved addresses will be blocked from ride requests.
                </p>
              </div>

              <div className="relative" ref={blacklistAddressRef}>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Address to Blacklist
                </label>
                <input
                  type="text"
                  value={blacklistRequest.address}
                  onChange={(e) => handleBlacklistAddressChange(e.target.value)}
                  onFocus={() => setShowBlacklistSuggestions(true)}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition outline-none text-gray-900"
                  placeholder="Start typing address..."
                  autoComplete="off"
                />
                {showBlacklistSuggestions && blacklistAddressSuggestions.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border-2 border-gray-200 rounded-xl shadow-xl max-h-60 overflow-y-auto">
                    {blacklistAddressSuggestions.map((suggestion, index) => (
                      <div
                        key={index}
                        onClick={() => selectBlacklistSuggestion(suggestion)}
                        className="px-4 py-3 hover:bg-orange-50 cursor-pointer transition flex items-start gap-2 border-b border-gray-100 last:border-0"
                      >
                        <MapPin size={16} className="text-orange-500 mt-1 flex-shrink-0" />
                        <span className="text-sm text-gray-900">{suggestion}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Reason for Blacklist
                </label>
                <textarea
                  value={blacklistRequest.reason}
                  onChange={(e) => setBlacklistRequest({...blacklistRequest, reason: e.target.value})}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition outline-none text-gray-900 min-h-[100px]"
                  placeholder="Explain why this address should be blacklisted..."
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowBlacklistModal(false)}
                  className="flex-1 py-3 bg-gray-200 hover:bg-gray-300 text-gray-900 rounded-xl transition font-semibold"
                >
                  Cancel
                </button>
                <button
                  onClick={handleBlacklistRequest}
                  disabled={blacklistLoading}
                  className="flex-1 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-xl transition font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {blacklistLoading ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      <span>Submitting...</span>
                    </>
                  ) : (
                    <>
                      <Send size={18} />
                      <span>Submit Request</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Blacklist Viewer Modal */}
      {showBlacklistViewer && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="bg-red-500 p-6 rounded-t-2xl sticky top-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center">
                    <Shield className="text-red-500" size={24} />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white">Blacklisted Addresses</h3>
                    <p className="text-white/90 text-sm">{blacklistedAddresses.length} approved addresses</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowBlacklistViewer(false)}
                  className="text-white hover:bg-white/20 rounded-lg p-2 transition"
                >
                  <XCircle size={24} />
                </button>
              </div>
            </div>

            <div className="p-6">
              {blacklistedAddresses.length === 0 ? (
                <div className="text-center py-12">
                  <Shield className="mx-auto text-gray-300 mb-4" size={48} />
                  <p className="text-gray-500 font-medium">No blacklisted addresses</p>
                  <p className="text-sm text-gray-400 mt-2">Approved blacklist requests will appear here</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {blacklistedAddresses.map((item) => (
                    <div key={item.id} className="bg-red-50 border-2 border-red-200 rounded-xl p-4">
                      <div className="flex items-start gap-3">
                        <MapPin className="text-red-500 flex-shrink-0 mt-1" size={20} />
                        <div className="flex-1">
                          <p className="font-semibold text-gray-900">{item.address}</p>
                          <p className="text-sm text-gray-600 mt-1">
                            <strong>Reason:</strong> {item.reason}
                          </p>
                          {item.approvedBy && (
                            <p className="text-xs text-gray-500 mt-2">
                              Approved by {item.approvedBy} on {item.approvedAt?.toDate().toLocaleDateString()}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
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