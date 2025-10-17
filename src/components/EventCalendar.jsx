import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, onSnapshot, updateDoc, doc, arrayUnion, arrayRemove, orderBy, where, getDocs } from 'firebase/firestore';
import { useAuth } from '../AuthContext';
import { ChevronLeft, ChevronRight, MapPin, Users, Clock, Award, X, User } from 'lucide-react';

const EventCalendar = () => {
  const [events, setEvents] = useState([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [signedUpMembers, setSignedUpMembers] = useState([]);
  const [allMembers, setAllMembers] = useState([]); // Cache all members
  const [loading, setLoading] = useState(true);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [showManageSignups, setShowManageSignups] = useState(false);
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
  useEffect(() => {
    if (!selectedEvent) {
      setShowManageSignups(false); // Reset when modal closes
      return;
    }

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

  // Fetch all members once for gender counting
  useEffect(() => {
    const membersRef = collection(db, 'members');
    const unsubscribe = onSnapshot(membersRef, (snapshot) => {
      const membersData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setAllMembers(membersData);
    });

    return () => unsubscribe();
  }, []);

  // Fetch member details when signedUp list changes
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
  
  // Get gender counts for an event using cached member data
  const getEventGenderCounts = (event) => {
    if (!event.signedUp || event.signedUp.length === 0 || allMembers.length === 0) {
      return { males: 0, females: 0, directors: 0 };
    }

    const eventMembers = allMembers.filter(m => event.signedUp.includes(m.id));
    
    const directors = eventMembers.filter(m => m.role === 'director').length;
    const males = eventMembers.filter(m => {
      const gender = m.gender?.toLowerCase();
      return m.role !== 'director' && (gender === 'male' || gender === 'm' || gender === 'man');
    }).length;
    const females = eventMembers.filter(m => {
      const gender = m.gender?.toLowerCase();
      return m.role !== 'director' && (gender === 'female' || gender === 'f' || gender === 'woman');
    }).length;

    return { males, females, directors };
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

      // If this event has an associated NDR, update it
      if (event.ndrId) {
        const ndrRef = doc(db, 'ndrs', event.ndrId);
        await updateDoc(ndrRef, {
          signedUpMembers: arrayUnion(userProfile.id)
        });
      }
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

        // If this event has an associated NDR, update it
        if (event.ndrId) {
          const ndrRef = doc(db, 'ndrs', event.ndrId);
          await updateDoc(ndrRef, {
            signedUpMembers: arrayRemove(userProfile.id)
          });
        }
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

  const manuallyAddMember = async (event, memberId) => {
    try {
      const eventRef = doc(db, 'events', event.id);
      await updateDoc(eventRef, {
        signedUp: arrayUnion(memberId)
      });

      // If this event has an associated NDR, update it
      if (event.ndrId) {
        const ndrRef = doc(db, 'ndrs', event.ndrId);
        await updateDoc(ndrRef, {
          signedUpMembers: arrayUnion(memberId)
        });
      }
    } catch (error) {
      console.error('Error adding member:', error);
      alert('Error adding member: ' + error.message);
    }
  };

  const manuallyRemoveMember = async (event, memberId) => {
    if (window.confirm('Remove this member from the event?')) {
      try {
        const eventRef = doc(db, 'events', event.id);
        await updateDoc(eventRef, {
          signedUp: arrayRemove(memberId)
        });

        // If this event has an associated NDR, update it
        if (event.ndrId) {
          const ndrRef = doc(db, 'ndrs', event.ndrId);
          await updateDoc(ndrRef, {
            signedUpMembers: arrayRemove(memberId)
          });
        }
      } catch (error) {
        console.error('Error removing member:', error);
        alert('Error removing member: ' + error.message);
      }
    }
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
      <div className="space-y-4 px-2">
        <h2 className="text-xl md:text-2xl font-bold text-gray-800">Event Calendar</h2>
        <div className="bg-white p-8 md:p-12 rounded-lg shadow text-center">
          <p className="text-gray-500">Loading calendar...</p>
        </div>
      </div>
    );
  }

  const { directors, males, females, others } = selectedEvent ? organizeMembers() : { directors: [], males: [], females: [], others: [] };

  return (
    <>
      <style>{`
        @supports (padding-bottom: env(safe-area-inset-bottom)) {
          .pb-safe {
            padding-bottom: env(safe-area-inset-bottom);
          }
        }
        
        /* Improve mobile scrolling */
        .modal-scroll {
          -webkit-overflow-scrolling: touch;
          overscroll-behavior: contain;
          touch-action: pan-y;
        }
        
        /* Prevent horizontal overflow on mobile */
        @media (max-width: 768px) {
          body {
            overflow-x: hidden;
          }
        }
      `}</style>
      
      <div className="space-y-4 px-2 md:px-0 pb-safe max-w-full overflow-hidden">
        {/* Calendar Header */}
        <div className="bg-white p-3 md:p-6 rounded-lg shadow">
          <div className="flex items-center justify-between mb-4 md:mb-6 gap-2">
            <h2 className="text-base md:text-2xl font-bold text-gray-800 truncate flex-shrink min-w-0">{monthYear}</h2>
            <div className="flex gap-1 md:gap-2 flex-shrink-0">
              <button
                onClick={goToToday}
                className="px-2 md:px-4 py-1 md:py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition text-xs md:text-sm font-medium"
              >
                Today
              </button>
              <button
                onClick={previousMonth}
                className="p-1 md:p-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition"
              >
                <ChevronLeft size={16} className="md:w-5 md:h-5" />
              </button>
              <button
                onClick={nextMonth}
                className="p-1 md:p-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition"
              >
                <ChevronRight size={16} className="md:w-5 md:h-5" />
              </button>
            </div>
          </div>

          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-0.5 md:gap-2 overflow-hidden">
            {/* Day headers */}
            {dayNames.map(day => (
              <div key={day} className="text-center font-semibold text-gray-600 text-xs md:text-sm py-1 md:py-2">
                <span className="hidden md:inline">{day}</span>
                <span className="md:hidden">{day.charAt(0)}</span>
              </div>
            ))}

            {/* Calendar days */}
            {days.map((date, index) => {
              const dayEvents = date ? getEventsForDay(date) : [];
              
              return (
                <div
                  key={index}
                  className={`min-h-20 md:min-h-24 border rounded-lg p-1 md:p-2 overflow-hidden ${
                    date ? 'bg-white' : 'bg-gray-50'
                  } ${
                    isToday(date) ? 'ring-2 ring-red-500' : ''
                  }`}
                >
                  {date && (
                    <>
                      <div className={`text-xs md:text-sm font-semibold mb-1 ${
                        isToday(date) ? 'text-red-600' : 'text-gray-700'
                      }`}>
                        {date.getDate()}
                      </div>
                      
                      <div className="space-y-0.5 md:space-y-1">
                        {dayEvents.map(event => {
                          const { males, females, directors } = getEventGenderCounts(event);

                          return (
                            <button
                              key={event.id}
                              onClick={() => setSelectedEvent(event)}
                              className={`w-full text-left px-1 md:px-2 py-1 rounded text-xs text-white ${getEventTypeColor(event.type)} hover:opacity-80 transition overflow-hidden`}
                            >
                              <div className="line-clamp-2 md:truncate font-medium leading-tight mb-0.5">
                                {event.name}
                              </div>
                              {/* Gender counts on mobile and desktop */}
                              {event.signedUp?.length > 0 && (
                                <div className="flex items-center gap-1 text-[9px] md:text-xs font-bold flex-wrap">
                                  <div className="flex items-center gap-0.5 whitespace-nowrap">
                                    <div className="w-3 h-3 md:w-4 md:h-4 bg-blue-400 rounded-full flex items-center justify-center text-white text-[7px] md:text-[10px] flex-shrink-0">
                                      M
                                    </div>
                                    <span>{males}</span>
                                  </div>
                                  <div className="flex items-center gap-0.5 whitespace-nowrap">
                                    <div className="w-3 h-3 md:w-4 md:h-4 bg-pink-400 rounded-full flex items-center justify-center text-white text-[7px] md:text-[10px] flex-shrink-0">
                                      F
                                    </div>
                                    <span>{females}</span>
                                  </div>
                                </div>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div className="mt-4 md:mt-6 pt-4 md:pt-6 border-t flex flex-wrap gap-2 md:gap-4 text-xs md:text-sm">
            <div className="flex items-center gap-1 md:gap-2 whitespace-nowrap">
              <div className="w-3 h-3 md:w-4 md:h-4 bg-red-500 rounded flex-shrink-0"></div>
              <span className="truncate">Operating Night</span>
            </div>
            <div className="flex items-center gap-1 md:gap-2 whitespace-nowrap">
              <div className="w-3 h-3 md:w-4 md:h-4 bg-blue-500 rounded flex-shrink-0"></div>
              <span>Gasups</span>
            </div>
            <div className="flex items-center gap-1 md:gap-2 whitespace-nowrap">
              <div className="w-3 h-3 md:w-4 md:h-4 bg-green-500 rounded flex-shrink-0"></div>
              <span>Pickups</span>
            </div>
            <div className="flex items-center gap-1 md:gap-2 whitespace-nowrap">
              <div className="w-3 h-3 md:w-4 md:h-4 bg-purple-500 rounded flex-shrink-0"></div>
              <span>Meeting</span>
            </div>
          </div>
        </div>

        {/* Event Detail Modal */}
        {selectedEvent && (
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 flex items-end md:items-center justify-center z-50 p-0 md:p-4"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setSelectedEvent(null);
                setShowManageSignups(false);
              }
            }}
          >
            <div 
              className="bg-white rounded-t-2xl md:rounded-lg shadow-xl w-full max-w-4xl h-[90vh] md:h-auto md:max-h-[90vh] flex flex-col overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className={`px-4 md:px-6 py-3 md:py-4 border-b-4 ${getEventTypeColor(selectedEvent.type)} flex-shrink-0`}>
                <div className="flex justify-between items-start">
                  <div className="flex-1 min-w-0 pr-2">
                    <h3 className="text-lg md:text-2xl font-bold text-gray-800 break-words">{selectedEvent.name}</h3>
                    <span className={`inline-block px-2 md:px-3 py-0.5 md:py-1 rounded-full text-xs font-semibold mt-1 md:mt-2 text-white ${getEventTypeColor(selectedEvent.type)}`}>
                      {selectedEvent.type}
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedEvent(null);
                      setShowManageSignups(false);
                    }}
                    className="text-gray-500 hover:text-gray-700 transition flex-shrink-0 p-1"
                  >
                    <X size={20} className="md:w-6 md:h-6" />
                  </button>
                </div>
              </div>

              <div className="p-4 md:p-6 space-y-4 md:space-y-6 overflow-y-auto flex-1 overscroll-contain modal-scroll">
                {/* Event Details */}
                <div className="space-y-3 md:space-y-4">
                  <div className="flex items-start gap-2 md:gap-3">
                    <Clock className="text-gray-400 mt-0.5 md:mt-1 flex-shrink-0" size={18} />
                    <div className="text-xs md:text-sm">
                      <p className="font-medium text-gray-700">Start: {formatDateTime(selectedEvent.startDate)}</p>
                      <p className="font-medium text-gray-700">End: {formatDateTime(selectedEvent.endDate)}</p>
                    </div>
                  </div>

                  {selectedEvent.location && (
                    <div className="flex items-start gap-2 md:gap-3">
                      <MapPin className="text-gray-400 mt-0.5 md:mt-1 flex-shrink-0" size={18} />
                      <p className="text-xs md:text-sm text-gray-700 break-words">{selectedEvent.location}</p>
                    </div>
                  )}

                  {selectedEvent.description && (
                    <div className="bg-gray-50 p-3 md:p-4 rounded">
                      <p className="text-xs md:text-sm text-gray-700 whitespace-pre-wrap break-words">{selectedEvent.description}</p>
                    </div>
                  )}

                  <div className="flex items-center gap-2 md:gap-3">
                    <Users className="text-gray-400 flex-shrink-0" size={18} />
                    <div className="text-xs md:text-sm text-gray-700">
                      <span className="font-semibold">{selectedEvent.signedUp?.length || 0}</span> / {selectedEvent.capacity} signed up
                      {isFull(selectedEvent) && (
                        <span className="ml-2 px-2 py-0.5 md:py-1 bg-red-100 text-red-700 rounded text-xs font-semibold">
                          FULL
                        </span>
                      )}
                    </div>
                  </div>

                  {selectedEvent.points > 0 && (
                    <div className="flex items-center gap-2 md:gap-3">
                      <Award className="text-yellow-500 flex-shrink-0" size={18} />
                      <p className="text-xs md:text-sm text-gray-700">
                        <span className="font-semibold">{selectedEvent.points}</span> points
                      </p>
                    </div>
                  )}

                  {selectedEvent.directorContact && (
                    <div className="text-xs md:text-sm text-gray-600 bg-blue-50 p-2 md:p-3 rounded">
                      <p className="font-medium">Contact: {selectedEvent.directorContact}</p>
                    </div>
                  )}
                </div>

                {/* Signed Up Members */}
                <div className="border-t pt-4 md:pt-6">
                  <h4 className="text-base md:text-lg font-bold text-gray-800 mb-3 md:mb-4">Signed Up Members</h4>
                  
                  {loadingMembers ? (
                    <div className="text-center py-6 md:py-8">
                      <p className="text-gray-500 text-sm">Loading members...</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
                      {/* Directors Column */}
                      <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 md:p-4">
                        <h5 className="font-semibold text-purple-800 mb-2 md:mb-3 flex items-center gap-2 text-sm md:text-base">
                          <span className="px-1.5 md:px-2 py-0.5 md:py-1 bg-purple-200 rounded text-xs flex-shrink-0">
                            {directors.length}
                          </span>
                          Directors
                        </h5>
                        {directors.length === 0 ? (
                          <p className="text-xs md:text-sm text-gray-500 italic">No signups yet</p>
                        ) : (
                          <ul className="space-y-1.5 md:space-y-2">
                            {directors.map(member => (
                              <li key={member.id} className="text-xs md:text-sm text-gray-700 bg-white p-1.5 md:p-2 rounded border border-purple-100 break-words">
                                <div className="font-medium">{member.name}</div>
                                {member.pronouns && <div className="text-xs text-gray-500">{member.pronouns}</div>}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>

                      {/* Males Column */}
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 md:p-4">
                        <h5 className="font-semibold text-blue-800 mb-2 md:mb-3 flex items-center gap-2 text-sm md:text-base">
                          <span className="px-1.5 md:px-2 py-0.5 md:py-1 bg-blue-200 rounded text-xs flex-shrink-0">
                            {males.length}
                          </span>
                          Males
                        </h5>
                        {males.length === 0 ? (
                          <p className="text-xs md:text-sm text-gray-500 italic">No signups yet</p>
                        ) : (
                          <ul className="space-y-1.5 md:space-y-2">
                            {males.map(member => (
                              <li key={member.id} className="text-xs md:text-sm text-gray-700 bg-white p-1.5 md:p-2 rounded border border-blue-100 break-words">
                                <div className="font-medium">{member.name}</div>
                                {member.pronouns && <div className="text-xs text-gray-500">{member.pronouns}</div>}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>

                      {/* Females Column */}
                      <div className="bg-pink-50 border border-pink-200 rounded-lg p-3 md:p-4">
                        <h5 className="font-semibold text-pink-800 mb-2 md:mb-3 flex items-center gap-2 text-sm md:text-base">
                          <span className="px-1.5 md:px-2 py-0.5 md:py-1 bg-pink-200 rounded text-xs flex-shrink-0">
                            {females.length}
                          </span>
                          Females
                        </h5>
                        {females.length === 0 ? (
                          <p className="text-xs md:text-sm text-gray-500 italic">No signups yet</p>
                        ) : (
                          <ul className="space-y-1.5 md:space-y-2">
                            {females.map(member => (
                              <li key={member.id} className="text-xs md:text-sm text-gray-700 bg-white p-1.5 md:p-2 rounded border border-pink-100 break-words">
                                <div className="font-medium">{member.name}</div>
                                {member.pronouns && <div className="text-xs text-gray-500">{member.pronouns}</div>}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>

                      {/* Others Column */}
                      {others.length > 0 && (
                        <div className="bg-green-50 border border-green-200 rounded-lg p-3 md:p-4 md:col-span-3">
                          <h5 className="font-semibold text-green-800 mb-2 md:mb-3 flex items-center gap-2 text-sm md:text-base">
                            <span className="px-1.5 md:px-2 py-0.5 md:py-1 bg-green-200 rounded text-xs flex-shrink-0">
                              {others.length}
                            </span>
                            Other
                          </h5>
                          <ul className="grid grid-cols-1 md:grid-cols-3 gap-1.5 md:gap-2">
                            {others.map(member => (
                              <li key={member.id} className="text-xs md:text-sm text-gray-700 bg-white p-1.5 md:p-2 rounded border border-green-100 break-words">
                                <div className="font-medium">{member.name}</div>
                                {member.pronouns && <div className="text-xs text-gray-500">{member.pronouns}</div>}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Director-Only: Manage Signups */}
                {userProfile?.role === 'director' && (
                  <div className="border-t pt-4 md:pt-6">
                    <button
                      onClick={() => setShowManageSignups(!showManageSignups)}
                      className="w-full mb-3 md:mb-4 px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition font-medium text-sm md:text-base flex items-center justify-center gap-2"
                    >
                      <User size={18} />
                      {showManageSignups ? 'Hide' : 'Manage Signups (Director Only)'}
                    </button>

                    {showManageSignups && (
                      <div className="space-y-3 md:space-y-4">
                        <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 md:p-4">
                          <h5 className="font-semibold text-purple-800 mb-2 md:mb-3 text-sm md:text-base">
                            Add Members to Event
                          </h5>
                          <p className="text-xs text-gray-600 mb-3">
                            Click on any member to add them to this event
                          </p>
                          
                          {/* Not Signed Up Members */}
                          <div className="space-y-2">
                            <h6 className="text-xs md:text-sm font-medium text-gray-700">Available Members:</h6>
                            <div className="max-h-60 overflow-y-auto space-y-1.5">
                              {allMembers
                                .filter(member => !selectedEvent.signedUp?.includes(member.id))
                                .sort((a, b) => {
                                  // Sort: directors first, then by name
                                  if (a.role === 'director' && b.role !== 'director') return -1;
                                  if (a.role !== 'director' && b.role === 'director') return 1;
                                  return a.name.localeCompare(b.name);
                                })
                                .map(member => (
                                  <button
                                    key={member.id}
                                    onClick={() => manuallyAddMember(selectedEvent, member.id)}
                                    className="w-full text-left px-3 py-2 bg-white border border-gray-300 rounded hover:bg-green-50 hover:border-green-400 transition text-xs md:text-sm"
                                  >
                                    <div className="flex items-center justify-between">
                                      <div>
                                        <span className="font-medium">{member.name}</span>
                                        {member.role === 'director' && (
                                          <span className="ml-2 px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded text-xs">
                                            Director
                                          </span>
                                        )}
                                      </div>
                                      <span className="text-green-600 font-bold">+</span>
                                    </div>
                                  </button>
                                ))}
                              {allMembers.filter(member => !selectedEvent.signedUp?.includes(member.id)).length === 0 && (
                                <p className="text-xs text-gray-500 italic py-2">All members are signed up</p>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Currently Signed Up - Remove Option */}
                        {selectedEvent.signedUp?.length > 0 && (
                          <div className="bg-red-50 border border-red-200 rounded-lg p-3 md:p-4">
                            <h5 className="font-semibold text-red-800 mb-2 md:mb-3 text-sm md:text-base">
                              Remove Members from Event
                            </h5>
                            <p className="text-xs text-gray-600 mb-3">
                              Click on any signed up member to remove them
                            </p>
                            <div className="max-h-60 overflow-y-auto space-y-1.5">
                              {signedUpMembers
                                .sort((a, b) => {
                                  if (a.role === 'director' && b.role !== 'director') return -1;
                                  if (a.role !== 'director' && b.role === 'director') return 1;
                                  return a.name.localeCompare(b.name);
                                })
                                .map(member => (
                                  <button
                                    key={member.id}
                                    onClick={() => manuallyRemoveMember(selectedEvent, member.id)}
                                    className="w-full text-left px-3 py-2 bg-white border border-gray-300 rounded hover:bg-red-50 hover:border-red-400 transition text-xs md:text-sm"
                                  >
                                    <div className="flex items-center justify-between">
                                      <div>
                                        <span className="font-medium">{member.name}</span>
                                        {member.role === 'director' && (
                                          <span className="ml-2 px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded text-xs">
                                            Director
                                          </span>
                                        )}
                                      </div>
                                      <span className="text-red-600 font-bold">×</span>
                                    </div>
                                  </button>
                                ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Action Buttons */}
                {isPastEvent(selectedEvent) && (
                  <div className="bg-gray-100 p-3 md:p-4 rounded text-center">
                    <p className="text-gray-600 font-medium text-sm md:text-base">This event has ended</p>
                  </div>
                )}

                {!isPastEvent(selectedEvent) && (
                  <div className="pt-3 md:pt-4 border-t">
                    {isSignedUp(selectedEvent) ? (
                      <div className="space-y-2 md:space-y-3">
                        <div className="bg-green-50 border border-green-200 p-2 md:p-3 rounded text-center">
                          <p className="text-green-700 font-semibold text-sm md:text-base">✓ You're signed up for this event!</p>
                        </div>
                        <button
                          onClick={() => cancelSignup(selectedEvent)}
                          className="w-full py-2 md:py-3 bg-red-500 text-white rounded-md hover:bg-red-600 transition font-medium text-sm md:text-base"
                        >
                          Cancel Signup
                        </button>
                      </div>
                    ) : isFull(selectedEvent) ? (
                      <button
                        disabled
                        className="w-full py-2 md:py-3 bg-gray-300 text-gray-500 rounded-md cursor-not-allowed font-medium text-sm md:text-base"
                      >
                        Event Full
                      </button>
                    ) : (
                      <button
                        onClick={() => signUpForEvent(selectedEvent)}
                        className="w-full py-2 md:py-3 bg-green-600 text-white rounded-md hover:bg-green-700 transition font-medium text-sm md:text-base"
                      >
                        Sign Up for Event
                      </button>
                    )}
                  </div>
                )}

                {/* Bottom padding for safe area */}
                <div className="h-4 md:h-0"></div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default EventCalendar;