import React, { useState, useEffect } from 'react';
import { db, auth } from '../firebase';
import { collection, query, onSnapshot, doc, updateDoc, deleteDoc, Timestamp, orderBy, where } from 'firebase/firestore';
import { Shield, CheckCircle, XCircle, MapPin, Clock, User, AlertTriangle } from 'lucide-react';

const AddressBlacklistManager = () => {
  const [pendingRequests, setPendingRequests] = useState([]);
  const [approvedBlacklists, setApprovedBlacklists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('pending');
  const [currentUser, setCurrentUser] = useState(null);

  // Fetch current user information
  useEffect(() => {
    const fetchCurrentUser = async () => {
      if (auth.currentUser) {
        const userDoc = await new Promise((resolve) => {
          const unsubscribe = onSnapshot(
            query(collection(db, 'members'), where('__name__', '==', auth.currentUser.uid)),
            (snapshot) => {
              unsubscribe();
              if (!snapshot.empty) {
                resolve(snapshot.docs[0].data());
              } else {
                resolve(null);
              }
            }
          );
        });
        setCurrentUser(userDoc);
      }
    };
    fetchCurrentUser();
  }, []);

  // Fetch pending requests
  useEffect(() => {
    const pendingQuery = query(
      collection(db, 'addressBlacklist'),
      orderBy('requestedAt', 'desc')
    );

    const unsubscribe = onSnapshot(pendingQuery, (snapshot) => {
      const pending = [];
      const approved = [];
      
      snapshot.docs.forEach(doc => {
        const data = { id: doc.id, ...doc.data() };
        if (data.status === 'pending') {
          pending.push(data);
        } else if (data.status === 'approved') {
          approved.push(data);
        }
      });

      setPendingRequests(pending);
      setApprovedBlacklists(approved);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleApprove = async (requestId, address) => {
    try {
      const requestRef = doc(db, 'addressBlacklist', requestId);
      await updateDoc(requestRef, {
        status: 'approved',
        approvedAt: Timestamp.now(),
        approvedBy: currentUser?.name || auth.currentUser?.email || 'Director',
        approvedByUid: auth.currentUser?.uid || null
      });
      
      alert(`Address blacklisted: ${address}`);
    } catch (error) {
      console.error('Error approving blacklist:', error);
      alert('Error approving blacklist: ' + error.message);
    }
  };

  const handleReject = async (requestId, address) => {
    if (!window.confirm(`Reject blacklist request for: ${address}?`)) {
      return;
    }

    try {
      const requestRef = doc(db, 'addressBlacklist', requestId);
      await deleteDoc(requestRef);
      
      alert(`Blacklist request rejected for: ${address}`);
    } catch (error) {
      console.error('Error rejecting blacklist:', error);
      alert('Error rejecting blacklist: ' + error.message);
    }
  };

  const handleRemoveBlacklist = async (requestId, address) => {
    if (!window.confirm(`Remove "${address}" from blacklist? This address will be allowed again.`)) {
      return;
    }

    try {
      const requestRef = doc(db, 'addressBlacklist', requestId);
      await deleteDoc(requestRef);
      
      alert(`Address removed from blacklist: ${address}`);
    } catch (error) {
      console.error('Error removing blacklist:', error);
      alert('Error removing blacklist: ' + error.message);
    }
  };

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
      {/* Header */}
      <div>
        <h2 className="text-3xl md:text-4xl font-bold text-gray-900 flex items-center gap-3">
          <Shield className="text-red-500" size={36} />
          Address Blacklist Manager
        </h2>
        <p className="text-gray-600 mt-1">Approve or reject address blacklist requests</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b-2 border-gray-200">
        <button
          onClick={() => setActiveTab('pending')}
          className={`px-6 py-3 font-semibold transition relative ${
            activeTab === 'pending'
              ? 'text-orange-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Pending Requests
          {pendingRequests.length > 0 && (
            <span className="ml-2 px-2 py-1 bg-orange-500 text-white text-xs rounded-full">
              {pendingRequests.length}
            </span>
          )}
          {activeTab === 'pending' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-orange-600"></div>
          )}
        </button>
        <button
          onClick={() => setActiveTab('approved')}
          className={`px-6 py-3 font-semibold transition relative ${
            activeTab === 'approved'
              ? 'text-red-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Approved Blacklists
          {approvedBlacklists.length > 0 && (
            <span className="ml-2 px-2 py-1 bg-red-500 text-white text-xs rounded-full">
              {approvedBlacklists.length}
            </span>
          )}
          {activeTab === 'approved' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-red-600"></div>
          )}
        </button>
      </div>

      {/* Pending Requests Tab */}
      {activeTab === 'pending' && (
        <div className="space-y-4">
          {pendingRequests.length === 0 ? (
            <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-12 text-center">
              <AlertTriangle className="mx-auto text-gray-300 mb-4" size={48} />
              <p className="text-gray-500 font-medium">No pending blacklist requests</p>
              <p className="text-sm text-gray-400 mt-2">Requests from Phone Room will appear here</p>
            </div>
          ) : (
            pendingRequests.map((request) => (
              <div key={request.id} className="bg-white rounded-2xl shadow-lg border-2 border-orange-300 overflow-hidden">
                <div className="bg-orange-50 p-4 border-b-2 border-orange-200">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="text-orange-600" size={20} />
                    <span className="font-bold text-orange-900 text-sm">PENDING APPROVAL</span>
                  </div>
                </div>

                <div className="p-6">
                  <div className="flex items-start gap-4 mb-6">
                    <MapPin className="text-orange-500 flex-shrink-0 mt-1" size={24} />
                    <div className="flex-1">
                      <h3 className="text-xl font-bold text-gray-900 mb-2">{request.address}</h3>
                      <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 mb-3">
                        <p className="text-sm font-semibold text-gray-700 mb-1">Reason:</p>
                        <p className="text-gray-900">{request.reason}</p>
                      </div>
                      <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                        <div className="flex items-center gap-2">
                          <Clock size={16} />
                          <span>Requested: {request.requestedAt?.toDate().toLocaleString()}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <User size={16} />
                          <span>By: {request.requestedBy}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={() => handleApprove(request.id, request.address)}
                      className="flex-1 py-3 bg-green-500 hover:bg-green-600 text-white rounded-xl transition font-bold flex items-center justify-center gap-2 shadow-lg"
                    >
                      <CheckCircle size={20} />
                      <span>Approve Blacklist</span>
                    </button>
                    <button
                      onClick={() => handleReject(request.id, request.address)}
                      className="flex-1 py-3 bg-red-500 hover:bg-red-600 text-white rounded-xl transition font-bold flex items-center justify-center gap-2 shadow-lg"
                    >
                      <XCircle size={20} />
                      <span>Reject Request</span>
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Approved Blacklists Tab */}
      {activeTab === 'approved' && (
        <div className="space-y-4">
          {approvedBlacklists.length === 0 ? (
            <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-12 text-center">
              <Shield className="mx-auto text-gray-300 mb-4" size={48} />
              <p className="text-gray-500 font-medium">No approved blacklists</p>
              <p className="text-sm text-gray-400 mt-2">Approved addresses will appear here</p>
            </div>
          ) : (
            approvedBlacklists.map((blacklist) => (
              <div key={blacklist.id} className="bg-white rounded-2xl shadow-lg border-2 border-red-300 overflow-hidden">
                <div className="bg-red-50 p-4 border-b-2 border-red-200">
                  <div className="flex items-center gap-2">
                    <Shield className="text-red-600" size={20} />
                    <span className="font-bold text-red-900 text-sm">BLACKLISTED</span>
                  </div>
                </div>

                <div className="p-6">
                  <div className="flex items-start gap-4 mb-4">
                    <MapPin className="text-red-500 flex-shrink-0 mt-1" size={24} />
                    <div className="flex-1">
                      <h3 className="text-xl font-bold text-gray-900 mb-2">{blacklist.address}</h3>
                      <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 mb-3">
                        <p className="text-sm font-semibold text-gray-700 mb-1">Reason:</p>
                        <p className="text-gray-900">{blacklist.reason}</p>
                      </div>
                      <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                        <div className="flex items-center gap-2">
                          <Clock size={16} />
                          <span>Approved: {blacklist.approvedAt?.toDate().toLocaleString()}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <User size={16} />
                          <span>By: {blacklist.approvedBy || 'Director'}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => handleRemoveBlacklist(blacklist.id, blacklist.address)}
                    className="w-full py-3 bg-gray-500 hover:bg-gray-600 text-white rounded-xl transition font-bold flex items-center justify-center gap-2"
                  >
                    <XCircle size={20} />
                    <span>Remove from Blacklist</span>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default AddressBlacklistManager;