import React, { useState, useEffect } from 'react';
import { Car, Phone, BarChart3, Users, AlertCircle, TrendingUp, Clock, Bell, Megaphone, Calendar as CalendarIcon, Award } from 'lucide-react';
import { db } from '../firebase';
import { collection, query, onSnapshot, where, orderBy, limit } from 'firebase/firestore';
import { useActiveNDR } from '../ActiveNDRContext';
import { useAuth } from '../AuthContext';
import { Link } from 'react-router-dom';

const Dashboard = () => {
  const [stats, setStats] = useState({
    activeRiders: 0,
    pendingRiders: 0,
    completedRiders: 0,
    availableCars: 0
  });
  const [announcements, setAnnouncements] = useState([]);
  const [upcomingEvents, setUpcomingEvents] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const { activeNDR, loading: ndrLoading } = useActiveNDR();
  const { userProfile } = useAuth();

  // Fetch announcements
  useEffect(() => {
    const announcementsQuery = query(
      collection(db, 'announcements'),
      where('active', '==', true),
      orderBy('createdAt', 'desc'),
      limit(3)
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

  // Fetch upcoming events
  useEffect(() => {
    const now = new Date();
    const eventsQuery = query(
      collection(db, 'events'),
      where('startTime', '>=', now),
      orderBy('startTime', 'asc'),
      limit(3)
    );
    
    const unsubscribe = onSnapshot(eventsQuery, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setUpcomingEvents(data);
    });

    return () => unsubscribe();
  }, []);

  // Fetch member leaderboard
  useEffect(() => {
    const membersQuery = query(
      collection(db, 'members'),
      orderBy('points', 'desc'),
      limit(5)
    );
    
    const unsubscribe = onSnapshot(membersQuery, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setLeaderboard(data);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!activeNDR) {
      setStats({
        activeRiders: 0,
        pendingRiders: 0,
        completedRiders: 0,
        availableCars: 0
      });
      return;
    }

    setStats(prev => ({ ...prev, availableCars: activeNDR.availableCars || 0 }));

    const ridesRef = collection(db, 'rides');
    
    const pendingQuery = query(
      ridesRef, 
      where('status', '==', 'pending'),
      where('ndrId', '==', activeNDR.id)
    );
    
    const activeQuery = query(
      ridesRef, 
      where('status', '==', 'active'),
      where('ndrId', '==', activeNDR.id)
    );
    
    const completedQuery = query(
      ridesRef, 
      where('status', '==', 'completed'),
      where('ndrId', '==', activeNDR.id)
    );

    const unsubPending = onSnapshot(pendingQuery, (snapshot) => {
      const totalPendingRiders = snapshot.docs.reduce((sum, doc) => {
        return sum + (doc.data().riders || 1);
      }, 0);
      setStats(prev => ({ ...prev, pendingRiders: totalPendingRiders }));
    });

    const unsubActive = onSnapshot(activeQuery, (snapshot) => {
      const totalActiveRiders = snapshot.docs.reduce((sum, doc) => {
        return sum + (doc.data().riders || 1);
      }, 0);
      setStats(prev => ({ ...prev, activeRiders: totalActiveRiders }));
    });

    const unsubCompleted = onSnapshot(completedQuery, (snapshot) => {
      const totalCompletedRiders = snapshot.docs.reduce((sum, doc) => {
        return sum + (doc.data().riders || 1);
      }, 0);
      setStats(prev => ({ ...prev, completedRiders: totalCompletedRiders }));
    });

    return () => {
      unsubPending();
      unsubActive();
      unsubCompleted();
    };
  }, [activeNDR]);

  if (ndrLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-[#79F200] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  const statCards = [
    {
      title: 'Pending Requests',
      value: stats.pendingRiders,
      icon: Clock,
      color: 'from-yellow-500 to-orange-500',
      bgColor: 'from-yellow-50 to-orange-50',
      textColor: 'text-orange-700',
      description: 'Awaiting assignment'
    },
    {
      title: 'Active Rides',
      value: stats.activeRiders,
      icon: TrendingUp,
      color: 'from-[#79F200] to-[#79F200]',
      bgColor: 'from-green-50 to-lime-50',
      textColor: 'text-green-700',
      description: 'Currently in progress'
    },
    {
      title: 'Completed Today',
      value: stats.completedRiders,
      icon: BarChart3,
      color: 'from-blue-500 to-cyan-500',
      bgColor: 'from-blue-50 to-cyan-50',
      textColor: 'text-blue-700',
      description: 'Successfully delivered'
    },
    {
      title: 'Available Cars',
      value: stats.availableCars,
      icon: Car,
      color: 'from-purple-500 to-pink-500',
      bgColor: 'from-purple-50 to-pink-50',
      textColor: 'text-purple-700',
      description: 'Ready for dispatch'
    }
  ];

  const formatDate = (timestamp) => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  };

  return (
    <div className="space-y-6 p-4 md:p-0">
      {/* Header with user greeting */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <div>
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900">
            Welcome back, {userProfile?.name?.split(' ')[0] || 'Member'}!
          </h2>
          <p className="text-gray-600 mt-1">
            {activeNDR ? `Operating Night: ${activeNDR.eventName}` : 'No active operating night'}
          </p>
        </div>
        {activeNDR && (
          <div className="bg-[#79F200] px-6 py-3 rounded-xl shadow-lg">
            <p className="text-sm font-medium text-gray-900">Active NDR</p>
            <p className="text-lg font-bold text-gray-900">{activeNDR.eventName}</p>
          </div>
        )}
      </div>

      {/* Announcements Section */}
      {announcements.length > 0 && (
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-300 rounded-2xl p-6 shadow-lg">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-blue-500 rounded-xl flex items-center justify-center">
              <Megaphone className="text-white" size={20} />
            </div>
            <h3 className="text-xl font-bold text-gray-900">Announcements</h3>
          </div>
          <div className="space-y-3">
            {announcements.map(announcement => (
              <div key={announcement.id} className="bg-white rounded-xl p-4 shadow-sm">
                <div className="flex items-start gap-3">
                  <Bell className="text-blue-500 mt-1 flex-shrink-0" size={18} />
                  <div className="flex-1">
                    <h4 className="font-semibold text-gray-900">{announcement.title}</h4>
                    <p className="text-sm text-gray-600 mt-1">{announcement.message}</p>
                    <p className="text-xs text-gray-400 mt-2">
                      {formatDate(announcement.createdAt)} • {announcement.createdBy}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* No Active NDR Warning */}
      {!activeNDR && (
        <div className="bg-gradient-to-br from-yellow-50 to-orange-50 border-2 border-yellow-400 rounded-2xl p-6 md:p-8 text-center shadow-xl">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-yellow-400 rounded-full mb-4">
            <AlertCircle className="text-white" size={32} />
          </div>
          <h3 className="text-2xl md:text-3xl font-bold text-gray-900 mb-3">No Active NDR</h3>
          <p className="text-gray-700 mb-4 max-w-2xl mx-auto text-sm md:text-base">
            There is currently no active operating night. Statistics will appear here once an NDR is activated.
          </p>
          <p className="text-sm text-gray-600">
            Directors: Go to NDR Reports to activate an event.
          </p>
        </div>
      )}

      {/* Stats Grid */}
      {activeNDR && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
          {statCards.map((stat, index) => (
            <div
              key={index}
              className={`bg-gradient-to-br ${stat.bgColor} rounded-2xl p-6 shadow-lg hover:shadow-xl transform hover:scale-105 transition-all border border-gray-200`}
            >
              <div className="flex items-center justify-between mb-4">
                <div className={`w-12 h-12 bg-gradient-to-br ${stat.color} rounded-xl flex items-center justify-center shadow-lg`}>
                  <stat.icon className="text-white" size={24} />
                </div>
                <span className={`text-3xl md:text-4xl font-bold ${stat.textColor}`}>
                  {stat.value}
                </span>
              </div>
              <h3 className="text-gray-900 font-semibold text-base md:text-lg mb-1">{stat.title}</h3>
              <p className="text-gray-600 text-xs md:text-sm">{stat.description}</p>
            </div>
          ))}
        </div>
      )}

      {/* Bottom Grid: Upcoming Events & Leaderboard */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upcoming Events */}
        <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
                <CalendarIcon className="text-white" size={20} />
              </div>
              <h3 className="text-xl font-bold text-gray-900">Upcoming Events</h3>
            </div>
            <Link to="/calendar" className="text-sm text-blue-600 hover:text-blue-700 font-semibold">
              View All →
            </Link>
          </div>
          <div className="space-y-3">
            {upcomingEvents.length === 0 ? (
              <p className="text-gray-500 text-center py-4">No upcoming events</p>
            ) : (
              upcomingEvents.map(event => (
                <div key={event.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition">
                  <div className={`w-2 h-12 rounded-full ${
                    event.type === 'operating night' ? 'bg-red-500' :
                    event.type === 'gasups' ? 'bg-blue-500' :
                    event.type === 'pickups' ? 'bg-green-500' : 'bg-purple-500'
                  }`}></div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-gray-900">{event.name}</h4>
                    <p className="text-sm text-gray-600">{formatDate(event.startTime)}</p>
                  </div>
                  <span className="text-xs font-semibold text-gray-600 uppercase">{event.type}</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Leaderboard */}
        <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-200">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-gradient-to-br from-yellow-500 to-orange-500 rounded-lg flex items-center justify-center">
              <Award className="text-white" size={20} />
            </div>
            <h3 className="text-xl font-bold text-gray-900">Top Members</h3>
          </div>
          <div className="space-y-3">
            {leaderboard.map((member, index) => (
              <div key={member.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-white ${
                  index === 0 ? 'bg-yellow-500' :
                  index === 1 ? 'bg-gray-400' :
                  index === 2 ? 'bg-orange-600' : 'bg-gray-300'
                }`}>
                  {index + 1}
                </div>
                <div className="flex-1">
                  <h4 className="font-semibold text-gray-900">{member.name}</h4>
                  <p className="text-xs text-gray-600">{member.nightsWorked || 0} nights worked</p>
                </div>
                <span className="text-lg font-bold text-[#79F200]">{member.points || 0} pts</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Quick Stats for Active NDR */}
      {activeNDR && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-gradient-to-br from-[#79F200] to-[#5bc000] rounded-lg flex items-center justify-center">
                <BarChart3 className="text-gray-900" size={20} />
              </div>
              <h3 className="text-xl font-bold text-gray-900">Tonight's Stats</h3>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between items-center p-3 bg-gray-50 rounded-xl">
                <span className="text-gray-700 font-medium">Total Requests</span>
                <span className="text-2xl font-bold text-gray-900">
                  {stats.pendingRiders + stats.activeRiders + stats.completedRiders}
                </span>
              </div>
              <div className="flex justify-between items-center p-3 bg-gray-50 rounded-xl">
                <span className="text-gray-700 font-medium">Completion Rate</span>
                <span className="text-2xl font-bold text-[#79F200]">
                  {stats.pendingRiders + stats.activeRiders + stats.completedRiders > 0
                    ? Math.round((stats.completedRiders / (stats.pendingRiders + stats.activeRiders + stats.completedRiders)) * 100)
                    : 0}%
                </span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-lg flex items-center justify-center">
                <Users className="text-white" size={20} />
              </div>
              <h3 className="text-xl font-bold text-gray-900">System Status</h3>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-green-50 rounded-xl border border-green-200">
                <span className="text-gray-700 font-medium">Phone Room</span>
                <span className="px-3 py-1 bg-[#79F200] text-gray-900 text-xs font-bold rounded-full">ONLINE</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-green-50 rounded-xl border border-green-200">
                <span className="text-gray-700 font-medium">Ride Management</span>
                <span className="px-3 py-1 bg-[#79F200] text-gray-900 text-xs font-bold rounded-full">ONLINE</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;