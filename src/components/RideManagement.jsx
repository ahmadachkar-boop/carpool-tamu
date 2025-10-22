import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, updateDoc, doc, getDoc, addDoc, Timestamp, getDocs } from 'firebase/firestore';
import { useActiveNDR } from '../ActiveNDRContext';
import { Car, AlertCircle, MapPin, Phone, Users, Clock, Edit2, Check, X, Split, AlertTriangle, Navigation } from 'lucide-react';
import { useGoogleMaps } from '../GoogleMapsProvider';

// Helper function to normalize and check gender
const normalizeGender = (gender) => {
  if (!gender) return null;
  const normalized = gender.toLowerCase().trim();
  if (['male', 'm', 'man'].includes(normalized)) return 'male';
  if (['female', 'f', 'woman'].includes(normalized)) return 'female';
  return null;
};

const isMale = (member) => normalizeGender(member?.gender) === 'male';
const isFemale = (member) => normalizeGender(member?.gender) === 'female';

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
  
  // NEW: ETA tracking for pending rides
  const [rideETAs, setRideETAs] = useState({}); // { rideId: { minutes, fastestCar, calculating } }

  // NEW: Calculate ETAs for pending rides using real routing
  useEffect(() => {
    if (!activeNDR || !googleMapsLoaded || !window.google || rides.pending.length === 0) {
      return;
    }

    const calculateAllETAs = async () => {
      const newETAs = {};
      const directionsService = new window.google.maps.DirectionsService();

      for (const ride of rides.pending) {
        // Mark as calculating
        setRideETAs(prev => ({
          ...prev,
          [ride.id]: { ...prev[ride.id], calculating: true }
        }));

        try {
          // Calculate availability for each car
          const carAvailability = [];

          for (let carNum = 1; carNum <= availableCars; carNum++) {
            const activeRide = rides.active.find(r => r.carNumber === carNum);
            const location = carLocations[carNum];

            if (!activeRide) {
              // Car is free
              if (location && location.latitude && location.longitude) {
                try {
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

                  const durationInTraffic = result.routes[0].legs[0].duration_in_traffic || result.routes[0].legs[0].duration;
                  const minutesToPickup = Math.ceil(durationInTraffic.value / 60);
                  
                  carAvailability.push({
                    carNumber: carNum,
                    availableInMinutes: minutesToPickup
                  });
                } catch (error) {
                  carAvailability.push({
                    carNumber: carNum,
                    availableInMinutes: 10
                  });
                }
              } else {
                carAvailability.push({
                  carNumber: carNum,
                  availableInMinutes: 10
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

                const bufferMinutes = (waypoints.length + 1) * 2;
                const currentRouteMinutes = Math.ceil(totalCurrentRouteTime / 60) + bufferMinutes;

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
                  availableInMinutes: 30
                });
              }
            }
          }

          if (carAvailability.length > 0) {
            carAvailability.sort((a, b) => a.availableInMinutes - b.availableInMinutes);
            const fastest = carAvailability[0];
            
            newETAs[ride.id] = {
              minutes: fastest.availableInMinutes,
              fastestCar: fastest.carNumber,
              calculating: false,
              timestamp: Date.now()
            };
          }
        } catch (error) {
          console.error(`Error calculating ETA for ride ${ride.id}:`, error);
          newETAs[ride.id] = {
            minutes: null,
            fastestCar: null,
            calculating: false,
            error: true
          };
        }
      }

      setRideETAs(prev => ({ ...prev, ...newETAs }));
    };

    // Calculate ETAs with a debounce
    const timer = setTimeout(calculateAllETAs, 2000);
    return () => clearTimeout(timer);
  }, [rides.pending, rides.active, carLocations, availableCars, googleMapsLoaded, activeNDR]);

  // NEW: Update current time every second for timer displays
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

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
        console.error('Error in pending query:', error);
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
        console.error('Error in active query:', error);
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
        console.error('Error in completed query:', error);
      }
    );

    return () => {
      if (unsubPending) unsubPending();
      if (unsubActive) unsubActive();
      if (unsubCompleted) unsubCompleted();
    };
  }, [activeNDR]);

  // NEW: Calculate wait time in minutes
  const calculateWaitTime = (requestedAt) => {
    if (!requestedAt) return 0;
    const diffMs = currentTime - requestedAt;
    return Math.floor(diffMs / (1000 * 60));
  };

  // NEW: Format wait time display
  const formatWaitTime = (minutes) => {
    if (minutes < 1) return '<1 min';
    if (minutes === 1) return '1 min';
    return `${minutes} mins`;
  };

  // NEW: Determine if wait time is concerning
  const isLongWait = (minutes) => minutes >= 15;

  const openAssignCar = async (ride) => {
    setAssigningRide({ ...ride, selectedCar: '' });
    setCheckingEligibility(true);

    // If single rider, check which cars are eligible
    if (ride.riders === 1) {
      try {
        const ndrDoc = await getDoc(doc(db, 'ndrs', activeNDR.id));
        const ndrData = ndrDoc.data();
        const carEligibility = {};

        // Check each car
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

          // Fetch car member details to check genders
          const carMembers = [];
          for (const memberId of carAssignments) {
            const memberDoc = await getDoc(doc(db, 'members', memberId));
            if (memberDoc.exists()) {
              carMembers.push(memberDoc.data());
            }
          }

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
        console.error('Error checking car eligibility:', error);
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
      alert('Please select a car number');
      return;
    }

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
          alert(`Car ${carNumber} must have at least 2 members assigned before accepting single rider rides. Please assign more members to Car ${carNumber} in the NDR assignments.`);
          return;
        }

        // Fetch car member details to check genders
        const membersRef = collection(db, 'members');
        const carMembers = [];
        for (const memberId of carAssignments) {
          const memberDoc = await getDoc(doc(db, 'members', memberId));
          if (memberDoc.exists()) {
            carMembers.push(memberDoc.data());
          }
        }

        const hasMale = carMembers.some(m => isMale(m));
        const hasFemale = carMembers.some(m => isFemale(m));

        if (!hasMale || !hasFemale) {
          alert(`Car ${carNumber} must have both male and female members assigned before accepting single rider rides. Please update Car ${carNumber} assignments in the NDR or select a different car.`);
          return;
        }
      }

      await updateDoc(doc(db, 'rides', assigningRide.id), {
        status: 'active',
        carNumber: carNumber,
        assignedDriver: carInfo ? `${carInfo.driverName}` : 'Unknown Driver',
        carInfo: carInfo || null,
        assignedAt: Timestamp.now()
      });

      setAssigningRide(null);
    } catch (error) {
      console.error('Error assigning car:', error);
      alert('Error assigning car: ' + error.message);
    }
  };

  const startRide = async (rideId) => {
    if (window.confirm('Mark patron as picked up?')) {
      try {
        await updateDoc(doc(db, 'rides', rideId), {
          pickedUpAt: Timestamp.now()
        });
      } catch (error) {
        console.error('Error starting ride:', error);
        alert('Error starting ride: ' + error.message);
      }
    }
  };

  const completeRide = async (rideId) => {
    if (window.confirm('Mark ride as completed?')) {
      try {
        await updateDoc(doc(db, 'rides', rideId), {
          status: 'completed',
          completedAt: Timestamp.now()
        });
      } catch (error) {
        console.error('Error completing ride:', error);
        alert('Error completing ride: ' + error.message);
      }
    }
  };

  const cancelRide = async (rideId) => {
    const reason = prompt('Reason for cancellation:');
    if (reason !== null) {
      try {
        await updateDoc(doc(db, 'rides', rideId), {
          status: 'cancelled',
          completedAt: Timestamp.now(),
          cancellationReason: reason || 'No reason provided'
        });
      } catch (error) {
        console.error('Error cancelling ride:', error);
        alert('Error cancelling ride: ' + error.message);
      }
    }
  };

  const terminateRide = async (rideId) => {
    const reason = prompt('Reason for termination (e.g., patron no-show, unsafe situation):');
    if (reason !== null) {
      try {
        await updateDoc(doc(db, 'rides', rideId), {
          status: 'terminated',
          completedAt: Timestamp.now(),
          terminationReason: reason || 'No reason provided'
        });
      } catch (error) {
        console.error('Error terminating ride:', error);
        alert('Error terminating ride: ' + error.message);
      }
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
    
    try {
      await updateDoc(doc(db, 'rides', editingRide.id), {
        patronName: editingRide.patronName,
        phone: editingRide.phone,
        pickup: editingRide.pickup,
        dropoffs: editingRide.dropoffs,
        riders: editingRide.riders
      });
      setEditingRide(null);
    } catch (error) {
      console.error('Error updating ride:', error);
      alert('Error updating ride: ' + error.message);
    }
  };

  const openSplitRide = (ride) => {
    if (ride.riders < 2) {
      alert('Cannot split a ride with less than 2 riders');
      return;
    }
    setSplittingRide(ride);
    setSplitRiders({ ride1: 1, ride2: ride.riders - 1 });
  };

  const handleSplitRide = async () => {
    if (!splittingRide) return;

    const totalRiders = splitRiders.ride1 + splitRiders.ride2;
    if (totalRiders !== splittingRide.riders) {
      alert(`Split must equal total riders (${splittingRide.riders})`);
      return;
    }

    if (splitRiders.ride1 < 1 || splitRiders.ride2 < 1) {
      alert('Each ride must have at least 1 rider');
      return;
    }

    try {
      await updateDoc(doc(db, 'rides', splittingRide.id), {
        riders: splitRiders.ride1
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
        splitFrom: splittingRide.id
      });

      alert('Ride split successfully!');
      setSplittingRide(null);
      setSplitRiders({ ride1: 1, ride2: 1 });
    } catch (error) {
      console.error('Error splitting ride:', error);
      alert('Error splitting ride: ' + error.message);
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
      alert('Ride must have at least one dropoff location');
      return;
    }
    const newDropoffs = editingRide.dropoffs.filter((_, i) => i !== index);
    setEditingRide({ ...editingRide, dropoffs: newDropoffs });
  };

  const formatTime = (date) => {
    if (!date) return '';
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  };

  const formatDateTime = (date) => {
    if (!date) return '';
    return date.toLocaleString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      hour: 'numeric', 
      minute: '2-digit' 
    });
  };

  const getStatusBadge = (status) => {
    const badges = {
      completed: 'bg-green-100 text-green-800',
      cancelled: 'bg-red-100 text-red-800',
      terminated: 'bg-orange-100 text-orange-800'
    };
    return badges[status] || 'bg-gray-100 text-gray-800';
  };

  // NEW: Get car status color
  const getCarStatusColor = (status) => {
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
  };

  // NEW: Get car status label
  const getCarStatusLabel = (status) => {
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
  };

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
                <div key={carNum} className="border-2 border-gray-200 rounded-xl p-4 hover:shadow-md transition">
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
            className={`flex-1 px-6 py-4 text-center transition ${activeTab === 'pending' ? 'border-b-2 border-blue-600 text-blue-600 font-medium' : 'text-gray-600'}`}
          >
            Pending ({rides.pending.length})
          </button>
          <button
            onClick={() => setActiveTab('active')}
            className={`flex-1 px-6 py-4 text-center transition ${activeTab === 'active' ? 'border-b-2 border-purple-600 text-purple-600 font-medium' : 'text-gray-600'}`}
          >
            Active ({rides.active.length})
          </button>
          <button
            onClick={() => setActiveTab('completed')}
            className={`flex-1 px-6 py-4 text-center transition ${activeTab === 'completed' ? 'border-b-2 border-green-600 text-green-600 font-medium' : 'text-gray-600'}`}
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
                        className="w-full px-3 py-2 border rounded"
                        placeholder="Name"
                      />
                      <input
                        type="tel"
                        value={editingRide.phone}
                        onChange={(e) => setEditingRide({...editingRide, phone: e.target.value})}
                        className="w-full px-3 py-2 border rounded"
                        placeholder="Phone"
                      />
                      <input
                        type="text"
                        value={editingRide.pickup}
                        onChange={(e) => setEditingRide({...editingRide, pickup: e.target.value})}
                        className="w-full px-3 py-2 border rounded"
                        placeholder="Pickup"
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
                              className="flex-1 px-3 py-2 border rounded"
                              placeholder={`Dropoff ${dropoffIndex + 1}`}
                            />
                            {editingRide.dropoffs.length > 1 && (
                              <button
                                onClick={() => removeDropoffFromEdit(dropoffIndex)}
                                className="px-3 py-2 bg-red-100 text-red-700 rounded hover:bg-red-200"
                              >
                                <X size={16} />
                              </button>
                            )}
                          </div>
                        ))}
                        <button
                          onClick={addDropoffToEdit}
                          className="mt-2 px-3 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 text-sm"
                        >
                          + Add Dropoff
                        </button>
                      </div>

                      <input
                        type="number"
                        value={editingRide.riders}
                        onChange={(e) => setEditingRide({...editingRide, riders: parseInt(e.target.value)})}
                        className="w-full px-3 py-2 border rounded"
                        placeholder="Riders"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={saveEdit}
                          className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingRide(null)}
                          className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
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
                          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                        >
                          Assign
                        </button>
                        <button
                          onClick={() => setAssigningRide(null)}
                          className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
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
                            
                            {/* ETA to pickup */}
                            {rideETAs[ride.id] && (
                              <div className={`flex items-center gap-2 px-3 py-1 rounded-full ${
                                rideETAs[ride.id].calculating 
                                  ? 'bg-gray-100 text-gray-600'
                                  : 'bg-green-100 text-green-800'
                              }`}>
                                <Navigation size={16} />
                                {rideETAs[ride.id].calculating ? (
                                  <span className="text-xs font-bold">Calculating ETA...</span>
                                ) : rideETAs[ride.id].error ? (
                                  <span className="text-xs font-bold">ETA unavailable</span>
                                ) : (
                                  <>
                                    <span className="text-xs font-bold">
                                      ETA: ~{rideETAs[ride.id].minutes} min
                                    </span>
                                    <span className="text-[10px] bg-green-200 px-1.5 py-0.5 rounded">
                                      Car {rideETAs[ride.id].fastestCar}
                                    </span>
                                  </>
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
                              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
                            >
                              Assign Car
                            </button>
                            <button
                              onClick={() => openSplitRide(ride)}
                              className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 text-sm flex items-center gap-1"
                            >
                              <Split size={16} />
                              Split
                            </button>
                            <button
                              onClick={() => startEdit(ride)}
                              className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 text-sm"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => cancelRide(ride.id)}
                              className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 text-sm"
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
                                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 text-sm"
                              >
                                Mark Picked Up
                              </button>
                            )}
                            <button
                              onClick={() => completeRide(ride.id)}
                              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
                            >
                              Complete
                            </button>
                            <button
                              onClick={() => startEdit(ride)}
                              className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 text-sm"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => cancelRide(ride.id)}
                              className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 text-sm"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={() => terminateRide(ride.id)}
                              className="px-4 py-2 bg-orange-500 text-white rounded hover:bg-orange-600 text-sm"
                            >
                              Terminate
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

      {/* Split Ride Modal */}
      {splittingRide && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Split size={24} className="text-purple-600" />
              Split Ride: {splittingRide.patronName}
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
                  className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
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
                  className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
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
                className="flex-1 px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-semibold"
              >
                Split Ride
              </button>
              <button
                onClick={() => {
                  setSplittingRide(null);
                  setSplitRiders({ ride1: 1, ride2: 1 });
                }}
                className="flex-1 px-4 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-semibold"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RideManagement;