import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, updateDoc, doc, getDoc, addDoc, Timestamp } from 'firebase/firestore';
import { useActiveNDR } from '../ActiveNDRContext';
import { Car, AlertCircle, MapPin, Phone, Users, Clock, Edit2, Check, X, Split } from 'lucide-react';

const RideManagement = () => {
  const { activeNDR, loading: ndrLoading } = useActiveNDR();
  const [rides, setRides] = useState({ pending: [], active: [], completed: [] });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('pending');
  const [availableCars, setAvailableCars] = useState(0);
  const [editingRide, setEditingRide] = useState(null);
  const [assigningRide, setAssigningRide] = useState(null);
  const [splittingRide, setSplittingRide] = useState(null);
  const [splitRiders, setSplitRiders] = useState({ ride1: 1, ride2: 1 });

  useEffect(() => {
    if (!activeNDR) return;
    setAvailableCars(activeNDR.availableCars || 0);
  }, [activeNDR]);

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

  const openAssignCar = (ride) => {
    setAssigningRide({ ...ride, selectedCar: '' });
  };

  const assignCar = async () => {
    if (!assigningRide || !assigningRide.selectedCar) {
      alert('Please select a car number');
      return;
    }

    try {
      const carNumber = parseInt(assigningRide.selectedCar);
      const ndrDoc = await getDoc(doc(db, 'ndrs', activeNDR.id));
      const cars = ndrDoc.data().cars || [];
      const carInfo = cars.find(c => c.carNumber === carNumber);

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
      dropoffs: ride.dropoffs || [ride.dropoff] // Handle legacy single dropoff
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
      // Update original ride with first group of riders
      await updateDoc(doc(db, 'rides', splittingRide.id), {
        riders: splitRiders.ride1,
        splitFrom: splittingRide.id,
        splitNote: `Split into 2 rides: ${splitRiders.ride1} + ${splitRiders.ride2} riders`
      });

      // Create new ride with second group of riders
      const newRideData = {
        patronName: splittingRide.patronName,
        phone: splittingRide.phone,
        pickup: splittingRide.pickup,
        dropoffs: splittingRide.dropoffs || [splittingRide.dropoff],
        riders: splitRiders.ride2,
        status: splittingRide.status,
        carNumber: null,
        assignedDriver: null,
        requestedAt: Timestamp.now(),
        completedAt: null,
        willingToCombine: false,
        carInfo: null,
        requestType: 'split',
        ndrId: activeNDR.id,
        eventId: activeNDR.eventId,
        pickupCoordinates: splittingRide.pickupCoordinates || null,
        dropoffCoordinates: splittingRide.dropoffCoordinates || null,
        splitFrom: splittingRide.id,
        splitNote: `Split from original ride: ${splitRiders.ride1} + ${splitRiders.ride2} riders`
      };

      await addDoc(collection(db, 'rides'), newRideData);

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
            rides[activeTab].map(ride => (
              <div key={ride.id} className="mb-4 p-4 border border-gray-200 rounded-lg">
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
                      {editingRide.dropoffs.map((dropoff, index) => (
                        <div key={index} className="flex gap-2 mb-2">
                          <input
                            type="text"
                            value={dropoff}
                            onChange={(e) => updateDropoff(index, e.target.value)}
                            className="flex-1 px-3 py-2 border rounded"
                            placeholder={`Dropoff ${index + 1}`}
                          />
                          {editingRide.dropoffs.length > 1 && (
                            <button
                              onClick={() => removeDropoffFromEdit(index)}
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
                    <select
                      value={assigningRide.selectedCar}
                      onChange={(e) => setAssigningRide({...assigningRide, selectedCar: e.target.value})}
                      className="w-full px-3 py-2 border rounded"
                    >
                      <option value="">Select a car...</option>
                      {Array.from({ length: availableCars }, (_, i) => i + 1).map(num => (
                        <option key={num} value={num}>Car {num}</option>
                      ))}
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
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h3 className="text-lg font-bold text-gray-900">{ride.patronName}</h3>
                        <p className="text-sm text-gray-600 flex items-center gap-1">
                          <Phone size={14} />
                          {ride.phone}
                        </p>
                        <p className="text-sm text-gray-600 flex items-center gap-1">
                          <Users size={14} />
                          {ride.riders} {ride.riders === 1 ? 'Rider' : 'Riders'}
                        </p>
                        {ride.splitNote && (
                          <p className="text-xs text-purple-600 mt-1 flex items-center gap-1">
                            <Split size={12} />
                            {ride.splitNote}
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-gray-500 flex items-center gap-1 justify-end">
                          <Clock size={12} />
                          {formatTime(ride.requestedAt)}
                        </p>
                        {ride.carNumber && (
                          <p className="text-sm font-semibold text-blue-600 mt-1">
                            Car {ride.carNumber}
                          </p>
                        )}
                        {ride.assignedDriver && (
                          <p className="text-xs text-gray-600">
                            {ride.assignedDriver}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="bg-gray-50 rounded p-3 mb-3 space-y-2">
                      <p className="text-sm flex items-start gap-2">
                        <MapPin size={16} className="text-green-600 mt-0.5 flex-shrink-0" />
                        <span><span className="font-semibold">Pickup:</span> {ride.pickup}</span>
                      </p>
                      {(ride.dropoffs || [ride.dropoff]).map((dropoff, index) => (
                        <p key={index} className="text-sm flex items-start gap-2">
                          <MapPin size={16} className="text-red-600 mt-0.5 flex-shrink-0" />
                          <span>
                            <span className="font-semibold">
                              Dropoff {(ride.dropoffs || [ride.dropoff]).length > 1 ? `${index + 1}` : ''}:
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
                            Split Riders
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
                            onClick={() => openSplitRide(ride)}
                            className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 text-sm flex items-center gap-1"
                          >
                            <Split size={16} />
                            Split Riders
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