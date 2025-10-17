import React, { useState, useEffect } from 'react';
import { Car, Phone, BarChart3, Users, AlertCircle } from 'lucide-react';
import { db } from '../firebase';
import { collection, query, onSnapshot, where } from 'firebase/firestore';
import { useActiveNDR } from '../ActiveNDRContext';

const Dashboard = () => {
  const [stats, setStats] = useState({
    activeRiders: 0,
    pendingRiders: 0,
    completedRiders: 0,
    availableCars: 0
  });

  const { activeNDR, loading: ndrLoading } = useActiveNDR();

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

    // Set available cars from active NDR
    setStats(prev => ({ ...prev, availableCars: activeNDR.availableCars || 0 }));

    const ridesRef = collection(db, 'rides');
    
    // Pending riders query
    const pendingQuery = query(
      ridesRef, 
      where('status', '==', 'pending'),
      where('ndrId', '==', activeNDR.id)
    );
    
    // Active riders query
    const activeQuery = query(
      ridesRef, 
      where('status', '==', 'active'),
      where('ndrId', '==', activeNDR.id)
    );
    
    // Completed riders query (for this NDR)
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
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-gray-800">Dashboard</h2>
        <div className="bg-white p-12 rounded-lg shadow text-center">
          <p className="text-gray-500">Loading...</p>
        </div>
      </div>
    );
  }

  if (!activeNDR) {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-gray-800">Dashboard</h2>
        
        <div className="bg-yellow-50 border-2 border-yellow-400 rounded-lg p-8 text-center">
          <AlertCircle className="mx-auto mb-4 text-yellow-600" size={64} />
          <h3 className="text-xl font-bold text-gray-800 mb-2">No Active NDR</h3>
          <p className="text-gray-600 mb-4">
            There is currently no active operating night. Statistics will appear here once an NDR is activated.
          </p>
          <p className="text-sm text-gray-500">
            Directors: Go to NDR Reports to activate an event.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 opacity-50">
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm">Active Riders</p>
                <p className="text-3xl font-bold text-blue-600">0</p>
              </div>
              <Car className="text-blue-600" size={40} />
            </div>
          </div>
          
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm">Pending Riders</p>
                <p className="text-3xl font-bold text-yellow-600">0</p>
              </div>
              <Phone className="text-yellow-600" size={40} />
            </div>
          </div>
          
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm">Completed Tonight</p>
                <p className="text-3xl font-bold text-lime-600">0</p>
              </div>
              <BarChart3 className="text-lime-600" size={40} />
            </div>
          </div>
          
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm">Available Cars</p>
                <p className="text-3xl font-bold text-purple-600">0</p>
              </div>
              <Users className="text-purple-600" size={40} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <h2 className="text-2xl font-bold text-gray-800">Dashboard</h2>
        <div className="bg-lime-100 px-4 py-2 rounded-lg border border-lime-200">
          <p className="text-sm font-semibold text-lime-800">Active NDR: {activeNDR.eventName}</p>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-lg shadow hover:shadow-lg transition">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm">Active Riders</p>
              <p className="text-3xl font-bold text-blue-600">{stats.activeRiders}</p>
              <p className="text-xs text-gray-400 mt-1">Currently in cars</p>
            </div>
            <Car className="text-blue-600" size={40} />
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow hover:shadow-lg transition">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm">Pending Riders</p>
              <p className="text-3xl font-bold text-yellow-600">{stats.pendingRiders}</p>
              <p className="text-xs text-gray-400 mt-1">Waiting for pickup</p>
            </div>
            <Phone className="text-yellow-600" size={40} />
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow hover:shadow-lg transition">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm">Completed Tonight</p>
              <p className="text-3xl font-bold text-lime-600">{stats.completedRiders}</p>
              <p className="text-xs text-gray-400 mt-1">Safe rides home</p>
            </div>
            <BarChart3 className="text-lime-600" size={40} />
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow hover:shadow-lg transition">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm">Available Cars</p>
              <p className="text-3xl font-bold text-purple-600">{stats.availableCars}</p>
              <p className="text-xs text-gray-400 mt-1">Ready to serve</p>
            </div>
            <Users className="text-purple-600" size={40} />
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-semibold mb-4">Tonight's Overview</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
            <p className="text-sm text-blue-800 font-medium">Total Riders Served</p>
            <p className="text-2xl font-bold text-blue-600 mt-1">
              {stats.completedRiders + stats.activeRiders}
            </p>
          </div>
          <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
            <p className="text-sm text-yellow-800 font-medium">In Queue</p>
            <p className="text-2xl font-bold text-yellow-600 mt-1">
              {stats.pendingRiders}
            </p>
          </div>
          <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
            <p className="text-sm text-purple-800 font-medium">Car Utilization</p>
            <p className="text-2xl font-bold text-purple-600 mt-1">
              {stats.availableCars > 0 
                ? `${Math.round((stats.activeRiders / stats.availableCars) * 10) / 10} riders/car`
                : 'N/A'
              }
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-semibold mb-4">Quick Actions</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <a 
            href="/phone-room"
            className="p-4 bg-lime-500 text-gray-900 rounded-lg hover:bg-lime-600 transition text-center font-bold shadow-lg shadow-lime-500/20"
          >
            📞 Add Phone Request
          </a>
          <a 
            href="/ride-management"
            className="p-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-center font-medium"
          >
            🚗 View Active Rides
          </a>
          <a 
            href="/calendar"
            className="p-4 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition text-center font-medium"
          >
            📅 Sign Up for Event
          </a>
        </div>
      </div>

      {stats.availableCars === 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
          <p className="text-orange-800 font-medium">
            ⚠️ No cars are currently set as available. Directors should update the car count in NDR Assignments.
          </p>
        </div>
      )}
    </div>
  );
};

export default Dashboard;