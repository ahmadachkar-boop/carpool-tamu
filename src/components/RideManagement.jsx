import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, onSnapshot, updateDoc, doc, where, Timestamp } from 'firebase/firestore';
import { Clock, AlertCircle, Car } from 'lucide-react';
import { useActiveNDR } from '../ActiveNDRContext';

const RideManagement = () => {
  const [activeTab, setActiveTab] = useState('pending');
  const [rides, setRides] = useState({
    pending: [],
    active: [],
    completed: []
  });
  const [editingRide, setEditingRide] = useState(null);
  const [assigningRide, setAssigningRide] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());
  const { activeNDR, loading: ndrLoading } = useActiveNDR();

  const availableCars = activeNDR?.availableCars || 0;

  // Update current time every 30 seconds to refresh live timers
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 30000);

    return () => clearInterval(timer);
  }, []);

  // Setup ride listeners
  useEffect(() => {
    if (!activeNDR) {
      setLoading(false);
      return;
    }

    let unsubPending, unsubActive, unsubCompleted;
    
    const ridesRef = collection(db, 'rides');

    // Pending rides listener
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

    // Active rides listener
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

    // Completed rides listener
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

  // Calculate time durations
  const calculateWaitTime = (requestedAt, assignedAt) => {
    if (!requestedAt || !assignedAt) return null;
    const diff = Math.floor((assignedAt - requestedAt) / 1000 / 60);
    return diff;
  };

  const calculateRideTime = (pickedUpAt, completedAt) => {
    if (!pickedUpAt || !completedAt) return null;
    const diff = Math.floor((completedAt - pickedUpAt) / 1000 / 60);
    return diff;
  };

  const calculateTotalTime = (requestedAt, completedAt) => {
    if (!requestedAt || !completedAt) return null;
    const diff = Math.floor((completedAt - requestedAt) / 1000 / 60);
    return diff;
  };

  const getCurrentWaitTime = (requestedAt) => {
    if (!requestedAt) return 0;
    const diff = Math.floor((currentTime - requestedAt) / 1000 / 60);
    return diff;
  };

  const getCurrentRideTime = (pickedUpAt) => {
    if (!pickedUpAt) return 0;
    const diff = Math.floor((currentTime - pickedUpAt) / 1000 / 60);
    return diff;
  };

  const formatDuration = (minutes) => {
    if (minutes === null || minutes === undefined) return 'N/A';
    if (minutes < 1) return '< 1m';
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  const getWaitTimeColor = (minutes) => {
    if (minutes < 5) return 'text-green-600';
    if (minutes < 10) return 'text-yellow-600';
    if (minutes < 15) return 'text-orange-600';
    return 'text-red-600';
  };

  const openAssignCar = (ride) => {
    if (availableCars === 0) {
      alert('No cars are available for this event. Please update the car count in NDR Assignments.');
      return;
    }
    setAssigningRide(ride);
  };

  const assignCar = async (rideId, carNumber) => {
    try {
      await updateDoc(doc(db, 'rides', rideId), {
        carNumber: carNumber,
        status: 'active',
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
    setEditingRide({...ride});
  };

  const saveEdit = async () => {
    if (!editingRide) return;
    
    try {
      await updateDoc(doc(db, 'rides', editingRide.id), {
        patronName: editingRide.patronName,
        phone: editingRide.phone,
        pickup: editingRide.pickup,
        dropoff: editingRide.dropoff,
        riders: editingRide.riders
      });
      setEditingRide(null);
    } catch (error) {
      console.error('Error updating ride:', error);
      alert('Error updating ride: ' + error.message);
    }
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

  // Show loading while checking for NDR
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

  // Show gate if no active NDR
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

  // Show loading while fetching rides
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

  // Main ride management interface
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

      {availableCars === 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-yellow-800 font-medium">
            ⚠️ No cars are set as available for this event. Directors should update the car count in NDR Assignments.
          </p>
        </div>
      )}
      
      <div className="bg-white rounded-lg shadow">
        <div className="flex border-b">
          <button
            onClick={() => setActiveTab('pending')}
            className={`flex-1 py-3 px-4 text-center ${activeTab === 'pending' ? 'border-b-2 border-red-600 text-red-600 font-medium' : 'text-gray-600'}`}
          >
            Pending ({rides.pending.length})
          </button>
          <button
            onClick={() => setActiveTab('active')}
            className={`flex-1 py-3 px-4 text-center ${activeTab === 'active' ? 'border-b-2 border-blue-600 text-blue-600 font-medium' : 'text-gray-600'}`}
          >
            Active ({rides.active.length})
          </button>
          <button
            onClick={() => setActiveTab('completed')}
            className={`flex-1 py-3 px-4 text-center ${activeTab === 'completed' ? 'border-b-2 border-green-600 text-green-600 font-medium' : 'text-gray-600'}`}
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
            rides[activeTab].map(ride => (
              <div key={ride.id} className="mb-4 p-4 border border-gray-200 rounded-lg">
                {editingRide?.id === ride.id ? (
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
                    <input
                      type="text"
                      value={editingRide.dropoff}
                      onChange={(e) => setEditingRide({...editingRide, dropoff: e.target.value})}
                      className="w-full px-3 py-2 border rounded"
                      placeholder="Dropoff"
                    />
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
                  <div className="space-y-3">
                    <h4 className="font-semibold text-lg mb-2">Assign Car to {ride.patronName}</h4>
                    <p className="text-sm text-gray-600 mb-3">Select which car will handle this ride:</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
                      {Array.from({ length: availableCars }, (_, i) => i + 1).map(carNum => (
                        <button
                          key={carNum}
                          onClick={() => assignCar(ride.id, carNum)}
                          className="px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold text-lg transition"
                        >
                          Car {carNum}
                        </button>
                      ))}
                    </div>
                    <button
                      onClick={() => setAssigningRide(null)}
                      className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400 mt-2"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h4 className="font-semibold text-lg">{ride.patronName}</h4>
                        <p className="text-gray-600 text-sm">{ride.phone}</p>
                        <p className="text-gray-500 text-xs">Requested: {formatTime(ride.requestedAt)}</p>
                      </div>
                      <div className="text-right">
                        <span className="px-3 py-1 bg-gray-100 rounded-full text-sm block mb-1">
                          {ride.riders} {ride.riders === 1 ? 'rider' : 'riders'}
                        </span>
                        {activeTab === 'completed' && (
                          <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusBadge(ride.status)}`}>
                            {ride.status.toUpperCase()}
                          </span>
                        )}
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-3">
                      <div>
                        <p className="text-xs text-gray-500">Pickup</p>
                        <p className="text-sm font-medium">{ride.pickup}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Dropoff</p>
                        <p className="text-sm font-medium">{ride.dropoff}</p>
                      </div>
                    </div>

                    {/* PENDING TAB - Show live wait time with pulsing animation */}
                    {activeTab === 'pending' && (
                      <div className="bg-yellow-50 border-l-4 border-yellow-400 p-3 rounded mb-3">
                        <div className="flex items-center gap-2">
                          <Clock className="text-yellow-600 animate-pulse" size={20} />
                          <p className={`text-lg font-semibold ${getWaitTimeColor(getCurrentWaitTime(ride.requestedAt))}`}>
                            Waiting: {formatDuration(getCurrentWaitTime(ride.requestedAt))}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* ACTIVE TAB - Show car, wait time, and live ride time */}
                    {activeTab === 'active' && (
                      <div className="bg-blue-50 border-l-4 border-blue-400 p-3 rounded mb-3 space-y-2">
                        {ride.carNumber && (
                          <p className="text-sm">
                            <span className="font-semibold">Car:</span> #{ride.carNumber}
                          </p>
                        )}
                        {ride.assignedAt && (
                          <p className="text-sm">
                            <span className="font-semibold">Assigned:</span> {formatTime(ride.assignedAt)} 
                            <span className="text-gray-600"> (waited {formatDuration(calculateWaitTime(ride.requestedAt, ride.assignedAt))})</span>
                          </p>
                        )}
                        {ride.pickedUpAt ? (
                          <div className="flex items-center gap-2">
                            <Clock className="text-blue-600 animate-pulse" size={18} />
                            <p className="text-sm font-semibold text-blue-700">
                              In car: {formatDuration(getCurrentRideTime(ride.pickedUpAt))}
                            </p>
                            <span className="text-xs text-gray-600">(picked up at {formatTime(ride.pickedUpAt)})</span>
                          </div>
                        ) : (
                          <p className="text-sm text-orange-600 font-medium">
                            ⚠️ En route to pickup location
                          </p>
                        )}
                      </div>
                    )}

                    {/* COMPLETED TAB - Show all statistics */}
                    {activeTab === 'completed' && (
                      <div className="bg-gray-50 p-3 rounded mb-3 space-y-2">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                          <div>
                            <p className="text-xs text-gray-500">Call Time</p>
                            <p className="font-medium">{formatTime(ride.requestedAt)}</p>
                          </div>
                          {ride.assignedAt && (
                            <div>
                              <p className="text-xs text-gray-500">Wait Time</p>
                              <p className="font-medium">{formatDuration(calculateWaitTime(ride.requestedAt, ride.assignedAt))}</p>
                            </div>
                          )}
                          {ride.pickedUpAt && ride.completedAt && (
                            <div>
                              <p className="text-xs text-gray-500">Ride Time</p>
                              <p className="font-medium">{formatDuration(calculateRideTime(ride.pickedUpAt, ride.completedAt))}</p>
                            </div>
                          )}
                          {ride.completedAt && (
                            <div>
                              <p className="text-xs text-gray-500">Total Time</p>
                              <p className="font-medium">{formatDuration(calculateTotalTime(ride.requestedAt, ride.completedAt))}</p>
                            </div>
                          )}
                        </div>
                        {ride.carNumber && (
                          <p className="text-sm">
                            <span className="font-semibold">Car:</span> #{ride.carNumber}
                          </p>
                        )}
                        <p className="text-xs text-gray-500">
                          Completed: {formatDateTime(ride.completedAt)}
                        </p>
                        {ride.cancellationReason && (
                          <p className="text-sm text-red-600">
                            <span className="font-semibold">Cancelled:</span> {ride.cancellationReason}
                          </p>
                        )}
                        {ride.terminationReason && (
                          <p className="text-sm text-orange-600">
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
                              className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 text-sm"
                            >
                              Mark Picked Up
                            </button>
                          )}
                          <button
                            onClick={() => completeRide(ride.id)}
                            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 text-sm"
                          >
                            Complete Ride
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
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default RideManagement;