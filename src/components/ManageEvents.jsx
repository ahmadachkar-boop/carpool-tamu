import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, addDoc, query, onSnapshot, updateDoc, deleteDoc, doc, orderBy, Timestamp } from 'firebase/firestore';
import { useAuth } from '../AuthContext';
import { Calendar, Trash2, Edit, Copy } from 'lucide-react';

const ManageEvents = () => {
  const [events, setEvents] = useState([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [massCreateMode, setMassCreateMode] = useState(false);
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

  // Mass create state
  const [massCreateDates, setMassCreateDates] = useState(['']);
  const [useRecurrence, setUseRecurrence] = useState(false);
  const [recurrenceData, setRecurrenceData] = useState({
    startDate: '',
    endDate: '',
    frequency: 'weekly',
    dayOfWeek: 5
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
    setMassCreateMode(false);
    setMassCreateDates(['']);
    setUseRecurrence(false);
    setRecurrenceData({
      startDate: '',
      endDate: '',
      frequency: 'weekly',
      dayOfWeek: 5
    });
  };

  // Create a date object from date string and time string, avoiding timezone issues
  const createDateTime = (dateStr, timeStr) => {
    const [year, month, day] = dateStr.split('-').map(Number);
    const [hours, minutes] = timeStr.split(':').map(Number);
    
    // Create date in LOCAL timezone explicitly
    return new Date(year, month - 1, day, hours, minutes, 0, 0);
  };

  // Generate dates based on recurrence pattern
  const generateRecurringDates = () => {
    if (!recurrenceData.startDate || !recurrenceData.endDate) return [];
    
    const dates = [];
    const start = new Date(recurrenceData.startDate + 'T00:00:00');
    const end = new Date(recurrenceData.endDate + 'T00:00:00');
    
    let current = new Date(start);
    const targetDay = parseInt(recurrenceData.dayOfWeek);
    
    // Move to first occurrence of target day
    while (current.getDay() !== targetDay) {
      current.setDate(current.getDate() + 1);
    }
    
    const increment = recurrenceData.frequency === 'weekly' ? 7 : 14;
    
    while (current <= end) {
      const year = current.getFullYear();
      const month = String(current.getMonth() + 1).padStart(2, '0');
      const day = String(current.getDate()).padStart(2, '0');
      dates.push(`${year}-${month}-${day}`);
      current.setDate(current.getDate() + increment);
    }
    
    return dates;
  };

  // Check if event spans midnight
  const isOvernightEvent = (startTime, endTime) => {
    if (!startTime || !endTime) return false;
    
    const [startHour, startMin] = startTime.split(':').map(Number);
    const [endHour, endMin] = endTime.split(':').map(Number);
    
    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;
    
    return endMinutes < startMinutes || endHour < 6;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.name || !formData.startTime || !formData.endTime) {
      alert('Please fill in all required fields');
      return;
    }

    try {
      let datesToCreate = [];
      const isOvernight = isOvernightEvent(formData.startTime, formData.endTime);

      if (massCreateMode) {
        if (useRecurrence) {
          const generatedDates = generateRecurringDates();
          if (generatedDates.length === 0) {
            alert('No valid dates generated from recurrence pattern');
            return;
          }
          datesToCreate = generatedDates.map(startDate => ({
            startDate,
            endDate: isOvernight ? getNextDay(startDate) : startDate
          }));
        } else {
          const validDates = massCreateDates.filter(d => d.trim() !== '');
          if (validDates.length === 0) {
            alert('Please add at least one date');
            return;
          }
          datesToCreate = validDates.map(startDate => ({
            startDate,
            endDate: isOvernight ? getNextDay(startDate) : startDate
          }));
        }
      } else {
        if (!formData.startDate || !formData.endDate) {
          alert('Please fill in start and end dates');
          return;
        }
        datesToCreate = [{ startDate: formData.startDate, endDate: formData.endDate }];
      }

      const eventsToCreate = [];

      for (const { startDate, endDate } of datesToCreate) {
        // Use explicit date construction to avoid timezone issues
        const startDateTime = createDateTime(startDate, formData.startTime);
        const endDateTime = createDateTime(endDate, formData.endTime);

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
          signedUp: [],
          createdBy: userProfile.id,
          createdAt: Timestamp.now()
        };

        eventsToCreate.push({ eventData, startDateTime });
      }

      // Create all events
      let successCount = 0;
      for (const { eventData, startDateTime } of eventsToCreate) {
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
          
          await updateDoc(eventRef, {
            ndrId: ndrRef.id
          });
        }
        
        successCount++;
      }

      if (massCreateMode) {
        alert(`Successfully created ${successCount} event${successCount > 1 ? 's' : ''}!`);
      } else {
        alert('Event created successfully!');
      }

      resetForm();
    } catch (error) {
      console.error('Error saving event:', error);
      alert('Error saving event: ' + error.message);
    }
  };

  const getNextDay = (dateString) => {
    const [year, month, day] = dateString.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    date.setDate(date.getDate() + 1);
    
    const nextYear = date.getFullYear();
    const nextMonth = String(date.getMonth() + 1).padStart(2, '0');
    const nextDay = String(date.getDate()).padStart(2, '0');
    
    return `${nextYear}-${nextMonth}-${nextDay}`;
  };

  const handleEdit = (event) => {
    // Extract date and time components carefully
    const startYear = event.startDate.getFullYear();
    const startMonth = String(event.startDate.getMonth() + 1).padStart(2, '0');
    const startDay = String(event.startDate.getDate()).padStart(2, '0');
    const startHours = String(event.startDate.getHours()).padStart(2, '0');
    const startMinutes = String(event.startDate.getMinutes()).padStart(2, '0');
    
    const endYear = event.endDate.getFullYear();
    const endMonth = String(event.endDate.getMonth() + 1).padStart(2, '0');
    const endDay = String(event.endDate.getDate()).padStart(2, '0');
    const endHours = String(event.endDate.getHours()).padStart(2, '0');
    const endMinutes = String(event.endDate.getMinutes()).padStart(2, '0');

    setFormData({
      name: event.name,
      type: event.type,
      startDate: `${startYear}-${startMonth}-${startDay}`,
      startTime: `${startHours}:${startMinutes}`,
      endDate: `${endYear}-${endMonth}-${endDay}`,
      endTime: `${endHours}:${endMinutes}`,
      capacity: event.capacity,
      location: event.location || '',
      description: event.description || '',
      points: event.points || 0,
      directorContact: event.directorContact || ''
    });
    setEditingEvent(event);
    setMassCreateMode(false);
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

  const addDateField = () => {
    setMassCreateDates([...massCreateDates, '']);
  };

  const removeDateField = (index) => {
    setMassCreateDates(massCreateDates.filter((_, i) => i !== index));
  };

  const updateDateField = (index, value) => {
    const newDates = [...massCreateDates];
    newDates[index] = value;
    setMassCreateDates(newDates);
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

  const isOvernight = isOvernightEvent(formData.startTime, formData.endTime);

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
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-bold text-gray-800">
              {editingEvent ? 'Edit Event' : 'Create New Event'}
            </h3>
            {!editingEvent && (
              <button
                type="button"
                onClick={() => {
                  setMassCreateMode(!massCreateMode);
                  setUseRecurrence(false);
                }}
                className={`flex items-center gap-2 px-4 py-2 rounded-md transition font-medium ${
                  massCreateMode 
                    ? 'bg-blue-600 text-white hover:bg-blue-700' 
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                <Copy size={18} />
                {massCreateMode ? 'Mass Create: ON' : 'Mass Create: OFF'}
              </button>
            )}
          </div>

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

            {/* Time Selection */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

            {/* Overnight indicator */}
            {isOvernight && formData.startTime && formData.endTime && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <p className="text-sm text-yellow-800 font-medium">
                  ⚠️ Overnight Event: Spans midnight (ends next day)
                </p>
                {massCreateMode && (
                  <p className="text-xs text-yellow-700 mt-1">
                    In mass create, each date is the START date. End dates auto-set to next day.
                  </p>
                )}
              </div>
            )}

            {/* Date Selection */}
            {massCreateMode ? (
              <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold text-blue-900">Mass Create - Start Dates</h4>
                  <button
                    type="button"
                    onClick={() => setUseRecurrence(!useRecurrence)}
                    className="text-sm px-3 py-1 bg-blue-200 hover:bg-blue-300 rounded-md transition"
                  >
                    {useRecurrence ? 'Manual Dates' : 'Use Recurrence'}
                  </button>
                </div>

                {useRecurrence ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Start Date *
                        </label>
                        <input
                          type="date"
                          value={recurrenceData.startDate}
                          onChange={(e) => setRecurrenceData({...recurrenceData, startDate: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          End Date *
                        </label>
                        <input
                          type="date"
                          value={recurrenceData.endDate}
                          onChange={(e) => setRecurrenceData({...recurrenceData, endDate: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md"
                          required
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Frequency *
                        </label>
                        <select
                          value={recurrenceData.frequency}
                          onChange={(e) => setRecurrenceData({...recurrenceData, frequency: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        >
                          <option value="weekly">Weekly</option>
                          <option value="biweekly">Every 2 Weeks</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Day of Week *
                        </label>
                        <select
                          value={recurrenceData.dayOfWeek}
                          onChange={(e) => setRecurrenceData({...recurrenceData, dayOfWeek: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        >
                          <option value="0">Sunday</option>
                          <option value="1">Monday</option>
                          <option value="2">Tuesday</option>
                          <option value="3">Wednesday</option>
                          <option value="4">Thursday</option>
                          <option value="5">Friday</option>
                          <option value="6">Saturday</option>
                        </select>
                      </div>
                    </div>
                    <p className="text-sm text-blue-700">
                      Will create {generateRecurringDates().length} event(s)
                      {isOvernight && ' (each ending next day)'}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-xs text-blue-700 mb-2">
                      Enter START dates{isOvernight && ' (auto-ends next day)'}
                    </p>
                    {massCreateDates.map((date, index) => (
                      <div key={index} className="flex gap-2 items-center">
                        <input
                          type="date"
                          value={date}
                          onChange={(e) => updateDateField(index, e.target.value)}
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-md"
                          required
                        />
                        {date && isOvernight && (
                          <span className="text-xs text-gray-600 whitespace-nowrap">
                            → {getNextDay(date)}
                          </span>
                        )}
                        {massCreateDates.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeDateField(index)}
                            className="px-3 py-2 bg-red-100 text-red-700 rounded-md hover:bg-red-200"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={addDateField}
                      className="w-full px-3 py-2 bg-blue-200 text-blue-800 rounded-md hover:bg-blue-300 font-medium"
                    >
                      + Add Another Date
                    </button>
                  </div>
                )}
              </div>
            ) : (
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
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Capacity *
                </label>
                <input
                  type="number"
                  value={formData.capacity}
                  onChange={(e) => setFormData({...formData, capacity: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-red-500"
                  min="1"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Points
                </label>
                <input
                  type="number"
                  value={formData.points}
                  onChange={(e) => setFormData({...formData, points: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-red-500"
                  min="0"
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
                {editingEvent ? 'Update Event' : massCreateMode ? 'Create Multiple Events' : 'Create Event'}
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