import React, { useState, useEffect } from 'react';
import { useAuth } from '../AuthContext';
import { db } from '../firebase';
import { doc, updateDoc, collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { User, Mail, Phone, MapPin, Car as CarIcon, Award, Calendar, Clock, Edit2, Save, X, TrendingUp } from 'lucide-react';

const MemberProfile = () => {
  const { userProfile } = useAuth();
  // Phone number formatting function
  const formatPhoneNumber = (value) => {
    const cleaned = value.replace(/\D/g, '');
    const limited = cleaned.slice(0, 10);
    
    if (limited.length <= 3) {
      return limited;
    } else if (limited.length <= 6) {
      return `(${limited.slice(0, 3)}) ${limited.slice(3)}`;
    } else {
      return `(${limited.slice(0, 3)}) ${limited.slice(3, 6)}-${limited.slice(6)}`;
    }
  };
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({});
  const [memberStats, setMemberStats] = useState({
    totalNights: 0,
    totalRides: 0,
    totalGasups: 0,
    totalPickups: 0,
    points: 0
  });
  const [recentActivity, setRecentActivity] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (userProfile) {
      setFormData({
        name: userProfile.name || '',
        phone: userProfile.phone || '',
        address: userProfile.address || '',
        city: userProfile.city || '',
        state: userProfile.state || '',
        zip: userProfile.zip || '',
        carInfo: userProfile.carInfo || '',
        dietaryRestrictions: userProfile.dietaryRestrictions || '',
        emergencyContact: userProfile.emergencyContact || '',
        emergencyPhone: userProfile.emergencyPhone || '',
        pronouns: userProfile.pronouns || ''
      });

      // Fetch member stats
      const stats = {
        totalNights: userProfile.nightsWorked || 0,
        points: userProfile.points || 0,
        totalRides: 0,
        totalGasups: 0,
        totalPickups: 0
      };

      // Query events this member signed up for
      const eventsQuery = query(
        collection(db, 'events'),
        where('signedUp', 'array-contains', userProfile.id)
      );

      const unsubEvents = onSnapshot(eventsQuery, (snapshot) => {
        const gasups = snapshot.docs.filter(doc => doc.data().type?.toLowerCase() === 'gasups').length;
        const pickups = snapshot.docs.filter(doc => doc.data().type?.toLowerCase() === 'pickups').length;
        const operatingNights = snapshot.docs.filter(doc => doc.data().type?.toLowerCase() === 'operating night').length;

        setMemberStats(prev => ({
          ...prev,
          totalGasups: gasups,
          totalPickups: pickups,
          totalNights: operatingNights
        }));
      });

      // Query recent NDRs member participated in
      const ndrsQuery = query(
        collection(db, 'ndrs'),
        orderBy('date', 'desc')
      );

      const unsubNdrs = onSnapshot(ndrsQuery, (snapshot) => {
        const activities = [];
        
        snapshot.docs.forEach(doc => {
          const ndr = doc.data();
          const memberAssignment = [
            ...(ndr.directors || []),
            ...(ndr.males || []),
            ...(ndr.females || [])
          ].find(m => m.id === userProfile.id);

          if (memberAssignment) {
            activities.push({
              id: doc.id,
              type: 'ndr',
              eventName: ndr.eventName,
              date: ndr.date,
              role: memberAssignment.role || 'Member',
              completedRiders: ndr.completedRiders || 0,
              cancelledRiders: ndr.cancelledRiders || 0
            });
          }
        });

        setRecentActivity(activities.slice(0, 10));
        setLoading(false);
      });

      return () => {
        unsubEvents();
        unsubNdrs();
      };
    }
  }, [userProfile]);

  const handleSave = async () => {
    try {
      const memberRef = doc(db, 'members', userProfile.id);
      await updateDoc(memberRef, {
        ...formData,
        updatedAt: new Date()
      });
      alert('Profile updated successfully!');
      setIsEditing(false);
    } catch (error) {
      console.error('Error updating profile:', error);
      alert('Error updating profile: ' + error.message);
    }
  };

  const handleCancel = () => {
    setFormData({
      name: userProfile.name || '',
      phone: userProfile.phone || '',
      address: userProfile.address || '',
      city: userProfile.city || '',
      state: userProfile.state || '',
      zip: userProfile.zip || '',
      carInfo: userProfile.carInfo || '',
      dietaryRestrictions: userProfile.dietaryRestrictions || '',
      emergencyContact: userProfile.emergencyContact || '',
      emergencyPhone: userProfile.emergencyPhone || '',
      pronouns: userProfile.pronouns || ''
    });
    setIsEditing(false);
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-[#79F200] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-0">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <div>
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900">My Profile</h2>
          <p className="text-gray-600 mt-1">Manage your information and view your activity</p>
        </div>
        <div className="flex gap-2">
          {isEditing ? (
            <>
              <button
                onClick={handleCancel}
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-xl transition font-semibold flex items-center gap-2"
              >
                <X size={18} />
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="px-4 py-2 bg-[#79F200] hover:bg-[#5bc000] text-gray-900 rounded-xl transition font-semibold flex items-center gap-2"
              >
                <Save size={18} />
                Save Changes
              </button>
            </>
          ) : (
            <button
              onClick={() => setIsEditing(true)}
              className="px-4 py-2 bg-[#79F200] hover:bg-[#5bc000] text-gray-900 rounded-xl transition font-semibold flex items-center gap-2"
            >
              <Edit2 size={18} />
              Edit Profile
            </button>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-yellow-50 to-orange-50 rounded-2xl p-6 shadow-lg border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-gradient-to-br from-yellow-500 to-orange-500 rounded-xl flex items-center justify-center">
              <Award className="text-white" size={24} />
            </div>
            <span className="text-3xl font-bold text-orange-700">{memberStats.points}</span>
          </div>
          <h3 className="text-gray-900 font-semibold text-lg">Points</h3>
          <p className="text-gray-600 text-sm">Total earned</p>
        </div>

        <div className="bg-gradient-to-br from-red-50 to-pink-50 rounded-2xl p-6 shadow-lg border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-gradient-to-br from-red-500 to-pink-500 rounded-xl flex items-center justify-center">
              <Calendar className="text-white" size={24} />
            </div>
            <span className="text-3xl font-bold text-red-700">{memberStats.totalNights}</span>
          </div>
          <h3 className="text-gray-900 font-semibold text-lg">Nights Worked</h3>
          <p className="text-gray-600 text-sm">Operating nights</p>
        </div>

        <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-2xl p-6 shadow-lg border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center">
              <CarIcon className="text-white" size={24} />
            </div>
            <span className="text-3xl font-bold text-blue-700">{memberStats.totalGasups}</span>
          </div>
          <h3 className="text-gray-900 font-semibold text-lg">Gas-Ups</h3>
          <p className="text-gray-600 text-sm">Events attended</p>
        </div>

        <div className="bg-gradient-to-br from-green-50 to-lime-50 rounded-2xl p-6 shadow-lg border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-lime-500 rounded-xl flex items-center justify-center">
              <TrendingUp className="text-white" size={24} />
            </div>
            <span className="text-3xl font-bold text-green-700">{memberStats.totalPickups}</span>
          </div>
          <h3 className="text-gray-900 font-semibold text-lg">Pick-Ups</h3>
          <p className="text-gray-600 text-sm">Events attended</p>
        </div>
      </div>

      {/* Profile Information */}
      <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
        <div className="bg-[#79F200] p-6">
          <h3 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
            <User size={28} />
            Profile Information
          </h3>
        </div>

        <div className="p-6 space-y-6">
          {/* Personal Information */}
          <div>
            <h4 className="text-lg font-semibold text-gray-900 mb-4">Personal Information</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Name</label>
                {isEditing ? (
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-[#79F200] focus:border-[#79F200]"
                  />
                ) : (
                  <p className="text-gray-900 bg-gray-50 px-4 py-2 rounded-xl">{formData.name || 'Not set'}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Email</label>
                <p className="text-gray-900 bg-gray-50 px-4 py-2 rounded-xl flex items-center gap-2">
                  <Mail size={16} className="text-gray-500" />
                  {userProfile?.email || 'Not set'}
                </p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Phone</label>
                {isEditing ? (
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({...formData, phone: formatPhoneNumber(e.target.value)})}
                    placeholder="(555) 123-4567"
                    maxLength="14"
                    className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-[#79F200] focus:border-[#79F200]"
                  />
                ) : (
                  <p className="text-gray-900 bg-gray-50 px-4 py-2 rounded-xl flex items-center gap-2">
                    <Phone size={16} className="text-gray-500" />
                    {formData.phone || 'Not set'}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Pronouns</label>
                {isEditing ? (
                  <input
                    type="text"
                    value={formData.pronouns}
                    onChange={(e) => setFormData({...formData, pronouns: e.target.value})}
                    placeholder="e.g., he/him, she/her, they/them"
                    className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-[#79F200] focus:border-[#79F200]"
                  />
                ) : (
                  <p className="text-gray-900 bg-gray-50 px-4 py-2 rounded-xl">{formData.pronouns || 'Not set'}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Role</label>
                <p className="text-gray-900 bg-gray-50 px-4 py-2 rounded-xl">
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                    userProfile?.role === 'director' ? 'bg-red-100 text-red-800' :
                    userProfile?.role === 'deputy' ? 'bg-blue-100 text-blue-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {userProfile?.role?.toUpperCase() || 'MEMBER'}
                  </span>
                </p>
              </div>
            </div>
          </div>

          {/* Address Information */}
          <div>
            <h4 className="text-lg font-semibold text-gray-900 mb-4">Address</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-semibold text-gray-700 mb-2">Street Address</label>
                {isEditing ? (
                  <input
                    type="text"
                    value={formData.address}
                    onChange={(e) => setFormData({...formData, address: e.target.value})}
                    className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-[#79F200] focus:border-[#79F200]"
                  />
                ) : (
                  <p className="text-gray-900 bg-gray-50 px-4 py-2 rounded-xl flex items-center gap-2">
                    <MapPin size={16} className="text-gray-500" />
                    {formData.address || 'Not set'}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">City</label>
                {isEditing ? (
                  <input
                    type="text"
                    value={formData.city}
                    onChange={(e) => setFormData({...formData, city: e.target.value})}
                    className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-[#79F200] focus:border-[#79F200]"
                  />
                ) : (
                  <p className="text-gray-900 bg-gray-50 px-4 py-2 rounded-xl">{formData.city || 'Not set'}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">State</label>
                {isEditing ? (
                  <input
                    type="text"
                    value={formData.state}
                    onChange={(e) => setFormData({...formData, state: e.target.value})}
                    className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-[#79F200] focus:border-[#79F200]"
                  />
                ) : (
                  <p className="text-gray-900 bg-gray-50 px-4 py-2 rounded-xl">{formData.state || 'Not set'}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">ZIP Code</label>
                {isEditing ? (
                  <input
                    type="text"
                    value={formData.zip}
                    onChange={(e) => setFormData({...formData, zip: e.target.value})}
                    className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-[#79F200] focus:border-[#79F200]"
                  />
                ) : (
                  <p className="text-gray-900 bg-gray-50 px-4 py-2 rounded-xl">{formData.zip || 'Not set'}</p>
                )}
              </div>
            </div>
          </div>

          {/* Emergency Contact */}
          <div>
            <h4 className="text-lg font-semibold text-gray-900 mb-4">Emergency Contact</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Contact Name</label>
                {isEditing ? (
                  <input
                    type="text"
                    value={formData.emergencyContact}
                    onChange={(e) => setFormData({...formData, emergencyContact: e.target.value})}
                    className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-[#79F200] focus:border-[#79F200]"
                  />
                ) : (
                  <p className="text-gray-900 bg-gray-50 px-4 py-2 rounded-xl">{formData.emergencyContact || 'Not set'}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Contact Phone</label>
                {isEditing ? (
                  <input
                    type="tel"
                    value={formData.emergencyPhone}
                    onChange={(e) => setFormData({...formData, emergencyPhone: e.target.value})}
                    className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-[#79F200] focus:border-[#79F200]"
                  />
                ) : (
                  <p className="text-gray-900 bg-gray-50 px-4 py-2 rounded-xl">{formData.emergencyPhone || 'Not set'}</p>
                )}
              </div>
            </div>
          </div>

          {/* Additional Information */}
          <div>
            <h4 className="text-lg font-semibold text-gray-900 mb-4">Additional Information</h4>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Car Information</label>
                {isEditing ? (
                  <input
                    type="text"
                    value={formData.carInfo}
                    onChange={(e) => setFormData({...formData, carInfo: e.target.value})}
                    placeholder="Make, Model, Color"
                    className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-[#79F200] focus:border-[#79F200]"
                  />
                ) : (
                  <p className="text-gray-900 bg-gray-50 px-4 py-2 rounded-xl">{formData.carInfo || 'Not set'}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Dietary Restrictions</label>
                {isEditing ? (
                  <textarea
                    value={formData.dietaryRestrictions}
                    onChange={(e) => setFormData({...formData, dietaryRestrictions: e.target.value})}
                    className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-[#79F200] focus:border-[#79F200] min-h-[80px]"
                  />
                ) : (
                  <p className="text-gray-900 bg-gray-50 px-4 py-2 rounded-xl">{formData.dietaryRestrictions || 'None'}</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
        <div className="bg-gradient-to-br from-blue-500 to-cyan-500 p-6">
          <h3 className="text-2xl font-bold text-white flex items-center gap-3">
            <Clock size={28} />
            Recent Activity
          </h3>
        </div>

        <div className="p-6">
          {recentActivity.length === 0 ? (
            <div className="text-center py-8">
              <Clock className="mx-auto text-gray-400 mb-2" size={48} />
              <p className="text-gray-600">No recent activity</p>
            </div>
          ) : (
            <div className="space-y-4">
              {recentActivity.map((activity, index) => (
                <div key={activity.id} className="flex items-start gap-4 p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition">
                  <div className="w-12 h-12 bg-gradient-to-br from-red-500 to-pink-500 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Calendar className="text-white" size={24} />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-gray-900">{activity.eventName}</h4>
                    <p className="text-sm text-gray-600 mt-1">Role: {activity.role}</p>
                    <div className="flex gap-4 mt-2 text-xs text-gray-500">
                      <span>✅ {activity.completedRiders} completed</span>
                      <span>❌ {activity.cancelledRiders} cancelled</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-gray-900">{formatDate(activity.date)}</p>
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

export default MemberProfile;