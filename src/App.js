import React, { useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { useAuth } from './AuthContext';
import Navigation from './components/Navigation';
import Dashboard from './components/Dashboard';
import PhoneRoom from './components/PhoneRoom';
import RideManagement from './components/RideManagement';
import Login from './components/Login';
import EventCalendar from './components/EventCalendar';
import ManageEvents from './components/ManageEvents';
import NDRReports from './components/NDRReports';
import Members from './components/Members';
import Register from './components/Register';

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
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const { userProfile, logout } = useAuth();

  return (
    <div className="h-screen flex flex-col md:flex-row bg-gray-100">
      <button
        onClick={() => setShowMobileMenu(!showMobileMenu)}
        className="md:hidden fixed top-4 left-4 z-50 p-2 bg-gray-800 text-white rounded-lg"
      >
        {showMobileMenu ? <X size={24} /> : <Menu size={24} />}
      </button>

      <div className={`${showMobileMenu ? 'block' : 'hidden'} md:block fixed md:relative w-64 h-full z-40`}>
        <Navigation 
          isMobile={showMobileMenu}
          setShowMobileMenu={setShowMobileMenu}
          user={userProfile}
          logout={logout}
        />
      </div>

      <div className="flex-1 overflow-auto">
        <div className="p-4 md:p-8 pt-16 md:pt-8">
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