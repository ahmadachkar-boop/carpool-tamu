import React, { useState, useEffect } from 'react';
import { Car, Phone, BarChart3, Users, AlertCircle, TrendingUp, Clock, Bell, Megaphone, Calendar as CalendarIcon, Award, ExternalLink, FileText, ClipboardCheck, DollarSign, Zap, Activity } from 'lucide-react';
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

  // Detect if running as iOS PWA
  const isIOSPWA = () => {
    return window.navigator.standalone === true ||
           window.matchMedia('(display-mode: standalone)').matches;
  };

  const [isAppMode] = useState(isIOSPWA());

  // Quick Links data
  const quickLinks = [
    {
      name: 'Refresher Form',
      url: 'https://docs.google.com/forms/d/e/1FAIpQLSeN__PVDSMyQUge68T1gVLe7d_CY1yrsrI0mP-B_OGksLn5dg/viewform',
      icon: FileText,
      gradient: 'from-blue-500 via-blue-600 to-cyan-600',
      description: 'Complete training'
    },
    {
      name: 'Friday Debrief',
      url: 'https://forms.gle/rFFiWfm7iAaLMyv18',
      icon: ClipboardCheck,
      gradient: 'from-purple-500 via-purple-600 to-pink-600',
      description: 'Friday feedback'
    },
    {
      name: 'Saturday Debrief',
      url: 'https://forms.gle/gAdFiPv24Lkk8u8w5',
      icon: ClipboardCheck,
      gradient: 'from-pink-500 via-pink-600 to-rose-600',
      description: 'Saturday feedback'
    },
    {
      name: 'Pay Dues',
      url: 'https://tamu.estore.flywire.com/products/membership-dues-fall-23-21127',
      icon: DollarSign,
      gradient: 'from-[#79F200] via-[#6dd100] to-[#5bc000]',
      description: 'Membership dues'
    }
  ];

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
      where('startDate', '>=', now),
      orderBy('startDate', 'asc'),
      limit(3)
    );

    const unsubscribe = onSnapshot(eventsQuery, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        startDate: doc.data().startDate?.toDate(),
        endDate: doc.data().endDate?.toDate()
      }));
      setUpcomingEvents(data);
    });

    return () => unsubscribe();
  }, []);

  // Fetch leaderboard
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

  // Fetch ride stats
  useEffect(() => {
    if (!activeNDR) {
      setStats({ activeRiders: 0, pendingRiders: 0, completedRiders: 0, availableCars: 0 });
      return;
    }

    const ridesRef = collection(db, 'rides');

    const unsubPending = onSnapshot(
      query(ridesRef, where('ndrId', '==', activeNDR.id), where('status', '==', 'pending')),
      (snapshot) => {
        const totalPendingRiders = snapshot.docs.reduce((sum, doc) => {
          return sum + (doc.data().riders || 1);
        }, 0);
        setStats(prev => ({ ...prev, pendingRiders: totalPendingRiders }));
      }
    );

    const unsubActive = onSnapshot(
      query(ridesRef, where('ndrId', '==', activeNDR.id), where('status', '==', 'active')),
      (snapshot) => {
        const totalActiveRiders = snapshot.docs.reduce((sum, doc) => {
          return sum + (doc.data().riders || 1);
        }, 0);
        setStats(prev => ({ ...prev, activeRiders: totalActiveRiders }));
      }
    );

    const unsubCompleted = onSnapshot(
      query(ridesRef, where('ndrId', '==', activeNDR.id), where('status', '==', 'completed')),
      (snapshot) => {
        const totalCompletedRiders = snapshot.docs.reduce((sum, doc) => {
          return sum + (doc.data().riders || 1);
        }, 0);
        setStats(prev => ({ ...prev, completedRiders: totalCompletedRiders }));
      }
    );

    setStats(prev => ({ ...prev, availableCars: activeNDR.availableCars || 0 }));

    return () => {
      unsubPending();
      unsubActive();
      unsubCompleted();
    };
  }, [activeNDR]);

  if (ndrLoading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${isAppMode ? 'bg-black' : 'bg-gradient-to-br from-gray-900 via-gray-800 to-black'}`}>
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-[#79F200] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-300 font-semibold">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  const statCards = [
    {
      title: 'Pending',
      value: stats.pendingRiders,
      icon: Clock,
      gradient: 'from-yellow-500 via-orange-500 to-red-500',
      description: 'Waiting for car',
      glow: 'shadow-yellow-500/20'
    },
    {
      title: 'Active',
      value: stats.activeRiders,
      icon: Activity,
      gradient: 'from-[#79F200] via-[#6dd100] to-[#5bc000]',
      description: 'On the road',
      glow: 'shadow-[#79F200]/30'
    },
    {
      title: 'Completed',
      value: stats.completedRiders,
      icon: BarChart3,
      gradient: 'from-blue-500 via-cyan-500 to-teal-500',
      description: 'Delivered safe',
      glow: 'shadow-blue-500/20'
    },
    {
      title: 'Cars',
      value: stats.availableCars,
      icon: Car,
      gradient: 'from-purple-500 via-pink-500 to-rose-500',
      description: 'Ready to go',
      glow: 'shadow-purple-500/20'
    }
  ];

  const formatDate = (timestamp) => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  };

  return (
    <div className={`min-h-screen ${isAppMode ? 'bg-black pb-24' : 'bg-gradient-to-br from-gray-900 via-gray-800 to-black'} text-white`}>
      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-black bg-gradient-to-r from-white via-gray-100 to-gray-300 bg-clip-text text-transparent">
              Hey, {userProfile?.name?.split(' ')[0] || 'Member'}! 👋
            </h1>
            <p className="text-gray-400 mt-1 font-medium">
              {activeNDR ? activeNDR.eventName : 'No active operating night'}
            </p>
          </div>
          {activeNDR && (
            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-r from-[#79F200] to-[#5bc000] rounded-2xl blur-lg opacity-50 group-hover:opacity-75 transition"></div>
              <div className="relative bg-gradient-to-r from-[#79F200] to-[#5bc000] px-6 py-3 rounded-2xl shadow-xl">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-gray-900 rounded-full animate-pulse"></div>
                  <p className="text-sm font-bold text-gray-900">LIVE</p>
                </div>
                <p className="text-lg font-black text-gray-900">{activeNDR.eventName}</p>
              </div>
            </div>
          )}
        </div>

        {/* Quick Links */}
        <div className={`relative ${isAppMode ? 'bg-gray-900/50' : 'bg-white/5'} backdrop-blur-xl rounded-3xl p-6 border border-white/10 shadow-2xl`}>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-red-500 rounded-xl flex items-center justify-center shadow-lg">
              <Zap className="text-white" size={20} />
            </div>
            <h2 className="text-xl font-black text-white">Quick Actions</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {quickLinks.map((link, index) => (
              <a
                key={index}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group relative overflow-hidden rounded-2xl p-4 transform hover:scale-105 transition-all duration-300"
              >
                <div className={`absolute inset-0 bg-gradient-to-br ${link.gradient} opacity-10 group-hover:opacity-20 transition`}></div>
                <div className="relative">
                  <div className="flex items-center justify-between mb-2">
                    <div className={`w-12 h-12 bg-gradient-to-br ${link.gradient} rounded-xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform`}>
                      <link.icon className="text-white" size={22} />
                    </div>
                    <ExternalLink className="text-gray-500 group-hover:text-gray-300 transition-colors" size={16} />
                  </div>
                  <h3 className="font-bold text-white mb-1">{link.name}</h3>
                  <p className="text-xs text-gray-400">{link.description}</p>
                </div>
              </a>
            ))}
          </div>
        </div>

        {/* Announcements */}
        {announcements.length > 0 && (
          <div className={`relative ${isAppMode ? 'bg-blue-900/20' : 'bg-blue-500/10'} backdrop-blur-xl rounded-3xl p-6 border border-blue-500/20 shadow-2xl`}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center shadow-lg">
                <Megaphone className="text-white" size={20} />
              </div>
              <h2 className="text-xl font-black text-white">Announcements</h2>
            </div>
            <div className="space-y-3">
              {announcements.map(announcement => (
                <div key={announcement.id} className="bg-white/5 backdrop-blur rounded-2xl p-4 border border-white/10 hover:bg-white/10 transition">
                  <div className="flex items-start gap-3">
                    <Bell className="text-blue-400 mt-1 flex-shrink-0" size={18} />
                    <div className="flex-1">
                      <h4 className="font-bold text-white">{announcement.title}</h4>
                      <p className="text-sm text-gray-300 mt-1">{announcement.message}</p>
                      <p className="text-xs text-gray-500 mt-2">
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
          <div className="relative bg-gradient-to-br from-yellow-500/20 to-orange-500/20 backdrop-blur-xl rounded-3xl p-8 text-center border border-yellow-500/30 shadow-2xl">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-yellow-500 to-orange-500 rounded-full mb-4 shadow-2xl">
              <AlertCircle className="text-white" size={40} />
            </div>
            <h3 className="text-3xl font-black text-white mb-3">No Active NDR</h3>
            <p className="text-gray-300 mb-4 max-w-2xl mx-auto">
              There is currently no active operating night. Statistics will appear once an NDR is activated.
            </p>
            <p className="text-sm text-gray-400 font-semibold">
              Directors: Activate an event in NDR Reports
            </p>
          </div>
        )}

        {/* Stats Grid */}
        {activeNDR && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {statCards.map((stat, index) => (
              <div
                key={index}
                className={`group relative overflow-hidden rounded-3xl p-6 transform hover:scale-105 transition-all duration-300 ${stat.glow} shadow-2xl`}
              >
                <div className={`absolute inset-0 bg-gradient-to-br ${stat.gradient} opacity-10 group-hover:opacity-20 transition`}></div>
                <div className={`absolute -right-8 -top-8 w-32 h-32 bg-gradient-to-br ${stat.gradient} rounded-full opacity-10 blur-2xl group-hover:opacity-20 transition`}></div>

                <div className="relative">
                  <div className="flex items-center justify-between mb-4">
                    <div className={`w-14 h-14 bg-gradient-to-br ${stat.gradient} rounded-2xl flex items-center justify-center shadow-xl group-hover:scale-110 transition-transform`}>
                      <stat.icon className="text-white" size={24} />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <p className="text-gray-400 text-sm font-semibold">{stat.title}</p>
                    <p className="text-5xl font-black text-white">{stat.value}</p>
                    <p className="text-gray-500 text-xs font-medium">{stat.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Bottom Grid: Events & Leaderboard */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Upcoming Events */}
          <div className={`relative ${isAppMode ? 'bg-gray-900/50' : 'bg-white/5'} backdrop-blur-xl rounded-3xl p-6 border border-white/10 shadow-2xl`}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center shadow-lg">
                  <CalendarIcon className="text-white" size={20} />
                </div>
                <h2 className="text-xl font-black text-white">Events</h2>
              </div>
              <Link to="/calendar" className="text-sm text-[#79F200] hover:text-[#6dd100] font-bold transition">
                View All →
              </Link>
            </div>
            <div className="space-y-3">
              {upcomingEvents.length === 0 ? (
                <p className="text-gray-500 text-center py-8 font-medium">No upcoming events</p>
              ) : (
                upcomingEvents.map(event => (
                  <div key={event.id} className="flex items-center gap-3 p-3 bg-white/5 rounded-2xl hover:bg-white/10 transition border border-white/5">
                    <div className={`w-1 h-14 rounded-full ${
                      event.type === 'operating night' ? 'bg-gradient-to-b from-red-500 to-rose-500' :
                      event.type === 'gasups' ? 'bg-gradient-to-b from-blue-500 to-cyan-500' :
                      event.type === 'pickups' ? 'bg-gradient-to-b from-green-500 to-emerald-500' :
                      'bg-gradient-to-b from-purple-500 to-pink-500'
                    } shadow-lg`}></div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-white truncate">{event.name}</h4>
                      <p className="text-xs text-gray-400 font-medium">
                        {event.startDate?.toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit'
                        })}
                      </p>
                    </div>
                    <span className={`px-3 py-1.5 text-xs font-bold rounded-full ${
                      event.type === 'operating night' ? 'bg-red-500/20 text-red-300 border border-red-500/30' :
                      event.type === 'gasups' ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30' :
                      event.type === 'pickups' ? 'bg-green-500/20 text-green-300 border border-green-500/30' :
                      'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                    }`}>
                      {event.type}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Leaderboard */}
          <div className={`relative ${isAppMode ? 'bg-gray-900/50' : 'bg-white/5'} backdrop-blur-xl rounded-3xl p-6 border border-white/10 shadow-2xl`}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-xl flex items-center justify-center shadow-lg">
                <Award className="text-white" size={20} />
              </div>
              <h2 className="text-xl font-black text-white">Top Members</h2>
            </div>
            <div className="space-y-3">
              {leaderboard.length === 0 ? (
                <p className="text-gray-500 text-center py-8 font-medium">No members yet</p>
              ) : (
                leaderboard.map((member, index) => (
                  <div key={member.id} className="flex items-center gap-3 p-3 bg-white/5 rounded-2xl hover:bg-white/10 transition border border-white/5">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-white shadow-lg ${
                      index === 0 ? 'bg-gradient-to-br from-yellow-400 to-yellow-600' :
                      index === 1 ? 'bg-gradient-to-br from-gray-300 to-gray-500' :
                      index === 2 ? 'bg-gradient-to-br from-orange-400 to-orange-600' :
                      'bg-gradient-to-br from-gray-700 to-gray-800'
                    }`}>
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <h4 className="font-bold text-white">{member.name}</h4>
                      <p className="text-xs text-gray-400 font-medium">{member.nightsWorked || 0} nights</p>
                    </div>
                    <span className="text-2xl font-black text-[#79F200]">{member.points || 0}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Tonight's Stats */}
        {activeNDR && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className={`relative ${isAppMode ? 'bg-gray-900/50' : 'bg-white/5'} backdrop-blur-xl rounded-3xl p-6 border border-white/10 shadow-2xl`}>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-gradient-to-br from-[#79F200] to-[#5bc000] rounded-xl flex items-center justify-center shadow-lg">
                  <BarChart3 className="text-gray-900" size={20} />
                </div>
                <h2 className="text-xl font-black text-white">Tonight's Stats</h2>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between items-center p-4 bg-white/5 rounded-2xl border border-white/10">
                  <span className="text-gray-300 font-bold">Total Requests</span>
                  <span className="text-3xl font-black text-white">
                    {stats.pendingRiders + stats.activeRiders + stats.completedRiders}
                  </span>
                </div>
                <div className="flex justify-between items-center p-4 bg-white/5 rounded-2xl border border-white/10">
                  <span className="text-gray-300 font-bold">Completion Rate</span>
                  <span className="text-3xl font-black text-[#79F200]">
                    {stats.pendingRiders + stats.activeRiders + stats.completedRiders > 0
                      ? Math.round((stats.completedRiders / (stats.pendingRiders + stats.activeRiders + stats.completedRiders)) * 100)
                      : 0}%
                  </span>
                </div>
              </div>
            </div>

            <div className={`relative ${isAppMode ? 'bg-gray-900/50' : 'bg-white/5'} backdrop-blur-xl rounded-3xl p-6 border border-white/10 shadow-2xl`}>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center shadow-lg">
                  <Users className="text-white" size={20} />
                </div>
                <h2 className="text-xl font-black text-white">System Status</h2>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-4 bg-green-500/10 rounded-2xl border border-green-500/30">
                  <span className="text-white font-bold">Phone Room</span>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-[#79F200] rounded-full animate-pulse shadow-lg shadow-[#79F200]/50"></div>
                    <span className="px-3 py-1 bg-[#79F200] text-gray-900 text-xs font-black rounded-full">ONLINE</span>
                  </div>
                </div>
                <div className="flex items-center justify-between p-4 bg-green-500/10 rounded-2xl border border-green-500/30">
                  <span className="text-white font-bold">Ride Management</span>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-[#79F200] rounded-full animate-pulse shadow-lg shadow-[#79F200]/50"></div>
                    <span className="px-3 py-1 bg-[#79F200] text-gray-900 text-xs font-black rounded-full">ONLINE</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
