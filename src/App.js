import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { useActiveNDR } from './ActiveNDRContext';
import TopNavigation from './components/TopNavigation';
import Dashboard from './components/Dashboard';
import PhoneRoom from './components/PhoneRoom';
import RideManagement from './components/RideManagement';
import Login from './components/Login';
import EventCalendar from './components/EventCalendar';
import ManageEvents from './components/ManageEvents';
import NDRReports from './components/NDRReports';
import Members from './components/Members';
import Register from './components/Register';
import AddressBlacklistManager from './components/AddressBlacklistManager';


const ProtectedRoute = ({ children, allowedRoles }) => {
  const { currentUser, userProfile } = useAuth();
  
  if (!currentUser) {
    return <Navigate to="/login" />;
  }

  if (allowedRoles && !allowedRoles.includes(userProfile?.role)) {
    return <Navigate to="/" />;
  }
  
  return children;
};

const MainApp = () => {
  const { userProfile, logout } = useAuth();

  return (
    <div className="min-h-screen flex flex-col bg-gray-100">
      {/* Top Navigation Bar */}
      <TopNavigation user={userProfile} logout={logout} />

      {/* Main Content Area */}
      <div className="flex-1 overflow-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/phone-room" element={<PhoneRoom />} />
            <Route path="/ride-management" element={<RideManagement />} />
            <Route path="/calendar" element={<EventCalendar />} />
            <Route 
              path="/manage-events" 
              element={
                <ProtectedRoute allowedRoles={['director', 'deputy']}>
                  <ManageEvents />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/ndr-reports" 
              element={
                <ProtectedRoute allowedRoles={['director', 'deputy']}>
                  <NDRReports />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/members" 
              element={
                <ProtectedRoute allowedRoles={['director', 'deputy']}>
                  <Members />
                </ProtectedRoute>
              } 
            />
          </Routes>
        </div>
      </div>
    </div>
  );
};

const App = () => {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/address-blacklist" element={<AddressBlacklistManager />} />
      <Route 
        path="/*" 
        element={
          <ProtectedRoute>
            <MainApp />
          </ProtectedRoute>
        } 
      />
    </Routes>
  );
};

export default App;