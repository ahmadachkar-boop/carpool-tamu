import React, { useState, useRef, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Calendar, Users, Phone, Car, Home, ClipboardList, PlusCircle, LogOut, ChevronDown, Menu, X, Shield, Megaphone, UserCircle, MessageSquare, Sparkles } from 'lucide-react';
import { useActiveNDR } from '../ActiveNDRContext';

const TopNavigation = ({ user, logout }) => {
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [showDirectorDropdown, setShowDirectorDropdown] = useState(false);
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const location = useLocation();
  const { hasActiveNDR, loading: ndrLoading } = useActiveNDR();

  const directorDropdownRef = useRef(null);
  const userDropdownRef = useRef(null);

  const navItems = [
    { path: '/', icon: Home, label: 'Dashboard', roles: ['director', 'deputy', 'member', 'admin'] },
    { path: '/phone-room', icon: Phone, label: 'Phone Room', roles: ['director', 'deputy', 'member', 'admin'] },
    { path: '/ride-management', icon: Car, label: 'Rides', roles: ['director', 'deputy', 'member', 'admin'] },
    { path: '/couch-navigator', icon: MessageSquare, label: 'Couch', roles: ['director', 'deputy', 'member', 'admin'] },
    { path: '/calendar', icon: Calendar, label: 'Calendar', roles: ['director', 'deputy', 'member', 'admin'] },
  ];

  const directorItems = [
    { path: '/manage-events', icon: PlusCircle, label: 'Manage Events', roles: ['director', 'deputy', 'admin'] },
    { path: '/ndr-reports', icon: ClipboardList, label: 'NDR Reports', roles: ['director', 'deputy', 'admin'] },
    { path: '/members', icon: Users, label: 'Members', roles: ['director', 'deputy', 'admin'] },
    { path: '/address-blacklist', icon: Shield, label: 'Blacklist', roles: ['director', 'deputy', 'admin'] },
    { path: '/announcements', icon: Megaphone, label: 'Announcements', roles: ['director', 'deputy', 'admin'] },
    { path: '/admin-panel', icon: Shield, label: 'Admin Panel', roles: ['admin'] },
  ];

  const filteredItems = navItems.filter(item => item.roles.includes(user?.role));
  const filteredDirectorItems = directorItems.filter(item => item.roles.includes(user?.role));

  const isActive = (path) => {
    if (path === '/') {
      return location.pathname === '/';
    }
    return location.pathname.startsWith(path);
  };

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (directorDropdownRef.current && !directorDropdownRef.current.contains(event.target)) {
        setShowDirectorDropdown(false);
      }
      if (userDropdownRef.current && !userDropdownRef.current.contains(event.target)) {
        setShowUserDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close mobile menu when route changes
  useEffect(() => {
    setShowMobileMenu(false);
    setShowUserDropdown(false);
  }, [location.pathname]);

  return (
    <>
      {/* Lime Green Navigation */}
      <nav className="bg-[#79F200] shadow-2xl sticky top-0 z-50">
        {/* Safe area spacer for iOS notch */}
        <div className="pt-safe"></div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo/Brand */}
            <Link to="/" className="flex items-center space-x-3 hover:opacity-80 transition group">
              <div className="relative">
                <div className="relative w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-xl transform group-hover:scale-110 transition p-1.5">
                  <img
                    src={`${process.env.PUBLIC_URL}/logo.png`}
                    alt="TAMU Carpool"
                    className="w-full h-full object-contain"
                    onError={(e) => {
                      console.error('Logo failed to load');
                      e.target.style.display = 'none';
                    }}
                  />
                </div>
              </div>
              <div className="hidden sm:block">
                <span className="text-xl font-black text-gray-900">
                  TAMU Carpool
                </span>
                <div className="flex items-center gap-1 mt-0.5">
                  <Sparkles size={10} className="text-gray-900" />
                  <span className="text-[10px] font-bold text-gray-900">v2.0</span>
                </div>
              </div>
            </Link>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center space-x-1">
              {filteredItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`group relative flex items-center space-x-2 px-4 py-2.5 rounded-xl transition-all font-bold ${
                    isActive(item.path)
                      ? 'bg-white text-gray-900 shadow-lg'
                      : 'text-gray-900 hover:bg-white/30'
                  }`}
                >
                  <item.icon size={20} className="relative z-10" />
                  <span className="relative z-10">{item.label}</span>
                </Link>
              ))}

              {/* Director Dropdown */}
              {filteredDirectorItems.length > 0 && (
                <div className="relative" ref={directorDropdownRef}>
                  <button
                    onClick={() => setShowDirectorDropdown(!showDirectorDropdown)}
                    className="flex items-center space-x-2 px-4 py-2.5 rounded-xl text-gray-900 hover:bg-white/30 transition-all font-bold"
                  >
                    <Shield size={20} />
                    <span>Director</span>
                    <ChevronDown size={18} className={`transition-transform ${showDirectorDropdown ? 'rotate-180' : ''}`} />
                  </button>

                  {showDirectorDropdown && (
                    <div className="absolute right-0 mt-2 w-60 bg-white rounded-2xl shadow-2xl py-2 z-50 border border-gray-200">
                      {filteredDirectorItems.map((item) => (
                        <Link
                          key={item.path}
                          to={item.path}
                          className="flex items-center space-x-3 px-4 py-3 text-gray-900 hover:bg-[#79F200]/20 transition font-semibold"
                          onClick={() => setShowDirectorDropdown(false)}
                        >
                          <item.icon size={20} />
                          <span>{item.label}</span>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* User Menu & Mobile Toggle */}
            <div className="flex items-center space-x-4">
              {/* User Dropdown */}
              <div className="relative" ref={userDropdownRef}>
                <button
                  onClick={() => setShowUserDropdown(!showUserDropdown)}
                  className="flex items-center space-x-2 px-3 py-2 rounded-xl hover:bg-white/30 transition group"
                >
                  <div className="relative">
                    <div className="relative w-10 h-10 bg-white rounded-full flex items-center justify-center text-[#79F200] font-black text-base shadow-lg">
                      {user?.name?.charAt(0) || 'U'}
                    </div>
                  </div>
                  <span className="hidden sm:block font-bold text-gray-900">{user?.name?.split(' ')[0] || 'User'}</span>
                  <ChevronDown size={18} className={`text-gray-900 transition-transform ${showUserDropdown ? 'rotate-180' : ''}`} />
                </button>

                {showUserDropdown && (
                  <div className="absolute right-0 mt-2 w-60 bg-white rounded-2xl shadow-2xl py-2 z-50 border border-gray-200">
                    <div className="px-4 py-3 border-b border-gray-200">
                      <p className="text-sm font-bold text-gray-900">{user?.name}</p>
                      <p className="text-xs text-[#79F200] capitalize mt-1 font-semibold">{user?.role}</p>
                    </div>

                    <Link
                      to="/profile"
                      onClick={() => setShowUserDropdown(false)}
                      className="w-full flex items-center space-x-3 px-4 py-3 text-gray-900 hover:bg-[#79F200]/20 transition font-semibold"
                    >
                      <UserCircle size={20} />
                      <span>My Profile</span>
                    </Link>

                    <button
                      onClick={logout}
                      className="w-full flex items-center space-x-3 px-4 py-3 text-red-600 hover:bg-red-50 transition font-semibold border-t border-gray-200"
                    >
                      <LogOut size={20} />
                      <span>Logout</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Mobile menu button */}
              <button
                onClick={() => setShowMobileMenu(!showMobileMenu)}
                className="md:hidden p-2 rounded-xl hover:bg-white/30 transition text-gray-900"
              >
                {showMobileMenu ? <X size={28} /> : <Menu size={28} />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Navigation */}
        {showMobileMenu && (
          <div className="md:hidden bg-[#79F200] border-t border-gray-900/10 pb-safe">
            <div className="px-4 pt-2 pb-4 space-y-1">
              {filteredItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`group relative flex items-center space-x-3 px-4 py-3 rounded-xl transition-all font-bold ${
                    isActive(item.path)
                      ? 'bg-white text-gray-900 shadow-lg'
                      : 'text-gray-900 hover:bg-white/30'
                  }`}
                >
                  <item.icon size={22} className="relative z-10" />
                  <span className="relative z-10">{item.label}</span>
                </Link>
              ))}

              <Link
                to="/profile"
                className={`flex items-center space-x-3 px-4 py-3 rounded-xl transition-all font-bold ${
                  isActive('/profile')
                    ? 'bg-white text-gray-900 shadow-lg'
                    : 'text-gray-900 hover:bg-white/30'
                }`}
              >
                <UserCircle size={22} />
                <span>My Profile</span>
              </Link>

              {filteredDirectorItems.length > 0 && (
                <>
                  <div className="border-t border-gray-900/10 my-3"></div>
                  <div className="px-4 py-2 flex items-center gap-2">
                    <Shield size={16} className="text-gray-900" />
                    <span className="text-xs font-black text-gray-900 uppercase tracking-wider">Director Tools</span>
                  </div>
                  {filteredDirectorItems.map((item) => (
                    <Link
                      key={item.path}
                      to={item.path}
                      className="flex items-center space-x-3 px-4 py-3 rounded-xl text-gray-900 hover:bg-white/30 transition font-bold"
                    >
                      <item.icon size={22} />
                      <span>{item.label}</span>
                    </Link>
                  ))}
                </>
              )}

              <button
                onClick={logout}
                className="w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-red-600 hover:bg-red-50 transition font-bold mt-4 bg-white"
              >
                <LogOut size={22} />
                <span>Logout</span>
              </button>
            </div>
          </div>
        )}
      </nav>

      {/* NDR Status Indicator */}
      {!ndrLoading && (
        hasActiveNDR ? (
          <div className="relative bg-gradient-to-r from-green-600 via-emerald-600 to-green-600 text-white text-center py-3 px-4 shadow-2xl">
            <div className="absolute inset-0 bg-gradient-to-r from-[#79F200]/20 via-transparent to-[#79F200]/20 animate-pulse"></div>
            <span className="relative inline-flex items-center gap-2 font-black text-sm">
              <span className="flex relative">
                <span className="absolute inline-flex h-3 w-3 rounded-full bg-white opacity-75 animate-ping"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-white"></span>
              </span>
              LIVE • ACTIVE NDR • ALL SYSTEMS OPERATIONAL
            </span>
          </div>
        ) : (
          <div className="bg-gradient-to-r from-red-600 via-rose-600 to-red-600 text-white text-center py-3 px-4 shadow-2xl">
            <span className="inline-flex items-center gap-2 font-black text-sm">
              <span className="w-3 h-3 bg-white rounded-full opacity-50"></span>
              OFFLINE • NO ACTIVE NDR • DIRECTORS MUST ACTIVATE
            </span>
          </div>
        )
      )}
    </>
  );
};

export default TopNavigation;
