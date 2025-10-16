import React, { useState, useEffect } from 'react';
import { Car, Phone, BarChart3, Users } from 'lucide-react';
import { db } from '../firebase';
import { collection, query, onSnapshot, where } from 'firebase/firestore';

const Dashboard = () => {
  const [stats, setStats] = useState({
    activeRides: 0,
    pendingRequests: 0,
    completedTonight: 0,
    availableCars: 4
  });

  useEffect(() => {
    const ridesRef = collection(db, 'rides');
    
    const pendingQuery = query(ridesRef, where('status', '==', 'pending'));
    const activeQuery = query(ridesRef, where('status', '==', 'active'));
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const completedQuery = query(
      ridesRef, 
      where('status', '==', 'completed'),
      where('requestedAt', '>=', today)
    );

    const unsubPending = onSnapshot(pendingQuery, (snapshot) => {
      setStats(prev => ({ ...prev, pendingRequests: snapshot.size }));
    });

    const unsubActive = onSnapshot(activeQuery, (snapshot) => {
      setStats(prev => ({ ...prev, activeRides: snapshot.size }));
    });

    const unsubCompleted = onSnapshot(completedQuery, (snapshot) => {
      setStats(prev => ({ ...prev, completedTonight: snapshot.size }));
    });

    return () => {
      unsubPending();
      unsubActive();
      unsubCompleted();
    };
  }, []);

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-800">Dashboard</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm">Active Rides</p>
              <p className="text-3xl font-bold text-blue-600">{stats.activeRides}</p>
            </div>
            <Car className="text-blue-600" size={40} />
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm">Pending Requests</p>
              <p className="text-3xl font-bold text-yellow-600">{stats.pendingRequests}</p>
            </div>
            <Phone className="text-yellow-600" size={40} />
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm">Completed Tonight</p>
              <p className="text-3xl font-bold text-green-600">{stats.completedTonight}</p>
            </div>
            <BarChart3 className="text-green-600" size={40} />
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm">Available Cars</p>
              <p className="text-3xl font-bold text-purple-600">{stats.availableCars}</p>
            </div>
            <Users className="text-purple-600" size={40} />
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-semibold mb-4">Quick Actions</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button className="p-4 bg-red-600 text-white rounded-lg hover:bg-red-700 transition">
            Add Phone Request
          </button>
          <button className="p-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">
            View Active Rides
          </button>
          <button className="p-4 bg-green-600 text-white rounded-lg hover:bg-green-700 transition">
            Sign Up for Event
          </button>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;