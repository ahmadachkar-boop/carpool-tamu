import React from 'react';
import { Route, Routes, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './AuthContext';
import { ActiveNDRProvider } from './ActiveNDRContext';
import Login from './components/Login';
import Register from './components/Register';
import CompleteProfile from './components/CompleteProfile';
import Dashboard from './components/Dashboard';
import TopNavigation from './components/TopNavigation';
import PhoneRoom from './components/PhoneRoom';
import RideManagement from './components/RideManagement';
import EventCalendar from './components/EventCalendar';
import ManageEvents from './components/ManageEvents';
import NDRReports from './components/NDRReports';
import Members from './components/Members';
import AddressBlacklistManager from './components/AddressBlacklistManager';
import AnnouncementsManager from './components/AnnouncementsManager';
import MemberProfile from './components/MemberProfile';
import AdminPanel from './components/AdminPanel';
import CouchNavigator from './components/CouchNavigator';

// Protected Route wrapper
const ProtectedRoute = ({ children, adminOnly = false }) => {
  const { currentUser, userProfile } = useAuth();

  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  // Check if user needs to complete profile
  if (userProfile && (userProfile.tempPassword || !userProfile.profileCompleted)) {
    return <Navigate to="/complete-profile" replace />;
  }

  if (adminOnly && userProfile?.role !== 'admin') {
    return <Navigate to="/" replace />;
  }

  return children;
};

// Route that only requires authentication, not profile completion
const AuthOnlyRoute = ({ children }) => {
  const { currentUser } = useAuth();

  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

// Public Route (redirects to dashboard if logged in and profile complete)
const PublicRoute = ({ children }) => {
  const { currentUser, userProfile } = useAuth();

  if (currentUser) {
    // If profile not complete, allow access to login/register
    if (userProfile && (userProfile.tempPassword || !userProfile.profileCompleted)) {
      return children;
    }
    // Otherwise redirect to dashboard
    return <Navigate to="/" replace />;
  }

  return children;
};

// Layout wrapper with navigation
const AppLayout = ({ children }) => {
  const { userProfile, logout } = useAuth();

  return (
    <div className="min-h-screen bg-gray-50">
      <TopNavigation user={userProfile} logout={logout} />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  );
};

function AppContent() {
  return (
    <ActiveNDRProvider>
      <Routes>
        {/* Public Routes */}
        <Route path="/login" element={
          <PublicRoute>
            <Login />
          </PublicRoute>
        } />
        <Route path="/register" element={
          <PublicRoute>
            <Register />
          </PublicRoute>
        } />

        {/* Profile Completion Route (authenticated but no profile check) */}
        <Route path="/complete-profile" element={
          <AuthOnlyRoute>
            <CompleteProfile />
          </AuthOnlyRoute>
        } />

        {/* Protected Routes with Layout */}
        <Route path="/" element={
          <ProtectedRoute>
            <AppLayout>
              <Dashboard />
            </AppLayout>
          </ProtectedRoute>
        } />

        <Route path="/phone-room" element={
          <ProtectedRoute>
            <AppLayout>
              <PhoneRoom />
            </AppLayout>
          </ProtectedRoute>
        } />

        <Route path="/ride-management" element={
          <ProtectedRoute>
            <AppLayout>
              <RideManagement />
            </AppLayout>
          </ProtectedRoute>
        } />

        <Route path="/calendar" element={
          <ProtectedRoute>
            <AppLayout>
              <EventCalendar />
            </AppLayout>
          </ProtectedRoute>
        } />

        <Route path="/manage-events" element={
          <ProtectedRoute>
            <AppLayout>
              <ManageEvents />
            </AppLayout>
          </ProtectedRoute>
        } />

        <Route path="/ndr-reports" element={
          <ProtectedRoute>
            <AppLayout>
              <NDRReports />
            </AppLayout>
          </ProtectedRoute>
        } />

        <Route path="/members" element={
          <ProtectedRoute>
            <AppLayout>
              <Members />
            </AppLayout>
          </ProtectedRoute>
        } />

        <Route path="/address-blacklist" element={
          <ProtectedRoute>
            <AppLayout>
              <AddressBlacklistManager />
            </AppLayout>
          </ProtectedRoute>
        } />

        <Route path="/announcements" element={
          <ProtectedRoute>
            <AppLayout>
              <AnnouncementsManager />
            </AppLayout>
          </ProtectedRoute>
        } />

        <Route path="/profile" element={
          <ProtectedRoute>
            <AppLayout>
              <MemberProfile />
            </AppLayout>
          </ProtectedRoute>
        } />

        <Route path="/admin-panel" element={
          <ProtectedRoute adminOnly={true}>
            <AppLayout>
              <AdminPanel />
            </AppLayout>
          </ProtectedRoute>
        } />
        <Route path="/couch-navigator" element={
          <ProtectedRoute>
            <AppLayout>
              <CouchNavigator />
            </AppLayout>
          </ProtectedRoute>
        } />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ActiveNDRProvider>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;