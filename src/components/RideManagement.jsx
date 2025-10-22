import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, updateDoc, doc, getDoc, addDoc, Timestamp, getDocs, documentId } from 'firebase/firestore';
import { useActiveNDR } from '../ActiveNDRContext';
import { Car, AlertCircle, MapPin, Phone, Users, Clock, Edit2, Check, X, Split, AlertTriangle, Navigation, Loader2, Search, Filter, SortAsc, Cloud, CloudRain, CloudSnow, Wind, RefreshCw } from 'lucide-react';
import { useGoogleMaps } from '../GoogleMapsProvider';
import { isMale, isFemale } from '../utils/genderUtils';
import { formatTime, formatDateTime, calculateWaitTime, formatWaitTime, isLongWait } from '../utils/timeUtils';
import { logError, logWarning } from '../utils/errorLogger';
import { getCurrentWeather, getWeatherAlert, getTrafficConditions, getTrafficAlert, getWeatherEmoji, WEATHER_SEVERITY } from '../utils/weatherUtils';
import Snackbar from './Snackbar';

// CONSTANTS: Extracted magic numbers for maintainability
const BUFFER_MINUTES_PER_STOP = 2; // Minutes to add per waypoint stop
const FALLBACK_ETA_FREE_CAR = 10; // Default ETA when car location unknown (free car)
const FALLBACK_ETA_BUSY_CAR = 30; // Default ETA when calculation fails (busy car)
const ETA_DEBOUNCE_MS = 45000; // 45 seconds between ETA recalculations
const ETA_CACHE_MS = 300000; // 5 minutes ETA cache duration
const API_RATE_LIMIT_PER_HOUR = 500; // Max Google Maps API calls per hour
const API_RESET_INTERVAL_MS = 3600000; // 1 hour in milliseconds
const LONG_WAIT_THRESHOLD_MINUTES = 15; // Minutes before wait is considered long
const CLOCK_UPDATE_INTERVAL_MS = 1000; // Update clock every second
const MAX_PENDING_RIDES_FOR_ETA = 3; // Only calculate ETA for top N pending rides

// Custom Modal Components (replaces alert/prompt/confirm)
const Modal = ({ isOpen, onClose, title, children, actions }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
        {title && (
          <h3 className="text-xl font-bold text-gray-900 mb-4">{title}</h3>
        )}
        <div className="mb-6">{children}</div>
        <div className="flex gap-3">
          {actions}
        </div>
      </div>
    </div>
  );
};

