import React, { useState, useEffect } from 'react';
import { db, auth } from '../firebase';
import { collection, query, onSnapshot, doc, updateDoc, deleteDoc, Timestamp, where, orderBy, addDoc } from 'firebase/firestore';
import { Shield, AlertTriangle, CheckCircle, XCircle, Clock, Trash2, MapPin, Phone } from 'lucide-react';
import { useAuth } from '../AuthContext';
import { useActiveNDR } from '../ActiveNDRContext';


const AddressBlacklistManager = () => {
  const [requests, setRequests] = useState([]);
  const [phoneBlacklist, setPhoneBlacklist] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('pending');
  const [showAddForm, setShowAddForm] = useState(false);
  const [newEntry, setNewEntry] = useState({
    type: 'address',
    value: '',
    reason: '',
    scope: 'permanent',
    appliesToPickup: true,
    appliesToDropoff: true
  });
  const { currentUser, userProfile } = useAuth();
    const { activeNDR } = useActiveNDR();


  useEffect(() => {
    setLoading(true);

    // Listen to address blacklist
    const addressQuery = query(collection(db, 'addressBlacklist'), orderBy('requestedAt', 'desc'));
    const unsubAddress = onSnapshot(addressQuery, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setRequests(data);
      setLoading(false);
    });

    // Listen to phone blacklist
    const phoneQuery = query(collection(db, 'phoneBlacklist'), orderBy('createdAt', 'desc'));
    const unsubPhone = onSnapshot(phoneQuery, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setPhoneBlacklist(data);
    });

    return () => {
      unsubAddress();
      unsubPhone();
    };
  }, []);

  const handleAddEntry = async () => {
    if (!newEntry.value || !newEntry.reason) {
      alert('Please fill in all required fields');
      return;
    }

    try {
      const collectionName = newEntry.type === 'address' ? 'addressBlacklist' : 'phoneBlacklist';
      
      const data = {
        [newEntry.type]: newEntry.value,
        reason: newEntry.reason,
        status: 'approved',
        scope: newEntry.scope,
        requestedAt: Timestamp.now(),
        approvedAt: Timestamp.now(),
        requestedBy: userProfile?.name || auth.currentUser?.email || 'Director',
        requestedByUid: auth.currentUser?.uid || null,
        approvedBy: userProfile?.name || auth.currentUser?.email || 'Director',
        approvedByUid: auth.currentUser?.uid || null,
        createdAt: Timestamp.now(),
        ndrId: newEntry.scope === 'temporary' ? (activeNDR?.id || null) : null
      };

      if (newEntry.type === 'address') {
        data.appliesToPickup = newEntry.appliesToPickup;
        data.appliesToDropoff = newEntry.appliesToDropoff;
      }

      await addDoc(collection(db, collectionName), data);
      
      alert(`${newEntry.type === 'address' ? 'Address' : 'Phone number'} blacklisted successfully!`);
      setNewEntry({
        type: 'address',
        value: '',
        reason: '',
        scope: 'permanent',
        appliesToPickup: true,
        appliesToDropoff: true
      });
      setShowAddForm(false);
    } catch (error) {
      console.error('Error adding blacklist entry:', error);
      alert('Error adding entry: ' + error.message);
    }
  };

  const handleApprove = async (requestId, value, type = 'address') => {
    if (!window.confirm(`Approve blacklist for: ${value}?`)) {
      return;
    }

    try {
      const collectionName = type === 'address' ? 'addressBlacklist' : 'phoneBlacklist';
      const requestRef = doc(db, collectionName, requestId);
      await updateDoc(requestRef, {
        status: 'approved',
        approvedAt: Timestamp.now(),
        approvedBy: userProfile?.name || auth.currentUser?.email || 'Director',
        approvedByUid: auth.currentUser?.uid || null
      });
      
      alert(`${type === 'address' ? 'Address' : 'Phone number'} blacklisted: ${value}`);
    } catch (error) {
      console.error('Error approving blacklist:', error);
      alert('Error approving: ' + error.message);
    }
  };

  const handleReject = async (requestId, value, type = 'address') => {
    if (!window.confirm(`Reject blacklist request for: ${value}?`)) {
      return;
    }

    try {
      const collectionName = type === 'address' ? 'addressBlacklist' : 'phoneBlacklist';
      const requestRef = doc(db, collectionName, requestId);
      await deleteDoc(requestRef);
      
      alert(`Request rejected for: ${value}`);
    } catch (error) {
      console.error('Error rejecting:', error);
      alert('Error rejecting: ' + error.message);
    }
  };

  const handleRemove = async (requestId, value, type = 'address') => {
    if (!window.confirm(`Remove "${value}" from blacklist?`)) {
      return;
    }

    try {
      const collectionName = type === 'address' ? 'addressBlacklist' : 'phoneBlacklist';
      const requestRef = doc(db, collectionName, requestId);
      await deleteDoc(requestRef);
      
      alert(`${type === 'address' ? 'Address' : 'Phone number'} removed from blacklist: ${value}`);
    } catch (error) {
      console.error('Error removing:', error);
      alert('Error removing: ' + error.message);
    }
  };

  const pendingAddressRequests = requests.filter(r => r.status === 'pending');
  const approvedAddressRequests = requests.filter(r => r.status === 'approved');
  const pendingPhoneRequests = phoneBlacklist.filter(p => p.status === 'pending');
  const approvedPhoneRequests = phoneBlacklist.filter(p => p.status === 'approved');

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-red-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading blacklist manager...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-0">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 flex items-center gap-3">
            <Shield className="text-red-500" size={36} />
            Blacklist Manager
          </h2>
          <p className="text-gray-600 mt-1">Manage address and phone number blacklists</p>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-xl transition font-semibold"
        >
          {showAddForm ? 'Cancel' : '+ Add Blacklist Entry'}
        </button>
      </div>

      {/* Add Entry Form */}
      {showAddForm && (
        <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-200">
          <h3 className="text-xl font-bold mb-4">Add Blacklist Entry</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Type</label>
              <select
                value={newEntry.type}
                onChange={(e) => setNewEntry({...newEntry, type: e.target.value})}
                className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500"
              >
                <option value="address">Address</option>
                <option value="phone">Phone Number</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                {newEntry.type === 'address' ? 'Address' : 'Phone Number'}
              </label>
              <input
                type="text"
                value={newEntry.value}
                onChange={(e) => setNewEntry({...newEntry, value: e.target.value})}
                placeholder={newEntry.type === 'address' ? 'Enter address...' : 'Enter phone number...'}
                className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Scope</label>
              <select
                value={newEntry.scope}
                onChange={(e) => setNewEntry({...newEntry, scope: e.target.value})}
                className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500"
              >
                <option value="permanent">Permanent</option>
                <option value="temporary">Temporary (Current NDR Only)</option>
              </select>
            </div>

            {newEntry.type === 'address' && (
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Applies To</label>
                <div className="space-y-2">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={newEntry.appliesToPickup}
                      onChange={(e) => setNewEntry({...newEntry, appliesToPickup: e.target.checked})}
                      className="w-4 h-4"
                    />
                    <span>Pickups</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={newEntry.appliesToDropoff}
                      onChange={(e) => setNewEntry({...newEntry, appliesToDropoff: e.target.checked})}
                      className="w-4 h-4"
                    />
                    <span>Dropoffs</span>
                  </label>
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Reason</label>
              <textarea
                value={newEntry.reason}
                onChange={(e) => setNewEntry({...newEntry, reason: e.target.value})}
                placeholder="Explain why this should be blacklisted..."
                className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 min-h-[80px]"
              />
            </div>

            <button
              onClick={handleAddEntry}
              className="w-full py-3 bg-red-500 hover:bg-red-600 text-white rounded-xl font-semibold"
            >
              Add to Blacklist
            </button>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 border-b-2 border-gray-200 overflow-x-auto">
        <button
          onClick={() => setActiveTab('pending')}
          className={`px-6 py-3 font-semibold transition relative whitespace-nowrap ${
            activeTab === 'pending'
              ? 'text-red-600 border-b-2 border-red-600 -mb-0.5'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Pending Requests ({pendingAddressRequests.length + pendingPhoneRequests.length})
        </button>
        <button
          onClick={() => setActiveTab('address-approved')}
          className={`px-6 py-3 font-semibold transition relative whitespace-nowrap ${
            activeTab === 'address-approved'
              ? 'text-red-600 border-b-2 border-red-600 -mb-0.5'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Address Blacklist ({approvedAddressRequests.length})
        </button>
        <button
          onClick={() => setActiveTab('phone-approved')}
          className={`px-6 py-3 font-semibold transition relative whitespace-nowrap ${
            activeTab === 'phone-approved'
              ? 'text-red-600 border-b-2 border-red-600 -mb-0.5'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Phone Blacklist ({approvedPhoneRequests.length})
        </button>
      </div>

      {/* Content */}
      <div className="space-y-4">
        {activeTab === 'pending' && (
          <>
            {pendingAddressRequests.length === 0 && pendingPhoneRequests.length === 0 ? (
              <div className="bg-gray-50 rounded-xl p-8 text-center">
                <Clock className="mx-auto text-gray-400 mb-2" size={48} />
                <p className="text-gray-600">No pending blacklist requests</p>
              </div>
            ) : (
              <>
                {/* Address Requests */}
                {pendingAddressRequests.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                      <MapPin size={20} className="text-yellow-500" />
                      Pending Address Requests ({pendingAddressRequests.length})
                    </h3>
                    {pendingAddressRequests.map(request => (
                      <div key={request.id} className="bg-white rounded-xl p-6 shadow-lg border-l-4 border-yellow-500">
                        <div className="flex justify-between items-start mb-4">
                          <div className="flex-1">
                            <h3 className="text-lg font-bold text-gray-900">{request.address}</h3>
                            <p className="text-sm text-gray-600 mt-1">Requested by: {request.requestedBy}</p>
                            <p className="text-xs text-gray-500 mt-1">
                              {request.requestedAt?.toDate().toLocaleString()}
                            </p>
                          </div>
                          <div className="flex flex-col items-end gap-2">
                            <span className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs font-semibold">
                              PENDING
                            </span>
                            <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                              request.scope === 'temporary' ? 'bg-orange-100 text-orange-800' : 'bg-red-100 text-red-800'
                            }`}>
                              {request.scope === 'temporary' ? 'TEMP' : 'PERM'}
                            </span>
                          </div>
                        </div>
                        {request.appliesToPickup !== undefined && (
                          <div className="mb-3 text-sm text-gray-600">
                            <strong>Applies to:</strong> {request.appliesToPickup && request.appliesToDropoff ? 'Pickup & Dropoff' :
                             request.appliesToPickup ? 'Pickup Only' : 'Dropoff Only'}
                          </div>
                        )}
                        <div className="bg-gray-50 rounded-lg p-4 mb-4">
                          <p className="text-sm text-gray-700"><strong>Reason:</strong> {request.reason}</p>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleApprove(request.id, request.address, 'address')}
                            className="flex-1 px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg font-semibold"
                          >
                            <CheckCircle className="inline mr-2" size={16} />
                            Approve
                          </button>
                          <button
                            onClick={() => handleReject(request.id, request.address, 'address')}
                            className="flex-1 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg font-semibold"
                          >
                            <XCircle className="inline mr-2" size={16} />
                            Reject
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Phone Requests */}
                {pendingPhoneRequests.length > 0 && (
                  <div className="space-y-3 mt-6">
                    <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                      <Phone size={20} className="text-yellow-500" />
                      Pending Phone Requests ({pendingPhoneRequests.length})
                    </h3>
                    {pendingPhoneRequests.map(request => (
                      <div key={request.id} className="bg-white rounded-xl p-6 shadow-lg border-l-4 border-yellow-500">
                        <div className="flex justify-between items-start mb-4">
                          <div className="flex-1">
                            <h3 className="text-lg font-bold text-gray-900">{request.phone}</h3>
                            <p className="text-sm text-gray-600 mt-1">Requested by: {request.requestedBy}</p>
                            <p className="text-xs text-gray-500 mt-1">
                              {request.requestedAt?.toDate().toLocaleString()}
                            </p>
                          </div>
                          <div className="flex flex-col items-end gap-2">
                            <span className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs font-semibold">
                              PENDING
                            </span>
                            <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                              request.scope === 'temporary' ? 'bg-orange-100 text-orange-800' : 'bg-red-100 text-red-800'
                            }`}>
                              {request.scope === 'temporary' ? 'TEMP' : 'PERM'}
                            </span>
                          </div>
                        </div>
                        <div className="bg-gray-50 rounded-lg p-4 mb-4">
                          <p className="text-sm text-gray-700"><strong>Reason:</strong> {request.reason}</p>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleApprove(request.id, request.phone, 'phone')}
                            className="flex-1 px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg font-semibold"
                          >
                            <CheckCircle className="inline mr-2" size={16} />
                            Approve
                          </button>
                          <button
                            onClick={() => handleReject(request.id, request.phone, 'phone')}
                            className="flex-1 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg font-semibold"
                          >
                            <XCircle className="inline mr-2" size={16} />
                            Reject
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </>
        )}

        {activeTab === 'address-approved' && (
          <>
            {approvedAddressRequests.length === 0 ? (
              <div className="bg-gray-50 rounded-xl p-8 text-center">
                <Shield className="mx-auto text-gray-400 mb-2" size={48} />
                <p className="text-gray-600">No blacklisted addresses</p>
              </div>
            ) : (
              approvedAddressRequests.map(request => (
                <div key={request.id} className="bg-white rounded-xl p-6 shadow-lg border-l-4 border-red-500">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex-1">
                      <h3 className="text-lg font-bold text-gray-900">{request.address}</h3>
                      <p className="text-sm text-gray-600">Approved by: {request.approvedBy || request.requestedBy}</p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        request.scope === 'temporary' ? 'bg-orange-100 text-orange-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {request.scope === 'temporary' ? 'TEMPORARY' : 'PERMANENT'}
                      </span>
                      {request.appliesToPickup !== undefined && (
                        <span className="text-xs text-gray-600">
                          {request.appliesToPickup && request.appliesToDropoff ? 'Pickup & Dropoff' :
                           request.appliesToPickup ? 'Pickup Only' : 'Dropoff Only'}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3 mb-3">
                    <p className="text-sm text-gray-700">{request.reason}</p>
                  </div>
                  <button
                    onClick={() => handleRemove(request.id, request.address, 'address')}
                    className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg font-semibold text-sm"
                  >
                    <Trash2 className="inline mr-2" size={14} />
                    Remove from Blacklist
                  </button>
                </div>
              ))
            )}
          </>
        )}

        {activeTab === 'phone-approved' && (
          <>
            {approvedPhoneRequests.length === 0 ? (
              <div className="bg-gray-50 rounded-xl p-8 text-center">
                <Shield className="mx-auto text-gray-400 mb-2" size={48} />
                <p className="text-gray-600">No blacklisted phone numbers</p>
              </div>
            ) : (
              approvedPhoneRequests.map(entry => (
                <div key={entry.id} className="bg-white rounded-xl p-6 shadow-lg border-l-4 border-red-500">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex-1">
                      <h3 className="text-lg font-bold text-gray-900">{entry.phone}</h3>
                      <p className="text-sm text-gray-600">Added by: {entry.approvedBy || entry.requestedBy}</p>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      entry.scope === 'temporary' ? 'bg-orange-100 text-orange-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {entry.scope === 'temporary' ? 'TEMPORARY' : 'PERMANENT'}
                    </span>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3 mb-3">
                    <p className="text-sm text-gray-700">{entry.reason}</p>
                  </div>
                  <button
                    onClick={() => handleRemove(entry.id, entry.phone, 'phone')}
                    className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg font-semibold text-sm"
                  >
                    <Trash2 className="inline mr-2" size={14} />
                    Remove from Blacklist
                  </button>
                </div>
              ))
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default AddressBlacklistManager;