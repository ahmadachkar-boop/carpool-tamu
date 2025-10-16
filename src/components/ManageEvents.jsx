import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, addDoc, query, onSnapshot, updateDoc, deleteDoc, doc, orderBy, Timestamp } from 'firebase/firestore';
import { useAuth } from '../AuthContext';
import { Calendar, Trash2, Edit } from 'lucide-react';

const ManageEvents = () => {
  const [events, setEvents] = useState([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const { userProfile } = useAuth();

  const [formData, setFormData] = useState({
    name: '',
    type: 'operating night',
    startDate: '',
    startTime: '',
    endDate: '',
    endTime: '',
    capacity: 10,
    location: '',
    description: '',
    points: 0,
    directorContact: ''
  });

  useEffect(() => {
    const eventsRef = collection(db, 'events');
    const eventsQuery = query(eventsRef, orderBy('startDate', 'desc'));

    const unsubscribe = onSnapshot(eventsQuery, (snapshot) => {
      const eventsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        startDate: doc.data().startDate?.toDate(),
        endDate: doc.data().endDate?.toDate()
      }));
      setEvents(eventsData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const resetForm = () => {
    setFormData({
      name: '',
      type: 'operating night',
      startDate: '',
      startTime: '',
      endDate: '',
      endTime: '',
      capacity: 10,
      location: '',
      description: '',
      points: 0,
      directorContact: ''
    });
    setEditingEvent(null);
    setShowCreateForm(false);
  };

const handleSubmit = async (e) => {
  e.preventDefault();

  if (!formData.name || !formData.startDate || !formData.startTime || !formData.endDate || !formData.endTime) {
    alert('Please fill in all required fields');
    return;
  }

  try {
    const startDateTime = new Date(`${formData.startDate}T${formData.startTime}`);
    const endDateTime = new Date(`${formData.endDate}T${formData.endTime}`);

    const eventData = {
      name: formData.name,
      type: formData.type,
      startDate: Timestamp.fromDate(startDateTime),
      endDate: Timestamp.fromDate(endDateTime),
      capacity: parseInt(formData.capacity),
      location: formData.location,
      description: formData.description,
      points: parseInt(formData.points),
      directorContact: formData.directorContact,
      signedUp: editingEvent?.signedUp || [],
      createdBy: userProfile.id,
      createdAt: editingEvent ? editingEvent.createdAt : Timestamp.now()
    };

    if (editingEvent) {
      // Update existing event
      await updateDoc(doc(db, 'events', editingEvent.id), eventData);
      
      // If it's an operating night and there's an associated NDR, update it
      if (formData.type.toLowerCase() === 'operating night' && editingEvent.ndrId) {
        await updateDoc(doc(db, 'ndrs', editingEvent.ndrId), {
          eventName: formData.name,
          eventDate: Timestamp.fromDate(startDateTime),
          location: formData.location
        });
      }
      
      alert('Event updated successfully!');
    } else {
      // Create new event
      const eventRef = await addDoc(collection(db, 'events'), eventData);
      
      // Auto-create NDR if event type is Operating Night
      if (formData.type.toLowerCase() === 'operating night') {
        const ndrData = {
          eventId: eventRef.id,
          eventName: formData.name,
          eventDate: Timestamp.fromDate(startDateTime),
          location: formData.location,
          status: 'pending',
          signedUpMembers: [],
          completedRides: 0,
          cancelledRides: 0,
          terminatedRides: 0,
          assignments: {
            cars: {},
            couch: [],
            phones: [],
            doc: null,
            duc: null,
            don: null,
            northgate: []
          },
          cars: [],
          notes: {
            leadership: { don: '', doc: '', duc: '', execs: '', directors: '' },
            carRoles: {},
            couchPhoneRoles: { couch: '', phones: '' },
            updates: [],
            summary: ''
          },
          createdBy: userProfile.id,
          createdAt: Timestamp.now()
        };
        
        const ndrRef = await addDoc(collection(db, 'ndrs'), ndrData);
        
        // Link the NDR back to the event
        await updateDoc(eventRef, {
          ndrId: ndrRef.id
        });
        
        alert('Event and NDR created successfully!');
      } else {
        alert('Event created successfully!');
      }
    }

    resetForm();
  } catch (error) {
    console.error('Error saving event:', error);
    alert('Error saving event: ' + error.message);
  }
};

  const handleEdit = (event) => {
    const startDate = event.startDate.toISOString().split('T')[0];
    const startTime = event.startDate.toTimeString().slice(0, 5);
    const endDate = event.endDate.toISOString().split('T')[0];
    const endTime = event.endDate.toTimeString().slice(0, 5);

    setFormData({
      name: event.name,
      type: event.type,
      startDate,
      startTime,
      endDate,
      endTime,
      capacity: event.capacity,
      location: event.location || '',
      description: event.description || '',
      points: event.points || 0,
      directorContact: event.directorContact || ''
    });
    setEditingEvent(event);
    setShowCreateForm(true);
  };

  const handleDelete = async (eventId) => {
    if (window.confirm('Are you sure you want to delete this event? This cannot be undone.')) {
      try {
        await deleteDoc(doc(db, 'events', eventId));
        alert('Event deleted successfully');
      } catch (error) {
        console.error('Error deleting event:', error);
        alert('Error deleting event: ' + error.message);
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
        <h2 className="text-2xl font-bold text-gray-800">Manage Events</h2>
        <div className="bg-white p-12 rounded-lg shadow text-center">
          <p className="text-gray-500">Loading events...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-800">Manage Events</h2>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="px-6 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition font-medium"
        >
          {showCreateForm ? 'Cancel' : '+ Create Event'}
        </button>
      </div>

      {showCreateForm && (
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-xl font-bold text-gray-800 mb-4">
            {editingEvent ? 'Edit Event' : 'Create New Event'}
          </h3>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Event Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-red-500"
                  placeholder="e.g., Friday Night Operations"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Event Type *
                </label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({...formData, type: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-red-500"
                  required
                >
                  <option value="operating night">Operating Night</option>
                  <option value="gasups">Gasups</option>
                  <option value="pickups">Pickups</option>
                  <option value="meeting">Meeting</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Start Date *
                </label>
                <input
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => setFormData({...formData, startDate: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-red-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Start Time *
                </label>
                <input
                  type="time"
                  value={formData.startTime}
                  onChange={(e) => setFormData({...formData, startTime: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-red-500"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  End Date *
                </label>
                <input
                  type="date"
                  value={formData.endDate}
                  onChange={(e) => setFormData({...formData, endDate: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-red-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  End Time *
                </label>
                <input
                  type="time"
                  value={formData.endTime}
                  onChange={(e) => setFormData({...formData, endTime: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-red-500"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Capacity *
                </label>
                <input
                  type="number"
                  min="1"
                  value={formData.capacity}
                  onChange={(e) => setFormData({...formData, capacity: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-red-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Points
                </label>
                <input
                  type="number"
                  min="0"
                  value={formData.points}
                  onChange={(e) => setFormData({...formData, points: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-red-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Location
              </label>
              <input
                type="text"
                value={formData.location}
                onChange={(e) => setFormData({...formData, location: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-red-500"
                placeholder="e.g., MSC 2406"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-red-500"
                rows="3"
                placeholder="Additional details about the event..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Director Contact
              </label>
              <input
                type="text"
                value={formData.directorContact}
                onChange={(e) => setFormData({...formData, directorContact: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-red-500"
                placeholder="e.g., John Doe (123-456-7890)"
              />
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="submit"
                className="flex-1 py-3 bg-green-600 text-white rounded-md hover:bg-green-700 transition font-medium"
              >
                {editingEvent ? 'Update Event' : 'Create Event'}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="px-6 py-3 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 transition font-medium"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-lg shadow">
        <div className="p-4 border-b">
          <h3 className="text-lg font-semibold text-gray-800">All Events ({events.length})</h3>
        </div>

        <div className="p-4">
          {events.length === 0 ? (
            <div className="text-center text-gray-500 py-8">
              <Calendar className="mx-auto mb-4 text-gray-400" size={48} />
              <p>No events created yet</p>
            </div>
          ) : (
            <div className="space-y-4">
              {events.map(event => (
                <div key={event.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h4 className="text-lg font-semibold text-gray-800">{event.name}</h4>
                      <span className="inline-block px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded mt-1">
                        {event.type}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEdit(event)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded"
                        title="Edit"
                      >
                        <Edit size={18} />
                      </button>
                      <button
                        onClick={() => handleDelete(event.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded"
                        title="Delete"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-gray-600">
                    <p><strong>Start:</strong> {formatDateTime(event.startDate)}</p>
                    <p><strong>End:</strong> {formatDateTime(event.endDate)}</p>
                    <p><strong>Location:</strong> {event.location || 'Not specified'}</p>
                    <p><strong>Capacity:</strong> {event.signedUp?.length || 0} / {event.capacity}</p>
                    {event.points > 0 && <p><strong>Points:</strong> {event.points}</p>}
                  </div>

                  {event.signedUp?.length > 0 && (
                    <div className="mt-3 pt-3 border-t">
                      <p className="text-sm font-medium text-gray-700">
                        {event.signedUp.length} member(s) signed up
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ManageEvents;