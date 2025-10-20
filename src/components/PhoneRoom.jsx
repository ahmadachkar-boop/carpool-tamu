import React, { useState, useEffect, useRef } from 'react';
import { db, auth } from '../firebase';
import { collection, addDoc, query, onSnapshot, where, Timestamp, getDocs } from 'firebase/firestore';
import { useActiveNDR } from '../ActiveNDRContext';
import { AlertCircle, Phone, MapPin, Users, Send, CheckCircle, XCircle, Shield, AlertTriangle, Plus, X } from 'lucide-react';
import { useLoadScript } from '@react-google-maps/api';

const libraries = ['places'];
const GOOGLE_API_KEY = process.env.REACT_APP_GOOGLE_PLACES_API_KEY;

const PhoneRoom = () => {
  const { activeNDR, loading } = useActiveNDR();
  
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

  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: GOOGLE_API_KEY,
    libraries: libraries,
  });

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
      }
      
      dropoffRefs.current.forEach((ref, index) => {
        if (ref && !ref.contains(event.target)) {
          const newShowSuggestions = [...showDropoffSuggestions];
          newShowSuggestions[index] = false;
          setShowDropoffSuggestions(newShowSuggestions);
        }
      });

      if (blacklistAddressRef.current && !blacklistAddressRef.current.contains(event.target)) {
        setShowBlacklistSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showDropoffSuggestions]);

  const fetchAddressSuggestions = async (input, setSuggestions) => {
    if (!input || input.length < 3) {
      setSuggestions([]);
      return;
    }

    if (!isLoaded || !autocompleteService.current) {
      setSuggestions(getMockBCSAddresses(input));
      return;
    }

    try {
      const request = {
        input: input,
        componentRestrictions: { country: 'us' },
        location: new window.google.maps.LatLng(BCS_CENTER.lat, BCS_CENTER.lng),
        radius: 50000,
      };

      autocompleteService.current.getPlacePredictions(request, (predictions, status) => {
        if (status === window.google.maps.places.PlacesServiceStatus.OK && predictions) {
          const allSuggestions = predictions
            .map(prediction => prediction.description)
            .slice(0, 10);
          
          setSuggestions(allSuggestions);
        } else if (status === window.google.maps.places.PlacesServiceStatus.ZERO_RESULTS) {
          setSuggestions([]);
        } else {
          setSuggestions(getMockBCSAddresses(input));
        }
      });
    } catch (error) {
      console.error('Error fetching Google suggestions:', error);
      setSuggestions(getMockBCSAddresses(input));
    }
  };

  const verifyAddressInBCS = async (address) => {
    if (!address || address.trim().length === 0) {
      return { valid: false, reason: 'Address is empty' };
    }
    
    const lowerAddress = address.toLowerCase();
    const hasValidCity = VALID_CITIES.some(city => lowerAddress.includes(city));
    const hasValidZip = VALID_ZIP_CODES.some(zip => lowerAddress.includes(zip));
    
    if (!hasValidCity && !hasValidZip) {
      return { 
        valid: false, 
        reason: 'Address must include "Bryan" or "College Station" or a valid local zip code (77801-77845)' 
      };
    }

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

        if (!isBryanOrCS && !hasValidZipCode) {
          return { 
            valid: false, 
            reason: 'Address must be within Bryan or College Station city limits (detected city: ' + (city || 'unknown') + ', zip: ' + (zip || 'unknown') + ')'
          };
        }

        return { valid: true, coordinates: { lat, lng } };
      } catch (error) {
        console.error('Geocoding error:', error);
        return { 
          valid: hasValidCity || hasValidZip,
          reason: hasValidCity || hasValidZip ? null : 'Unable to verify address location'
        };
      }
    }

    return { 
      valid: hasValidCity || hasValidZip,
      reason: hasValidCity || hasValidZip ? null : 'Address must be in Bryan/College Station area'
    };
  };

  const checkAddressBlacklist = async (address, type) => {
    if (!activeNDR) return { allowed: true };
    
    const normalizedInput = address.toLowerCase().trim();
    
    const blacklistRef = collection(db, 'addressBlacklist');
    const blacklistQuery = query(blacklistRef, where('status', '==', 'approved'));
    const blacklistSnapshot = await getDocs(blacklistQuery);
    
    for (const doc of blacklistSnapshot.docs) {
      const blacklisted = doc.data();
      const normalizedBlacklisted = blacklisted.address.toLowerCase().trim();
      
      const isMatch = normalizedInput.includes(normalizedBlacklisted) || 
                      normalizedBlacklisted.includes(normalizedInput) ||
                      normalizedInput === normalizedBlacklisted;
      
      if (isMatch) {
        const appliesToType = type === 'pickup' ? 
          blacklisted.appliesToPickup : blacklisted.appliesToDropoff;
        
        if (appliesToType === false) {
          continue;
        }
        
        if (blacklisted.scope === 'permanent') {
          return { 
            allowed: false, 
            reason: `This address is permanently blacklisted (${blacklisted.reason})`
          };
        }
        
        if (blacklisted.scope === 'temporary') {
          if (!blacklisted.ndrId || blacklisted.ndrId === activeNDR.id) {
            return { 
              allowed: false, 
              reason: `This address is temporarily blacklisted for the current NDR (${blacklisted.reason})`
            };
          }
        }
      }
    }
    
    return { allowed: true };
  };

  const addDropoff = () => {
    setFormData({
      ...formData,
      dropoffs: [...formData.dropoffs, '']
    });
    setDropoffSuggestions([...dropoffSuggestions, []]);
    setShowDropoffSuggestions([...showDropoffSuggestions, false]);
  };

  const removeDropoff = (index) => {
    const newDropoffs = formData.dropoffs.filter((_, i) => i !== index);
    const newDropoffSuggestions = dropoffSuggestions.filter((_, i) => i !== index);
    const newShowDropoffSuggestions = showDropoffSuggestions.filter((_, i) => i !== index);
    
    setFormData({ ...formData, dropoffs: newDropoffs });
    setDropoffSuggestions(newDropoffSuggestions);
    setShowDropoffSuggestions(newShowDropoffSuggestions);
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
      const phoneBlacklistSnapshot = await getDocs(phoneBlacklistQuery);

      if (!phoneBlacklistSnapshot.empty) {
        const blacklistEntry = phoneBlacklistSnapshot.docs[0].data();
        
        if (blacklistEntry.scope === 'permanent') {
          setMessage('⛔ This phone number is permanently blacklisted and cannot be used');
          setMessageType('error');
          setSubmitLoading(false);
          return;
        }
        
        if (blacklistEntry.scope === 'temporary' && activeNDR) {
          if (!blacklistEntry.ndrId || blacklistEntry.ndrId === activeNDR.id) {
            setMessage('⛔ This phone number is temporarily blacklisted for the current NDR');
            setMessageType('error');
            setSubmitLoading(false);
            return;
          }
        }
      }

      const pickupBlacklistCheck = await checkAddressBlacklist(formData.pickup, 'pickup');
      if (!pickupBlacklistCheck.allowed) {
        setMessage(`⛔ Pickup address is blacklisted: ${pickupBlacklistCheck.reason}`);
        setMessageType('error');
        setSubmitLoading(false);
        return;
      }

      for (let i = 0; i < formData.dropoffs.length; i++) {
        const dropoffBlacklistCheck = await checkAddressBlacklist(formData.dropoffs[i], 'dropoff');
        if (!dropoffBlacklistCheck.allowed) {
          setMessage(`⛔ Dropoff ${i + 1} is blacklisted: ${dropoffBlacklistCheck.reason}`);
          setMessageType('error');
          setSubmitLoading(false);
          return;
        }
      }

      setMessage('Validating addresses...');

      const pickupValidation = await verifyAddressInBCS(formData.pickup);
      if (!pickupValidation.valid) {
        setMessage(`Pickup address rejected: ${pickupValidation.reason}`);
        setMessageType('error');
        setSubmitLoading(false);
        return;
      }

      const dropoffValidations = [];
      for (let i = 0; i < formData.dropoffs.length; i++) {
        const dropoffValidation = await verifyAddressInBCS(formData.dropoffs[i]);
        if (!dropoffValidation.valid) {
          setMessage(`Dropoff ${i + 1} rejected: ${dropoffValidation.reason}`);
          setMessageType('error');
          setSubmitLoading(false);
          return;
        }
        dropoffValidations.push(dropoffValidation);
      }

      setMessage('Submitting request...');

      await addDoc(collection(db, 'rides'), {
        patronName: formData.name,
        phone: formData.phone,
        pickup: formData.pickup,
        dropoffs: formData.dropoffs,
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
        pickupCoordinates: pickupValidation.coordinates || null,
        dropoffCoordinates: dropoffValidations.map(v => v.coordinates || null)
      });

      setMessage('Request submitted successfully!');
      setMessageType('success');
      setFormData({ name: '', phone: '', pickup: '', dropoffs: [''], riders: 1 });
      setDropoffSuggestions([[]]);
      setShowDropoffSuggestions([false]);
      
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

  const handleBlacklistRequest = async () => {
    if (!blacklistRequest.value || !blacklistRequest.reason) {
      setMessage('Please fill in all required fields');
      setMessageType('error');
      return;
    }

    if (blacklistRequest.type === 'phone') {
      const phoneRegex = /^[\d\s\-\(\)]+$/;
      if (!phoneRegex.test(blacklistRequest.value)) {
        setMessage('Please enter a valid phone number');
        setMessageType('error');
        return;
      }
    }

    setBlacklistLoading(true);

    try {
      const now = Timestamp.now();
      const collectionName = blacklistRequest.type === 'phone' ? 'phoneBlacklist' : 'addressBlacklist';
      
      const blacklistData = {
        ...(blacklistRequest.type === 'phone' 
          ? { phone: blacklistRequest.value }
          : { 
              address: blacklistRequest.value,
              appliesToPickup: blacklistRequest.appliesToPickup,
              appliesToDropoff: blacklistRequest.appliesToDropoff
            }
        ),
        reason: blacklistRequest.reason,
        scope: blacklistRequest.scope,
        status: 'pending',
        requestedBy: currentUser?.uid || 'unknown',
        requestedAt: now,
        ...(blacklistRequest.scope === 'temporary' && activeNDR ? { ndrId: activeNDR.id } : {})
      };

      await addDoc(collection(db, collectionName), blacklistData);

      setMessage('Blacklist request submitted. Awaiting director approval.');
      setMessageType('success');
      setBlacklistRequest({ 
        type: 'address',
        value: '',
        reason: '',
        scope: 'permanent',
        appliesToPickup: true,
        appliesToDropoff: true
      });
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

  const handlePickupChange = (value) => {
    setFormData({...formData, pickup: value});
    fetchAddressSuggestions(value, setPickupSuggestions);
    setShowPickupSuggestions(true);
  };

  const selectPickupSuggestion = (address) => {
    setFormData({...formData, pickup: address});
    setShowPickupSuggestions(false);
    setPickupSuggestions([]);
  };

  const handleBlacklistValueChange = (value) => {
    setBlacklistRequest({...blacklistRequest, value: value});
    if (blacklistRequest.type === 'address') {
      fetchAddressSuggestions(value, setBlacklistAddressSuggestions);
      setShowBlacklistSuggestions(true);
    }
  };

  const selectBlacklistSuggestion = (value) => {
    setBlacklistRequest({...blacklistRequest, value: value});
    setShowBlacklistSuggestions(false);
    setBlacklistAddressSuggestions([]);
  };

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

  if (loadError) {
    console.error('Google Maps load error:', loadError);
  }

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
                onChange={(e) => setFormData({...formData, phone: formatPhoneNumber(e.target.value)})}
                maxLength="14"
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
                placeholder="123 Main St, College Station, TX"
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

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <MapPin size={16} />
                  Dropoff Location(s)
                </span>
                <button
                  type="button"
                  onClick={addDropoff}
                  className="px-3 py-1 bg-[#79F200] hover:bg-[#6DD600] text-gray-900 rounded-lg text-xs font-bold flex items-center gap-1 transition"
                >
                  <Plus size={14} />
                  Add Dropoff
                </button>
              </label>
              
              {formData.dropoffs.map((dropoff, index) => (
                <div 
                  key={index} 
                  className="relative mb-3"
                  ref={el => dropoffRefs.current[index] = el}
                >
                  <div className="flex gap-2">
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={dropoff}
                        onChange={(e) => handleDropoffChange(index, e.target.value)}
                        onFocus={() => {
                          const newShowSuggestions = [...showDropoffSuggestions];
                          newShowSuggestions[index] = true;
                          setShowDropoffSuggestions(newShowSuggestions);
                        }}
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-[#79F200] focus:border-[#79F200] transition outline-none text-gray-900"
                        placeholder={`Dropoff ${index + 1}: 456 College Ave, Bryan, TX`}
                      />
                      {showDropoffSuggestions[index] && dropoffSuggestions[index]?.length > 0 && (
                        <div className="absolute z-10 w-full mt-1 bg-white border-2 border-gray-200 rounded-xl shadow-xl max-h-60 overflow-y-auto">
                          {dropoffSuggestions[index].map((suggestion, sIndex) => (
                            <div
                              key={sIndex}
                              onClick={() => selectDropoffSuggestion(index, suggestion)}
                              className="px-4 py-3 hover:bg-[#79F200]/10 cursor-pointer transition flex items-start gap-2 border-b border-gray-100 last:border-0"
                            >
                              <MapPin size={16} className="text-[#79F200] mt-1 flex-shrink-0" />
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
              disabled={submitLoading}
              className="w-full py-4 bg-[#79F200] text-gray-900 rounded-xl hover:shadow-lg hover:shadow-[#79F200]/30 transform hover:scale-[1.02] transition font-bold text-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-3"
            >
              {submitLoading ? (
                <>
                  <div className="w-5 h-5 border-2 border-gray-900 border-t-transparent rounded-full animate-spin"></div>
                  Processing...
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
                  <XCircle size={24} />
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

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-3">Blacklist Type</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setBlacklistRequest({...blacklistRequest, type: 'address', value: ''})}
                    className={`p-4 rounded-xl border-2 transition ${
                      blacklistRequest.type === 'address'
                        ? 'border-orange-500 bg-orange-50'
                        : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}
                  >
                    <MapPin className={`mx-auto mb-2 ${blacklistRequest.type === 'address' ? 'text-orange-500' : 'text-gray-400'}`} size={24} />
                    <p className={`font-semibold text-sm ${blacklistRequest.type === 'address' ? 'text-orange-700' : 'text-gray-700'}`}>
                      Address
                    </p>
                    <p className="text-xs text-gray-500 mt-1">Block a location</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setBlacklistRequest({...blacklistRequest, type: 'phone', value: ''})}
                    className={`p-4 rounded-xl border-2 transition ${
                      blacklistRequest.type === 'phone'
                        ? 'border-orange-500 bg-orange-50'
                        : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}
                  >
                    <Phone className={`mx-auto mb-2 ${blacklistRequest.type === 'phone' ? 'text-orange-500' : 'text-gray-400'}`} size={24} />
                    <p className={`font-semibold text-sm ${blacklistRequest.type === 'phone' ? 'text-orange-700' : 'text-gray-700'}`}>
                      Phone Number
                    </p>
                    <p className="text-xs text-gray-500 mt-1">Block a caller</p>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-3">Duration</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setBlacklistRequest({...blacklistRequest, scope: 'permanent'})}
                    className={`p-3 rounded-xl border-2 transition text-left ${
                      blacklistRequest.scope === 'permanent'
                        ? 'border-red-500 bg-red-50'
                        : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}
                  >
                    <p className={`font-semibold text-sm ${blacklistRequest.scope === 'permanent' ? 'text-red-700' : 'text-gray-700'}`}>
                      Permanent
                    </p>
                    <p className="text-xs text-gray-500 mt-1">All future NDRs</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setBlacklistRequest({...blacklistRequest, scope: 'temporary'})}
                    className={`p-3 rounded-xl border-2 transition text-left ${
                      blacklistRequest.scope === 'temporary'
                        ? 'border-orange-500 bg-orange-50'
                        : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}
                  >
                    <p className={`font-semibold text-sm ${blacklistRequest.scope === 'temporary' ? 'text-orange-700' : 'text-gray-700'}`}>
                      Temporary
                    </p>
                    <p className="text-xs text-gray-500 mt-1">Current NDR only</p>
                  </button>
                </div>
              </div>

              {blacklistRequest.type === 'address' && (
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-3">Applies To</label>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={blacklistRequest.appliesToPickup}
                        onChange={(e) => setBlacklistRequest({...blacklistRequest, appliesToPickup: e.target.checked})}
                        className="w-4 h-4 text-orange-500 rounded"
                      />
                      <span className="text-sm text-gray-700">Pickup locations</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={blacklistRequest.appliesToDropoff}
                        onChange={(e) => setBlacklistRequest({...blacklistRequest, appliesToDropoff: e.target.checked})}
                        className="w-4 h-4 text-orange-500 rounded"
                      />
                      <span className="text-sm text-gray-700">Dropoff locations</span>
                    </label>
                  </div>
                </div>
              )}

              <div className="relative" ref={blacklistAddressRef}>
                <label className="block text-sm font-bold text-gray-700 mb-2">
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
                  placeholder={blacklistRequest.type === 'address' ? 'Start typing address...' : '(555) 123-4567'}
                  autoComplete="off"
                />
                {blacklistRequest.type === 'address' && showBlacklistSuggestions && blacklistAddressSuggestions.length > 0 && (
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
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  Reason for Blacklist *
                </label>
                <textarea
                  value={blacklistRequest.reason}
                  onChange={(e) => setBlacklistRequest({...blacklistRequest, reason: e.target.value})}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition outline-none text-gray-900 min-h-[100px] resize-none"
                  placeholder="Explain why this should be blacklisted..."
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowBlacklistModal(false)}
                  className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl transition font-semibold"
                >
                  Cancel
                </button>
                <button
                  onClick={handleBlacklistRequest}
                  disabled={blacklistLoading || !blacklistRequest.value || !blacklistRequest.reason}
                  className="flex-1 py-3 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white rounded-xl transition font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg"
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
          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="bg-gradient-to-r from-red-500 to-pink-500 p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center">
                    <Shield className="text-red-500" size={24} />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white">Active Blacklists</h3>
                    <p className="text-white/90 text-sm">
                      {getActiveBlacklists(blacklistedAddresses, 'address').length} addresses, {getActiveBlacklists(blacklistedPhones, 'phone').length} phones
                    </p>
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

            <div className="flex border-b border-gray-200 bg-gray-50 px-6">
              <button
                onClick={() => setViewerTab('addresses')}
                className={`px-6 py-3 font-semibold text-sm transition relative ${
                  viewerTab === 'addresses'
                    ? 'text-red-600 border-b-2 border-red-600 -mb-px'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <div className="flex items-center gap-2">
                  <MapPin size={16} />
                  <span>Addresses ({getActiveBlacklists(blacklistedAddresses, 'address').length})</span>
                </div>
              </button>
              <button
                onClick={() => setViewerTab('phones')}
                className={`px-6 py-3 font-semibold text-sm transition relative ${
                  viewerTab === 'phones'
                    ? 'text-red-600 border-b-2 border-red-600 -mb-px'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Phone size={16} />
                  <span>Phone Numbers ({getActiveBlacklists(blacklistedPhones, 'phone').length})</span>
                </div>
              </button>
            </div>

            {viewerTab === 'addresses' && (
              <div className="flex-1 overflow-y-auto p-6">
                {getActiveBlacklists(blacklistedAddresses, 'address').length === 0 ? (
                  <div className="text-center py-12">
                    <Shield className="mx-auto text-gray-300 mb-3" size={48} />
                    <p className="text-gray-500 font-medium">No active address blacklists</p>
                    <p className="text-gray-400 text-sm mt-1">for current NDR</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {getActiveBlacklists(blacklistedAddresses, 'address').map((item) => (
                      <div key={item.id} className="bg-red-50 border-2 border-red-200 rounded-xl p-4 hover:shadow-md transition">
                        <div className="flex items-start gap-3">
                          <MapPin className="text-red-500 flex-shrink-0 mt-1" size={20} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <p className="font-semibold text-gray-900 break-words">{item.address}</p>
                              <div className="flex gap-1 flex-shrink-0">
                                <span className={`px-2 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${
                                  item.scope === 'temporary' ? 'bg-orange-100 text-orange-800' : 'bg-red-100 text-red-800'
                                }`}>
                                  {item.scope === 'temporary' ? 'TEMP' : 'PERM'}
                                </span>
                              </div>
                            </div>
                            <p className="text-sm text-gray-600 mb-2">
                              <strong>Reason:</strong> {item.reason}
                            </p>
                            {(item.appliesToPickup !== undefined || item.appliesToDropoff !== undefined) && (
                              <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
                                <span className="font-medium">Applies to:</span>
                                {item.appliesToPickup && item.appliesToDropoff ? (
                                  <span className="px-2 py-0.5 bg-gray-100 rounded">Pickup & Dropoff</span>
                                ) : item.appliesToPickup ? (
                                  <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded">Pickup Only</span>
                                ) : item.appliesToDropoff ? (
                                  <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded">Dropoff Only</span>
                                ) : (
                                  <span className="px-2 py-0.5 bg-gray-100 rounded">None</span>
                                )}
                              </div>
                            )}
                            {item.approvedBy && (
                              <p className="text-xs text-gray-500">
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
            )}

            {viewerTab === 'phones' && (
              <div className="flex-1 overflow-y-auto p-6">
                {getActiveBlacklists(blacklistedPhones, 'phone').length === 0 ? (
                  <div className="text-center py-12">
                    <Shield className="mx-auto text-gray-300 mb-3" size={48} />
                    <p className="text-gray-500 font-medium">No active phone blacklists</p>
                    <p className="text-gray-400 text-sm mt-1">for current NDR</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {getActiveBlacklists(blacklistedPhones, 'phone').map((item) => (
                      <div key={item.id} className="bg-red-50 border-2 border-red-200 rounded-xl p-4 hover:shadow-md transition">
                        <div className="flex items-start gap-3">
                          <Phone className="text-red-500 flex-shrink-0 mt-1" size={20} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <p className="font-semibold text-gray-900 text-lg">{item.phone}</p>
                              <span className={`px-2 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${
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
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default PhoneRoom;