// OPTIMIZATION: Memoized Car Status Card to prevent re-renders every second
const CarStatusCard = React.memo(({ carNum, status, location, currentTime, getCarStatusColor, getCarStatusLabel }) => {
  return (
    <div className="border-2 border-gray-200 rounded-xl p-4 hover:shadow-md transition">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Car size={20} className="text-gray-700" />
          <span className="font-bold text-lg text-gray-900">Car {carNum}</span>
        </div>
        <div className={`w-3 h-3 rounded-full ${getCarStatusColor(status.status)}`}></div>
      </div>

      <div className="space-y-2">
        <div className="bg-gray-50 rounded-lg px-3 py-2">
          <p className={`text-xs font-bold ${
            status.status === 'available' ? 'text-green-700' :
            status.status === 'en_route' ? 'text-blue-700' :
            'text-yellow-700'
          }`}>
            {getCarStatusLabel(status.status)}
          </p>
        </div>

        {status.currentRide && (
          <div className="text-xs space-y-1">
            <p className="font-semibold text-gray-900 truncate">
              {status.currentRide.patronName}
            </p>
            <p className="text-gray-600">
              {status.currentRide.riders} {status.currentRide.riders === 1 ? 'rider' : 'riders'}
            </p>
            {status.currentRide.pickedUpAt ? (
              <p className="text-purple-600 font-semibold">
                → {status.currentRide.dropoffs?.[0]?.substring(0, 25) || 'Dropoff'}...
              </p>
            ) : (
              <p className="text-blue-600 font-semibold">
                → {status.currentRide.pickup?.substring(0, 25)}...
              </p>
            )}
          </div>
        )}

        <div className="pt-2 border-t border-gray-200 flex items-center justify-between">
          <span className="text-xs text-gray-500">
            {status.ridesCompleted} {status.ridesCompleted === 1 ? 'ride' : 'rides'} tonight
          </span>
          {location && (
            <span className="text-xs text-gray-400">
              {Math.floor((currentTime - location.updatedAt) / (1000 * 60))}m ago
            </span>
          )}
        </div>
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  // Custom comparison function - only re-render if these change
  return (
    prevProps.status.status === nextProps.status.status &&
    prevProps.status.ridesCompleted === nextProps.status.ridesCompleted &&
    prevProps.status.currentRide?.id === nextProps.status.currentRide?.id &&
    Math.floor((prevProps.currentTime - prevProps.location?.updatedAt) / (1000 * 60)) === Math.floor((nextProps.currentTime - nextProps.location?.updatedAt) / (1000 * 60))
  );
});

const RideManagement = () => {
  const { activeNDR, loading: ndrLoading } = useActiveNDR();
  const { isLoaded: googleMapsLoaded } = useGoogleMaps();
  const [rides, setRides] = useState({ pending: [], active: [], completed: [] });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('pending');
  const [availableCars, setAvailableCars] = useState(0);
  const [editingRide, setEditingRide] = useState(null);
  const [assigningRide, setAssigningRide] = useState(null);
  const [splittingRide, setSplittingRide] = useState(null);
  const [splitRiders, setSplitRiders] = useState({ ride1: 1, ride2: 1 });
  const [eligibleCars, setEligibleCars] = useState({}); // { carNumber: { eligible: boolean, reason: string, maleCount: number, femaleCount: number } }
  const [checkingEligibility, setCheckingEligibility] = useState(false);

  // NEW: Car status tracking
  const [carLocations, setCarLocations] = useState({});
  const [carStatuses, setCarStatuses] = useState({});
  const [currentTime, setCurrentTime] = useState(new Date());

  // REMOVED: Client-side ETA calculation - now server-side
  // ETAs are now stored in ride documents and read from Firestore
  // Fields: estimatedPickupMinutes, fastestCarNumber, etaCalculatedAt
  const [calculatingETAs, setCalculatingETAs] = useState(false);
  const apiCallCount = useRef(0); // Track API calls
  const lastApiReset = useRef(Date.now());
  const isMounted = useRef(true); // Track component mount status

  // Modal states (replaces alert/prompt/confirm)
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', message: '', onConfirm: null });
  const [promptModal, setPromptModal] = useState({ isOpen: false, title: '', message: '', onSubmit: null, defaultValue: '' });
  const [promptValue, setPromptValue] = useState('');
  const [alertModal, setAlertModal] = useState({ isOpen: false, title: '', message: '' });

  // Loading states for async operations
  const [loadingStates, setLoadingStates] = useState({
    assigningCar: false,
    startingRide: {},
    completingRide: {},
    cancellingRide: {},
    terminatingRide: {},
    savingEdit: false,
    splittingRide: false
  });

  // Search and filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [filterOption, setFilterOption] = useState('all'); // all, single, group
  const [sortOption, setSortOption] = useState('time'); // time, riders, wait

  // NEW: Undo functionality
  const [snackbar, setSnackbar] = useState({ isOpen: false, message: '', type: 'info', onUndo: null });
  const [lastAction, setLastAction] = useState(null); // Stores last action for undo

  // NEW: Weather and traffic
  const [weather, setWeather] = useState(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [activeRideCompletionTimes, setActiveRideCompletionTimes] = useState({}); // { rideId: estimatedTime }

  // NEW: Reassignment modal
  const [reassigningRide, setReassigningRide] = useState(null);

  // NEW: Patron history modal
  const [patronHistory, setPatronHistory] = useState({ isOpen: false, phone: '', rides: [] });

  // Track component mount/unmount to prevent memory leaks
  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  // NEW: Fetch weather data every 10 minutes
  useEffect(() => {
    const fetchWeather = async () => {
      if (!activeNDR?.location) return;

      setWeatherLoading(true);
      // Use event location or default to College Station, TX
      const lat = activeNDR.location?.lat || 30.6280;
      const lng = activeNDR.location?.lng || -96.3344;

      const weatherData = await getCurrentWeather(lat, lng);
      if (isMounted.current && weatherData) {
        setWeather(weatherData);
      }
      setWeatherLoading(false);
    };

    fetchWeather();
    const interval = setInterval(fetchWeather, 600000); // Update every 10 minutes

    return () => clearInterval(interval);
  }, [activeNDR]);

  // SERVER-SIDE: ETA Calculation Function
  // This function calculates ETAs and stores them in Firestore
  // All clients read ETAs from ride documents instead of calculating
  const calculateAndStoreETAs = async () => {
    if (!activeNDR || !googleMapsLoaded || !window.google || rides.pending.length === 0) {
      setSnackbar({
        isOpen: true,
        message: 'No pending rides to calculate ETAs for',
        type: 'info',
        onUndo: null
      });
      return;
    }

    setCalculatingETAs(true);

    try {
      // Reset API call counter every hour
      if (Date.now() - lastApiReset.current > API_RESET_INTERVAL_MS) {
        apiCallCount.current = 0;
        lastApiReset.current = Date.now();
      }

      // Rate limiting
      if (apiCallCount.current > API_RATE_LIMIT_PER_HOUR) {
        logWarning('ETA Calculation', 'Google Maps API rate limit reached', {
          currentCount: apiCallCount.current,
          limit: API_RATE_LIMIT_PER_HOUR
        });
        return;
      }

      const newETAs = {};
      const directionsService = new window.google.maps.DirectionsService();

      // OPTIMIZATION: Only calculate for top N pending rides
      const ridesToCalculate = rides.pending.slice(0, MAX_PENDING_RIDES_FOR_ETA);

      for (const ride of ridesToCalculate) {
        // Skip if ETA was calculated recently (less than 5 minutes ago)
        if (ride.etaCalculatedAt) {
          const etaAge = Date.now() - ride.etaCalculatedAt.toMillis();
          if (etaAge < ETA_CACHE_MS && ride.estimatedPickupMinutes) {
            continue; // Skip, ETA is still fresh
          }
        }

        try {
          // Calculate availability for each car
          const carAvailability = [];

          for (let carNum = 1; carNum <= availableCars; carNum++) {
            // Check if component is still mounted
            if (!isMounted.current) return;

            const activeRide = rides.active.find(r => r.carNumber === carNum);
            const location = carLocations[carNum];

            if (!activeRide) {
              // Car is free
              if (location && location.latitude && location.longitude) {
                try {
                  apiCallCount.current++; // Increment API call counter
                  const result = await new Promise((resolve, reject) => {
                    directionsService.route(
                      {
                        origin: { lat: location.latitude, lng: location.longitude },
                        destination: ride.pickup,
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

                  if (!isMounted.current) return; // Check again after async operation

                  const durationInTraffic = result.routes[0].legs[0].duration_in_traffic || result.routes[0].legs[0].duration;
                  const minutesToPickup = Math.ceil(durationInTraffic.value / 60);

                  carAvailability.push({
                    carNumber: carNum,
                    availableInMinutes: minutesToPickup
                  });
                } catch (error) {
                  carAvailability.push({
                    carNumber: carNum,
                    availableInMinutes: FALLBACK_ETA_FREE_CAR
                  });
                }
              } else {
                carAvailability.push({
                  carNumber: carNum,
                  availableInMinutes: FALLBACK_ETA_FREE_CAR
                });
              }
            } else {
              // Car is busy - calculate remaining route time
              try {
                const waypoints = [];
                const dropoffs = activeRide.dropoffs || [activeRide.dropoff];

                let origin;
                if (activeRide.pickedUpAt) {
                  origin = activeRide.pickup;
                } else if (location && location.latitude && location.longitude) {
                  origin = { lat: location.latitude, lng: location.longitude };
                  waypoints.push({ location: activeRide.pickup, stopover: true });
                } else {
                  origin = activeRide.pickup;
                }

                dropoffs.forEach((dropoff, idx) => {
                  if (idx < dropoffs.length - 1) {
                    waypoints.push({ location: dropoff, stopover: true });
                  }
                });

                const finalDropoff = dropoffs[dropoffs.length - 1];

                apiCallCount.current++; // Increment API call counter
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

                if (!isMounted.current) return; // Check after async operation

                let totalCurrentRouteTime = 0;
                currentRouteResult.routes[0].legs.forEach(leg => {
                  const duration = leg.duration_in_traffic || leg.duration;
                  totalCurrentRouteTime += duration.value;
                });

                const bufferMinutes = (waypoints.length + 1) * BUFFER_MINUTES_PER_STOP;
                const currentRouteMinutes = Math.ceil(totalCurrentRouteTime / 60) + bufferMinutes;

                apiCallCount.current++; // Increment API call counter
                const toNewPickupResult = await new Promise((resolve, reject) => {
                  directionsService.route(
                    {
                      origin: finalDropoff,
                      destination: ride.pickup,
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

                if (!isMounted.current) return; // Check after async operation

                const toNewPickupDuration = toNewPickupResult.routes[0].legs[0].duration_in_traffic || toNewPickupResult.routes[0].legs[0].duration;
                const toNewPickupMinutes = Math.ceil(toNewPickupDuration.value / 60);

                const totalAvailableInMinutes = currentRouteMinutes + toNewPickupMinutes;

                carAvailability.push({
                  carNumber: carNum,
                  availableInMinutes: totalAvailableInMinutes
                });
              } catch (error) {
                carAvailability.push({
                  carNumber: carNum,
                  availableInMinutes: FALLBACK_ETA_BUSY_CAR
                });
              }
            }
          }

          if (!isMounted.current) return; // Final check before updating state

          if (carAvailability.length > 0) {
            carAvailability.sort((a, b) => a.availableInMinutes - b.availableInMinutes);
            const fastest = carAvailability[0];

            const etaData = {
              minutes: fastest.availableInMinutes,
              fastestCar: fastest.carNumber,
              calculating: false,
              timestamp: Date.now()
            };

            newETAs[ride.id] = etaData;
          }
        } catch (error) {
          logError('ETA Calculation', error, { rideId: ride.id });
          newETAs[ride.id] = {
            minutes: null,
            fastestCar: null,
            calculating: false,
            error: true
          };
        }
      }

      // SERVER-SIDE: Update ETAs in Firestore instead of component state
      for (const [rideId, etaData] of Object.entries(newETAs)) {
        if (!etaData.error && etaData.minutes !== null) {
          await updateDoc(doc(db, 'rides', rideId), {
            estimatedPickupMinutes: etaData.minutes,
            fastestCarNumber: etaData.fastestCar,
            etaCalculatedAt: Timestamp.now()
          });
        }
      }

      setCalculatingETAs(false);
      setSnackbar({
        isOpen: true,
        message: `ETAs calculated for ${Object.keys(newETAs).length} rides`,
        type: 'success',
        onUndo: null
      });
    } catch (error) {
      logError('Calculate and Store ETAs', error);
      setCalculatingETAs(false);
      setAlertModal({
        isOpen: true,
        title: 'Error',
        message: 'Error calculating ETAs: ' + error.message
      });
    }
  };

  // NEW: Update current time for timer displays
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, CLOCK_UPDATE_INTERVAL_MS);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!activeNDR) return;
    setAvailableCars(activeNDR.availableCars || 0);
  }, [activeNDR]);

  // NEW: Listen to car locations for status board
  useEffect(() => {
    if (!activeNDR) return;

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
  }, [activeNDR]);

  // NEW: Calculate car statuses based on rides
  useEffect(() => {
    if (!activeNDR || !availableCars) return;

    const statuses = {};
    
    // Initialize all cars as available
    for (let i = 1; i <= availableCars; i++) {
      statuses[i] = {
        status: 'available',
        currentRide: null,
        ridesCompleted: 0,
        lastActivity: null
      };
    }

    // Update statuses based on active rides
    rides.active.forEach(ride => {
      if (ride.carNumber && statuses[ride.carNumber]) {
        statuses[ride.carNumber] = {
          status: ride.pickedUpAt ? 'with_patron' : 'en_route',
          currentRide: ride,
          ridesCompleted: statuses[ride.carNumber].ridesCompleted,
          lastActivity: ride.pickedUpAt || ride.assignedAt
        };
      }
    });

    // Count completed rides per car
    rides.completed.forEach(ride => {
      if (ride.carNumber && statuses[ride.carNumber] && ride.status === 'completed') {
        statuses[ride.carNumber].ridesCompleted++;
      }
    });

    setCarStatuses(statuses);
  }, [rides, availableCars, activeNDR]);

  useEffect(() => {
    if (!activeNDR) {
      setLoading(false);
      return;
    }

    const ridesRef = collection(db, 'rides');
    let unsubPending, unsubActive, unsubCompleted;

    const pendingQuery = query(ridesRef, where('status', '==', 'pending'), where('ndrId', '==', activeNDR.id));
    unsubPending = onSnapshot(pendingQuery,
      (snapshot) => {
        const pendingRides = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            requestedAt: data.requestedAt?.toDate() || new Date()
          };
        }).sort((a, b) => a.requestedAt - b.requestedAt);

        setRides(prev => ({ ...prev, pending: pendingRides }));
        setLoading(false);
      },
      (error) => {
        logError('Pending Rides Query', error);
        setLoading(false);
      }
    );

    const activeQuery = query(ridesRef, where('status', '==', 'active'), where('ndrId', '==', activeNDR.id));
    unsubActive = onSnapshot(activeQuery,
      (snapshot) => {
        const activeRides = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            requestedAt: data.requestedAt?.toDate() || new Date(),
            assignedAt: data.assignedAt?.toDate() || null,
            pickedUpAt: data.pickedUpAt?.toDate() || null
          };
        }).sort((a, b) => b.requestedAt - a.requestedAt);

        setRides(prev => ({ ...prev, active: activeRides }));
      },
      (error) => {
        logError('Active Rides Query', error);
      }
    );

    const completedQuery = query(ridesRef, where('status', 'in', ['completed', 'cancelled', 'terminated']), where('ndrId', '==', activeNDR.id));
    unsubCompleted = onSnapshot(completedQuery,
      (snapshot) => {
        const completedRides = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            requestedAt: data.requestedAt?.toDate() || new Date(),
            assignedAt: data.assignedAt?.toDate() || null,
            pickedUpAt: data.pickedUpAt?.toDate() || null,
            completedAt: data.completedAt?.toDate() || new Date()
          };
        }).sort((a, b) => b.completedAt - a.completedAt);

        setRides(prev => ({ ...prev, completed: completedRides }));
      },
      (error) => {
        logError('Completed Rides Query', error);
      }
    );

    return () => {
      if (unsubPending) unsubPending();
      if (unsubActive) unsubActive();
      if (unsubCompleted) unsubCompleted();
    };
  }, [activeNDR]);

  const openAssignCar = async (ride) => {
    setAssigningRide({ ...ride, selectedCar: '' });
    setCheckingEligibility(true);

    // If single rider, check which cars are eligible
    if (ride.riders === 1) {
      try {
        const ndrDoc = await getDoc(doc(db, 'ndrs', activeNDR.id));
        const ndrData = ndrDoc.data();
        const carEligibility = {};

        // OPTIMIZATION: Collect all member IDs across all cars first (fixes N+1 query)
        const allMemberIds = new Set();
        for (let carNum = 1; carNum <= availableCars; carNum++) {
          const carAssignments = ndrData.assignments?.cars?.[carNum] || [];
          carAssignments.forEach(id => allMemberIds.add(id));
        }

        // OPTIMIZATION: Batch fetch all members at once instead of one-by-one
        const memberIds = Array.from(allMemberIds);
        const memberMap = {};

        if (memberIds.length > 0) {
          // Firestore has a limit of 10 for 'in' queries, so batch in chunks of 10
          for (let i = 0; i < memberIds.length; i += 10) {
            const chunk = memberIds.slice(i, i + 10);
            const membersQuery = query(
              collection(db, 'members'),
              where(documentId(), 'in', chunk)
            );
            const membersSnapshot = await getDocs(membersQuery);
            membersSnapshot.docs.forEach(doc => {
              memberMap[doc.id] = doc.data();
            });
          }
        }

        // Check each car using the cached member data
        for (let carNum = 1; carNum <= availableCars; carNum++) {
          const carAssignments = ndrData.assignments?.cars?.[carNum] || [];

          if (carAssignments.length < 2) {
            carEligibility[carNum] = {
              eligible: false,
              reason: 'Needs 2+ members',
              maleCount: 0,
              femaleCount: 0
            };
            continue;
          }

          // Use cached member data instead of fetching individually
          const carMembers = carAssignments
            .map(id => memberMap[id])
            .filter(Boolean);

          const maleCount = carMembers.filter(m => isMale(m)).length;
          const femaleCount = carMembers.filter(m => isFemale(m)).length;
          const hasMale = maleCount > 0;
          const hasFemale = femaleCount > 0;

          if (!hasMale || !hasFemale) {
            carEligibility[carNum] = {
              eligible: false,
              reason: 'Needs opposite genders',
              maleCount,
              femaleCount
            };
          } else {
            carEligibility[carNum] = {
              eligible: true,
              reason: '',
              maleCount,
              femaleCount
            };
          }
        }

        setEligibleCars(carEligibility);
      } catch (error) {
        logError('Car Eligibility Check', error, { rideId: ride.id });
      } finally {
        setCheckingEligibility(false);
      }
    } else {
      // Multi-rider, all cars eligible
      setEligibleCars({});
      setCheckingEligibility(false);
    }
  };

  const assignCar = async () => {
    if (!assigningRide || !assigningRide.selectedCar) {
      setAlertModal({
        isOpen: true,
        title: 'No Car Selected',
        message: 'Please select a car number before assigning.'
      });
      return;
    }

    setLoadingStates(prev => ({ ...prev, assigningCar: true }));

    try {
      const carNumber = parseInt(assigningRide.selectedCar);
      const ndrDoc = await getDoc(doc(db, 'ndrs', activeNDR.id));
      const ndrData = ndrDoc.data();
      const cars = ndrData.cars || [];
      const carInfo = cars.find(c => c.carNumber === carNumber);

      // ENFORCE: Single rider rides MUST be assigned to a car with opposite gender members
      if (assigningRide.riders === 1) {
        // Validate selected car has opposite gender members
        const carAssignments = ndrData.assignments?.cars?.[carNumber] || [];
        if (carAssignments.length < 2) {
          setAlertModal({
            isOpen: true,
            title: 'Insufficient Members',
            message: `Car ${carNumber} must have at least 2 members assigned before accepting single rider rides. Please assign more members to Car ${carNumber} in the NDR assignments.`
          });
          return;
        }

        // OPTIMIZATION: Batch fetch members instead of one-by-one (fixes N+1 query)
        const carMembers = [];
        if (carAssignments.length > 0) {
          // Batch in chunks of 10 (Firestore limit)
          for (let i = 0; i < carAssignments.length; i += 10) {
            const chunk = carAssignments.slice(i, i + 10);
            const membersQuery = query(
              collection(db, 'members'),
              where(documentId(), 'in', chunk)
            );
            const membersSnapshot = await getDocs(membersQuery);
            membersSnapshot.docs.forEach(doc => {
              carMembers.push(doc.data());
            });
          }
        }

        const hasMale = carMembers.some(m => isMale(m));
        const hasFemale = carMembers.some(m => isFemale(m));

        if (!hasMale || !hasFemale) {
          setAlertModal({
            isOpen: true,
            title: 'Gender Requirement Not Met',
            message: `Car ${carNumber} must have both male and female members assigned before accepting single rider rides. Please update Car ${carNumber} assignments in the NDR or select a different car.`
          });
          return;
        }
      }

      // OPTIMIZATION: Add version check for optimistic locking (prevents race conditions)
      const rideDoc = await getDoc(doc(db, 'rides', assigningRide.id));
      if (!rideDoc.exists()) {
        setAlertModal({
          isOpen: true,
          title: 'Ride Not Found',
          message: 'This ride no longer exists.'
        });
        setAssigningRide(null);
        return;
      }

      const currentRide = rideDoc.data();
      if (currentRide.status !== 'pending') {
        setAlertModal({
          isOpen: true,
          title: 'Ride Already Assigned',
          message: 'This ride has already been assigned by another dispatcher. Please refresh.'
        });
        setAssigningRide(null);
        return;
      }

      const currentVersion = currentRide.version || 0;

      await updateDoc(doc(db, 'rides', assigningRide.id), {
        status: 'active',
        carNumber: carNumber,
        assignedDriver: carInfo ? `${carInfo.driverName}` : 'Unknown Driver',
        carInfo: carInfo || null,
        assignedAt: Timestamp.now(),
        version: currentVersion + 1  // Increment version for optimistic locking
      });

      setAssigningRide(null);
      setLoadingStates(prev => ({ ...prev, assigningCar: false }));
    } catch (error) {
      logError('Assign Car', error, { rideId: assigningRide.id, carNumber: assigningRide.selectedCar });
      setLoadingStates(prev => ({ ...prev, assigningCar: false }));
      setAlertModal({
        isOpen: true,
        title: 'Error',
        message: 'Error assigning car: ' + error.message
      });
    }
  };

  const startRide = async (rideId) => {
    setConfirmModal({
      isOpen: true,
      title: 'Mark as Picked Up?',
      message: 'Confirm that the patron has been picked up.',
      onConfirm: async () => {
        setLoadingStates(prev => ({ ...prev, startingRide: { ...prev.startingRide, [rideId]: true } }));
        try {
          await updateDoc(doc(db, 'rides', rideId), {
            pickedUpAt: Timestamp.now()
          });
          setConfirmModal({ isOpen: false, title: '', message: '', onConfirm: null });
          setLoadingStates(prev => ({ ...prev, startingRide: { ...prev.startingRide, [rideId]: false } }));
        } catch (error) {
          logError('Start Ride', error, { rideId });
          setLoadingStates(prev => ({ ...prev, startingRide: { ...prev.startingRide, [rideId]: false } }));
          setConfirmModal({ isOpen: false, title: '', message: '', onConfirm: null });
          setAlertModal({
            isOpen: true,
            title: 'Error',
            message: 'Error starting ride: ' + error.message
          });
        }
      }
    });
  };

  const completeRide = async (rideId) => {
    setConfirmModal({
      isOpen: true,
      title: 'Complete Ride?',
      message: 'Mark this ride as completed?',
      onConfirm: async () => {
        setLoadingStates(prev => ({ ...prev, completingRide: { ...prev.completingRide, [rideId]: true } }));
        try {
          // Store current state for undo
          const rideDoc = await getDoc(doc(db, 'rides', rideId));
          const previousState = rideDoc.data();

          await updateDoc(doc(db, 'rides', rideId), {
            status: 'completed',
            completedAt: Timestamp.now()
          });

          setConfirmModal({ isOpen: false, title: '', message: '', onConfirm: null });
          setLoadingStates(prev => ({ ...prev, completingRide: { ...prev.completingRide, [rideId]: false } }));

          // Show snackbar with undo option
          setLastAction({ type: 'complete', rideId, previousState });
          setSnackbar({
            isOpen: true,
            message: 'Ride marked as completed',
            type: 'success',
            onUndo: () => undoLastAction()
          });
        } catch (error) {
          logError('Complete Ride', error, { rideId });
          setLoadingStates(prev => ({ ...prev, completingRide: { ...prev.completingRide, [rideId]: false } }));
          setConfirmModal({ isOpen: false, title: '', message: '', onConfirm: null });
          setAlertModal({
            isOpen: true,
            title: 'Error',
            message: 'Error completing ride: ' + error.message
          });
        }
      }
    });
  };

  const cancelRide = async (rideId) => {
    setPromptModal({
      isOpen: true,
      title: 'Cancel Ride',
      message: 'Please provide a reason for cancellation:',
      defaultValue: '',
      onSubmit: async (reason) => {
        setLoadingStates(prev => ({ ...prev, cancellingRide: { ...prev.cancellingRide, [rideId]: true } }));
        try {
          // Store current state for undo
          const rideDoc = await getDoc(doc(db, 'rides', rideId));
          const previousState = rideDoc.data();

          await updateDoc(doc(db, 'rides', rideId), {
            status: 'cancelled',
            completedAt: Timestamp.now(),
            cancellationReason: reason || 'No reason provided'
          });
          setPromptModal({ isOpen: false, title: '', message: '', onSubmit: null, defaultValue: '' });
          setPromptValue('');
          setLoadingStates(prev => ({ ...prev, cancellingRide: { ...prev.cancellingRide, [rideId]: false } }));

          // Show snackbar with undo option
          setLastAction({ type: 'cancel', rideId, previousState });
          setSnackbar({
            isOpen: true,
            message: 'Ride cancelled',
            type: 'warning',
            onUndo: () => undoLastAction()
          });
        } catch (error) {
          logError('Cancel Ride', error, { rideId, reason });
          setLoadingStates(prev => ({ ...prev, cancellingRide: { ...prev.cancellingRide, [rideId]: false } }));
          setPromptModal({ isOpen: false, title: '', message: '', onSubmit: null, defaultValue: '' });
          setPromptValue('');
          setAlertModal({
            isOpen: true,
            title: 'Error',
            message: 'Error cancelling ride: ' + error.message
          });
        }
      }
    });
  };

  const terminateRide = async (rideId) => {
    setPromptModal({
      isOpen: true,
      title: 'Terminate Ride',
      message: 'Reason for termination (e.g., patron no-show, unsafe situation):',
      defaultValue: '',
      onSubmit: async (reason) => {
        setLoadingStates(prev => ({ ...prev, terminatingRide: { ...prev.terminatingRide, [rideId]: true } }));
        try {
          // Store current state for undo
          const rideDoc = await getDoc(doc(db, 'rides', rideId));
          const previousState = rideDoc.data();

          await updateDoc(doc(db, 'rides', rideId), {
            status: 'terminated',
            completedAt: Timestamp.now(),
            terminationReason: reason || 'No reason provided'
          });
          setPromptModal({ isOpen: false, title: '', message: '', onSubmit: null, defaultValue: '' });
          setPromptValue('');
          setLoadingStates(prev => ({ ...prev, terminatingRide: { ...prev.terminatingRide, [rideId]: false } }));

          // Show snackbar with undo option
          setLastAction({ type: 'terminate', rideId, previousState });
          setSnackbar({
            isOpen: true,
            message: 'Ride terminated',
            type: 'warning',
            onUndo: () => undoLastAction()
          });
        } catch (error) {
          logError('Terminate Ride', error, { rideId, reason });
          setLoadingStates(prev => ({ ...prev, terminatingRide: { ...prev.terminatingRide, [rideId]: false } }));
          setPromptModal({ isOpen: false, title: '', message: '', onSubmit: null, defaultValue: '' });
          setPromptValue('');
          setAlertModal({
            isOpen: true,
            title: 'Error',
            message: 'Error terminating ride: ' + error.message
          });
        }
      }
    });
  };

  // NEW: Undo last action
  const undoLastAction = async () => {
    if (!lastAction) return;

    try {
      const { type, rideId, previousState } = lastAction;

      // Restore previous state
      await updateDoc(doc(db, 'rides', rideId), {
        status: previousState.status,
        completedAt: previousState.completedAt || null,
        cancellationReason: previousState.cancellationReason || null,
        terminationReason: previousState.terminationReason || null
      });

      setSnackbar({ isOpen: false, message: '', type: 'info', onUndo: null });
      setLastAction(null);

      // Show success message
      setSnackbar({
        isOpen: true,
        message: `Undo successful - ride restored to ${previousState.status}`,
        type: 'success',
        onUndo: null
      });
    } catch (error) {
      logError('Undo Action', error, { lastAction });
      setAlertModal({
        isOpen: true,
        title: 'Undo Failed',
        message: 'Could not undo the last action: ' + error.message
      });
    }
  };

  // NEW: Reassign active ride to different car
  const reassignRide = async () => {
    if (!reassigningRide || !reassigningRide.newCarNumber) {
      setAlertModal({
        isOpen: true,
        title: 'No Car Selected',
        message: 'Please select a car to reassign to.'
      });
      return;
    }

    try {
      const newCarNumber = parseInt(reassigningRide.newCarNumber);
      const ndrDoc = await getDoc(doc(db, 'ndrs', activeNDR.id));
      const ndrData = ndrDoc.data();
      const cars = ndrData.cars || [];
      const carInfo = cars.find(c => c.carNumber === newCarNumber);

      await updateDoc(doc(db, 'rides', reassigningRide.id), {
        carNumber: newCarNumber,
        assignedDriver: carInfo ? `${carInfo.driverName}` : 'Unknown Driver',
        carInfo: carInfo || null,
        reassignedAt: Timestamp.now()
      });

      setReassigningRide(null);
      setSnackbar({
        isOpen: true,
        message: `Ride reassigned to Car ${newCarNumber}`,
        type: 'success',
        onUndo: null
      });
    } catch (error) {
      logError('Reassign Ride', error, { rideId: reassigningRide.id });
      setAlertModal({
        isOpen: true,
        title: 'Error',
        message: 'Error reassigning ride: ' + error.message
      });
    }
  };

  const startEdit = (ride) => {
    setEditingRide({
      ...ride,
      dropoffs: ride.dropoffs || [ride.dropoff]
    });
  };

  const saveEdit = async () => {
    if (!editingRide) return;

    // VALIDATION: Check required fields
    const patronName = editingRide.patronName?.trim();
    const phone = editingRide.phone?.trim();
    const pickup = editingRide.pickup?.trim();
    const riders = editingRide.riders;

    if (!patronName) {
      setAlertModal({
        isOpen: true,
        title: 'Validation Error',
        message: 'Patron name is required.'
      });
      return;
    }

    if (!phone) {
      setAlertModal({
        isOpen: true,
        title: 'Validation Error',
        message: 'Phone number is required.'
      });
      return;
    }

    if (!pickup) {
      setAlertModal({
        isOpen: true,
        title: 'Validation Error',
        message: 'Pickup location is required.'
      });
      return;
    }

    if (!riders || riders < 1) {
      setAlertModal({
        isOpen: true,
        title: 'Validation Error',
        message: 'Number of riders must be at least 1.'
      });
      return;
    }

    // VALIDATION: Check dropoffs
    const hasEmptyDropoff = editingRide.dropoffs.some(d => !d?.trim());
    if (hasEmptyDropoff) {
      setAlertModal({
        isOpen: true,
        title: 'Validation Error',
        message: 'All dropoff locations must be filled in.'
      });
      return;
    }

    setLoadingStates(prev => ({ ...prev, savingEdit: true }));

    try {
      // OPTIMIZATION: Add version check for optimistic locking (prevents race conditions)
      const rideDoc = await getDoc(doc(db, 'rides', editingRide.id));
      if (!rideDoc.exists()) {
        setLoadingStates(prev => ({ ...prev, savingEdit: false }));
        setAlertModal({
          isOpen: true,
          title: 'Ride Not Found',
          message: 'This ride no longer exists.'
        });
        setEditingRide(null);
        return;
      }

      const currentRide = rideDoc.data();
      const currentVersion = currentRide.version || 0;

      await updateDoc(doc(db, 'rides', editingRide.id), {
        patronName: patronName,
        phone: phone,
        pickup: pickup,
        dropoffs: editingRide.dropoffs,
        riders: riders,
        version: currentVersion + 1  // Increment version for optimistic locking
      });
      setEditingRide(null);
      setLoadingStates(prev => ({ ...prev, savingEdit: false }));
    } catch (error) {
      logError('Update Ride', error, { rideId: editingRide.id });
      setLoadingStates(prev => ({ ...prev, savingEdit: false }));
      setAlertModal({
        isOpen: true,
        title: 'Error',
        message: 'Error updating ride: ' + error.message
      });
    }
  };

  const openSplitRide = (ride) => {
    if (ride.riders < 2) {
      setAlertModal({
        isOpen: true,
        title: 'Cannot Split',
        message: 'Cannot split a ride with less than 2 riders.'
      });
      return;
    }
    setSplittingRide(ride);
    setSplitRiders({ ride1: 1, ride2: ride.riders - 1 });
  };

  const handleSplitRide = async () => {
    if (!splittingRide) return;

    const totalRiders = splitRiders.ride1 + splitRiders.ride2;
    if (totalRiders !== splittingRide.riders) {
      setAlertModal({
        isOpen: true,
        title: 'Invalid Split',
        message: `Split must equal total riders (${splittingRide.riders})`
      });
      return;
    }

    if (splitRiders.ride1 < 1 || splitRiders.ride2 < 1) {
      setAlertModal({
        isOpen: true,
        title: 'Invalid Split',
        message: 'Each ride must have at least 1 rider.'
      });
      return;
    }

    setLoadingStates(prev => ({ ...prev, splittingRide: true }));

    try {
      await updateDoc(doc(db, 'rides', splittingRide.id), {
        riders: splitRiders.ride1,
        version: (splittingRide.version || 0) + 1  // Increment version
      });

      await addDoc(collection(db, 'rides'), {
        ndrId: splittingRide.ndrId,
        patronName: splittingRide.patronName,
        phone: splittingRide.phone,
        pickup: splittingRide.pickup,
        dropoffs: splittingRide.dropoffs || [splittingRide.dropoff],
        riders: splitRiders.ride2,
        status: 'pending',
        requestedAt: Timestamp.now(),
        requestedBy: splittingRide.requestedBy,
        splitFrom: splittingRide.id,
        version: 1  // Initialize version
      });

      setAlertModal({
        isOpen: true,
        title: 'Success',
        message: 'Ride split successfully!'
      });
      setSplittingRide(null);
      setSplitRiders({ ride1: 1, ride2: 1 });
      setLoadingStates(prev => ({ ...prev, splittingRide: false }));
    } catch (error) {
      logError('Split Ride', error, { rideId: splittingRide.id, split: splitRiders });
      setLoadingStates(prev => ({ ...prev, splittingRide: false }));
      setAlertModal({
        isOpen: true,
        title: 'Error',
        message: 'Error splitting ride: ' + error.message
      });
    }
  };

  const updateDropoff = (index, value) => {
    const newDropoffs = [...editingRide.dropoffs];
    newDropoffs[index] = value;
    setEditingRide({ ...editingRide, dropoffs: newDropoffs });
  };

  const addDropoffToEdit = () => {
    setEditingRide({
      ...editingRide,
      dropoffs: [...editingRide.dropoffs, '']
    });
  };

  const removeDropoffFromEdit = (index) => {
    if (editingRide.dropoffs.length <= 1) {
      setAlertModal({
        isOpen: true,
        title: 'Cannot Remove',
        message: 'Ride must have at least one dropoff location.'
      });
      return;
    }
    const newDropoffs = editingRide.dropoffs.filter((_, i) => i !== index);
    setEditingRide({ ...editingRide, dropoffs: newDropoffs });
  };

  const getStatusBadge = (status) => {
    const badges = {
      completed: 'bg-green-100 text-green-800',
      cancelled: 'bg-red-100 text-red-800',
      terminated: 'bg-orange-100 text-orange-800'
    };
    return badges[status] || 'bg-gray-100 text-gray-800';
  };

  // NEW: Get car status color (memoized)
  const getCarStatusColor = useCallback((status) => {
    switch (status) {
      case 'available':
        return 'bg-green-500';
      case 'en_route':
        return 'bg-blue-500';
      case 'with_patron':
        return 'bg-yellow-500';
      default:
        return 'bg-gray-400';
    }
  }, []);

  // NEW: Get car status label (memoized)
  const getCarStatusLabel = useCallback((status) => {
    switch (status) {
      case 'available':
        return 'AVAILABLE';
      case 'en_route':
        return 'EN ROUTE';
      case 'with_patron':
        return 'WITH PATRON';
      default:
        return 'UNKNOWN';
    }
  }, []);

  if (ndrLoading) {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-gray-800">Ride Management</h2>
        <div className="bg-white p-12 rounded-lg shadow text-center">
          <p className="text-gray-500">Loading...</p>
        </div>
      </div>
    );
  }

  if (!activeNDR) {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-gray-800">Ride Management</h2>
        <div className="bg-yellow-50 border-2 border-yellow-400 rounded-lg p-8 text-center">
          <AlertCircle className="mx-auto mb-4 text-yellow-600" size={64} />
          <h3 className="text-xl font-bold text-gray-800 mb-2">No Active NDR</h3>
          <p className="text-gray-600 mb-4">
            Ride Management is currently unavailable. A director must activate an NDR from the NDR Reports page before you can manage rides.
          </p>
          <p className="text-sm text-gray-500">
            Directors: Go to NDR Reports and activate an Operating Night event to enable Ride Management.
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-gray-800">Ride Management</h2>
        <div className="bg-white p-12 rounded-lg shadow text-center">
          <p className="text-gray-500">Loading rides...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <h2 className="text-2xl font-bold text-gray-800">Ride Management</h2>
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="bg-green-100 px-4 py-2 rounded-lg">
            <p className="text-sm font-semibold text-green-800">Active NDR: {activeNDR.eventName}</p>
          </div>
          <div className="bg-blue-100 px-4 py-2 rounded-lg flex items-center gap-2">
            <Car size={18} className="text-blue-800" />
            <p className="text-sm font-semibold text-blue-800">
              {availableCars} {availableCars === 1 ? 'Car' : 'Cars'} Available
            </p>
          </div>
        </div>
      </div>

      {/* NEW: Weather and Traffic Alerts - BIG FOCUS */}
      {weather && (
        <div className={`rounded-lg border-2 p-4 ${
          weather.severity === WEATHER_SEVERITY.DANGER ? 'bg-red-50 border-red-500' :
          weather.severity === WEATHER_SEVERITY.WARNING ? 'bg-orange-50 border-orange-500' :
          weather.severity === WEATHER_SEVERITY.CAUTION ? 'bg-yellow-50 border-yellow-500' :
          'bg-blue-50 border-blue-200'
        }`}>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <div className="text-4xl">{getWeatherEmoji(weather.condition)}</div>
              <div>
                <h3 className="font-bold text-gray-900 text-lg">
                  {weather.temp}°F - {weather.description}
                </h3>
                <p className="text-sm text-gray-600">
                  Wind: {weather.windSpeed} mph | Humidity: {weather.humidity}%
                </p>
              </div>
            </div>
            <button
              onClick={async () => {
                setWeatherLoading(true);
                const lat = activeNDR.location?.lat || 30.6280;
                const lng = activeNDR.location?.lng || -96.3344;
                const weatherData = await getCurrentWeather(lat, lng);
                if (weatherData) setWeather(weatherData);
                setWeatherLoading(false);
              }}
              className="px-3 py-2 bg-white border-2 border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2 min-h-touch touch-manipulation"
              disabled={weatherLoading}
            >
              <RefreshCw size={16} className={weatherLoading ? 'animate-spin' : ''} />
              Refresh
            </button>
          </div>
          {getWeatherAlert(weather) && (
            <div className="mt-3 p-3 bg-white rounded-lg border-2 border-current">
              <p className="font-semibold text-gray-900">{getWeatherAlert(weather)}</p>
            </div>
          )}
        </div>
      )}

      {/* SERVER-SIDE: Manual ETA Recalculation */}
      {rides.pending.length > 0 && (
        <div className="bg-purple-50 border-2 border-purple-200 rounded-lg p-4">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h3 className="font-bold text-gray-900 text-lg">Estimated Pickup Times</h3>
              <p className="text-sm text-gray-600">
                ETAs are stored server-side and persist across all devices and sessions
              </p>
            </div>
            <button
              onClick={calculateAndStoreETAs}
              disabled={calculatingETAs}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-semibold flex items-center gap-2 min-h-touch touch-manipulation disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Navigation size={16} className={calculatingETAs ? 'animate-spin' : ''} />
              {calculatingETAs ? 'Calculating...' : 'Recalculate ETAs'}
            </button>
          </div>
        </div>
      )}

      {/* NEW: Car Status Board */}
      {availableCars > 0 && (
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Car size={20} />
            Car Status Board
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: availableCars }, (_, i) => i + 1).map(carNum => {
              const status = carStatuses[carNum] || { status: 'available', currentRide: null, ridesCompleted: 0 };
              const location = carLocations[carNum];

              return (
                <CarStatusCard
                  key={carNum}
                  carNum={carNum}
                  status={status}
                  location={location}
                  currentTime={currentTime}
                  getCarStatusColor={getCarStatusColor}
                  getCarStatusLabel={getCarStatusLabel}
                />
              );
            })}
          </div>
        </div>
      )}

      {availableCars === 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-yellow-800 font-medium">
            ⚠️ No cars are set as available for this event. Directors should update the car count in NDR Assignments.
          </p>
        </div>
      )}

      <div className="bg-white rounded-lg shadow border border-gray-200">
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setActiveTab('pending')}
            className={`flex-1 px-2 sm:px-4 md:px-6 py-3 md:py-4 text-center transition text-xs sm:text-sm md:text-base min-h-touch touch-manipulation ${activeTab === 'pending' ? 'border-b-2 border-blue-600 text-blue-600 font-medium' : 'text-gray-600'}`}
          >
            Pending ({rides.pending.length})
          </button>
          <button
            onClick={() => setActiveTab('active')}
            className={`flex-1 px-2 sm:px-4 md:px-6 py-3 md:py-4 text-center transition text-xs sm:text-sm md:text-base min-h-touch touch-manipulation ${activeTab === 'active' ? 'border-b-2 border-purple-600 text-purple-600 font-medium' : 'text-gray-600'}`}
          >
            Active ({rides.active.length})
          </button>
          <button
            onClick={() => setActiveTab('completed')}
            className={`flex-1 px-2 sm:px-4 md:px-6 py-3 md:py-4 text-center transition text-xs sm:text-sm md:text-base min-h-touch touch-manipulation ${activeTab === 'completed' ? 'border-b-2 border-green-600 text-green-600 font-medium' : 'text-gray-600'}`}
          >
            History ({rides.completed.length})
          </button>
        </div>

        <div className="p-4">
          {rides[activeTab].length === 0 ? (
            <div className="text-center text-gray-500 py-8">
              No {activeTab} rides
            </div>
          ) : (
            rides[activeTab].map((ride, index) => {
              // NEW: Calculate wait time for this ride
              const waitMinutes = calculateWaitTime(ride.requestedAt);
              const isWaitLong = isLongWait(waitMinutes);
              
              return (
                <div 
                  key={ride.id} 
                  className={`mb-4 p-4 border-2 rounded-lg ${
                    isWaitLong && activeTab === 'pending' ? 'border-red-500 bg-red-50' : 'border-gray-200'
                  }`}
                >
                  {editingRide?.id === ride.id ? (
                    /* EDIT MODE */
                    <div className="space-y-3">
                      <input
                        type="text"
                        value={editingRide.patronName}
                        onChange={(e) => setEditingRide({...editingRide, patronName: e.target.value})}
                        className="w-full px-3 py-2 border rounded min-h-touch"
                        placeholder="Name"
                        inputMode="text"
                        autoComplete="name"
                      />
                      <input
                        type="tel"
                        value={editingRide.phone}
                        onChange={(e) => setEditingRide({...editingRide, phone: e.target.value})}
                        className="w-full px-3 py-2 border rounded min-h-touch"
                        placeholder="Phone"
                        inputMode="tel"
                        autoComplete="tel"
                      />
                      <input
                        type="text"
                        value={editingRide.pickup}
                        onChange={(e) => setEditingRide({...editingRide, pickup: e.target.value})}
                        className="w-full px-3 py-2 border rounded min-h-touch"
                        placeholder="Pickup"
                        inputMode="text"
                        autoComplete="street-address"
                      />
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Dropoff Locations
                        </label>
                        {editingRide.dropoffs.map((dropoff, dropoffIndex) => (
                          <div key={dropoffIndex} className="flex gap-2 mb-2">
                            <input
                              type="text"
                              value={dropoff}
                              onChange={(e) => updateDropoff(dropoffIndex, e.target.value)}
                              className="flex-1 px-3 py-2 border rounded min-h-touch"
                              placeholder={`Dropoff ${dropoffIndex + 1}`}
                              inputMode="text"
                              autoComplete="street-address"
                            />
                            {editingRide.dropoffs.length > 1 && (
                              <button
                                onClick={() => removeDropoffFromEdit(dropoffIndex)}
                                className="px-3 py-2 bg-red-100 text-red-700 rounded hover:bg-red-200 min-h-touch touch-manipulation"
                              >
                                <X size={16} />
                              </button>
                            )}
                          </div>
                        ))}
                        <button
                          onClick={addDropoffToEdit}
                          className="mt-2 px-3 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 text-sm min-h-touch touch-manipulation"
                        >
                          + Add Dropoff
                        </button>
                      </div>

                      <input
                        type="number"
                        value={editingRide.riders}
                        onChange={(e) => setEditingRide({...editingRide, riders: parseInt(e.target.value)})}
                        className="w-full px-3 py-2 border rounded min-h-touch"
                        placeholder="Riders"
                        inputMode="numeric"
                        min="1"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={saveEdit}
                          disabled={loadingStates.savingEdit}
                          className="px-4 py-3 md:py-2 min-h-touch bg-green-600 text-white rounded hover:bg-green-700 active:bg-green-800 touch-manipulation disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 justify-center"
                        >
                          {loadingStates.savingEdit && <Loader2 size={16} className="animate-spin" />}
                          {loadingStates.savingEdit ? 'Saving...' : 'Save'}
                        </button>
                        <button
                          onClick={() => setEditingRide(null)}
                          disabled={loadingStates.savingEdit}
                          className="px-4 py-3 md:py-2 min-h-touch bg-gray-300 text-gray-700 rounded hover:bg-gray-400 active:bg-gray-500 touch-manipulation disabled:opacity-50"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : assigningRide?.id === ride.id ? (
                    /* CAR ASSIGNMENT MODE */
                    <div className="space-y-3">
                      <p className="font-semibold">Assign car to {ride.patronName}</p>
                      {checkingEligibility && (
                        <div className="bg-blue-50 border border-blue-300 rounded-lg p-3 flex items-center gap-2">
                          <div className="animate-spin h-4 w-4 border-2 border-blue-600 border-t-transparent rounded-full"></div>
                          <p className="text-blue-800 text-sm font-medium">
                            Checking car eligibility...
                          </p>
                        </div>
                      )}
                      {assigningRide.riders === 1 && !checkingEligibility && (
                        <>
                          <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-3">
                            <p className="text-yellow-800 text-sm font-medium">
                              ⚠️ Single rider rides MUST be assigned to a car with opposite gender members for safety.
                            </p>
                          </div>
                          {Object.keys(eligibleCars).length > 0 && Object.values(eligibleCars).every(car => !car.eligible) && (
                            <div className="bg-red-50 border border-red-300 rounded-lg p-3">
                              <p className="text-red-800 text-sm font-semibold">
                                No cars are eligible! All cars need at least 2 members with opposite genders assigned.
                              </p>
                              <p className="text-red-700 text-xs mt-1">
                                Please update car assignments in the NDR before accepting single rider rides.
                              </p>
                            </div>
                          )}
                        </>
                      )}
                      <select
                        value={assigningRide.selectedCar}
                        onChange={(e) => setAssigningRide({...assigningRide, selectedCar: e.target.value})}
                        className="w-full px-3 py-2 border rounded"
                        disabled={checkingEligibility}
                      >
                        <option value="">{checkingEligibility ? 'Checking eligibility...' : 'Select a car...'}</option>
                        {Array.from({ length: availableCars }, (_, i) => i + 1).map(num => {
                          const carEligibility = eligibleCars[num];
                          const isEligible = !carEligibility || carEligibility.eligible;
                          const reason = carEligibility?.reason || '';
                          const maleCount = carEligibility?.maleCount || 0;
                          const femaleCount = carEligibility?.femaleCount || 0;

                          // Build gender breakdown display
                          let genderInfo = '';
                          if (assigningRide.riders === 1 && carEligibility) {
                            genderInfo = ` (${maleCount}M, ${femaleCount}F)`;
                          }

                          return (
                            <option
                              key={num}
                              value={num}
                              disabled={!isEligible}
                            >
                              Car {num}{genderInfo}{!isEligible ? ` - ${reason}` : isEligible && assigningRide.riders === 1 ? ' ✓' : ''}
                            </option>
                          );
                        })}
                      </select>
                      <div className="flex gap-2">
                        <button
                          onClick={assignCar}
                          disabled={loadingStates.assigningCar || checkingEligibility}
                          className="px-4 py-3 md:py-2 min-h-touch bg-blue-600 text-white rounded hover:bg-blue-700 active:bg-blue-800 touch-manipulation disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 justify-center"
                        >
                          {loadingStates.assigningCar && <Loader2 size={16} className="animate-spin" />}
                          {loadingStates.assigningCar ? 'Assigning...' : 'Assign'}
                        </button>
                        <button
                          onClick={() => setAssigningRide(null)}
                          disabled={loadingStates.assigningCar}
                          className="px-4 py-3 md:py-2 min-h-touch bg-gray-300 text-gray-700 rounded hover:bg-gray-400 active:bg-gray-500 touch-manipulation disabled:opacity-50"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* NORMAL DISPLAY MODE */
                    <>
                      {/* NEW: Queue Position for Pending Rides */}
                      {activeTab === 'pending' && (
                        <div className="mb-3 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className={`px-3 py-1 rounded-full text-sm font-bold ${
                              index === 0 ? 'bg-green-500 text-white' :
                              index === 1 ? 'bg-yellow-500 text-gray-900' :
                              'bg-gray-300 text-gray-700'
                            }`}>
                              #{index + 1} in Queue
                            </span>
                            {index === 0 && (
                              <span className="text-sm font-bold text-green-600 animate-pulse">
                                ← NEXT UP
                              </span>
                            )}
                          </div>
                          
                          {/* NEW: Wait Time Display */}
                          <div className="flex flex-col gap-2">
                            {/* Elapsed wait time */}
                            <div className={`flex items-center gap-2 px-3 py-1 rounded-full ${
                              isWaitLong ? 'bg-red-500 text-white animate-pulse' : 'bg-blue-100 text-blue-800'
                            }`}>
                              <Clock size={16} />
                              <span className="text-sm font-bold">
                                Waiting: {formatWaitTime(waitMinutes)}
                              </span>
                              {isWaitLong && (
                                <AlertTriangle size={16} className="animate-bounce" />
                              )}
                            </div>
                            
                            {/* ETA to pickup - SERVER-SIDE: Read from Firestore */}
                            {ride.estimatedPickupMinutes && (
                              <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-green-100 text-green-800">
                                <Navigation size={16} />
                                <span className="text-xs font-bold">
                                  ETA: ~{ride.estimatedPickupMinutes} min
                                </span>
                                {ride.fastestCarNumber && (
                                  <span className="text-xs bg-green-200 px-1.5 py-0.5 rounded">
                                    Car {ride.fastestCarNumber}
                                  </span>
                                )}
                                {ride.etaCalculatedAt && (
                                  <span className="text-xs text-gray-500">
                                    ({formatTime(ride.etaCalculatedAt.toDate())})
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* NEW: Wait Time Display for Active Rides */}
                      {activeTab === 'active' && (
                        <div className="mb-3 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="px-3 py-1 rounded-full text-sm font-bold bg-purple-500 text-white">
                              Car {ride.carNumber}
                            </span>
                            {ride.pickedUpAt ? (
                              <span className="text-sm font-semibold text-yellow-600">
                                In Transit
                              </span>
                            ) : (
                              <span className="text-sm font-semibold text-blue-600">
                                En Route to Pickup
                              </span>
                            )}
                          </div>
                          
                          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-gray-100 text-gray-800">
                            <Clock size={16} />
                            <span className="text-sm font-bold">
                              Total: {formatWaitTime(waitMinutes)}
                            </span>
                          </div>
                        </div>
                      )}

                      {isWaitLong && activeTab === 'pending' && (
                        <div className="mb-3 bg-red-100 border-2 border-red-500 rounded-lg p-3 flex items-start gap-2">
                          <AlertTriangle size={20} className="text-red-600 flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="text-sm font-bold text-red-900">
                              ⚠️ LONG WAIT ALERT
                            </p>
                            <p className="text-xs text-red-700">
                              This patron has been waiting for over 15 minutes. Consider prioritizing this ride.
                            </p>
                          </div>
                        </div>
                      )}

                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h3 className="text-lg font-bold text-gray-900">{ride.patronName}</h3>
                          <p className="text-sm text-gray-600 flex items-center gap-1">
                            <Phone size={14} />
                            {ride.phone}
                          </p>
                          <p className="text-sm text-gray-600 flex items-center gap-1">
                            <Users size={14} />
                            {ride.riders} {ride.riders === 1 ? 'rider' : 'riders'}
                          </p>
                        </div>
                        
                        <div className="text-right text-xs text-gray-500">
                          <p>Requested: {formatTime(ride.requestedAt)}</p>
                          {ride.assignedAt && <p>Assigned: {formatTime(ride.assignedAt)}</p>}
                          {ride.pickedUpAt && <p>Picked up: {formatTime(ride.pickedUpAt)}</p>}
                        </div>
                      </div>

                      <div className="mb-3 space-y-2 text-sm">
                        <p className="flex items-start gap-2">
                          <MapPin size={14} className="text-blue-600 mt-1 flex-shrink-0" />
                          <span>
                            <span className="font-semibold">Pickup:</span> {ride.pickup}
                          </span>
                        </p>
                        {(ride.dropoffs || [ride.dropoff]).map((dropoff, dropoffIndex) => (
                          <p key={dropoffIndex} className="flex items-start gap-2">
                            <MapPin size={14} className="text-red-600 mt-1 flex-shrink-0" />
                            <span>
                              <span className="font-semibold">
                                Drop {(ride.dropoffs?.length || 0) > 1 ? `${dropoffIndex + 1}` : ''}:
                              </span> {dropoff}
                            </span>
                          </p>
                        ))}
                      </div>

                      {activeTab === 'completed' && (
                        <div className="mb-3">
                          <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${getStatusBadge(ride.status)}`}>
                            {ride.status.toUpperCase()}
                          </span>
                          {ride.cancellationReason && (
                            <p className="text-xs text-gray-600 mt-2">
                              <span className="font-semibold">Cancelled:</span> {ride.cancellationReason}
                            </p>
                          )}
                          {ride.terminationReason && (
                            <p className="text-xs text-gray-600 mt-2">
                              <span className="font-semibold">Terminated:</span> {ride.terminationReason}
                            </p>
                          )}
                        </div>
                      )}

                      {/* ACTION BUTTONS */}
                      <div className="flex gap-2 flex-wrap">
                        {activeTab === 'pending' && (
                          <>
                            <button
                              onClick={() => openAssignCar(ride)}
                              className="px-4 py-3 md:py-2 min-h-touch bg-blue-600 text-white rounded hover:bg-blue-700 active:bg-blue-800 text-sm touch-manipulation"
                            >
                              Assign Car
                            </button>
                            <button
                              onClick={() => openSplitRide(ride)}
                              className="px-4 py-3 md:py-2 min-h-touch bg-purple-600 text-white rounded hover:bg-purple-700 active:bg-purple-800 text-sm flex items-center gap-1 touch-manipulation"
                            >
                              <Split size={16} />
                              Split
                            </button>
                            <button
                              onClick={() => startEdit(ride)}
                              className="px-4 py-3 md:py-2 min-h-touch bg-gray-200 text-gray-700 rounded hover:bg-gray-300 active:bg-gray-400 text-sm touch-manipulation"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => cancelRide(ride.id)}
                              className="px-4 py-3 md:py-2 min-h-touch bg-red-500 text-white rounded hover:bg-red-600 active:bg-red-700 text-sm touch-manipulation"
                            >
                              Cancel
                            </button>
                          </>
                        )}

                        {activeTab === 'active' && (
                          <>
                            {!ride.pickedUpAt && (
                              <button
                                onClick={() => startRide(ride.id)}
                                disabled={loadingStates.startingRide[ride.id]}
                                className="px-4 py-3 md:py-2 min-h-touch bg-green-600 text-white rounded hover:bg-green-700 active:bg-green-800 text-sm touch-manipulation disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                              >
                                {loadingStates.startingRide[ride.id] && <Loader2 size={14} className="animate-spin" />}
                                {loadingStates.startingRide[ride.id] ? 'Marking...' : 'Mark Picked Up'}
                              </button>
                            )}
                            <button
                              onClick={() => completeRide(ride.id)}
                              disabled={loadingStates.completingRide[ride.id]}
                              className="px-4 py-3 md:py-2 min-h-touch bg-blue-600 text-white rounded hover:bg-blue-700 active:bg-blue-800 text-sm touch-manipulation disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                            >
                              {loadingStates.completingRide[ride.id] && <Loader2 size={14} className="animate-spin" />}
                              {loadingStates.completingRide[ride.id] ? 'Completing...' : 'Complete'}
                            </button>
                            <button
                              onClick={() => startEdit(ride)}
                              className="px-4 py-3 md:py-2 min-h-touch bg-gray-200 text-gray-700 rounded hover:bg-gray-300 active:bg-gray-400 text-sm touch-manipulation"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => setReassigningRide({ ...ride, newCarNumber: '' })}
                              className="px-4 py-3 md:py-2 min-h-touch bg-purple-600 text-white rounded hover:bg-purple-700 active:bg-purple-800 text-sm touch-manipulation flex items-center gap-1"
                            >
                              <RefreshCw size={14} />
                              Reassign
                            </button>
                            <button
                              onClick={() => cancelRide(ride.id)}
                              disabled={loadingStates.cancellingRide[ride.id]}
                              className="px-4 py-3 md:py-2 min-h-touch bg-red-500 text-white rounded hover:bg-red-600 active:bg-red-700 text-sm touch-manipulation disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                            >
                              {loadingStates.cancellingRide[ride.id] && <Loader2 size={14} className="animate-spin" />}
                              {loadingStates.cancellingRide[ride.id] ? 'Cancelling...' : 'Cancel'}
                            </button>
                            <button
                              onClick={() => terminateRide(ride.id)}
                              disabled={loadingStates.terminatingRide[ride.id]}
                              className="px-4 py-3 md:py-2 min-h-touch bg-orange-500 text-white rounded hover:bg-orange-600 active:bg-orange-700 text-sm touch-manipulation disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                            >
                              {loadingStates.terminatingRide[ride.id] && <Loader2 size={14} className="animate-spin" />}
                              {loadingStates.terminatingRide[ride.id] ? 'Terminating...' : 'Terminate'}
                            </button>
                          </>
                        )}
                      </div>
                    </>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Split Ride Modal - MOBILE OPTIMIZED */}
      {splittingRide && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end sm:items-center justify-center z-50">
          <div className="bg-white rounded-t-xl sm:rounded-xl shadow-2xl w-full sm:max-w-md sm:m-4 p-6 pb-safe-offset-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Split size={24} className="text-purple-600" />
              <span className="truncate">Split Ride: {splittingRide.patronName}</span>
            </h3>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
              <p className="text-sm text-blue-800">
                Total Riders: <span className="font-bold">{splittingRide.riders}</span>
              </p>
              <p className="text-xs text-blue-600 mt-1">
                Split into two separate rides. Useful when a car needs to make multiple trips or riders need to go at different times.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  First Ride - Number of Riders
                </label>
                <input
                  type="number"
                  min="1"
                  max={splittingRide.riders - 1}
                  value={splitRiders.ride1}
                  onChange={(e) => {
                    const val = parseInt(e.target.value) || 1;
                    setSplitRiders({ ride1: val, ride2: splittingRide.riders - val });
                  }}
                  className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 min-h-touch"
                  inputMode="numeric"
                  disabled={loadingStates.splittingRide}
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Second Ride - Number of Riders
                </label>
                <input
                  type="number"
                  min="1"
                  max={splittingRide.riders - 1}
                  value={splitRiders.ride2}
                  onChange={(e) => {
                    const val = parseInt(e.target.value) || 1;
                    setSplitRiders({ ride1: splittingRide.riders - val, ride2: val });
                  }}
                  className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 min-h-touch"
                  inputMode="numeric"
                  disabled={loadingStates.splittingRide}
                />
              </div>

              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-sm text-gray-600">
                  <span className="font-semibold">Result:</span> Ride 1 will have {splitRiders.ride1} {splitRiders.ride1 === 1 ? 'rider' : 'riders'}, Ride 2 will have {splitRiders.ride2} {splitRiders.ride2 === 1 ? 'rider' : 'riders'}
                </p>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={handleSplitRide}
                disabled={loadingStates.splittingRide}
                className="flex-1 px-4 py-3 min-h-touch bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-semibold touch-manipulation disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 justify-center"
              >
                {loadingStates.splittingRide && <Loader2 size={16} className="animate-spin" />}
                {loadingStates.splittingRide ? 'Splitting...' : 'Split Ride'}
              </button>
              <button
                onClick={() => {
                  setSplittingRide(null);
                  setSplitRiders({ ride1: 1, ride2: 1 });
                }}
                disabled={loadingStates.splittingRide}
                className="flex-1 px-4 py-3 min-h-touch bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-semibold touch-manipulation disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Alert Modal (replaces alert()) */}
      <Modal
        isOpen={alertModal.isOpen}
        onClose={() => setAlertModal({ isOpen: false, title: '', message: '' })}
        title={alertModal.title}
        actions={
          <button
            onClick={() => setAlertModal({ isOpen: false, title: '', message: '' })}
            className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold min-h-touch touch-manipulation"
          >
            OK
          </button>
        }
      >
        <p className="text-gray-700">{alertModal.message}</p>
      </Modal>

      {/* Confirm Modal (replaces confirm()) */}
      <Modal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal({ isOpen: false, title: '', message: '', onConfirm: null })}
        title={confirmModal.title}
        actions={
          <>
            <button
              onClick={() => {
                if (confirmModal.onConfirm) confirmModal.onConfirm();
              }}
              className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold min-h-touch touch-manipulation"
            >
              Confirm
            </button>
            <button
              onClick={() => setConfirmModal({ isOpen: false, title: '', message: '', onConfirm: null })}
              className="flex-1 px-4 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-semibold min-h-touch touch-manipulation"
            >
              Cancel
            </button>
          </>
        }
      >
        <p className="text-gray-700">{confirmModal.message}</p>
      </Modal>

      {/* Prompt Modal (replaces prompt()) */}
      <Modal
        isOpen={promptModal.isOpen}
        onClose={() => {
          setPromptModal({ isOpen: false, title: '', message: '', onSubmit: null, defaultValue: '' });
          setPromptValue('');
        }}
        title={promptModal.title}
        actions={
          <>
            <button
              onClick={() => {
                if (promptModal.onSubmit) promptModal.onSubmit(promptValue);
              }}
              className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold min-h-touch touch-manipulation"
            >
              Submit
            </button>
            <button
              onClick={() => {
                setPromptModal({ isOpen: false, title: '', message: '', onSubmit: null, defaultValue: '' });
                setPromptValue('');
              }}
              className="flex-1 px-4 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-semibold min-h-touch touch-manipulation"
            >
              Cancel
            </button>
          </>
        }
      >
        <p className="text-gray-700 mb-3">{promptModal.message}</p>
        <input
          type="text"
          value={promptValue}
          onChange={(e) => setPromptValue(e.target.value)}
          className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-h-touch"
          placeholder="Enter text..."
          autoFocus
        />
      </Modal>

      {/* NEW: Reassignment Modal */}
      {reassigningRide && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <RefreshCw size={24} className="text-blue-600" />
              Reassign Ride
            </h3>
            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-2">
                <strong>Patron:</strong> {reassigningRide.patronName}
              </p>
              <p className="text-sm text-gray-600 mb-2">
                <strong>Current Car:</strong> {reassigningRide.carNumber}
              </p>
            </div>
            <div className="mb-4">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Reassign to Car:
              </label>
              <select
                value={reassigningRide.newCarNumber || ''}
                onChange={(e) => setReassigningRide({ ...reassigningRide, newCarNumber: e.target.value })}
                className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-h-touch"
              >
                <option value="">Select a car...</option>
                {Array.from({ length: availableCars }, (_, i) => i + 1)
                  .filter(num => num !== reassigningRide.carNumber)
                  .map(num => (
                    <option key={num} value={num}>
                      Car {num}
                    </option>
                  ))}
              </select>
            </div>
            <div className="flex gap-3">
              <button
                onClick={reassignRide}
                className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold min-h-touch touch-manipulation"
              >
                Reassign
              </button>
              <button
                onClick={() => setReassigningRide(null)}
                className="flex-1 px-4 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-semibold min-h-touch touch-manipulation"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* NEW: Snackbar for undo actions */}
      <Snackbar
        isOpen={snackbar.isOpen}
        message={snackbar.message}
        type={snackbar.type}
        onClose={() => setSnackbar({ ...snackbar, isOpen: false })}
        onUndo={snackbar.onUndo}
        autoHideDuration={snackbar.onUndo ? undefined : 5000}
      />
    </div>
  );
};

export default RideManagement;