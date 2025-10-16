import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, onSnapshot, doc, getDoc, updateDoc, orderBy, Timestamp, getDocs, where } from 'firebase/firestore';
import { useAuth } from '../AuthContext';
import { Play, Printer, FileText, Users, Car, ClipboardList, Archive, RotateCcw } from 'lucide-react';

const NDRReports = () => {
  const [ndrs, setNdrs] = useState([]);
  const [selectedNdr, setSelectedNdr] = useState(null);
  const [selectedPendingNdrIndex, setSelectedPendingNdrIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const { userProfile } = useAuth();

  useEffect(() => {
    const ndrsRef = collection(db, 'ndrs');
    const ndrsQuery = query(ndrsRef);

    const unsubscribe = onSnapshot(
      ndrsQuery,
      (snapshot) => {
        const ndrsData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate(),
          activatedAt: doc.data().activatedAt?.toDate(),
          endedAt: doc.data().endedAt?.toDate(),
          archivedAt: doc.data().archivedAt?.toDate(),
          eventDate: doc.data().eventDate?.toDate()
        }));
        setNdrs(ndrsData);
        setLoading(false);
      },
      (error) => {
        console.error('Error fetching NDRs:', error);
        setLoading(false);
        setNdrs([]);
      }
    );

    return () => unsubscribe();
  }, []);

  const activateNDR = async (ndrId) => {
    if (window.confirm('Activate this NDR? This will enable Phone Room and Ride Management.')) {
      try {
        // Deactivate any currently active NDRs
        const activeNdrs = ndrs.filter(n => n.status === 'active');
        for (const activeNdr of activeNdrs) {
          await updateDoc(doc(db, 'ndrs', activeNdr.id), {
            status: 'completed',
            endedAt: Timestamp.now()
          });
        }

        // Activate the selected NDR
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
        // Get ride statistics
        const ridesRef = collection(db, 'rides');
        const ridesQuery = query(ridesRef, where('ndrId', '==', ndrId));
        const ridesSnapshot = await getDocs(ridesQuery);
        
        let completedRiders = 0, cancelledRiders = 0, terminatedRiders = 0;
        ridesSnapshot.forEach(doc => {
          const data = doc.data();
          const status = data.status;
          const riders = data.riders || 1; // Default to 1 if riders not specified
          
          if (status === 'completed') completedRiders += riders;
          else if (status === 'cancelled') cancelledRiders += riders;
          else if (status === 'terminated') terminatedRiders += riders;
        });

        await updateDoc(doc(db, 'ndrs', ndrId), {
          status: 'completed',
          endedAt: Timestamp.now(),
          completedRiders: completedRiders,
          cancelledRiders: cancelledRiders,
          terminatedRiders: terminatedRiders
        });

        alert('NDR ended. Phone Room and Ride Management are now disabled.');
      } catch (error) {
        console.error('Error ending NDR:', error);
        alert('Error ending NDR: ' + error.message);
      }
    }
  };

  const archiveNDR = async (ndrId) => {
    if (window.confirm('Archive this NDR? You can reactivate it later if needed.')) {
      try {
        const ndrDoc = await getDoc(doc(db, 'ndrs', ndrId));
        const ndrData = ndrDoc.data();

        // Generate comprehensive summary
        const summary = generateNDRSummary(ndrData);

        await updateDoc(doc(db, 'ndrs', ndrId), {
          status: 'archived',
          archivedAt: Timestamp.now(),
          archivedBy: userProfile.id,
          archivedSummary: summary
        });
        alert('NDR archived successfully!');
      } catch (error) {
        console.error('Error archiving NDR:', error);
        alert('Error archiving NDR: ' + error.message);
      }
    }
  };

  const generateNDRSummary = (ndrData) => {
    const parts = [];
    
    parts.push(`EVENT: ${ndrData.eventName}`);
    parts.push(`DATE: ${new Date(ndrData.eventDate?.seconds * 1000).toLocaleDateString()}`);
    parts.push(`LOCATION: ${ndrData.location || 'N/A'}`);
    parts.push('');
    
    parts.push('STATISTICS:');
    parts.push(`- Completed Riders: ${ndrData.completedRiders || 0}`);
    parts.push(`- Cancelled Riders: ${ndrData.cancelledRiders || 0}`);
    parts.push(`- Terminated Riders: ${ndrData.terminatedRiders || 0}`);
    parts.push(`- Total Members: ${ndrData.signedUpMembers?.length || 0}`);
    parts.push('');
    
    if (ndrData.notes?.leadership) {
      parts.push('LEADERSHIP:');
      if (ndrData.notes.leadership.don) parts.push(`- DON: ${ndrData.notes.leadership.don}`);
      if (ndrData.notes.leadership.doc) parts.push(`- DOC: ${ndrData.notes.leadership.doc}`);
      if (ndrData.notes.leadership.duc) parts.push(`- DUC: ${ndrData.notes.leadership.duc}`);
      if (ndrData.notes.leadership.execs) parts.push(`- Executives: ${ndrData.notes.leadership.execs}`);
      if (ndrData.notes.leadership.directors) parts.push(`- Directors: ${ndrData.notes.leadership.directors}`);
      parts.push('');
    }

    if (ndrData.notes?.couchPhoneRoles) {
      parts.push('ROLES:');
      if (ndrData.notes.couchPhoneRoles.couch) parts.push(`- Couch: ${ndrData.notes.couchPhoneRoles.couch}`);
      if (ndrData.notes.couchPhoneRoles.phones) parts.push(`- Phones: ${ndrData.notes.couchPhoneRoles.phones}`);
      parts.push('');
    }

    if (ndrData.cars && ndrData.cars.length > 0) {
      parts.push('CARS:');
      ndrData.cars.forEach(car => {
        parts.push(`Car ${car.carNumber}: ${car.make} ${car.model} ${car.color} (${car.licensePlate})`);
        if (car.driver) parts.push(`  Driver: ${car.driver}`);
        if (car.navigator) parts.push(`  Navigator: ${car.navigator}`);
      });
      parts.push('');
    }

    if (ndrData.notes?.updates && ndrData.notes.updates.length > 0) {
      parts.push('PROGRESS UPDATES:');
      ndrData.notes.updates.forEach(update => {
        parts.push(`[${update.time}] ${update.text}`);
      });
      parts.push('');
    }

    if (ndrData.notes?.summary) {
      parts.push('SUMMARY:');
      parts.push(ndrData.notes.summary);
    }

    return parts.join('\n');
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

  if (selectedNdr) {
    return <NDRDetail ndr={selectedNdr} onBack={() => setSelectedNdr(null)} />;
  }

  // Organize NDRs
  const now = new Date();
  const pendingNDRs = ndrs
    .filter(n => n.status === 'pending' && n.eventDate && n.eventDate >= now)
    .sort((a, b) => a.eventDate - b.eventDate); // Sort by soonest first
  
  const activeNDR = ndrs.find(n => n.status === 'active');
  const archivedNDRs = ndrs.filter(n => n.status === 'archived').sort((a, b) => (b.archivedAt || 0) - (a.archivedAt || 0));
  const completedNDRs = ndrs.filter(n => n.status === 'completed').sort((a, b) => (b.endedAt || 0) - (a.endedAt || 0));


  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-800">NDR Reports</h2>

      {/* Active NDR */}
      {activeNDR && (
        <div className="bg-green-50 border-2 border-green-500 rounded-lg p-6">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
            <h3 className="text-xl font-bold text-green-800">Currently Active</h3>
          </div>
          <NDRCard ndr={activeNDR} onView={setSelectedNdr} onEnd={endNDR} onArchive={archiveNDR} onActivate={activateNDR} />
        </div>
      )}

      {/* Next NDR to Activate */}
      {pendingNDRs.length > 0 && (
        <div className="bg-white rounded-lg shadow">
          <div className="p-4 border-b bg-blue-50">
            <h3 className="text-lg font-semibold text-blue-800">Next NDR to Activate</h3>
          </div>
          <div className="p-4">
            {/* Dropdown to select which NDR to show */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Event:
              </label>
              <select
                value={selectedPendingNdrIndex}
                onChange={(e) => setSelectedPendingNdrIndex(parseInt(e.target.value))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {pendingNDRs.map((ndr, index) => (
                  <option key={ndr.id} value={index}>
                    {ndr.eventName} - {formatDateTime(ndr.eventDate)}
                  </option>
                ))}
              </select>
            </div>
            
            <NDRCard 
              ndr={pendingNDRs[selectedPendingNdrIndex]} 
              onView={setSelectedNdr} 
              onEnd={endNDR} 
              onArchive={archiveNDR} 
              onActivate={activateNDR} 
            />
          </div>
        </div>
      )}
{/* Completed NDRs */}
      {completedNDRs.length > 0 && (
        <div className="bg-white rounded-lg shadow">
          <div className="p-4 border-b bg-blue-50">
            <h3 className="text-lg font-semibold text-blue-800 flex items-center gap-2">
              <FileText size={20} />
              Completed NDRs ({completedNDRs.length})
            </h3>
          </div>
          <div className="p-4 space-y-4">
            {completedNDRs.map(ndr => (
              <NDRCard key={ndr.id} ndr={ndr} onView={setSelectedNdr} onEnd={endNDR} onArchive={archiveNDR} onActivate={activateNDR} />
            ))}
          </div>
        </div>
      )}
      {/* Archived NDRs */}
      {archivedNDRs.length > 0 && (
        <div className="bg-white rounded-lg shadow">
          <div className="p-4 border-b bg-gray-50">
            <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
              <Archive size={20} />
              Archived NDRs ({archivedNDRs.length})
            </h3>
          </div>
          <div className="p-4 space-y-4">
            {archivedNDRs.map(ndr => (
              <NDRCard key={ndr.id} ndr={ndr} onView={setSelectedNdr} onEnd={endNDR} onArchive={archiveNDR} onActivate={activateNDR} />
            ))}
          </div>
        </div>
      )}

      {!activeNDR && pendingNDRs.length === 0 && ndrs.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-yellow-800">All NDRs have been completed or archived.</p>
        </div>
      )}
    </div>
  );
};

