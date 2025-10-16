import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, onSnapshot, doc, getDoc, updateDoc, addDoc, where, orderBy, Timestamp } from 'firebase/firestore';
import { useAuth } from '../AuthContext';
import { Play, Printer, FileText, Users, Car, ClipboardList } from 'lucide-react';

const NDRReports = () => {
  const [ndrs, setNdrs] = useState([]);
  const [selectedNdr, setSelectedNdr] = useState(null);
  const [activeTab, setActiveTab] = useState('home');
  const [loading, setLoading] = useState(true);
  const { userProfile } = useAuth();

  useEffect(() => {
    const ndrsRef = collection(db, 'ndrs');
    const ndrsQuery = query(ndrsRef, orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(ndrsQuery, (snapshot) => {
      const ndrsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate(),
        activatedAt: doc.data().activatedAt?.toDate(),
        endedAt: doc.data().endedAt?.toDate()
      }));
      setNdrs(ndrsData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const activateNDR = async (ndrId) => {
    if (window.confirm('Activate this NDR? This will enable Phone Room and Ride Management.')) {
      try {
        await updateDoc(doc(db, 'ndrs', ndrId), {
          status: 'active',
          activatedAt: Timestamp.now(),
          activatedBy: userProfile.id
        });
        alert('NDR activated! Phone Room and Ride Management are now accessible.');
      } catch (error) {
        console.error('Error activating NDR:', error);
        alert('Error activating NDR: ' + error.message);
      }
    }
  };

  const endNDR = async (ndrId) => {
    if (window.confirm('End this NDR? This will disable Phone Room and Ride Management.')) {
      try {
        await updateDoc(doc(db, 'ndrs', ndrId), {
          status: 'completed',
          endedAt: Timestamp.now()
        });
        alert('NDR ended. Phone Room and Ride Management are now disabled.');
      } catch (error) {
        console.error('Error ending NDR:', error);
        alert('Error ending NDR: ' + error.message);
      }
    }
  };

  const formatDateTime = (date) => {
    if (!date) return '';
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-gray-800">NDR Reports</h2>
        <div className="bg-white p-12 rounded-lg shadow text-center">
          <p className="text-gray-500">Loading NDR reports...</p>
        </div>
      </div>
    );
  }

  // If viewing a specific NDR
  if (selectedNdr) {
    return <NDRDetail ndr={selectedNdr} onBack={() => setSelectedNdr(null)} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-800">NDR Reports</h2>
      </div>

      <div className="bg-white rounded-lg shadow">
        <div className="p-4 border-b">
          <h3 className="text-lg font-semibold text-gray-800">All NDRs ({ndrs.length})</h3>
        </div>

        <div className="p-4">
          {ndrs.length === 0 ? (
            <div className="text-center text-gray-500 py-8">
              <FileText className="mx-auto mb-4 text-gray-400" size={48} />
              <p>No NDR reports yet</p>
              <p className="text-sm mt-2">NDRs are automatically created for Operating Night events</p>
            </div>
          ) : (
            <div className="space-y-4">
              {ndrs.map(ndr => (
                <div key={ndr.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h4 className="text-lg font-semibold text-gray-800">{ndr.eventName}</h4>
                      <p className="text-sm text-gray-600">{formatDateTime(ndr.eventDate)}</p>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      ndr.status === 'active' ? 'bg-green-100 text-green-800' :
                      ndr.status === 'completed' ? 'bg-gray-100 text-gray-800' :
                      'bg-yellow-100 text-yellow-800'
                    }`}>
                      {ndr.status?.toUpperCase() || 'PENDING'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm mb-4">
                    <div>
                      <p className="text-gray-500">Members Signed Up</p>
                      <p className="font-semibold">{ndr.signedUpMembers?.length || 0}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Completed Rides</p>
                      <p className="font-semibold text-green-600">{ndr.completedRides || 0}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Cancelled Rides</p>
                      <p className="font-semibold text-red-600">{ndr.cancelledRides || 0}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Terminated Rides</p>
                      <p className="font-semibold text-orange-600">{ndr.terminatedRides || 0}</p>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => setSelectedNdr(ndr)}
                      className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
                    >
                      View Details
                    </button>
                    {ndr.status === 'pending' && (
                      <button
                        onClick={() => activateNDR(ndr.id)}
                        className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 text-sm flex items-center gap-2"
                      >
                        <Play size={16} />
                        Activate
                      </button>
                    )}
                    {ndr.status === 'active' && (
                      <button
                        onClick={() => endNDR(ndr.id)}
                        className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 text-sm"
                      >
                        End NDR
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// NDR Detail Component with Tabs
const NDRDetail = ({ ndr, onBack }) => {
  const [activeTab, setActiveTab] = useState('home');
  const [members, setMembers] = useState([]);
  const [assignments, setAssignments] = useState(ndr.assignments || {
    cars: {},
    couch: [],
    phones: [],
    doc: null,
    duc: null,
    don: null,
    northgate: []
  });
  const [cars, setCars] = useState(ndr.cars || []);
  const [notes, setNotes] = useState(ndr.notes || {
    leadership: { don: '', doc: '', duc: '', execs: '', directors: '' },
    carRoles: {},
    couchPhoneRoles: { couch: '', phones: '' },
    updates: ndr.notes?.updates || [],
    summary: ''
  });
  const [loading, setLoading] = useState(true);

  // Fetch signed up members
  useEffect(() => {
    const fetchMembers = async () => {
      if (!ndr.signedUpMembers || ndr.signedUpMembers.length === 0) {
        setMembers([]);
        setLoading(false);
        return;
      }

      try {
        const membersData = [];
        for (const memberId of ndr.signedUpMembers) {
          const memberDoc = await getDoc(doc(db, 'members', memberId));
          if (memberDoc.exists()) {
            membersData.push({ id: memberDoc.id, ...memberDoc.data() });
          }
        }
        setMembers(membersData);
      } catch (error) {
        console.error('Error fetching members:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchMembers();
  }, [ndr.signedUpMembers]);

  // Auto-save assignments, cars, and notes
  const saveData = async () => {
    try {
      await updateDoc(doc(db, 'ndrs', ndr.id), {
        assignments,
        cars,
        notes,
        lastUpdated: Timestamp.now()
      });
    } catch (error) {
      console.error('Error saving NDR data:', error);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      saveData();
    }, 2000);
    return () => clearTimeout(timer);
  }, [assignments, cars, notes]);

  const organizeMembers = () => {
    const directors = members.filter(m => m.role === 'director');
    const males = members.filter(m => {
      const gender = m.gender?.toLowerCase();
      return m.role !== 'director' && (gender === 'male' || gender === 'm' || gender === 'man');
    });
    const females = members.filter(m => {
      const gender = m.gender?.toLowerCase();
      return m.role !== 'director' && (gender === 'female' || gender === 'f' || gender === 'woman');
    });
    return { directors, males, females };
  };

  const printAgreements = () => {
    window.print();
  };

  const { directors, males, females } = organizeMembers();

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <button
            onClick={onBack}
            className="text-blue-600 hover:text-blue-800 mb-2"
          >
            ← Back to NDRs
          </button>
          <h2 className="text-2xl font-bold text-gray-800">{ndr.eventName}</h2>
          <p className="text-gray-600">{new Date(ndr.eventDate).toLocaleDateString()}</p>
        </div>
        <span className={`px-4 py-2 rounded-full text-sm font-semibold ${
          ndr.status === 'active' ? 'bg-green-100 text-green-800' :
          ndr.status === 'completed' ? 'bg-gray-100 text-gray-800' :
          'bg-yellow-100 text-yellow-800'
        }`}>
          {ndr.status?.toUpperCase() || 'PENDING'}
        </span>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow">
        <div className="flex border-b overflow-x-auto">
          <button
            onClick={() => setActiveTab('home')}
            className={`flex items-center gap-2 px-6 py-3 ${activeTab === 'home' ? 'border-b-2 border-red-600 text-red-600 font-medium' : 'text-gray-600'}`}
          >
            <FileText size={18} />
            Home
          </button>
          <button
            onClick={() => setActiveTab('assignments')}
            className={`flex items-center gap-2 px-6 py-3 ${activeTab === 'assignments' ? 'border-b-2 border-red-600 text-red-600 font-medium' : 'text-gray-600'}`}
          >
            <Users size={18} />
            Assignments
          </button>
          <button
            onClick={() => setActiveTab('cars')}
            className={`flex items-center gap-2 px-6 py-3 ${activeTab === 'cars' ? 'border-b-2 border-red-600 text-red-600 font-medium' : 'text-gray-600'}`}
          >
            <Car size={18} />
            Cars
          </button>
          <button
            onClick={() => setActiveTab('notes')}
            className={`flex items-center gap-2 px-6 py-3 ${activeTab === 'notes' ? 'border-b-2 border-red-600 text-red-600 font-medium' : 'text-gray-600'}`}
          >
            <ClipboardList size={18} />
            Notes
          </button>
        </div>

        <div className="p-6">
          {activeTab === 'home' && (
            <HomeTab 
              ndr={ndr} 
              directors={directors} 
              males={males} 
              females={females}
              printAgreements={printAgreements}
            />
          )}
          {activeTab === 'assignments' && (
            <AssignmentsTab 
              members={members}
              assignments={assignments}
              setAssignments={setAssignments}
            />
          )}
          {activeTab === 'cars' && (
            <CarsTab 
              cars={cars}
              setCars={setCars}
            />
          )}
          {activeTab === 'notes' && (
            <NotesTab 
              notes={notes}
              setNotes={setNotes}
              ndrId={ndr.id}
            />
          )}
        </div>
      </div>
    </div>
  );
};

// Home Tab Component
const HomeTab = ({ ndr, directors, males, females, printAgreements }) => {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-bold">Event Details</h3>
        <button
          onClick={printAgreements}
          className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
        >
          <Printer size={18} />
          Print Agreements
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-green-50 p-4 rounded">
          <p className="text-sm text-gray-600">Completed Rides</p>
          <p className="text-2xl font-bold text-green-600">{ndr.completedRides || 0}</p>
        </div>
        <div className="bg-red-50 p-4 rounded">
          <p className="text-sm text-gray-600">Cancelled Rides</p>
          <p className="text-2xl font-bold text-red-600">{ndr.cancelledRides || 0}</p>
        </div>
        <div className="bg-orange-50 p-4 rounded">
          <p className="text-sm text-gray-600">Terminated Rides</p>
          <p className="text-2xl font-bold text-orange-600">{ndr.terminatedRides || 0}</p>
        </div>
        <div className="bg-blue-50 p-4 rounded">
          <p className="text-sm text-gray-600">Total Members</p>
          <p className="text-2xl font-bold text-blue-600">{directors.length + males.length + females.length}</p>
        </div>
      </div>

      <div>
        <h4 className="text-lg font-semibold mb-4">Signed Up Members</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Directors */}
          {directors.length > 0 && (
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
              <h5 className="font-semibold text-purple-800 mb-3">Directors ({directors.length})</h5>
              <ul className="space-y-2">
                {directors.map(member => (
                  <li key={member.id} className="text-sm text-gray-700 bg-white p-2 rounded">
                    <div className="font-medium">{member.name}</div>
                    <div className="text-xs text-gray-500">{member.phone}</div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Males */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h5 className="font-semibold text-blue-800 mb-3">Males ({males.length})</h5>
            {males.length === 0 ? (
              <p className="text-sm text-gray-500 italic">No signups</p>
            ) : (
              <ul className="space-y-2">
                {males.map(member => (
                  <li key={member.id} className="text-sm text-gray-700 bg-white p-2 rounded">
                    <div className="font-medium">{member.name}</div>
                    <div className="text-xs text-gray-500">{member.phone}</div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Females */}
          <div className="bg-pink-50 border border-pink-200 rounded-lg p-4">
            <h5 className="font-semibold text-pink-800 mb-3">Females ({females.length})</h5>
            {females.length === 0 ? (
              <p className="text-sm text-gray-500 italic">No signups</p>
            ) : (
              <ul className="space-y-2">
                {females.map(member => (
                  <li key={member.id} className="text-sm text-gray-700 bg-white p-2 rounded">
                    <div className="font-medium">{member.name}</div>
                    <div className="text-xs text-gray-500">{member.phone}</div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// Assignments Tab - Part 1 (will continue in next message due to length)
const AssignmentsTab = ({ members, assignments, setAssignments }) => {
  const [draggedMember, setDraggedMember] = useState(null);

  const handleDragStart = (member) => {
    setDraggedMember(member);
  };

  const handleDrop = (location, carNumber = null) => {
    if (!draggedMember) return;

    const newAssignments = { ...assignments };

    // Remove from all locations first
    Object.keys(newAssignments).forEach(key => {
      if (key === 'cars') {
        Object.keys(newAssignments.cars).forEach(carNum => {
          newAssignments.cars[carNum] = newAssignments.cars[carNum].filter(id => id !== draggedMember.id);
        });
      } else if (Array.isArray(newAssignments[key])) {
        newAssignments[key] = newAssignments[key].filter(id => id !== draggedMember.id);
      } else if (newAssignments[key] === draggedMember.id) {
        newAssignments[key] = null;
      }
    });

    // Add to new location
    if (location === 'car') {
      if (!newAssignments.cars[carNumber]) {
        newAssignments.cars[carNumber] = [];
      }
      newAssignments.cars[carNumber].push(draggedMember.id);
    } else if (['couch', 'phones', 'northgate'].includes(location)) {
      newAssignments[location].push(draggedMember.id);
    } else {
      newAssignments[location] = draggedMember.id;
    }

    setAssignments(newAssignments);
    setDraggedMember(null);
  };

  const getMemberById = (id) => members.find(m => m.id === id);

  const unassignedMembers = members.filter(member => {
    // Check if member is assigned anywhere
    const isInCar = Object.values(assignments.cars).some(car => car.includes(member.id));
    const isInCouch = assignments.couch.includes(member.id);
    const isInPhones = assignments.phones.includes(member.id);
    const isInNorthgate = assignments.northgate.includes(member.id);
    const isDOC = assignments.doc === member.id;
    const isDUC = assignments.duc === member.id;
    const isDON = assignments.don === member.id;

    return !isInCar && !isInCouch && !isInPhones && !isInNorthgate && !isDOC && !isDUC && !isDON;
  });

  return (
    <div className="space-y-6">
      <h3 className="text-xl font-bold">Member Assignments</h3>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Unassigned Members */}
        <div className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg p-4">
          <h4 className="font-semibold mb-3">Unassigned Members ({unassignedMembers.length})</h4>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {unassignedMembers.map(member => (
              <div
                key={member.id}
                draggable
                onDragStart={() => handleDragStart(member)}
                className="bg-white p-3 rounded border border-gray-200 cursor-move hover:shadow-md transition"
              >
                <p className="font-medium text-sm">{member.name}</p>
                <p className="text-xs text-gray-500">{member.role} - {member.gender}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Leadership Roles */}
        <div className="space-y-4">
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => handleDrop('don')}
            className="bg-purple-50 border-2 border-purple-200 rounded-lg p-4 min-h-20"
          >
            <h5 className="font-semibold text-purple-800 mb-2">DON (Director on Night)</h5>
            {assignments.don && (
              <div className="bg-white p-2 rounded">
                <p className="text-sm font-medium">{getMemberById(assignments.don)?.name}</p>
              </div>
            )}
          </div>

          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => handleDrop('doc')}
            className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4 min-h-20"
          >
            <h5 className="font-semibold text-blue-800 mb-2">DOC (Director on Call)</h5>
            {assignments.doc && (
              <div className="bg-white p-2 rounded">
                <p className="text-sm font-medium">{getMemberById(assignments.doc)?.name}</p>
              </div>
            )}
          </div>

          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => handleDrop('duc')}
            className="bg-green-50 border-2 border-green-200 rounded-lg p-4 min-h-20"
          >
            <h5 className="font-semibold text-green-800 mb-2">DUC (Deputy on Call)</h5>
            {assignments.duc && (
              <div className="bg-white p-2 rounded">
                <p className="text-sm font-medium">{getMemberById(assignments.duc)?.name}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Cars, Couch, Phones, Northgate */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Cars 1-10 */}
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(carNum => (
          <div
            key={carNum}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => handleDrop('car', carNum)}
            className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4 min-h-32"
          >
            <h5 className="font-semibold text-blue-800 mb-2">Car {carNum}</h5>
            <div className="space-y-1">
              {assignments.cars[carNum]?.map(memberId => {
                const member = getMemberById(memberId);
                return member ? (
                  <div key={memberId} className="bg-white p-1 rounded text-xs">
                    {member.name}
                  </div>
                ) : null;
              })}
            </div>
          </div>
        ))}

        {/* Couch */}
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={() => handleDrop('couch')}
          className="bg-orange-50 border-2 border-orange-200 rounded-lg p-4 min-h-32"
        >
          <h5 className="font-semibold text-orange-800 mb-2">Couch</h5>
          <div className="space-y-1">
            {assignments.couch?.map(memberId => {
              const member = getMemberById(memberId);
              return member ? (
                <div key={memberId} className="bg-white p-1 rounded text-xs">
                  {member.name}
                </div>
              ) : null;
            })}
          </div>
        </div>

        {/* Phones */}
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={() => handleDrop('phones')}
          className="bg-green-50 border-2 border-green-200 rounded-lg p-4 min-h-32"
        >
          <h5 className="font-semibold text-green-800 mb-2">Phones</h5>
          <div className="space-y-1">
            {assignments.phones?.map(memberId => {
              const member = getMemberById(memberId);
              return member ? (
                <div key={memberId} className="bg-white p-1 rounded text-xs">
                  {member.name}
                </div>
              ) : null;
            })}
          </div>
        </div>

        {/* Northgate */}
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={() => handleDrop('northgate')}
          className="bg-red-50 border-2 border-red-200 rounded-lg p-4 min-h-32"
        >
          <h5 className="font-semibold text-red-800 mb-2">Northgate</h5>
          <div className="space-y-1">
            {assignments.northgate?.map(memberId => {
              const member = getMemberById(memberId);
              return member ? (
                <div key={memberId} className="bg-white p-1 rounded text-xs">
                  {member.name}
                </div>
              ) : null;
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

// Cars Tab Component
const CarsTab = ({ cars, setCars }) => {
  const addCar = () => {
    setCars([...cars, {
      id: Date.now(),
      carNumber: cars.length + 1,
      make: '',
      model: '',
      color: '',
      licensePlate: '',
      driver: '',
      navigator: ''
    }]);
  };

  const updateCar = (id, field, value) => {
    setCars(cars.map(car => car.id === id ? { ...car, [field]: value } : car));
  };

  const removeCar = (id) => {
    if (window.confirm('Remove this car?')) {
      setCars(cars.filter(car => car.id !== id));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-bold">Car Information</h3>
        <button
          onClick={addCar}
          className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
        >
          + Add Car
        </button>
      </div>

      <div className="space-y-4">
        {cars.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            <Car className="mx-auto mb-4 text-gray-400" size={48} />
            <p>No cars added yet</p>
          </div>
        ) : (
          cars.map(car => (
            <div key={car.id} className="border border-gray-200 rounded-lg p-4">
              <div className="flex justify-between items-center mb-4">
                <h4 className="text-lg font-semibold">Car {car.carNumber}</h4>
                <button
                  onClick={() => removeCar(car.id)}
                  className="text-red-600 hover:text-red-800 text-sm"
                >
                  Remove
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Make
                  </label>
                  <input
                    type="text"
                    value={car.make}
                    onChange={(e) => updateCar(car.id, 'make', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    placeholder="e.g., Toyota"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Model
                  </label>
                  <input
                    type="text"
                    value={car.model}
                    onChange={(e) => updateCar(car.id, 'model', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    placeholder="e.g., Camry"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Color
                  </label>
                  <input
                    type="text"
                    value={car.color}
                    onChange={(e) => updateCar(car.id, 'color', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    placeholder="e.g., Silver"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    License Plate
                  </label>
                  <input
                    type="text"
                    value={car.licensePlate}
                    onChange={(e) => updateCar(car.id, 'licensePlate', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    placeholder="e.g., ABC1234"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Driver
                  </label>
                  <input
                    type="text"
                    value={car.driver}
                    onChange={(e) => updateCar(car.id, 'driver', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    placeholder="Driver name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Navigator
                  </label>
                  <input
                    type="text"
                    value={car.navigator}
                    onChange={(e) => updateCar(car.id, 'navigator', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    placeholder="Navigator name"
                  />
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

// Notes Tab Component
const NotesTab = ({ notes, setNotes, ndrId }) => {
  const [newUpdate, setNewUpdate] = useState('');

  const addUpdate = () => {
    if (!newUpdate.trim()) {
      alert('Please enter an update');
      return;
    }

    const update = {
      id: Date.now(),
      text: newUpdate,
      timestamp: new Date(),
      time: new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    };

    setNotes({
      ...notes,
      updates: [...notes.updates, update]
    });
    setNewUpdate('');
  };

  const updateLeadership = (field, value) => {
    setNotes({
      ...notes,
      leadership: {
        ...notes.leadership,
        [field]: value
      }
    });
  };

  const updateCarRole = (carNum, role, value) => {
    setNotes({
      ...notes,
      carRoles: {
        ...notes.carRoles,
        [carNum]: {
          ...notes.carRoles[carNum],
          [role]: value
        }
      }
    });
  };

  const updateCouchPhoneRole = (field, value) => {
    setNotes({
      ...notes,
      couchPhoneRoles: {
        ...notes.couchPhoneRoles,
        [field]: value
      }
    });
  };

  // Check if 15 minutes have passed since last update
  const lastUpdate = notes.updates.length > 0 ? new Date(notes.updates[notes.updates.length - 1].timestamp) : null;
  const minutesSinceLastUpdate = lastUpdate ? Math.floor((new Date() - lastUpdate) / 1000 / 60) : 999;
  const needsUpdate = minutesSinceLastUpdate >= 15;

  return (
    <div className="space-y-6">
      <h3 className="text-xl font-bold">NDR Notes</h3>

      {/* Warning if update needed */}
      {needsUpdate && notes.updates.length > 0 && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          <p className="font-semibold">⚠️ Update Required</p>
          <p className="text-sm">It's been {minutesSinceLastUpdate} minutes since the last update. Please add a progress note.</p>
        </div>
      )}

      {/* Leadership Information */}
      <div className="border border-gray-200 rounded-lg p-4">
        <h4 className="font-semibold mb-4">Leadership Information</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              DON (Director on Night)
            </label>
            <input
              type="text"
              value={notes.leadership.don}
              onChange={(e) => updateLeadership('don', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              placeholder="Name"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              DOC (Director on Call)
            </label>
            <input
              type="text"
              value={notes.leadership.doc}
              onChange={(e) => updateLeadership('doc', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              placeholder="Name"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              DUC (Deputy on Call)
            </label>
            <input
              type="text"
              value={notes.leadership.duc}
              onChange={(e) => updateLeadership('duc', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              placeholder="Name"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Executives
            </label>
            <input
              type="text"
              value={notes.leadership.execs}
              onChange={(e) => updateLeadership('execs', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              placeholder="Names"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Directors
            </label>
            <input
              type="text"
              value={notes.leadership.directors}
              onChange={(e) => updateLeadership('directors', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              placeholder="Names"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Couch
            </label>
            <input
              type="text"
              value={notes.couchPhoneRoles.couch}
              onChange={(e) => updateCouchPhoneRole('couch', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              placeholder="Name"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Phones
            </label>
            <input
              type="text"
              value={notes.couchPhoneRoles.phones}
              onChange={(e) => updateCouchPhoneRole('phones', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              placeholder="Name"
            />
          </div>
        </div>
      </div>

      {/* Car Roles */}
      <div className="border border-gray-200 rounded-lg p-4">
        <h4 className="font-semibold mb-4">Car Roles (Driver & Navigator)</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(carNum => (
            <div key={carNum} className="border border-gray-200 rounded p-3">
              <h5 className="font-medium text-sm mb-2">Car {carNum}</h5>
              <input
                type="text"
                value={notes.carRoles[carNum]?.driver || ''}
                onChange={(e) => updateCarRole(carNum, 'driver', e.target.value)}
                className="w-full px-2 py-1 border border-gray-300 rounded text-sm mb-2"
                placeholder="Driver"
              />
              <input
                type="text"
                value={notes.carRoles[carNum]?.navigator || ''}
                onChange={(e) => updateCarRole(carNum, 'navigator', e.target.value)}
                className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                placeholder="Navigator"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Progress Updates */}
      <div className="border border-gray-200 rounded-lg p-4">
        <h4 className="font-semibold mb-4">Progress Updates (Every 15 Minutes)</h4>
        
        <div className="mb-4">
          <textarea
            value={newUpdate}
            onChange={(e) => setNewUpdate(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
            rows="3"
            placeholder="Enter progress update (e.g., 'All cars dispatched, 3 rides in queue')"
          />
          <button
            onClick={addUpdate}
            className="mt-2 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
          >
            Add Update
          </button>
        </div>

        <div className="space-y-2 max-h-96 overflow-y-auto">
          {notes.updates.length === 0 ? (
            <p className="text-gray-500 text-sm italic">No updates yet</p>
          ) : (
            notes.updates.map(update => (
              <div key={update.id} className="bg-gray-50 p-3 rounded border-l-4 border-blue-500">
                <div className="flex justify-between items-start mb-1">
                  <span className="text-xs font-semibold text-blue-600">{update.time}</span>
                  <span className="text-xs text-gray-500">
                    {new Date(update.timestamp).toLocaleDateString()}
                  </span>
                </div>
                <p className="text-sm text-gray-700">{update.text}</p>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Summary */}
      <div className="border border-gray-200 rounded-lg p-4">
        <h4 className="font-semibold mb-4">Night Summary</h4>
        <textarea
          value={notes.summary}
          onChange={(e) => setNotes({ ...notes, summary: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-md"
          rows="6"
          placeholder="Overall summary of the night's operations..."
        />
      </div>
    </div>
  );
};
export default NDRReports;
