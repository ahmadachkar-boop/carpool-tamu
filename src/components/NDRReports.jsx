import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, onSnapshot, doc, getDoc, updateDoc, orderBy, Timestamp, getDocs, where, deleteDoc } from 'firebase/firestore';
import { useAuth } from '../AuthContext';
import { Play, Printer, FileText, Users, Car, ClipboardList, Archive, RotateCcw, GripVertical, Clock, AlertTriangle } from 'lucide-react';

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
        const activeNdrs = ndrs.filter(n => n.status === 'active');
        for (const activeNdr of activeNdrs) {
          await updateDoc(doc(db, 'ndrs', activeNdr.id), {
            status: 'completed',
            endedAt: Timestamp.now()
          });
        }

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
      // Calculate ride statistics
      const ridesRef = collection(db, 'rides');
      const ridesQuery = query(ridesRef, where('ndrId', '==', ndrId));
      const ridesSnapshot = await getDocs(ridesQuery);
      
      let completedRiders = 0, cancelledRiders = 0, terminatedRiders = 0;
      let completedRides = 0, cancelledRides = 0, terminatedRides = 0;
      
      ridesSnapshot.forEach(doc => {
        const data = doc.data();
        const status = data.status;
        const riders = data.riders || 1;
        
        if (status === 'completed') {
          completedRiders += riders;
          completedRides++;
        } else if (status === 'cancelled') {
          cancelledRiders += riders;
          cancelledRides++;
        } else if (status === 'terminated') {
          terminatedRiders += riders;
          terminatedRides++;
        }
      });

      // ===== NEW: Cleanup temporary blacklists for this NDR =====
      
      // Remove temporary address blacklists for this NDR
      const addressBlacklistRef = collection(db, 'addressBlacklist');
      const addressBlacklistQuery = query(
        addressBlacklistRef, 
        where('scope', '==', 'temporary'),
        where('ndrId', '==', ndrId)
      );
      const addressBlacklistSnapshot = await getDocs(addressBlacklistQuery);
      
      const addressDeletions = addressBlacklistSnapshot.docs.map(doc => 
        deleteDoc(doc.ref)
      );
      
      // Remove temporary phone blacklists for this NDR
      const phoneBlacklistRef = collection(db, 'phoneBlacklist');
      const phoneBlacklistQuery = query(
        phoneBlacklistRef,
        where('scope', '==', 'temporary'),
        where('ndrId', '==', ndrId)
      );
      const phoneBlacklistSnapshot = await getDocs(phoneBlacklistQuery);
      
      const phoneDeletions = phoneBlacklistSnapshot.docs.map(doc =>
        deleteDoc(doc.ref)
      );
      
      // Wait for all blacklist deletions to complete
      await Promise.all([...addressDeletions, ...phoneDeletions]);
      
      const totalBlacklistsRemoved = addressDeletions.length + phoneDeletions.length;
      
      console.log(`Removed ${totalBlacklistsRemoved} temporary blacklist(s) for NDR ${ndrId}`);
      
      // ===== END NEW CODE =====

      // Update NDR status
      await updateDoc(doc(db, 'ndrs', ndrId), {
        status: 'completed',
        endedAt: Timestamp.now(),
        completedRiders,
        cancelledRiders,
        terminatedRiders,
        completedRides,
        cancelledRides,
        terminatedRides
      });

      const message = totalBlacklistsRemoved > 0 
        ? `NDR ended. Phone Room and Ride Management are now disabled. Removed ${totalBlacklistsRemoved} temporary blacklist(s).`
        : 'NDR ended. Phone Room and Ride Management are now disabled.';
      
      alert(message);
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
    parts.push(`- Cars Available: ${ndrData.availableCars || 0}`);
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

  const now = new Date();
  const pendingNDRs = ndrs
    .filter(n => n.status === 'pending' && n.eventDate && n.eventDate >= now)
    .sort((a, b) => a.eventDate - b.eventDate);
  
  const activeNDR = ndrs.find(n => n.status === 'active');
  const archivedNDRs = ndrs.filter(n => n.status === 'archived').sort((a, b) => (b.archivedAt || 0) - (a.archivedAt || 0));
  const completedNDRs = ndrs.filter(n => n.status === 'completed').sort((a, b) => (b.endedAt || 0) - (a.endedAt || 0));

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-800">NDR Reports</h2>

      {activeNDR && (
        <div className="bg-green-50 border-2 border-green-500 rounded-lg p-6">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
            <h3 className="text-xl font-bold text-green-800">Currently Active</h3>
          </div>
          <NDRCard ndr={activeNDR} onView={setSelectedNdr} onEnd={endNDR} onArchive={archiveNDR} onActivate={activateNDR} />
        </div>
      )}

      {pendingNDRs.length > 0 && (
        <div className="bg-white rounded-lg shadow">
          <div className="p-4 border-b bg-blue-50">
            <h3 className="text-lg font-semibold text-blue-800">Next NDR to Activate</h3>
          </div>
          <div className="p-4">
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

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm mb-4">
        <div>
          <p className="text-gray-500">Members</p>
          <p className="font-semibold">{ndr.signedUpMembers?.length || 0}</p>
        </div>
        <div>
          <p className="text-gray-500">Cars Available</p>
          <p className="font-semibold text-blue-600">{ndr.availableCars || 0}</p>
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

const NDRDetail = ({ ndr, onBack }) => {
  const [activeTab, setActiveTab] = useState('home');
  const [members, setMembers] = useState([]);
  const [showPrintAgreements, setShowPrintAgreements] = useState(false);
  const [loading, setLoading] = useState(true);
  const [availableCars, setAvailableCars] = useState(ndr.availableCars || 0);
  
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

  // Auto-sync assignments to notes
  useEffect(() => {
    if (!isActive) return;
    
    const getMemberById = (id) => members.find(m => m.id === id);
    
    const updatedLeadership = {
      don: assignments.don ? getMemberById(assignments.don)?.name || '' : '',
      doc: assignments.doc ? getMemberById(assignments.doc)?.name || '' : '',
      duc: assignments.duc ? getMemberById(assignments.duc)?.name || '' : '',
      execs: notes.leadership.execs || '',
      directors: notes.leadership.directors || ''
    };
    
    const updatedCouchPhoneRoles = {
      couch: (assignments.couch || []).map(id => getMemberById(id)?.name).filter(Boolean).join(', '),
      phones: (assignments.phones || []).map(id => getMemberById(id)?.name).filter(Boolean).join(', ')
    };
    
    setNotes(prev => ({
      ...prev,
      leadership: updatedLeadership,
      couchPhoneRoles: updatedCouchPhoneRoles
    }));
  }, [assignments, members, isActive]);

  const saveData = async () => {
    if (!isActive) return;
    
    try {
      await updateDoc(doc(db, 'ndrs', ndr.id), {
        assignments,
        cars,
        notes,
        availableCars,
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
  }, [assignments, cars, notes, availableCars, isActive]);

  const organizeMembers = () => {
    const directors = members.filter(m => m.role === 'director');
    const nonDirectors = members.filter(m => m.role !== 'director');
    
    const males = nonDirectors.filter(m => {
      const gender = m.gender?.toLowerCase();
      return (gender === 'male' || gender === 'm' || gender === 'man');
    });
    const females = nonDirectors.filter(m => {
      const gender = m.gender?.toLowerCase();
      return (gender === 'female' || gender === 'f' || gender === 'woman');
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
                      ndr={{...ndr, availableCars}} 
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
                        availableCars={availableCars}
                        setAvailableCars={setAvailableCars}
                      />
                    ) : (
                      <AssignmentsTabViewOnly ndr={{...ndr, availableCars}} members={members} />
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
                      <NotesTabEditable 
                        notes={notes} 
                        setNotes={setNotes} 
                        ndrId={ndr.id}
                        assignments={assignments}
                        members={members}
                        ndr={ndr}
                      />
                    ) : (
                      <NotesTabViewOnly ndr={ndr} members={members} />
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

// Drag and Drop Assignments Tab with Car 1 Validation
const AssignmentsTabEditable = ({ assignments, setAssignments, members, directors, males, females, availableCars, setAvailableCars }) => {
  const [draggedMember, setDraggedMember] = useState(null);

  const handleDragStart = (e, member) => {
    setDraggedMember(member);
    e.dataTransfer.effectAllowed = 'copy';
  };

  const handleDragEnd = () => {
    setDraggedMember(null);
  };

  const validateCar1 = (carMembers, newMemberId) => {
    const getMemberById = (id) => members.find(m => m.id === id);
    const allMembers = [...carMembers, newMemberId].map(id => getMemberById(id)).filter(Boolean);
    
    const hasMale = allMembers.some(m => {
      const gender = m.gender?.toLowerCase();
      return (gender === 'male' || gender === 'm' || gender === 'man');
    });
    
    const hasFemale = allMembers.some(m => {
      const gender = m.gender?.toLowerCase();
      return (gender === 'female' || gender === 'f' || gender === 'woman');
    });
    
    return { hasMale, hasFemale };
  };

  const handleDrop = (e, role, carNum = null) => {
    e.preventDefault();
    if (!draggedMember) return;

    const isAlreadyAssigned = carNum 
      ? (assignments.cars[carNum] || []).includes(draggedMember.id)
      : role === 'don' || role === 'doc' || role === 'duc'
      ? assignments[role] === draggedMember.id
      : (assignments[role] || []).includes(draggedMember.id);

    if (isAlreadyAssigned) {
      alert(`${draggedMember.name} is already assigned to this position!`);
      return;
    }

    const isDuplicating = Object.entries(assignments).some(([key, value]) => {
      if (key === 'cars') {
        return Object.values(value).some(carMembers => carMembers.includes(draggedMember.id));
      }
      return Array.isArray(value) 
        ? value.includes(draggedMember.id)
        : value === draggedMember.id;
    });

    if (isDuplicating) {
      const shouldDuplicate = window.confirm(
        `${draggedMember.name} is already assigned elsewhere. Do you want to assign them to this position as well (duplicate)?`
      );
      if (!shouldDuplicate) return;
    }

    // Handle car assignments with Car 1 validation
    if (carNum) {
      const currentCar = assignments.cars[carNum] || [];
      const newCarMembers = [...currentCar, draggedMember.id];
      
      // Validate Car 1 requirements
      if (carNum === 1) {
        const validation = validateCar1(currentCar, draggedMember.id);
        
        if (!validation.hasMale || !validation.hasFemale) {
          const message = !validation.hasMale 
            ? 'Car 1 requires at least 1 male member. Please add a male to Car 1.'
            : 'Car 1 requires at least 1 female member. Please add a female to Car 1.';
          
          if (!window.confirm(message + ' Do you want to continue adding this member anyway?')) {
            return;
          }
        }
      }
      
      setAssignments({
        ...assignments,
        cars: {
          ...assignments.cars,
          [carNum]: newCarMembers
        }
      });
      return;
    }

    // Handle single role assignments (DON, DOC, DUC)
    if (role === 'don' || role === 'doc' || role === 'duc') {
      setAssignments({
        ...assignments,
        [role]: draggedMember.id
      });
      return;
    }

    // Handle multi-role assignments (couch, phones, northgate)
    const currentPosition = assignments[role] || [];
    setAssignments({
      ...assignments,
      [role]: [...currentPosition, draggedMember.id]
    });
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };

  const removeMember = (role, memberId, carNum = null) => {
    if (carNum) {
      const currentCar = assignments.cars[carNum] || [];
      setAssignments({
        ...assignments,
        cars: {
          ...assignments.cars,
          [carNum]: currentCar.filter(id => id !== memberId)
        }
      });
      return;
    }

    if (role === 'don' || role === 'doc' || role === 'duc') {
      setAssignments({
        ...assignments,
        [role]: null
      });
      return;
    }

    const currentPosition = assignments[role] || [];
    setAssignments({
      ...assignments,
      [role]: currentPosition.filter(id => id !== memberId)
    });
  };

  const getMemberById = (id) => members.find(m => m.id === id);

  // Check Car 1 compliance
  const car1Members = (assignments.cars[1] || []).map(id => getMemberById(id)).filter(Boolean);
  const car1HasMale = car1Members.some(m => {
    const gender = m.gender?.toLowerCase();
    return (gender === 'male' || gender === 'm' || gender === 'man');
  });
  const car1HasFemale = car1Members.some(m => {
    const gender = m.gender?.toLowerCase();
    return (gender === 'female' || gender === 'f' || gender === 'woman');
  });
  const car1Compliant = car1Members.length === 0 || (car1HasMale && car1HasFemale);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-bold">Member Assignments (Drag & Drop)</h3>
        
        {/* Cars Available Input */}
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-gray-700">Cars Available This Weekend:</label>
          <input
            type="number"
            min="0"
            max="20"
            value={availableCars}
            onChange={(e) => setAvailableCars(parseInt(e.target.value) || 0)}
            className="w-20 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      </div>

      {availableCars === 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-yellow-800 font-medium">
            ⚠️ Please set the number of cars available for this weekend above to begin assignments.
          </p>
        </div>
      )}

      {availableCars >= 1 && !car1Compliant && (
        <div className="bg-red-50 border-2 border-red-400 rounded-lg p-4 flex items-start gap-3">
          <AlertTriangle className="text-red-600 flex-shrink-0 mt-0.5" size={24} />
          <div>
            <p className="text-red-800 font-bold">Car 1 Requirements Not Met</p>
            <p className="text-red-700 text-sm mt-1">
              Car 1 must have at least 1 male and 1 female member. 
              Current: {car1HasMale ? '✓ Male' : '✗ Male'} | {car1HasFemale ? '✓ Female' : '✗ Female'}
            </p>
          </div>
        </div>
      )}

      {/* Available Members */}
      <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 bg-gray-50">
        <h4 className="font-semibold mb-3 text-gray-700">Available Members (Drag to Assign)</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
          {members.map(member => (
            <div
              key={member.id}
              draggable
              onDragStart={(e) => handleDragStart(e, member)}
              onDragEnd={handleDragEnd}
              className="bg-white border border-gray-300 rounded p-2 cursor-move hover:bg-blue-50 hover:border-blue-400 transition flex items-center gap-1"
            >
              <GripVertical size={14} className="text-gray-400" />
              <span className="text-sm font-medium truncate">{member.name}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Leadership Roles */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div
          onDrop={(e) => handleDrop(e, 'don')}
          onDragOver={handleDragOver}
          className="border-2 border-dashed border-purple-300 rounded-lg p-4 bg-purple-50 min-h-24"
        >
          <h5 className="font-semibold text-purple-800 mb-2">DON (Director on Night)</h5>
          {assignments.don ? (
            <div className="bg-white border border-purple-300 rounded p-2 flex justify-between items-center">
              <span className="text-sm font-medium">{getMemberById(assignments.don)?.name}</span>
              <button
                onClick={() => removeMember('don', assignments.don)}
                className="text-red-600 hover:text-red-800 text-xs"
              >
                ✕
              </button>
            </div>
          ) : (
            <p className="text-sm text-gray-500 italic">Drop director here</p>
          )}
        </div>

        <div
          onDrop={(e) => handleDrop(e, 'doc')}
          onDragOver={handleDragOver}
          className="border-2 border-dashed border-blue-300 rounded-lg p-4 bg-blue-50 min-h-24"
        >
          <h5 className="font-semibold text-blue-800 mb-2">DOC (Director on Call)</h5>
          {assignments.doc ? (
            <div className="bg-white border border-blue-300 rounded p-2 flex justify-between items-center">
              <span className="text-sm font-medium">{getMemberById(assignments.doc)?.name}</span>
              <button
                onClick={() => removeMember('doc', assignments.doc)}
                className="text-red-600 hover:text-red-800 text-xs"
              >
                ✕
              </button>
            </div>
          ) : (
            <p className="text-sm text-gray-500 italic">Drop director here</p>
          )}
        </div>

        <div
          onDrop={(e) => handleDrop(e, 'duc')}
          onDragOver={handleDragOver}
          className="border-2 border-dashed border-green-300 rounded-lg p-4 bg-green-50 min-h-24"
        >
          <h5 className="font-semibold text-green-800 mb-2">DUC (Director Under Cover)</h5>
          {assignments.duc ? (
            <div className="bg-white border border-green-300 rounded p-2 flex justify-between items-center">
              <span className="text-sm font-medium">{getMemberById(assignments.duc)?.name}</span>
              <button
                onClick={() => removeMember('duc', assignments.duc)}
                className="text-red-600 hover:text-red-800 text-xs"
              >
                ✕
              </button>
            </div>
          ) : (
            <p className="text-sm text-gray-500 italic">Drop director here (undercover)</p>
          )}
        </div>
      </div>

      {/* Cars and Other Positions */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: availableCars }, (_, i) => i + 1).map(carNum => {
          const isCarOne = carNum === 1;
          const carMembers = (assignments.cars[carNum] || []).map(id => getMemberById(id)).filter(Boolean);
          const hasMale = carMembers.some(m => {
            const gender = m.gender?.toLowerCase();
            return (gender === 'male' || gender === 'm' || gender === 'man');
          });
          const hasFemale = carMembers.some(m => {
            const gender = m.gender?.toLowerCase();
            return (gender === 'female' || gender === 'f' || gender === 'woman');
          });
          const isCompliant = carMembers.length === 0 || (hasMale && hasFemale);
          
          return (
            <div
              key={carNum}
              onDrop={(e) => handleDrop(e, null, carNum)}
              onDragOver={handleDragOver}
              className={`border-2 border-dashed rounded-lg p-4 min-h-32 ${
                isCarOne && !isCompliant
                  ? 'border-red-400 bg-red-50'
                  : 'border-blue-300 bg-blue-50'
              }`}
            >
              <h5 className={`font-semibold mb-2 flex items-center justify-between ${
                isCarOne && !isCompliant ? 'text-red-800' : 'text-blue-800'
              }`}>
                <span>Car {carNum}</span>
                {isCarOne && !isCompliant && (
                  <AlertTriangle size={16} className="text-red-600" />
                )}
              </h5>
              {isCarOne && (
                <p className="text-xs text-gray-600 mb-2">
                  Required: 1 Male + 1 Female
                </p>
              )}
              <div className="space-y-1">
                {(assignments.cars[carNum] || []).map(memberId => {
                  const member = getMemberById(memberId);
                  return member ? (
                    <div key={memberId} className="bg-white border border-blue-200 rounded p-1 flex justify-between items-center">
                      <span className="text-xs font-medium truncate">{member.name}</span>
                      <button
                        onClick={() => removeMember('cars', memberId, carNum)}
                        className="text-red-600 hover:text-red-800 text-xs ml-1"
                      >
                        ✕
                      </button>
                    </div>
                  ) : null;
                })}
                {(assignments.cars[carNum] || []).length === 0 && (
                  <p className="text-xs text-gray-500 italic">Drop members here</p>
                )}
              </div>
            </div>
          );
        })}

        <div
          onDrop={(e) => handleDrop(e, 'couch')}
          onDragOver={handleDragOver}
          className="border-2 border-dashed border-orange-300 rounded-lg p-4 bg-orange-50 min-h-32"
        >
          <h5 className="font-semibold text-orange-800 mb-2">Couch</h5>
          <div className="space-y-1">
            {(assignments.couch || []).map(memberId => {
              const member = getMemberById(memberId);
              return member ? (
                <div key={memberId} className="bg-white border border-orange-200 rounded p-1 flex justify-between items-center">
                  <span className="text-xs font-medium truncate">{member.name}</span>
                  <button
                    onClick={() => removeMember('couch', memberId)}
                    className="text-red-600 hover:text-red-800 text-xs ml-1"
                  >
                    ✕
                  </button>
                </div>
              ) : null;
            })}
            {(assignments.couch || []).length === 0 && (
              <p className="text-xs text-gray-500 italic">Drop members here</p>
            )}
          </div>
        </div>

        <div
          onDrop={(e) => handleDrop(e, 'phones')}
          onDragOver={handleDragOver}
          className="border-2 border-dashed border-green-300 rounded-lg p-4 bg-green-50 min-h-32"
        >
          <h5 className="font-semibold text-green-800 mb-2">Phones</h5>
          <div className="space-y-1">
            {(assignments.phones || []).map(memberId => {
              const member = getMemberById(memberId);
              return member ? (
                <div key={memberId} className="bg-white border border-green-200 rounded p-1 flex justify-between items-center">
                  <span className="text-xs font-medium truncate">{member.name}</span>
                  <button
                    onClick={() => removeMember('phones', memberId)}
                    className="text-red-600 hover:text-red-800 text-xs ml-1"
                  >
                    ✕
                  </button>
                </div>
              ) : null;
            })}
            {(assignments.phones || []).length === 0 && (
              <p className="text-xs text-gray-500 italic">Drop members here</p>
            )}
          </div>
        </div>

        <div
          onDrop={(e) => handleDrop(e, 'northgate')}
          onDragOver={handleDragOver}
          className="border-2 border-dashed border-red-300 rounded-lg p-4 bg-red-50 min-h-32"
        >
          <h5 className="font-semibold text-red-800 mb-2">Northgate</h5>
          <div className="space-y-1">
            {(assignments.northgate || []).map(memberId => {
              const member = getMemberById(memberId);
              return member ? (
                <div key={memberId} className="bg-white border border-red-200 rounded p-1 flex justify-between items-center">
                  <span className="text-xs font-medium truncate">{member.name}</span>
                  <button
                    onClick={() => removeMember('northgate', memberId)}
                    className="text-red-600 hover:text-red-800 text-xs ml-1"
                  >
                    ✕
                  </button>
                </div>
              ) : null;
            })}
            {(assignments.northgate || []).length === 0 && (
              <p className="text-xs text-gray-500 italic">Drop members here</p>
            )}
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

// Notes Tab - EDITABLE with timer and formatted report
const NotesTabEditable = ({ notes, setNotes, ndrId, assignments, members, ndr }) => {
  const [newUpdate, setNewUpdate] = useState('');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [lastUpdateTime, setLastUpdateTime] = useState(null);
  const [rideStats, setRideStats] = useState({
    completedRides: 0,
    cancelledRides: 0,
    terminatedRides: 0,
    completedRiders: 0,
    cancelledRiders: 0,
    terminatedRiders: 0
  });

  // Fetch ride statistics
  useEffect(() => {
    const fetchRideStats = async () => {
      try {
        const ridesRef = collection(db, 'rides');
        const ridesQuery = query(ridesRef, where('ndrId', '==', ndrId));
        
        const unsubscribe = onSnapshot(ridesQuery, (snapshot) => {
          let completed = 0, cancelled = 0, terminated = 0;
          let completedRiders = 0, cancelledRiders = 0, terminatedRiders = 0;
          
          snapshot.docs.forEach(doc => {
            const data = doc.data();
            const riders = data.riders || 1;
            
            if (data.status === 'completed') {
              completed++;
              completedRiders += riders;
            } else if (data.status === 'cancelled') {
              cancelled++;
              cancelledRiders += riders;
            } else if (data.status === 'terminated') {
              terminated++;
              terminatedRiders += riders;
            }
          });
          
          setRideStats({
            completedRides: completed,
            cancelledRides: cancelled,
            terminatedRides: terminated,
            completedRiders,
            cancelledRiders,
            terminatedRiders
          });
        });
        
        return () => unsubscribe();
      } catch (error) {
        console.error('Error fetching ride stats:', error);
      }
    };
    
    fetchRideStats();
  }, [ndrId]);

  // Update timer every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Track last update time
  useEffect(() => {
    if (notes.updates && notes.updates.length > 0) {
      const lastUpdate = notes.updates[notes.updates.length - 1];
      setLastUpdateTime(lastUpdate.timestamp);
    }
  }, [notes.updates]);

  const getTimeSinceLastUpdate = () => {
    if (!lastUpdateTime) return null;
    const diff = Math.floor((currentTime - new Date(lastUpdateTime)) / 1000 / 60);
    return diff;
  };

  const minutesSinceUpdate = getTimeSinceLastUpdate();
  const updateOverdue = minutesSinceUpdate !== null && minutesSinceUpdate >= 15;

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
      updates: [...(notes.updates || []), update]
    });
    setNewUpdate('');
  };

  // Generate formatted report
 // Generate formatted report as JSX
  const generateFormattedReport = () => {
    const getMemberById = (id) => members.find(m => m.id === id);
    
    const sortedCars = Object.entries(assignments.cars || {})
      .sort(([a], [b]) => parseInt(a) - parseInt(b));
    
    return (
      <div className="space-y-4">
        {/* Leadership */}
        <div>
          <p><strong>DON:</strong> {notes.leadership.don || 'Not assigned'}</p>
          <p><strong>DOC:</strong> {notes.leadership.doc || 'Not assigned'}</p>
          <p><strong>DUC:</strong> {notes.leadership.duc || 'Not assigned'}</p>
        </div>

        {/* Car Assignments */}
        <div>
          <p className="font-bold">CAR ASSIGNMENTS:</p>
          {sortedCars.length === 0 ? (
            <p className="ml-4">No cars assigned yet</p>
          ) : (
            <div className="ml-4">
              {sortedCars.map(([carNum, memberIds]) => {
                if (memberIds && memberIds.length > 0) {
                  const memberNames = memberIds.map(id => getMemberById(id)?.name || 'Unknown').join(', ');
                  return <p key={carNum}>Car {carNum}: {memberNames}</p>;
                }
                return null;
              })}
            </div>
          )}
        </div>

        {/* Progress Updates */}
        <div>
          <p className="font-bold">PROGRESS UPDATES:</p>
          {notes.updates && notes.updates.length > 0 ? (
            <div className="ml-4">
              {notes.updates.map(update => (
                <p key={update.id}>[{update.time}] {update.text}</p>
              ))}
            </div>
          ) : (
            <p className="ml-4">No updates yet</p>
          )}
        </div>

        {/* Ride Statistics */}
        <div>
          <p className="font-bold">RIDE STATISTICS:</p>
          <div className="ml-4">
            <p>Completed Rides: {rideStats.completedRides}</p>
            <p>Cancelled Rides: {rideStats.cancelledRides}</p>
            <p>Terminated Rides: {rideStats.terminatedRides}</p>
            <p className="mt-2">Completed Riders: {rideStats.completedRiders}</p>
            <p>Cancelled Riders: {rideStats.cancelledRiders}</p>
            <p>Terminated Riders: {rideStats.terminatedRiders}</p>
          </div>
        </div>
      </div>
    );
  };

  const downloadReportAsPDF = () => {
    const printContent = document.getElementById('formatted-report');
    if (!printContent) return;
    
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Please allow popups to download the PDF');
      return;
    }
    
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>NDR Night Report - ${ndr.eventName}</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              padding: 20px;
              max-width: 800px;
              margin: 0 auto;
            }
            h1 {
              text-align: center;
              margin-bottom: 20px;
            }
            h2 {
              margin-bottom: 10px;
            }
            .date {
              margin-bottom: 20px;
              color: #666;
            }
            .section {
              margin-bottom: 16px;
            }
            strong {
              font-weight: bold;
            }
            .font-bold {
              font-weight: bold;
            }
            .ml-4 {
              margin-left: 16px;
            }
            .mt-2 {
              margin-top: 8px;
            }
            @media print {
              @page {
                margin: 1in;
              }
            }
          </style>
        </head>
        <body>
          <h1>NDR Night Report</h1>
          <h2>${ndr.eventName}</h2>
          <p class="date">${new Date(ndr.eventDate).toLocaleDateString()}</p>
          ${printContent.innerHTML}
          <script>
            window.onload = function() {
              window.print();
            }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="space-y-6">
      <h3 className="text-xl font-bold">NDR Notes</h3>

      <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
        <h4 className="font-semibold mb-4">Leadership Information (Auto-synced from Assignments)</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">DON</label>
            <input
              type="text"
              value={notes.leadership.don}
              disabled
              className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 cursor-not-allowed"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">DOC</label>
            <input
              type="text"
              value={notes.leadership.doc}
              disabled
              className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 cursor-not-allowed"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">DUC</label>
            <input
              type="text"
              value={notes.leadership.duc}
              disabled
              className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 cursor-not-allowed"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Executives</label>
            <input
              type="text"
              value={notes.leadership.execs}
              onChange={(e) => setNotes({
                ...notes,
                leadership: { ...notes.leadership, execs: e.target.value }
              })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              placeholder="Names"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Directors</label>
            <input
              type="text"
              value={notes.leadership.directors}
              onChange={(e) => setNotes({
                ...notes,
                leadership: { ...notes.leadership, directors: e.target.value }
              })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              placeholder="Names"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Couch (Auto-synced)</label>
            <input
              type="text"
              value={notes.couchPhoneRoles.couch}
              disabled
              className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 cursor-not-allowed"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phones (Auto-synced)</label>
            <input
              type="text"
              value={notes.couchPhoneRoles.phones}
              disabled
              className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 cursor-not-allowed"
            />
          </div>
        </div>
      </div>

      <div className="border border-gray-200 rounded-lg p-4">
        <div className="flex justify-between items-center mb-4">
          <h4 className="font-semibold">Progress Updates</h4>
          {minutesSinceUpdate !== null && (
            <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium ${
              updateOverdue ? 'bg-red-100 text-red-800 animate-pulse' : 'bg-green-100 text-green-800'
            }`}>
              <Clock size={16} />
              {updateOverdue ? (
                <span>⚠️ Update overdue ({minutesSinceUpdate}min ago)</span>
              ) : (
                <span>Next update in {15 - minutesSinceUpdate}min</span>
              )}
            </div>
          )}
        </div>
        <div className="flex gap-2 mb-4">
          <input
            type="text"
            value={newUpdate}
            onChange={(e) => setNewUpdate(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && addUpdate()}
            placeholder="Add a progress update (recommended every 15 minutes)..."
            className="flex-1 px-3 py-2 border border-gray-300 rounded-md"
          />
          <button
            onClick={addUpdate}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Add Update
          </button>
        </div>
        <div className="space-y-2 max-h-96 overflow-y-auto">
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

      {/* Formatted Report - View Only */}
      {/* Formatted Report - View Only */}
      <div className="border-2 border-blue-300 rounded-lg p-4 bg-blue-50">
        <div className="flex justify-between items-center mb-4">
          <h4 className="font-semibold text-blue-900">Formatted Night Report</h4>
          <button
            onClick={downloadReportAsPDF}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 print:hidden"
          >
            <Printer size={18} />
            Download as PDF
          </button>
        </div>
        <div className="text-sm bg-white p-4 rounded border text-gray-800 max-h-96 overflow-y-auto" id="formatted-report">
          {generateFormattedReport()}
        </div>
        <p className="text-xs text-gray-600 mt-2 italic">
          This report auto-updates with your assignments and progress updates. Click "Download as PDF" to save.
        </p>
      </div>
    </div>
  );
};

// Home Tab Component
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

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-blue-50 p-4 rounded">
          <p className="text-sm text-gray-600">Cars Available</p>
          <p className="text-2xl font-bold text-blue-600">{ndr.availableCars || 0}</p>
        </div>
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
        <div className="bg-purple-50 p-4 rounded">
          <p className="text-sm text-gray-600">Total Members</p>
          <p className="text-2xl font-bold text-purple-600">{directors.length + males.length + females.length}</p>
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

// View Only Components
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

  const availableCars = ndr.availableCars || 0;
  const getMemberById = (id) => members.find(m => m.id === id);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-bold">Member Assignments (View Only)</h3>
        <div className="text-sm text-gray-600">
          <span className="font-semibold">Cars Available:</span> {availableCars}
        </div>
      </div>

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
          <h5 className="font-semibold text-green-800 mb-2">DUC (Director Under Cover)</h5>
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
        {Array.from({ length: availableCars }, (_, i) => i + 1).map(carNum => (
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

const NotesTabViewOnly = ({ ndr, members }) => {
  const notes = ndr.notes || {
    leadership: {},
    carRoles: {},
    couchPhoneRoles: {},
    updates: [],
    summary: ''
  };

  const assignments = ndr.assignments || { cars: {} };

  // Generate formatted report for view-only
 // Generate formatted report for view-only
  const generateFormattedReport = () => {
    const getMemberById = (id) => members.find(m => m.id === id);
    
    const sortedCars = Object.entries(assignments.cars || {})
      .sort(([a], [b]) => parseInt(a) - parseInt(b));

    return (
      <div className="space-y-4">
        {/* Leadership */}
        <div>
          <p><strong>DON:</strong> {notes.leadership?.don || 'Not assigned'}</p>
          <p><strong>DOC:</strong> {notes.leadership?.doc || 'Not assigned'}</p>
          <p><strong>DUC:</strong> {notes.leadership?.duc || 'Not assigned'}</p>
        </div>

        {/* Car Assignments */}
        <div>
          <p className="font-bold">CAR ASSIGNMENTS:</p>
          {sortedCars.length === 0 ? (
            <p className="ml-4">No cars assigned</p>
          ) : (
            <div className="ml-4">
              {sortedCars.map(([carNum, memberIds]) => {
                if (memberIds && memberIds.length > 0) {
                  const memberNames = memberIds.map(id => getMemberById(id)?.name || 'Unknown').join(', ');
                  return <p key={carNum}>Car {carNum}: {memberNames}</p>;
                }
                return null;
              })}
            </div>
          )}
        </div>

        {/* Progress Updates */}
        <div>
          <p className="font-bold">PROGRESS UPDATES:</p>
          {notes.updates && notes.updates.length > 0 ? (
            <div className="ml-4">
              {notes.updates.map(update => (
                <p key={update.id}>[{update.time}] {update.text}</p>
              ))}
            </div>
          ) : (
            <p className="ml-4">No updates recorded</p>
          )}
        </div>

        {/* Ride Statistics */}
        <div>
          <p className="font-bold">RIDE STATISTICS:</p>
          <div className="ml-4">
            <p>Completed Rides: {ndr.completedRides || 0}</p>
            <p>Cancelled Rides: {ndr.cancelledRides || 0}</p>
            <p>Terminated Rides: {ndr.terminatedRides || 0}</p>
            <p className="mt-2">Completed Riders: {ndr.completedRiders || 0}</p>
            <p>Cancelled Riders: {ndr.cancelledRiders || 0}</p>
            <p>Terminated Riders: {ndr.terminatedRiders || 0}</p>
          </div>
        </div>
      </div>
    );
  };

  const downloadReportAsPDF = () => {
    const printContent = document.getElementById('formatted-report-view');
    if (!printContent) return;
    
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Please allow popups to download the PDF');
      return;
    }
    
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>NDR Night Report - ${ndr.eventName}</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              padding: 20px;
              max-width: 800px;
              margin: 0 auto;
            }
            h1 {
              text-align: center;
              margin-bottom: 20px;
            }
            h2 {
              margin-bottom: 10px;
            }
            .date {
              margin-bottom: 20px;
              color: #666;
            }
            .section {
              margin-bottom: 16px;
            }
            strong {
              font-weight: bold;
            }
            .font-bold {
              font-weight: bold;
            }
            .ml-4 {
              margin-left: 16px;
            }
            .mt-2 {
              margin-top: 8px;
            }
            @media print {
              @page {
                margin: 1in;
              }
            }
          </style>
        </head>
        <body>
          <h1>NDR Night Report</h1>
          <h2>${ndr.eventName}</h2>
          <p class="date">${new Date(ndr.eventDate).toLocaleDateString()}</p>
          ${printContent.innerHTML}
          <script>
            window.onload = function() {
              window.print();
            }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
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

      {/* Formatted Report - View Only */}
      <div className="border-2 border-blue-300 rounded-lg p-4 bg-blue-50">
        <div className="flex justify-between items-center mb-4">
          <h4 className="font-semibold text-blue-900">Formatted Night Report</h4>
          <button
            onClick={downloadReportAsPDF}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 print:hidden"
          >
            <Printer size={18} />
            Download as PDF
          </button>
        </div>
        <div className="text-sm bg-white p-4 rounded border text-gray-800 max-h-96 overflow-y-auto" id="formatted-report-view">
          {generateFormattedReport()}
        </div>
      </div>
    </div>
  );
};

// Print Agreements - Directors counted by their actual gender
const PrintAgreements = ({ ndr, onClose }) => {
  const { directors = [], males = [], females = [] } = ndr;

  // Separate directors by gender for agreement forms
  const maleDirectors = directors.filter(m => {
    const gender = m.gender?.toLowerCase();
    return (gender === 'male' || gender === 'm' || gender === 'man');
  });
  
  const femaleDirectors = directors.filter(m => {
    const gender = m.gender?.toLowerCase();
    return (gender === 'female' || gender === 'f' || gender === 'woman');
  });

  // Combine directors with their respective genders for agreement forms
  const allMales = [...males, ...maleDirectors];
  const allFemales = [...females, ...femaleDirectors];

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

        {/* Male Agreement - non-director males + male directors */}
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
              {allMales.map((member, index) => (
                <tr key={index}>
                  <td className="border border-black p-3">{member.name}</td>
                  <td className="border border-black p-3"></td>
                  <td className="border border-black p-3">{member.phone}</td>
                  <td className="border border-black p-3">{member.phone}</td>
                </tr>
              ))}
              {Array.from({ length: Math.max(0, 10 - allMales.length) }).map((_, i) => (
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

        {/* Female Agreement - non-director females + female directors */}
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
              {allFemales.map((member, index) => (
                <tr key={index}>
                  <td className="border border-black p-3">{member.name}</td>
                  <td className="border border-black p-3"></td>
                  <td className="border border-black p-3">{member.phone}</td>
                  <td className="border border-black p-3">{member.phone}</td>
                </tr>
              ))}
              {Array.from({ length: Math.max(0, 10 - allFemales.length) }).map((_, i) => (
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

        {/* Director Agreement section removed - directors now appear on gender-specific forms */}

        {/* Driver Agreements remain the same... */}
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