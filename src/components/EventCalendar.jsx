import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, onSnapshot, updateDoc, doc, arrayUnion, arrayRemove, orderBy, where, getDocs } from 'firebase/firestore';
import { useAuth } from '../AuthContext';
import { ChevronLeft, ChevronRight, MapPin, Users, Clock, Award, X } from 'lucide-react';

const EventCalendar = () => {
  const [events, setEvents] = useState([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [signedUpMembers, setSignedUpMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const { userProfile } = useAuth();

  useEffect(() => {
    const eventsRef = collection(db, 'events');
    const eventsQuery = query(eventsRef, orderBy('startDate', 'asc'));

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

  // Real-time listener for selected event
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!selectedEvent) return;

    const eventRef = doc(db, 'events', selectedEvent.id);
    const unsubscribe = onSnapshot(eventRef, (doc) => {
      if (doc.exists()) {
        const updatedEvent = {
          id: doc.id,
          ...doc.data(),
          startDate: doc.data().startDate?.toDate(),
          endDate: doc.data().endDate?.toDate()
        };
        setSelectedEvent(updatedEvent);
      }
    });

    return () => unsubscribe();
  }, [selectedEvent?.id]);

// Fetch member details when signedUp list changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const fetchSignedUpMembers = async () => {
      if (!selectedEvent || !selectedEvent.signedUp || selectedEvent.signedUp.length === 0) {
        setSignedUpMembers([]);
        setLoadingMembers(false);
        return;
      }

      setLoadingMembers(true);
      try {
        const membersRef = collection(db, 'members');
        const membersQuery = query(membersRef, where('__name__', 'in', selectedEvent.signedUp));
        const snapshot = await getDocs(membersQuery);
        
        const members = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        
        setSignedUpMembers(members);
      } catch (error) {
        console.error('Error fetching members:', error);
        setSignedUpMembers([]);
      } finally {
        setLoadingMembers(false);
      }
    };

    fetchSignedUpMembers();
  }, [selectedEvent?.signedUp]);

  // Organize members by gender and role
  const organizeMembers = () => {
    const directors = signedUpMembers.filter(m => m.role === 'director');
    const males = signedUpMembers.filter(m => {
      const gender = m.gender?.toLowerCase();
      return m.role !== 'director' && (gender === 'male' || gender === 'm' || gender === 'man');
    });
    const females = signedUpMembers.filter(m => {
      const gender = m.gender?.toLowerCase();
      return m.role !== 'director' && (gender === 'female' || gender === 'f' || gender === 'woman');
    });
    const others = signedUpMembers.filter(m => {
      const gender = m.gender?.toLowerCase();
      return m.role !== 'director' && 
             gender !== 'male' && gender !== 'm' && gender !== 'man' &&
             gender !== 'female' && gender !== 'f' && gender !== 'woman';
    });

    return { directors, males, females, others };
  };

  // Calendar helpers
  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days = [];
    
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }
    
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(new Date(year, month, day));
    }
    
    return days;
  };

  const getEventsForDay = (date) => {
    if (!date) return [];
    
    return events.filter(event => {
      const eventDate = new Date(event.startDate);
      return (
        eventDate.getDate() === date.getDate() &&
        eventDate.getMonth() === date.getMonth() &&
        eventDate.getFullYear() === date.getFullYear()
      );
    });
  };

  const isToday = (date) => {
    if (!date) return false;
    const today = new Date();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  };

  const previousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1));
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const monthYear = currentDate.toLocaleString('en-US', { month: 'long', year: 'numeric' });

  // Event actions
  const signUpForEvent = async (event) => {
    if (!userProfile) return;

    try {
      const eventRef = doc(db, 'events', event.id);
      await updateDoc(eventRef, {
        signedUp: arrayUnion(userProfile.id)
      });
      // Don't close modal - it will update automatically via listener
    } catch (error) {
      console.error('Error signing up:', error);
      alert('Error signing up: ' + error.message);
    }
  };

  const cancelSignup = async (event) => {
    if (!userProfile) return;

    if (window.confirm('Are you sure you want to cancel your signup?')) {
      try {
        const eventRef = doc(db, 'events', event.id);
        await updateDoc(eventRef, {
          signedUp: arrayRemove(userProfile.id)
        });
        // Don't close modal - it will update automatically via listener
      } catch (error) {
        console.error('Error cancelling signup:', error);
        alert('Error cancelling signup: ' + error.message);
      }
    }
  };

  const isSignedUp = (event) => {
    return event.signedUp?.includes(userProfile?.id);
  };

  const isFull = (event) => {
    return event.signedUp?.length >= event.capacity;
  };

  const isPastEvent = (event) => {
    return event.endDate < new Date();
  };

  const getEventTypeColor = (type) => {
    const colors = {
      'gasups': 'bg-blue-500',
      'pickups': 'bg-green-500',
      'operating night': 'bg-red-500',
      'meeting': 'bg-purple-500'
    };
    return colors[type?.toLowerCase()] || 'bg-gray-500';
  };

  const formatTime = (date) => {
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  };

  const formatDateTime = (date) => {
    return date.toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  };

  const days = getDaysInMonth(currentDate);
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  if (loading) {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-gray-800">Event Calendar</h2>
        <div className="bg-white p-12 rounded-lg shadow text-center">
          <p className="text-gray-500">Loading calendar...</p>
        </div>
      </div>
    );
  }

  const { directors, males, females, others } = selectedEvent ? organizeMembers() : { directors: [], males: [], females: [], others: [] };

  return (
    <div className="space-y-6">
      {/* Calendar Header */}
      <div className="bg-white p-6 rounded-lg shadow">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-800">{monthYear}</h2>
          <div className="flex gap-2">
            <button
              onClick={goToToday}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition text-sm font-medium"
            >
              Today
            </button>
            <button
              onClick={previousMonth}
              className="p-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition"
            >
              <ChevronLeft size={20} />
            </button>
            <button
              onClick={nextMonth}
              className="p-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition"
            >
              <ChevronRight size={20} />
            </button>
          </div>
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7 gap-2">
          {/* Day headers */}
          {dayNames.map(day => (
            <div key={day} className="text-center font-semibold text-gray-600 text-sm py-2">
              {day}
            </div>
          ))}

          {/* Calendar days */}
          {days.map((date, index) => {
            const dayEvents = date ? getEventsForDay(date) : [];
            
            return (
              <div
                key={index}
                className={`min-h-24 border rounded-lg p-2 ${
                  date ? 'bg-white' : 'bg-gray-50'
                } ${
                  isToday(date) ? 'ring-2 ring-red-500' : ''
                }`}
              >
                {date && (
                  <>
                    <div className={`text-sm font-semibold mb-1 ${
                      isToday(date) ? 'text-red-600' : 'text-gray-700'
                    }`}>
                      {date.getDate()}
                    </div>
                    
                    <div className="space-y-1">
                      {dayEvents.map(event => (
                        <button
                          key={event.id}
                          onClick={() => setSelectedEvent(event)}
                          className={`w-full text-left px-2 py-1 rounded text-xs text-white ${getEventTypeColor(event.type)} hover:opacity-80 transition truncate`}
                        >
                          {formatTime(event.startDate)} {event.name}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="mt-6 pt-6 border-t flex flex-wrap gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-red-500 rounded"></div>
            <span>Operating Night</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-blue-500 rounded"></div>
            <span>Gasups</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-green-500 rounded"></div>
            <span>Pickups</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-purple-500 rounded"></div>
            <span>Meeting</span>
          </div>
        </div>
      </div>

      {/* Event Detail Modal */}
      {selectedEvent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className={`px-6 py-4 border-b-4 ${getEventTypeColor(selectedEvent.type)}`}>
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-2xl font-bold text-gray-800">{selectedEvent.name}</h3>
                  <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold mt-2 text-white ${getEventTypeColor(selectedEvent.type)}`}>
                    {selectedEvent.type}
                  </span>
                </div>
                <button
                  onClick={() => setSelectedEvent(null)}
                  className="text-gray-500 hover:text-gray-700 transition"
                >
                  <X size={24} />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Event Details */}
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <Clock className="text-gray-400 mt-1" size={20} />
                  <div className="text-sm">
                    <p className="font-medium text-gray-700">Start: {formatDateTime(selectedEvent.startDate)}</p>
                    <p className="font-medium text-gray-700">End: {formatDateTime(selectedEvent.endDate)}</p>
                  </div>
                </div>

                {selectedEvent.location && (
                  <div className="flex items-start gap-3">
                    <MapPin className="text-gray-400 mt-1" size={20} />
                    <p className="text-sm text-gray-700">{selectedEvent.location}</p>
                  </div>
                )}

                {selectedEvent.description && (
                  <div className="bg-gray-50 p-4 rounded">
                    <p className="text-sm text-gray-700">{selectedEvent.description}</p>
                  </div>
                )}

                <div className="flex items-center gap-3">
                  <Users className="text-gray-400" size={20} />
                  <div className="text-sm text-gray-700">
                    <span className="font-semibold">{selectedEvent.signedUp?.length || 0}</span> / {selectedEvent.capacity} signed up
                    {isFull(selectedEvent) && (
                      <span className="ml-2 px-2 py-1 bg-red-100 text-red-700 rounded text-xs font-semibold">
                        FULL
                      </span>
                    )}
                  </div>
                </div>

                {selectedEvent.points > 0 && (
                  <div className="flex items-center gap-3">
                    <Award className="text-yellow-500" size={20} />
                    <p className="text-sm text-gray-700">
                      <span className="font-semibold">{selectedEvent.points}</span> points
                    </p>
                  </div>
                )}

                {selectedEvent.directorContact && (
                  <div className="text-sm text-gray-600 bg-blue-50 p-3 rounded">
                    <p className="font-medium">Contact: {selectedEvent.directorContact}</p>
                  </div>
                )}
              </div>

              {/* Signed Up Members - ALWAYS VISIBLE */}
              <div className="border-t pt-6">
                <h4 className="text-lg font-bold text-gray-800 mb-4">Signed Up Members</h4>
                
                {loadingMembers ? (
                  <div className="text-center py-8">
                    <p className="text-gray-500">Loading members...</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Directors Column - ALWAYS SHOWN */}
                    <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                      <h5 className="font-semibold text-purple-800 mb-3 flex items-center gap-2">
                        <span className="px-2 py-1 bg-purple-200 rounded text-xs">
                          {directors.length}
                        </span>
                        Directors
                      </h5>
                      {directors.length === 0 ? (
                        <p className="text-sm text-gray-500 italic">No signups yet</p>
                      ) : (
                        <ul className="space-y-2">
                          {directors.map(member => (
                            <li key={member.id} className="text-sm text-gray-700 bg-white p-2 rounded border border-purple-100">
                              <div className="font-medium">{member.name}</div>
                              <div className="text-xs text-gray-500">{member.pronouns}</div>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>

                    {/* Males Column - ALWAYS SHOWN */}
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <h5 className="font-semibold text-blue-800 mb-3 flex items-center gap-2">
                        <span className="px-2 py-1 bg-blue-200 rounded text-xs">
                          {males.length}
                        </span>
                        Males
                      </h5>
                      {males.length === 0 ? (
                        <p className="text-sm text-gray-500 italic">No signups yet</p>
                      ) : (
                        <ul className="space-y-2">
                          {males.map(member => (
                            <li key={member.id} className="text-sm text-gray-700 bg-white p-2 rounded border border-blue-100">
                              <div className="font-medium">{member.name}</div>
                              <div className="text-xs text-gray-500">{member.pronouns}</div>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>

                    {/* Females Column - ALWAYS SHOWN */}
                    <div className="bg-pink-50 border border-pink-200 rounded-lg p-4">
                      <h5 className="font-semibold text-pink-800 mb-3 flex items-center gap-2">
                        <span className="px-2 py-1 bg-pink-200 rounded text-xs">
                          {females.length}
                        </span>
                        Females
                      </h5>
                      {females.length === 0 ? (
                        <p className="text-sm text-gray-500 italic">No signups yet</p>
                      ) : (
                        <ul className="space-y-2">
                          {females.map(member => (
                            <li key={member.id} className="text-sm text-gray-700 bg-white p-2 rounded border border-pink-100">
                              <div className="font-medium">{member.name}</div>
                              <div className="text-xs text-gray-500">{member.pronouns}</div>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>

                    {/* Others Column - Only shown if there are members */}
                    {others.length > 0 && (
                      <div className="bg-green-50 border border-green-200 rounded-lg p-4 md:col-span-3">
                        <h5 className="font-semibold text-green-800 mb-3 flex items-center gap-2">
                          <span className="px-2 py-1 bg-green-200 rounded text-xs">
                            {others.length}
                          </span>
                          Other
                        </h5>
                        <ul className="grid grid-cols-1 md:grid-cols-3 gap-2">
                          {others.map(member => (
                            <li key={member.id} className="text-sm text-gray-700 bg-white p-2 rounded border border-green-100">
                              <div className="font-medium">{member.name}</div>
                              <div className="text-xs text-gray-500">{member.pronouns}</div>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              {isPastEvent(selectedEvent) && (
                <div className="bg-gray-100 p-4 rounded text-center">
                  <p className="text-gray-600 font-medium">This event has ended</p>
                </div>
              )}

              {!isPastEvent(selectedEvent) && (
                <div className="pt-4 border-t">
                  {isSignedUp(selectedEvent) ? (
                    <div className="space-y-3">
                      <div className="bg-green-50 border border-green-200 p-3 rounded text-center">
                        <p className="text-green-700 font-semibold">✓ You're signed up for this event!</p>
                      </div>
                      <button
                        onClick={() => cancelSignup(selectedEvent)}
                        className="w-full py-3 bg-red-500 text-white rounded-md hover:bg-red-600 transition font-medium"
                      >
                        Cancel Signup
                      </button>
                    </div>
                  ) : isFull(selectedEvent) ? (
                    <button
                      disabled
                      className="w-full py-3 bg-gray-300 text-gray-500 rounded-md cursor-not-allowed font-medium"
                    >
                      Event Full
                    </button>
                  ) : (
                    <button
                      onClick={() => signUpForEvent(selectedEvent)}
                      className="w-full py-3 bg-green-600 text-white rounded-md hover:bg-green-700 transition font-medium"
                    >
                      Sign Up for Event
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EventCalendar;