// NDR Card Component
const NDRCard = ({ ndr, onView, onEnd, onArchive, onActivate }) => {
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

  return (
    <div className="border border-gray-200 rounded-lg p-4">
      <div className="flex justify-between items-start mb-3">
        <div>
          <h4 className="text-lg font-semibold text-gray-800">{ndr.eventName}</h4>
          <p className="text-sm text-gray-600">{formatDateTime(ndr.eventDate)}</p>
        </div>
        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
          ndr.status === 'active' ? 'bg-green-100 text-green-800' :
          ndr.status === 'completed' ? 'bg-blue-100 text-blue-800' :
          ndr.status === 'archived' ? 'bg-gray-100 text-gray-800' :
          'bg-yellow-100 text-yellow-800'
        }`}>
          {ndr.status?.toUpperCase() || 'PENDING'}
        </span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm mb-4">
        <div>
          <p className="text-gray-500">Members</p>
          <p className="font-semibold">{ndr.signedUpMembers?.length || 0}</p>
        </div>
        <div>
          <p className="text-gray-500">Completed</p>
          <p className="font-semibold text-green-600">{ndr.completedRiders || 0} riders</p>
        </div>
        <div>
          <p className="text-gray-500">Cancelled</p>
          <p className="font-semibold text-red-600">{ndr.cancelledRiders || 0} riders</p>
        </div>
        <div>
          <p className="text-gray-500">Terminated</p>
          <p className="font-semibold text-orange-600">{ndr.terminatedRiders || 0} riders</p>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => onView(ndr)}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
        >
          View Details
        </button>
        {ndr.status === 'pending' && (
          <button
            onClick={() => onActivate(ndr.id)}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 text-sm flex items-center gap-2"
          >
            <Play size={16} />
            Activate
          </button>
        )}
        {ndr.status === 'active' && (
          <button
            onClick={() => onEnd(ndr.id)}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 text-sm"
          >
            End NDR
          </button>
        )}
        {ndr.status === 'completed' && (
          <button
            onClick={() => onArchive(ndr.id)}
            className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 text-sm flex items-center gap-2"
          >
            <Archive size={16} />
            Archive
          </button>
        )}
        {ndr.status === 'archived' && (
          <button
            onClick={() => onActivate(ndr.id)}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm flex items-center gap-2"
          >
            <RotateCcw size={16} />
            Reactivate
          </button>
        )}
      </div>
    </div>
  );
};

// NDR Detail Component - Switches between editable and view-only based on status
const NDRDetail = ({ ndr, onBack }) => {
  const [activeTab, setActiveTab] = useState('home');
  const [members, setMembers] = useState([]);
  const [showPrintAgreements, setShowPrintAgreements] = useState(false);
  const [loading, setLoading] = useState(true);
  
  // Only for active NDRs - editable state
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
    updates: [],
    summary: ''
  });

  const isActive = ndr.status === 'active';

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

  // Auto-save - only when active
  const saveData = async () => {
    if (!isActive) return;
    
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
    if (!isActive) return;
    
    const timer = setTimeout(() => {
      saveData();
    }, 2000);
    return () => clearTimeout(timer);
  }, [assignments, cars, notes, isActive]);

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

  const printPage = () => {
    window.print();
  };

  const { directors, males, females } = organizeMembers();

  if (showPrintAgreements) {
    return <PrintAgreements ndr={{ ...ndr, directors, males, females }} onClose={() => setShowPrintAgreements(false)} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center print:hidden">
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
          ndr.status === 'completed' ? 'bg-blue-100 text-blue-800' :
          ndr.status === 'archived' ? 'bg-gray-100 text-gray-800' :
          'bg-yellow-100 text-yellow-800'
        }`}>
          {ndr.status?.toUpperCase() || 'PENDING'}
        </span>
      </div>

      {ndr.status === 'archived' && ndr.archivedSummary && (
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-bold">Archived Summary</h3>
            <button
              onClick={printPage}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 print:hidden"
            >
              <Printer size={18} />
              Print Summary
            </button>
          </div>
          <pre className="whitespace-pre-wrap text-sm font-mono bg-gray-50 p-4 rounded border">
            {ndr.archivedSummary}
          </pre>
        </div>
      )}

      {ndr.status !== 'archived' && (
        <>
          <div className="bg-white rounded-lg shadow print:shadow-none">
            <div className="flex border-b overflow-x-auto print:hidden">
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
              {/* Show view-only banner if not active */}
              {!isActive && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                  <p className="text-blue-800 font-medium">
                    ℹ️ View Only Mode - This NDR must be activated to make changes
                  </p>
                </div>
              )}

              {loading ? (
                <div className="text-center py-8 text-gray-500">Loading...</div>
              ) : (
                <>
                  {activeTab === 'home' && (
                    <HomeTab 
                      ndr={ndr} 
                      directors={directors} 
                      males={males} 
                      females={females}
                      onPrintAgreements={() => setShowPrintAgreements(true)}
                      onPrintPage={printPage}
                    />
                  )}
                  {activeTab === 'assignments' && (
                    isActive ? (
                      <AssignmentsTabEditable 
                        assignments={assignments}
                        setAssignments={setAssignments}
                        members={members}
                        directors={directors}
                        males={males}
                        females={females}
                      />
                    ) : (
                      <AssignmentsTabViewOnly ndr={ndr} members={members} />
                    )
                  )}
                  {activeTab === 'cars' && (
                    isActive ? (
                      <CarsTabEditable cars={cars} setCars={setCars} />
                    ) : (
                      <CarsTabViewOnly ndr={ndr} />
                    )
                  )}
                  {activeTab === 'notes' && (
                    isActive ? (
                      <NotesTabEditable notes={notes} setNotes={setNotes} ndrId={ndr.id} />
                    ) : (
                      <NotesTabViewOnly ndr={ndr} />
                    )
                  )}
                </>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
// Assignments Tab - EDITABLE
const AssignmentsTabEditable = ({ assignments, setAssignments, members, directors, males, females }) => {
  const assignRole = (role, memberId) => {
    setAssignments({...assignments, [role]: memberId});
  };

  const assignCar = (carNum, memberId) => {
    const currentCar = assignments.cars[carNum] || [];
    if (currentCar.includes(memberId)) {
      setAssignments({
        ...assignments,
        cars: {
          ...assignments.cars,
          [carNum]: currentCar.filter(id => id !== memberId)
        }
      });
    } else {
      setAssignments({
        ...assignments,
        cars: {
          ...assignments.cars,
          [carNum]: [...currentCar, memberId]
        }
      });
    }
  };

  const assignPosition = (position, memberId) => {
    const currentPosition = assignments[position] || [];
    if (currentPosition.includes(memberId)) {
      setAssignments({
        ...assignments,
        [position]: currentPosition.filter(id => id !== memberId)
      });
    } else {
      setAssignments({
        ...assignments,
        [position]: [...currentPosition, memberId]
      });
    }
  };

  return (
    <div className="space-y-6">
      <h3 className="text-xl font-bold">Member Assignments</h3>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">DON (Director on Night)</label>
          <select
            value={assignments.don || ''}
            onChange={(e) => assignRole('don', e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2"
          >
            <option value="">Select DON</option>
            {directors.map(m => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">DOC (Director on Call)</label>
          <select
            value={assignments.doc || ''}
            onChange={(e) => assignRole('doc', e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2"
          >
            <option value="">Select DOC</option>
            {directors.map(m => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">DUC (Deputy on Call)</label>
          <select
            value={assignments.duc || ''}
            onChange={(e) => assignRole('duc', e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2"
          >
            <option value="">Select DUC</option>
            {[...directors, ...males, ...females].map(m => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(carNum => (
          <div key={carNum} className="border border-gray-200 rounded-lg p-4">
            <h5 className="font-semibold mb-2">Car {carNum}</h5>
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {[...males, ...females].map(member => (
                <label key={member.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={(assignments.cars[carNum] || []).includes(member.id)}
                    onChange={() => assignCar(carNum, member.id)}
                  />
                  {member.name}
                </label>
              ))}
            </div>
          </div>
        ))}

        <div className="border border-gray-200 rounded-lg p-4">
          <h5 className="font-semibold mb-2">Couch</h5>
          <div className="space-y-1 max-h-40 overflow-y-auto">
            {[...males, ...females].map(member => (
              <label key={member.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={(assignments.couch || []).includes(member.id)}
                  onChange={() => assignPosition('couch', member.id)}
                />
                {member.name}
              </label>
            ))}
          </div>
        </div>

        <div className="border border-gray-200 rounded-lg p-4">
          <h5 className="font-semibold mb-2">Phones</h5>
          <div className="space-y-1 max-h-40 overflow-y-auto">
            {[...males, ...females].map(member => (
              <label key={member.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={(assignments.phones || []).includes(member.id)}
                  onChange={() => assignPosition('phones', member.id)}
                />
                {member.name}
              </label>
            ))}
          </div>
        </div>

        <div className="border border-gray-200 rounded-lg p-4">
          <h5 className="font-semibold mb-2">Northgate</h5>
          <div className="space-y-1 max-h-40 overflow-y-auto">
            {[...males, ...females].map(member => (
              <label key={member.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={(assignments.northgate || []).includes(member.id)}
                  onChange={() => assignPosition('northgate', member.id)}
                />
                {member.name}
              </label>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// Cars Tab - EDITABLE
const CarsTabEditable = ({ cars, setCars }) => {
  const addCar = () => {
    const newCar = {
      id: Date.now(),
      carNumber: cars.length + 1,
      make: '',
      model: '',
      color: '',
      licensePlate: '',
      driver: '',
      navigator: ''
    };
    setCars([...cars, newCar]);
  };

  const updateCar = (carId, field, value) => {
    setCars(cars.map(car => 
      car.id === carId ? { ...car, [field]: value } : car
    ));
  };

  const removeCar = (carId) => {
    if (window.confirm('Remove this car?')) {
      setCars(cars.filter(car => car.id !== carId));
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
          Add Car
        </button>
      </div>

      <div className="space-y-4">
        {cars.map(car => (
          <div key={car.id} className="border border-gray-200 rounded-lg p-4">
            <div className="flex justify-between items-center mb-4">
              <h4 className="text-lg font-semibold">Car {car.carNumber}</h4>
              <button
                onClick={() => removeCar(car.id)}
                className="px-3 py-1 bg-red-500 text-white text-sm rounded hover:bg-red-600"
              >
                Remove
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Make</label>
                <input
                  type="text"
                  value={car.make}
                  onChange={(e) => updateCar(car.id, 'make', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  placeholder="Make"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Model</label>
                <input
                  type="text"
                  value={car.model}
                  onChange={(e) => updateCar(car.id, 'model', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  placeholder="Model"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Color</label>
                <input
                  type="text"
                  value={car.color}
                  onChange={(e) => updateCar(car.id, 'color', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  placeholder="Color"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">License Plate</label>
                <input
                  type="text"
                  value={car.licensePlate}
                  onChange={(e) => updateCar(car.id, 'licensePlate', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  placeholder="License Plate"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Driver</label>
                <input
                  type="text"
                  value={car.driver}
                  onChange={(e) => updateCar(car.id, 'driver', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  placeholder="Driver name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Navigator</label>
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
        ))}
      </div>
    </div>
  );
};

// Notes Tab - EDITABLE
const NotesTabEditable = ({ notes, setNotes, ndrId }) => {
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

  const updateCouchPhoneRole = (field, value) => {
    setNotes({
      ...notes,
      couchPhoneRoles: {
        ...notes.couchPhoneRoles,
        [field]: value
      }
    });
  };

  return (
    <div className="space-y-6">
      <h3 className="text-xl font-bold">NDR Notes</h3>

      <div className="border border-gray-200 rounded-lg p-4">
        <h4 className="font-semibold mb-4">Leadership Information</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">DON</label>
            <input
              type="text"
              value={notes.leadership.don}
              onChange={(e) => updateLeadership('don', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              placeholder="Name"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">DOC</label>
            <input
              type="text"
              value={notes.leadership.doc}
              onChange={(e) => updateLeadership('doc', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              placeholder="Name"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">DUC</label>
            <input
              type="text"
              value={notes.leadership.duc}
              onChange={(e) => updateLeadership('duc', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              placeholder="Name"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Executives</label>
            <input
              type="text"
              value={notes.leadership.execs}
              onChange={(e) => updateLeadership('execs', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              placeholder="Names"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Directors</label>
            <input
              type="text"
              value={notes.leadership.directors}
              onChange={(e) => updateLeadership('directors', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              placeholder="Names"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Couch</label>
            <input
              type="text"
              value={notes.couchPhoneRoles.couch}
              onChange={(e) => updateCouchPhoneRole('couch', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              placeholder="Names"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phones</label>
            <input
              type="text"
              value={notes.couchPhoneRoles.phones}
              onChange={(e) => updateCouchPhoneRole('phones', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              placeholder="Names"
            />
          </div>
        </div>
      </div>

      <div className="border border-gray-200 rounded-lg p-4">
        <h4 className="font-semibold mb-4">Progress Updates</h4>
        <div className="flex gap-2 mb-4">
          <input
            type="text"
            value={newUpdate}
            onChange={(e) => setNewUpdate(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && addUpdate()}
            placeholder="Add a progress update..."
            className="flex-1 px-3 py-2 border border-gray-300 rounded-md"
          />
          <button
            onClick={addUpdate}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Add Update
          </button>
        </div>
        <div className="space-y-2">
          {notes.updates?.map(update => (
            <div key={update.id} className="bg-gray-50 p-3 rounded border-l-4 border-blue-500">
              <div className="flex justify-between items-start mb-1">
                <span className="text-xs font-semibold text-blue-600">{update.time}</span>
                <span className="text-xs text-gray-500">
                  {new Date(update.timestamp).toLocaleDateString()}
                </span>
              </div>
              <p className="text-sm text-gray-700">{update.text}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="border border-gray-200 rounded-lg p-4">
        <h4 className="font-semibold mb-4">Night Summary</h4>
        <textarea
          value={notes.summary}
          onChange={(e) => setNotes({ ...notes, summary: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-md"
          rows="6"
          placeholder="Write a summary of the night..."
        />
      </div>
    </div>
  );
};

// Home Tab Component (View Only)
const HomeTab = ({ ndr, directors, males, females, onPrintAgreements, onPrintPage }) => {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center print:hidden">
        <h3 className="text-xl font-bold">Event Details</h3>
        <div className="flex gap-2">
          <button
            onClick={onPrintAgreements}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            <Printer size={18} />
            Print Agreements
          </button>
          <button
            onClick={onPrintPage}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            <Printer size={18} />
            Print This Page
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-green-50 p-4 rounded">
          <p className="text-sm text-gray-600">Completed Riders</p>
          <p className="text-2xl font-bold text-green-600">{ndr.completedRiders || 0}</p>
        </div>
        <div className="bg-red-50 p-4 rounded">
          <p className="text-sm text-gray-600">Cancelled Riders</p>
          <p className="text-2xl font-bold text-red-600">{ndr.cancelledRiders || 0}</p>
        </div>
        <div className="bg-orange-50 p-4 rounded">
          <p className="text-sm text-gray-600">Terminated Riders</p>
          <p className="text-2xl font-bold text-orange-600">{ndr.terminatedRiders || 0}</p>
        </div>
        <div className="bg-blue-50 p-4 rounded">
          <p className="text-sm text-gray-600">Total Members</p>
          <p className="text-2xl font-bold text-blue-600">{directors.length + males.length + females.length}</p>
        </div>
      </div>

      <div>
        <h4 className="text-lg font-semibold mb-4">Signed Up Members</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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

// Assignments Tab - View Only
const AssignmentsTabViewOnly = ({ ndr, members }) => {
  const assignments = ndr.assignments || {
    cars: {},
    couch: [],
    phones: [],
    doc: null,
    duc: null,
    don: null,
    northgate: []
  };

  const getMemberById = (id) => members.find(m => m.id === id);

  return (
    <div className="space-y-6">
      <h3 className="text-xl font-bold">Member Assignments (View Only)</h3>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
          <h5 className="font-semibold text-purple-800 mb-2">DON (Director on Night)</h5>
          {assignments.don ? (
            <div className="bg-white p-2 rounded">
              <p className="text-sm font-medium">{getMemberById(assignments.don)?.name || 'Unknown'}</p>
            </div>
          ) : (
            <p className="text-sm text-gray-500 italic">Not assigned</p>
          )}
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h5 className="font-semibold text-blue-800 mb-2">DOC (Director on Call)</h5>
          {assignments.doc ? (
            <div className="bg-white p-2 rounded">
              <p className="text-sm font-medium">{getMemberById(assignments.doc)?.name || 'Unknown'}</p>
            </div>
          ) : (
            <p className="text-sm text-gray-500 italic">Not assigned</p>
          )}
        </div>

        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <h5 className="font-semibold text-green-800 mb-2">DUC (Deputy on Call)</h5>
          {assignments.duc ? (
            <div className="bg-white p-2 rounded">
              <p className="text-sm font-medium">{getMemberById(assignments.duc)?.name || 'Unknown'}</p>
            </div>
          ) : (
            <p className="text-sm text-gray-500 italic">Not assigned</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(carNum => (
          <div key={carNum} className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h5 className="font-semibold text-blue-800 mb-2">Car {carNum}</h5>
            <div className="space-y-1">
              {assignments.cars[carNum]?.length > 0 ? (
                assignments.cars[carNum].map(memberId => {
                  const member = getMemberById(memberId);
                  return member ? (
                    <div key={memberId} className="bg-white p-1 rounded text-xs">
                      {member.name}
                    </div>
                  ) : null;
                })
              ) : (
                <p className="text-xs text-gray-500 italic">Empty</p>
              )}
            </div>
          </div>
        ))}

        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
          <h5 className="font-semibold text-orange-800 mb-2">Couch</h5>
          <div className="space-y-1">
            {assignments.couch?.length > 0 ? (
              assignments.couch.map(memberId => {
                const member = getMemberById(memberId);
                return member ? (
                  <div key={memberId} className="bg-white p-1 rounded text-xs">
                    {member.name}
                  </div>
                ) : null;
              })
            ) : (
              <p className="text-xs text-gray-500 italic">Empty</p>
            )}
          </div>
        </div>

        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <h5 className="font-semibold text-green-800 mb-2">Phones</h5>
          <div className="space-y-1">
            {assignments.phones?.length > 0 ? (
              assignments.phones.map(memberId => {
                const member = getMemberById(memberId);
                return member ? (
                  <div key={memberId} className="bg-white p-1 rounded text-xs">
                    {member.name}
                  </div>
                ) : null;
              })
            ) : (
              <p className="text-xs text-gray-500 italic">Empty</p>
            )}
          </div>
        </div>

        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h5 className="font-semibold text-red-800 mb-2">Northgate</h5>
          <div className="space-y-1">
            {assignments.northgate?.length > 0 ? (
              assignments.northgate.map(memberId => {
                const member = getMemberById(memberId);
                return member ? (
                  <div key={memberId} className="bg-white p-1 rounded text-xs">
                    {member.name}
                  </div>
                ) : null;
              })
            ) : (
              <p className="text-xs text-gray-500 italic">Empty</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// Cars Tab - View Only
const CarsTabViewOnly = ({ ndr }) => {
  const cars = ndr.cars || [];

  return (
    <div className="space-y-6">
      <h3 className="text-xl font-bold">Car Information (View Only)</h3>

      <div className="space-y-4">
        {cars.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            <Car className="mx-auto mb-4 text-gray-400" size={48} />
            <p>No cars recorded</p>
          </div>
        ) : (
          cars.map(car => (
            <div key={car.id} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
              <h4 className="text-lg font-semibold mb-4">Car {car.carNumber}</h4>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <p className="text-sm font-medium text-gray-700">Make</p>
                  <p className="text-gray-900">{car.make || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-700">Model</p>
                  <p className="text-gray-900">{car.model || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-700">Color</p>
                  <p className="text-gray-900">{car.color || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-700">License Plate</p>
                  <p className="text-gray-900">{car.licensePlate || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-700">Driver</p>
                  <p className="text-gray-900">{car.driver || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-700">Navigator</p>
                  <p className="text-gray-900">{car.navigator || 'N/A'}</p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

// Notes Tab - View Only
const NotesTabViewOnly = ({ ndr }) => {
  const notes = ndr.notes || {
    leadership: {},
    carRoles: {},
    couchPhoneRoles: {},
    updates: [],
    summary: ''
  };

  return (
    <div className="space-y-6">
      <h3 className="text-xl font-bold">NDR Notes (View Only)</h3>

      <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
        <h4 className="font-semibold mb-4">Leadership Information</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <p className="text-sm font-medium text-gray-700">DON</p>
            <p className="text-gray-900">{notes.leadership?.don || 'N/A'}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-700">DOC</p>
            <p className="text-gray-900">{notes.leadership?.doc || 'N/A'}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-700">DUC</p>
            <p className="text-gray-900">{notes.leadership?.duc || 'N/A'}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-700">Executives</p>
            <p className="text-gray-900">{notes.leadership?.execs || 'N/A'}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-700">Directors</p>
            <p className="text-gray-900">{notes.leadership?.directors || 'N/A'}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-700">Couch</p>
            <p className="text-gray-900">{notes.couchPhoneRoles?.couch || 'N/A'}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-700">Phones</p>
            <p className="text-gray-900">{notes.couchPhoneRoles?.phones || 'N/A'}</p>
          </div>
        </div>
      </div>

      {Object.keys(notes.carRoles || {}).length > 0 && (
        <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
          <h4 className="font-semibold mb-4">Car Roles</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.entries(notes.carRoles).map(([carNum, roles]) => (
              <div key={carNum} className="border border-gray-200 rounded p-3 bg-white">
                <h5 className="font-medium text-sm mb-2">Car {carNum}</h5>
                <p className="text-sm"><span className="font-medium">Driver:</span> {roles.driver || 'N/A'}</p>
                <p className="text-sm"><span className="font-medium">Navigator:</span> {roles.navigator || 'N/A'}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
        <h4 className="font-semibold mb-4">Progress Updates</h4>
        {notes.updates?.length === 0 ? (
          <p className="text-sm text-gray-500 italic">No updates recorded</p>
        ) : (
          <div className="space-y-2">
            {notes.updates?.map(update => (
              <div key={update.id} className="bg-white p-3 rounded border-l-4 border-blue-500">
                <div className="flex justify-between items-start mb-1">
                  <span className="text-xs font-semibold text-blue-600">{update.time}</span>
                  <span className="text-xs text-gray-500">
                    {new Date(update.timestamp).toLocaleDateString()}
                  </span>
                </div>
                <p className="text-sm text-gray-700">{update.text}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
        <h4 className="font-semibold mb-4">Night Summary</h4>
        {notes.summary ? (
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{notes.summary}</p>
        ) : (
          <p className="text-sm text-gray-500 italic">No summary recorded</p>
        )}
      </div>
    </div>
  );
};

// Print Agreements Component
const PrintAgreements = ({ ndr, onClose }) => {
  const { directors = [], males = [], females = [] } = ndr;

  return (
    <div className="fixed inset-0 bg-white z-50 overflow-auto print:relative">
      <div className="max-w-4xl mx-auto p-8">
        <div className="mb-4 print:hidden flex gap-2">
          <button
            onClick={() => window.print()}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Print
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
          >
            Close
          </button>
        </div>

        {/* Male Agreement */}
        <div className="page-break mb-8 border-2 border-black p-6">
          <h2 className="text-xl font-bold text-center mb-4">Event Participant Agreement (Males)</h2>
          
          <div className="mb-6 text-sm">
            <p className="mb-2">By signing this form, I verify that:</p>
            <ol className="list-decimal ml-6 space-y-1">
              <li>I have not consumed any alcoholic beverages or illegal drugs today.</li>
              <li>I am 18 or older and have a valid driver's license.</li>
              <li>I am currently covered under a valid automobile liability insurance policy.</li>
            </ol>
          </div>

          <table className="w-full border-collapse border border-black">
            <thead>
              <tr className="bg-gray-100">
                <th className="border border-black p-2 text-left">Member Name</th>
                <th className="border border-black p-2 text-left">Signature</th>
                <th className="border border-black p-2 text-left">Cell Phone</th>
                <th className="border border-black p-2 text-left">Local Phone</th>
              </tr>
            </thead>
            <tbody>
              {males.map((member, index) => (
                <tr key={index}>
                  <td className="border border-black p-3">{member.name}</td>
                  <td className="border border-black p-3"></td>
                  <td className="border border-black p-3">{member.phone}</td>
                  <td className="border border-black p-3">{member.phone}</td>
                </tr>
              ))}
              {Array.from({ length: Math.max(0, 10 - males.length) }).map((_, i) => (
                <tr key={`empty-${i}`}>
                  <td className="border border-black p-3 h-12"></td>
                  <td className="border border-black p-3"></td>
                  <td className="border border-black p-3"></td>
                  <td className="border border-black p-3"></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Female Agreement */}
        <div className="page-break mb-8 border-2 border-black p-6">
          <h2 className="text-xl font-bold text-center mb-4">Event Participant Agreement (Females)</h2>
          
          <div className="mb-6 text-sm">
            <p className="mb-2">By signing this form, I verify that:</p>
            <ol className="list-decimal ml-6 space-y-1">
              <li>I have not consumed any alcoholic beverages or illegal drugs today.</li>
              <li>I am 18 or older and have a valid driver's license.</li>
              <li>I am currently covered under a valid automobile liability insurance policy.</li>
            </ol>
          </div>

          <table className="w-full border-collapse border border-black">
            <thead>
              <tr className="bg-gray-100">
                <th className="border border-black p-2 text-left">Member Name</th>
                <th className="border border-black p-2 text-left">Signature</th>
                <th className="border border-black p-2 text-left">Cell Phone</th>
                <th className="border border-black p-2 text-left">Local Phone</th>
              </tr>
            </thead>
            <tbody>
              {females.map((member, index) => (
                <tr key={index}>
                  <td className="border border-black p-3">{member.name}</td>
                  <td className="border border-black p-3"></td>
                  <td className="border border-black p-3">{member.phone}</td>
                  <td className="border border-black p-3">{member.phone}</td>
                </tr>
              ))}
              {Array.from({ length: Math.max(0, 10 - females.length) }).map((_, i) => (
                <tr key={`empty-${i}`}>
                  <td className="border border-black p-3 h-12"></td>
                  <td className="border border-black p-3"></td>
                  <td className="border border-black p-3"></td>
                  <td className="border border-black p-3"></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Driver Agreements */}
        {[1, 2, 3, 4, 5].map(carNum => (
          <div key={carNum} className="page-break mb-8 border-2 border-black p-6">
            <h2 className="text-lg font-bold text-center mb-4">Herschel Driver Agreement and Assumption of Risk</h2>
            <h3 className="text-center mb-4">Car {carNum}</h3>
            
            <div className="text-xs leading-relaxed mb-6">
              <p className="mb-3">
                By signing this document, the Driver, ____________________, agrees to drive a group CARPOOL members around BCS. 
                The Driver assumes the responsibility for himself/herself and of all members in the car. By signing this agreement, 
                the Driver acknowledges that CARPOOL purchases medical insurance to cover all conference attendees inside the transport 
                vehicle in the occurrence of an accident or in any other appropriate incident. However, the Driver also acknowledges 
                that CARPOOL does not purchase any insurance covering damage to the Driver's car or to third parties (persons or property) 
                involved in the accident. The responsibility is left with the Driver and their personal insurance to cover any costs 
                associated with vehicular and/or third party damage incurred.
              </p>
              
              <p className="mb-3">
                All Passengers, as listed below, acknowledge that by signing this agreement, CARPOOL does purchase insurance to cover 
                members in the Driver's vehicle to the extent provided by these policies. In the event that an accident does occur, 
                the Passenger's personal medical insurance will only be used as secondary coverage if CARPOOL's policy does not completely 
                cover costs from injuries resulting directly because of the accident. All Passengers also acknowledge that there are external 
                risks associated with riding in the Driver's vehicle which are out of CARPOOL's control and that each Passenger has voluntarily 
                chosen to assume these risks by riding in the Driver's vehicle.
              </p>
              
              <p>
                This is an agreement between CARPOOL, the Driver of the car transporting the members, and the Passengers in the transport vehicle.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-4 mb-6 border-t border-black pt-4">
              <div>
                <p className="text-xs mb-2">Director in Charge (Print)</p>
                <div className="border-b border-black h-8"></div>
              </div>
              <div>
                <p className="text-xs mb-2">Signature</p>
                <div className="border-b border-black h-8"></div>
              </div>
              <div>
                <p className="text-xs mb-2">Date</p>
                <div className="border-b border-black h-8"></div>
              </div>
            </div>

            <div className="mb-6 border-t border-black pt-4">
              <p className="text-sm font-semibold mb-3">Driver</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs mb-2">DRIVER (Print)</p>
                  <div className="border-b border-black h-8"></div>
                </div>
                <div>
                  <p className="text-xs mb-2">Signature</p>
                  <div className="border-b border-black h-8"></div>
                </div>
              </div>
            </div>

            <div className="border-t border-black pt-4">
              <p className="text-sm font-semibold mb-3">Passengers</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(passengerNum => (
                  <React.Fragment key={passengerNum}>
                    <div>
                      <p className="text-xs mb-1">Name (Print)</p>
                      <div className="border-b border-black h-6"></div>
                    </div>
                    <div>
                      <p className="text-xs mb-1">Signature</p>
                      <div className="border-b border-black h-6"></div>
                    </div>
                  </React.Fragment>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      <style>{`
        @media print {
          .page-break {
            page-break-after: always;
          }
          body {
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }
        }
      `}</style>
    </div>
  );
};
export default NDRReports;