// ========================================
// 2. AdminPanel.jsx - Component for managing email approvals
// Save this as src/components/AdminPanel.jsx
// ========================================

import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, onSnapshot, doc, updateDoc, addDoc, deleteDoc, Timestamp, where, orderBy, getDocs } from 'firebase/firestore';
import { Shield, Mail, Check, X, Plus, UserPlus, Clock, Trash2, Send } from 'lucide-react';
import { useAuth } from '../AuthContext';

const AdminPanel = () => {
  const [emailApprovals, setEmailApprovals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [activeTab, setActiveTab] = useState('pending');
  const { userProfile } = useAuth();

  useEffect(() => {
    const approvalsRef = collection(db, 'emailApprovals');
    const approvalsQuery = query(approvalsRef, orderBy('requestedAt', 'desc'));

    const unsubscribe = onSnapshot(approvalsQuery, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setEmailApprovals(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleApprove = async (approvalId, email) => {
    if (!window.confirm(`Approve registration for ${email}?`)) {
      return;
    }

    try {
      const approvalRef = doc(db, 'emailApprovals', approvalId);
      await updateDoc(approvalRef, {
        status: 'approved',
        approvedAt: Timestamp.now(),
        approvedBy: userProfile?.name || 'Admin',
        approvedByUid: userProfile?.id || null
      });

      // Here you would send an email invitation
      // This requires backend/Cloud Function setup
      alert(`${email} has been approved! They can now create an account.`);
    } catch (error) {
      console.error('Error approving:', error);
      alert('Error approving: ' + error.message);
    }
  };

  const handleReject = async (approvalId, email) => {
    if (!window.confirm(`Reject registration request for ${email}?`)) {
      return;
    }

    try {
      const approvalRef = doc(db, 'emailApprovals', approvalId);
      await updateDoc(approvalRef, {
        status: 'rejected',
        rejectedAt: Timestamp.now(),
        rejectedBy: userProfile?.name || 'Admin',
        rejectedByUid: userProfile?.id || null
      });

      alert(`Registration request for ${email} has been rejected.`);
    } catch (error) {
      console.error('Error rejecting:', error);
      alert('Error rejecting: ' + error.message);
    }
  };

  const handleDelete = async (approvalId, email) => {
    if (!window.confirm(`Delete approval record for ${email}?`)) {
      return;
    }

    try {
      await deleteDoc(doc(db, 'emailApprovals', approvalId));
      alert(`Approval record for ${email} has been deleted.`);
    } catch (error) {
      console.error('Error deleting:', error);
      alert('Error deleting: ' + error.message);
    }
  };

  const handlePreApprove = async (e) => {
    e.preventDefault();

    if (!newEmail || !newName) {
      alert('Please enter both email and name');
      return;
    }

    try {
      // Check if email already exists
      const existingRef = collection(db, 'emailApprovals');
      const existingQuery = query(existingRef, where('email', '==', newEmail.toLowerCase()));
      const snapshot = await getDocs(existingQuery);

      if (!snapshot.empty) {
        alert('This email is already in the system!');
        return;
      }

      await addDoc(collection(db, 'emailApprovals'), {
        email: newEmail.toLowerCase(),
        name: newName,
        status: 'approved',
        approved: true,
        preApproved: true,
        requestedAt: Timestamp.now(),
        approvedAt: Timestamp.now(),
        approvedBy: userProfile?.name || 'Admin',
        approvedByUid: userProfile?.id || null
      });

      // Here you would send an invitation email
      // This requires backend/Cloud Function setup
      alert(`${newEmail} has been pre-approved! An invitation email should be sent.`);
      
      setNewEmail('');
      setNewName('');
      setShowAddForm(false);
    } catch (error) {
      console.error('Error pre-approving:', error);
      alert('Error pre-approving email: ' + error.message);
    }
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  };

  const pendingApprovals = emailApprovals.filter(a => a.status === 'pending');
  const approvedEmails = emailApprovals.filter(a => a.status === 'approved');
  const rejectedEmails = emailApprovals.filter(a => a.status === 'rejected');

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-red-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading admin panel...</p>
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
            Admin Panel
          </h2>
          <p className="text-gray-600 mt-1">Manage email approvals and registrations</p>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-xl transition font-semibold flex items-center gap-2"
        >
          <UserPlus size={18} />
          {showAddForm ? 'Cancel' : 'Pre-Approve Email'}
        </button>
      </div>

      {/* Pre-Approve Form */}
      {showAddForm && (
        <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-200">
          <h3 className="text-xl font-bold mb-4">Pre-Approve Email</h3>
          <form onSubmit={handlePreApprove} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Full Name *
              </label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500"
                placeholder="John Doe"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Email Address *
              </label>
              <input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500"
                placeholder="student@tamu.edu"
                required
              />
            </div>

            <div className="flex gap-3">
              <button
                type="submit"
                className="flex-1 py-3 bg-green-600 text-white rounded-xl hover:bg-green-700 transition font-semibold flex items-center justify-center gap-2"
              >
                <Check size={18} />
                Approve & Send Invitation
              </button>
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="px-6 py-3 bg-gray-300 text-gray-700 rounded-xl hover:bg-gray-400 transition font-semibold"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Tabs */}
      <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
        <div className="flex border-b">
          <button
            onClick={() => setActiveTab('pending')}
            className={`flex-1 px-6 py-3 font-semibold transition ${
              activeTab === 'pending'
                ? 'text-red-600 border-b-2 border-red-600 -mb-0.5'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Pending Requests ({pendingApprovals.length})
          </button>
          <button
            onClick={() => setActiveTab('approved')}
            className={`flex-1 px-6 py-3 font-semibold transition ${
              activeTab === 'approved'
                ? 'text-red-600 border-b-2 border-red-600 -mb-0.5'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Approved ({approvedEmails.length})
          </button>
          <button
            onClick={() => setActiveTab('rejected')}
            className={`flex-1 px-6 py-3 font-semibold transition ${
              activeTab === 'rejected'
                ? 'text-red-600 border-b-2 border-red-600 -mb-0.5'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Rejected ({rejectedEmails.length})
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Pending Tab */}
          {activeTab === 'pending' && (
            <>
              {pendingApprovals.length === 0 ? (
                <div className="bg-gray-50 rounded-xl p-8 text-center">
                  <Clock className="mx-auto text-gray-400 mb-2" size={48} />
                  <p className="text-gray-600">No pending requests</p>
                </div>
              ) : (
                pendingApprovals.map(approval => (
                  <div key={approval.id} className="bg-white rounded-xl p-6 shadow-lg border-l-4 border-yellow-500">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex-1">
                        <h3 className="text-lg font-bold text-gray-900">{approval.name}</h3>
                        <p className="text-sm text-gray-600 mt-1">
                          <Mail className="inline mr-1" size={14} />
                          {approval.email}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          Requested: {formatDate(approval.requestedAt)}
                        </p>
                      </div>
                      <span className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs font-semibold">
                        PENDING
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleApprove(approval.id, approval.email)}
                        className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold text-sm flex items-center justify-center gap-2"
                      >
                        <Check size={16} />
                        Approve
                      </button>
                      <button
                        onClick={() => handleReject(approval.id, approval.email)}
                        className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold text-sm flex items-center justify-center gap-2"
                      >
                        <X size={16} />
                        Reject
                      </button>
                    </div>
                  </div>
                ))
              )}
            </>
          )}

          {/* Approved Tab */}
          {activeTab === 'approved' && (
            <>
              {approvedEmails.length === 0 ? (
                <div className="bg-gray-50 rounded-xl p-8 text-center">
                  <Shield className="mx-auto text-gray-400 mb-2" size={48} />
                  <p className="text-gray-600">No approved emails</p>
                </div>
              ) : (
                approvedEmails.map(approval => (
                  <div key={approval.id} className="bg-white rounded-xl p-6 shadow-lg border-l-4 border-green-500">
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex-1">
                        <h3 className="text-lg font-bold text-gray-900">{approval.name}</h3>
                        <p className="text-sm text-gray-600 mt-1">
                          <Mail className="inline mr-1" size={14} />
                          {approval.email}
                        </p>
                        <div className="text-xs text-gray-500 mt-2">
                          {approval.preApproved && (
                            <p className="text-blue-600 font-semibold">✓ Pre-approved by admin</p>
                          )}
                          <p>Approved: {formatDate(approval.approvedAt)}</p>
                          {approval.approvedBy && <p>By: {approval.approvedBy}</p>}
                        </div>
                      </div>
                      <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-xs font-semibold">
                        APPROVED
                      </span>
                    </div>
                    <button
                      onClick={() => handleDelete(approval.id, approval.email)}
                      className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg font-semibold text-sm flex items-center gap-2"
                    >
                      <Trash2 size={14} />
                      Delete Record
                    </button>
                  </div>
                ))
              )}
            </>
          )}

          {/* Rejected Tab */}
          {activeTab === 'rejected' && (
            <>
              {rejectedEmails.length === 0 ? (
                <div className="bg-gray-50 rounded-xl p-8 text-center">
                  <X className="mx-auto text-gray-400 mb-2" size={48} />
                  <p className="text-gray-600">No rejected requests</p>
                </div>
              ) : (
                rejectedEmails.map(approval => (
                  <div key={approval.id} className="bg-white rounded-xl p-6 shadow-lg border-l-4 border-red-500">
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex-1">
                        <h3 className="text-lg font-bold text-gray-900">{approval.name}</h3>
                        <p className="text-sm text-gray-600 mt-1">
                          <Mail className="inline mr-1" size={14} />
                          {approval.email}
                        </p>
                        <div className="text-xs text-gray-500 mt-2">
                          <p>Rejected: {formatDate(approval.rejectedAt)}</p>
                          {approval.rejectedBy && <p>By: {approval.rejectedBy}</p>}
                        </div>
                      </div>
                      <span className="px-3 py-1 bg-red-100 text-red-800 rounded-full text-xs font-semibold">
                        REJECTED
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleApprove(approval.id, approval.email)}
                        className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold text-sm flex items-center justify-center gap-2"
                      >
                        <Check size={16} />
                        Approve Anyway
                      </button>
                      <button
                        onClick={() => handleDelete(approval.id, approval.email)}
                        className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg font-semibold text-sm flex items-center gap-2"
                      >
                        <Trash2 size={14} />
                        Delete
                      </button>
                    </div>
                  </div>
                ))
              )}
            </>
          )}
        </div>
      </div>

      {/* Info Box */}
      <div className="bg-blue-50 border-2 border-blue-200 rounded-2xl p-6">
        <h3 className="font-bold text-blue-900 mb-2">How Email Approval Works</h3>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• <strong>Pre-Approve:</strong> Add emails before users register - they can create accounts immediately</li>
          <li>• <strong>Pending:</strong> Users who tried to register but weren't pre-approved - review and approve/reject</li>
          <li>• <strong>Note:</strong> Approved users will receive an invitation email (requires email service setup)</li>
        </ul>
      </div>
    </div>
  );
};

export default AdminPanel;