import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, addDoc, query, onSnapshot, doc, updateDoc, deleteDoc, Timestamp, orderBy } from 'firebase/firestore';
import { useAuth } from '../AuthContext';
import { Megaphone, Plus, Edit2, Trash2, Eye, EyeOff } from 'lucide-react';

const AnnouncementsManager = () => {
  const [announcements, setAnnouncements] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    message: '',
    active: true
  });
  const { userProfile } = useAuth();

  useEffect(() => {
    const announcementsQuery = query(
      collection(db, 'announcements'),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(announcementsQuery, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setAnnouncements(data);
    });

    return () => unsubscribe();
  }, []);

  const resetForm = () => {
    setFormData({
      title: '',
      message: '',
      active: true
    });
    setEditingAnnouncement(null);
    setShowForm(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.title || !formData.message) {
      alert('Please fill in title and message');
      return;
    }

    try {
      if (editingAnnouncement) {
        // Update existing announcement
        const announcementRef = doc(db, 'announcements', editingAnnouncement.id);
        await updateDoc(announcementRef, {
          title: formData.title,
          message: formData.message,
          active: formData.active,
          updatedAt: Timestamp.now(),
          updatedBy: userProfile?.name || 'Director'
        });
        alert('Announcement updated!');
      } else {
        // Create new announcement
        await addDoc(collection(db, 'announcements'), {
          title: formData.title,
          message: formData.message,
          active: formData.active,
          createdAt: Timestamp.now(),
          createdBy: userProfile?.name || 'Director',
          createdByUid: userProfile?.id || null
        });
        alert('Announcement created!');
      }
      resetForm();
    } catch (error) {
      console.error('Error saving announcement:', error);
      alert('Error saving announcement: ' + error.message);
    }
  };

  const startEdit = (announcement) => {
    setFormData({
      title: announcement.title,
      message: announcement.message,
      active: announcement.active
    });
    setEditingAnnouncement(announcement);
    setShowForm(true);
  };

  const toggleActive = async (announcementId, currentActive) => {
    try {
      const announcementRef = doc(db, 'announcements', announcementId);
      await updateDoc(announcementRef, {
        active: !currentActive,
        updatedAt: Timestamp.now(),
        updatedBy: userProfile?.name || 'Director'
      });
    } catch (error) {
      console.error('Error toggling announcement:', error);
      alert('Error updating announcement: ' + error.message);
    }
  };

  const deleteAnnouncement = async (announcementId, title) => {
    if (!window.confirm(`Delete announcement: "${title}"?`)) {
      return;
    }

    try {
      await deleteDoc(doc(db, 'announcements', announcementId));
      alert('Announcement deleted!');
    } catch (error) {
      console.error('Error deleting announcement:', error);
      alert('Error deleting announcement: ' + error.message);
    }
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return '';
    const date = timestamp.toDate();
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  };

  return (
    <div className="space-y-6 p-4 md:p-0">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 flex items-center gap-3">
            <Megaphone className="text-blue-500" size={36} />
            Announcements Manager
          </h2>
          <p className="text-gray-600 mt-1">Create and manage announcements for the dashboard</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-xl transition font-semibold flex items-center gap-2"
        >
          <Plus size={18} />
          {showForm ? 'Cancel' : 'New Announcement'}
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-200">
          <h3 className="text-xl font-bold mb-4">
            {editingAnnouncement ? 'Edit Announcement' : 'Create New Announcement'}
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Title</label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({...formData, title: e.target.value})}
                placeholder="Announcement title..."
                className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Message</label>
              <textarea
                value={formData.message}
                onChange={(e) => setFormData({...formData, message: e.target.value})}
                placeholder="Announcement message..."
                className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-h-[120px]"
                required
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="active"
                checked={formData.active}
                onChange={(e) => setFormData({...formData, active: e.target.checked})}
                className="w-4 h-4"
              />
              <label htmlFor="active" className="text-sm font-semibold text-gray-700">
                Show on dashboard (active)
              </label>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={resetForm}
                className="flex-1 py-3 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-xl transition font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-xl transition font-semibold"
              >
                {editingAnnouncement ? 'Update' : 'Create'} Announcement
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Announcements List */}
      <div className="space-y-4">
        {announcements.length === 0 ? (
          <div className="bg-gray-50 rounded-xl p-8 text-center">
            <Megaphone className="mx-auto text-gray-400 mb-2" size={48} />
            <p className="text-gray-600">No announcements yet</p>
          </div>
        ) : (
          announcements.map(announcement => (
            <div
              key={announcement.id}
              className={`bg-white rounded-xl p-6 shadow-lg border-l-4 ${
                announcement.active ? 'border-blue-500' : 'border-gray-300'
              }`}
            >
              <div className="flex justify-between items-start mb-3">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-bold text-gray-900">{announcement.title}</h3>
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      announcement.active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                    }`}>
                      {announcement.active ? 'ACTIVE' : 'INACTIVE'}
                    </span>
                  </div>
                  <p className="text-gray-700 mb-3">{announcement.message}</p>
                  <p className="text-xs text-gray-500">
                    Created by {announcement.createdBy} on {formatDate(announcement.createdAt)}
                  </p>
                  {announcement.updatedAt && (
                    <p className="text-xs text-gray-500">
                      Last updated: {formatDate(announcement.updatedAt)} by {announcement.updatedBy}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex gap-2 mt-4">
                <button
                  onClick={() => toggleActive(announcement.id, announcement.active)}
                  className={`px-4 py-2 rounded-lg font-semibold text-sm flex items-center gap-2 ${
                    announcement.active
                      ? 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                      : 'bg-green-500 hover:bg-green-600 text-white'
                  }`}
                >
                  {announcement.active ? (
                    <>
                      <EyeOff size={16} />
                      Deactivate
                    </>
                  ) : (
                    <>
                      <Eye size={16} />
                      Activate
                    </>
                  )}
                </button>
                <button
                  onClick={() => startEdit(announcement)}
                  className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-semibold text-sm flex items-center gap-2"
                >
                  <Edit2 size={16} />
                  Edit
                </button>
                <button
                  onClick={() => deleteAnnouncement(announcement.id, announcement.title)}
                  className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg font-semibold text-sm flex items-center gap-2"
                >
                  <Trash2 size={16} />
                  Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default AnnouncementsManager;