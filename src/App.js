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

const ProtectedRoute = ({ children }) => {
  const { currentUser } = useAuth();
  
  if (!currentUser) {
    return <Navigate to="/login" />;
  }
  
  return children;
};

const MainApp = () => {
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const { userProfile, logout } = useAuth();

  const renderPage = () => {
  switch(currentPage) {
    case 'dashboard': return <Dashboard />;
    case 'phone-room': return <PhoneRoom />;
    case 'rides': return <RideManagement />;
    case 'calendar': return <EventCalendar />;
    case 'manage-events': return <ManageEvents />;
    case 'ndr': return <div className="text-center text-gray-500 py-12">NDR Reports - Coming Soon</div>;
    case 'members': return <div className="text-center text-gray-500 py-12">Member Management - Coming Soon</div>;
    case 'points': return <div className="text-center text-gray-500 py-12">Points Management - Coming Soon</div>;
    case 'statistics': return <div className="text-center text-gray-500 py-12">Statistics - Coming Soon</div>;
    case 'settings': return <div className="text-center text-gray-500 py-12">Settings - Coming Soon</div>;
    default: return <Dashboard />;
    }
  };

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
          currentPage={currentPage} 
          setCurrentPage={setCurrentPage}
          isMobile={showMobileMenu}
          setShowMobileMenu={setShowMobileMenu}
          user={userProfile}
          logout={logout}
        />
      </div>

      <div className="flex-1 overflow-auto">
        <div className="p-4 md:p-8 pt-16 md:pt-8">
          {renderPage()}
        </div>
      </div>
    </div>
  );
};

const App = () => {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
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