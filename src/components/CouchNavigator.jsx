import React, { useState, useEffect, useRef } from 'react';
import { db } from '../firebase';
import { collection, addDoc, query, where, onSnapshot, orderBy, updateDoc, doc, Timestamp, getDocs } from 'firebase/firestore';
import { useActiveNDR } from '../ActiveNDRContext';
import { useAuth } from '../AuthContext';
import { MapPin, Send, Navigation, Phone, User, Car, Clock, AlertCircle, MessageSquare, CheckCircle } from 'lucide-react';
import { GoogleMap, useLoadScript } from '@react-google-maps/api';

const libraries = ['places', 'marker'];
const GOOGLE_API_KEY = process.env.REACT_APP_GOOGLE_PLACES_API_KEY;

const CouchNavigator = () => {
  const { activeNDR, loading: ndrLoading } = useActiveNDR();
  const { userProfile } = useAuth();
  const [viewMode, setViewMode] = useState('couch'); // 'couch' or 'navigator'
  const [selectedCar, setSelectedCar] = useState(null);
  const [carNumber, setCarNumber] = useState('');
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [carLocations, setCarLocations] = useState({});
  const [locationEnabled, setLocationEnabled] = useState(false);
  const [locationError, setLocationError] = useState('');
  const [activeRides, setActiveRides] = useState([]);
  const [availableCars, setAvailableCars] = useState([]);
  const messagesEndRef = useRef(null);
  const locationWatchId = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);

  const { isLoaded } = useLoadScript({
    googleMapsApiKey: GOOGLE_API_KEY,
    libraries: libraries,
  });

  const mapContainerStyle = {
    width: '100%',
    height: '400px'
  };

  const bcsCenter = {
    lat: 30.6280,
    lng: -96.3344
  };

  // Handle map load
  const onMapLoad = (map) => {
    mapRef.current = map;
  };

  // Update marker when car location changes
  useEffect(() => {
    if (!mapRef.current || !isLoaded || !carLocations[selectedCar]) return;

    // Remove old marker if it exists
    if (markerRef.current) {
      markerRef.current.map = null;
    }

    // Create new AdvancedMarkerElement
    const { AdvancedMarkerElement } = window.google.maps.marker;
    
    const marker = new AdvancedMarkerElement({
      map: mapRef.current,
      position: {
        lat: carLocations[selectedCar].latitude,
        lng: carLocations[selectedCar].longitude
      },
      title: `Car ${selectedCar}`
    });

    markerRef.current = marker;

    // Cleanup
    return () => {
      if (markerRef.current) {
        markerRef.current.map = null;
      }
    };
  }, [carLocations, selectedCar, isLoaded]);

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
      const ndrDoc = await getDocs(query(collection(db, 'ndrs'), where('id', '==', activeNDR.id)));
      if (!ndrDoc.empty) {
        const cars = ndrDoc.docs[0].data().cars || [];
        setAvailableCars(cars);
      }
    };

    loadCars();
  }, [activeNDR]);

  // Listen to messages for selected car
  useEffect(() => {
    if (!activeNDR || !selectedCar) return;

    const messagesRef = collection(db, 'couchMessages');
    const messagesQuery = query(
      messagesRef,
      where('ndrId', '==', activeNDR.id),
      where('carNumber', '==', selectedCar),
      orderBy('timestamp', 'asc')
    );

    const unsubscribe = onSnapshot(messagesQuery, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp?.toDate()
      }));
      setMessages(msgs);
    });

    return () => unsubscribe();
  }, [activeNDR, selectedCar]);

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
    if (!activeNDR || !selectedCar) return;

    const ridesRef = collection(db, 'rides');
    const ridesQuery = query(
      ridesRef,
      where('ndrId', '==', activeNDR.id),
      where('carNumber', '==', selectedCar),
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

  // Location tracking for navigator
  useEffect(() => {
    if (viewMode !== 'navigator' || !carNumber || !locationEnabled || !activeNDR) return;

    const updateLocation = async (position) => {
      const { latitude, longitude } = position.coords;

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
        } else {
          const docRef = doc(db, 'carLocations', existingDocs.docs[0].id);
          await updateDoc(docRef, {
            latitude,
            longitude,
            updatedAt: Timestamp.now()
          });
        }
      } catch (error) {
        console.error('Error updating location:', error);
      }
    };

    const handleError = (error) => {
      console.error('Location error:', error);
      setLocationError('Unable to get location: ' + error.message);
      setLocationEnabled(false);
    };

    // Watch position with high accuracy
    locationWatchId.current = navigator.geolocation.watchPosition(
      updateLocation,
      handleError,
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );

    return () => {
      if (locationWatchId.current) {
        navigator.geolocation.clearWatch(locationWatchId.current);
      }
    };
  }, [viewMode, carNumber, locationEnabled, activeNDR]);

  const requestLocationPermission = () => {
    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported by your browser');
      return;
    }

    setLocationError('');
    navigator.geolocation.getCurrentPosition(
      () => {
        setLocationEnabled(true);
      },
      (error) => {
        setLocationError('Location permission denied: ' + error.message);
        setLocationEnabled(false);
      }
    );
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedCar || !activeNDR) return;

    try {
      await addDoc(collection(db, 'couchMessages'), {
        ndrId: activeNDR.id,
        carNumber: selectedCar,
        sender: viewMode,
        senderName: userProfile?.name || 'Unknown',
        message: newMessage,
        timestamp: Timestamp.now()
      });

      setNewMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  const assignRideToCar = async (rideId) => {
    if (!selectedCar || !activeNDR) return;

    try {
      await updateDoc(doc(db, 'rides', rideId), {
        status: 'active',
        carNumber: selectedCar,
        assignedAt: Timestamp.now()
      });

      // Send notification message
      await addDoc(collection(db, 'couchMessages'), {
        ndrId: activeNDR.id,
        carNumber: selectedCar,
        sender: 'couch',
        senderName: userProfile?.name || 'Couch',
        message: `🚗 New ride assigned! Check your active rides.`,
        timestamp: Timestamp.now()
      });
    } catch (error) {
      console.error('Error assigning ride:', error);
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
      {/* View Mode Selector */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            <h1 className="text-xl md:text-2xl font-bold text-gray-900 flex items-center gap-2">
              <MessageSquare size={24} className="text-[#79F200]" />
              Couch Navigator
            </h1>
            <div className="flex gap-2">
              <button
                onClick={() => setViewMode('couch')}
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
        {viewMode === 'couch' ? (
          /* COUCH VIEW */
          <div className="space-y-6">
            {/* Car Selection */}
            <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Car size={20} />
                Select Car to Communicate
              </h2>
              <select
                value={selectedCar || ''}
                onChange={(e) => setSelectedCar(parseInt(e.target.value) || null)}
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
                {/* Live Location Map */}
                {isLoaded && carLocations[selectedCar] && (
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
                    >
                      {/* Marker is now managed via useEffect with AdvancedMarkerElement */}
                    </GoogleMap>
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

                {/* Active Rides */}
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

                {/* Messages */}
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
                        className="px-6 py-3 bg-[#79F200] text-gray-900 rounded-xl font-bold hover:shadow-lg transition flex items-center gap-2"
                      >
                        <Send size={18} />
                        Send
                      </button>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        ) : (
          /* NAVIGATOR VIEW */
          <div className="space-y-6">
            {/* Car Number Input */}
            {!carNumber && (
              <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
                <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <Car size={20} />
                  Enter Your Car Number
                </h2>
                <input
                  type="number"
                  min="1"
                  placeholder="Enter car number..."
                  onChange={(e) => setCarNumber(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-[#79F200] focus:border-[#79F200] text-gray-900 font-medium text-lg"
                />
                <button
                  onClick={() => {
                    if (carNumber) {
                      setSelectedCar(parseInt(carNumber));
                    }
                  }}
                  className="w-full mt-3 px-6 py-3 bg-[#79F200] text-gray-900 rounded-xl font-bold hover:shadow-lg transition"
                >
                  Connect as Car {carNumber}
                </button>
              </div>
            )}

            {carNumber && (
              <>
                {/* Location Sharing */}
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
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3">
                      <CheckCircle className="text-green-600 flex-shrink-0" size={24} />
                      <div>
                        <p className="text-sm font-bold text-green-900">Location Sharing Active</p>
                        <p className="text-xs text-green-700">The couch can now see your live location</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Active Rides */}
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

                {/* Messages */}
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
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                        placeholder="Type a message..."
                        className="flex-1 px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-lg"
                      />
                      <button
                        onClick={sendMessage}
                        className="px-6 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition flex items-center gap-2"
                      >
                        <Send size={18} />
                      </button>
                    </div>
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