import React, { useState, useRef, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Calendar, Users, Phone, Car, Home, ClipboardList, PlusCircle, LogOut, ChevronDown, Menu, X, Shield } from 'lucide-react';
import { useActiveNDR } from '../ActiveNDRContext';

const TopNavigation = ({ user, logout }) => {
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [showDirectorDropdown, setShowDirectorDropdown] = useState(false);
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const location = useLocation();
  const { hasActiveNDR, loading: ndrLoading } = useActiveNDR();
  
  const directorDropdownRef = useRef(null);
  const userDropdownRef = useRef(null);

  // Define navigation items - Phone Room and Ride Management always visible
  const navItems = [
    { path: '/', icon: Home, label: 'Dashboard', roles: ['director', 'deputy', 'member'] },
    { path: '/phone-room', icon: Phone, label: 'Phone Room', roles: ['director', 'deputy', 'member'] },
    { path: '/ride-management', icon: Car, label: 'Ride Management', roles: ['director', 'deputy', 'member'] },
    { path: '/calendar', icon: Calendar, label: 'Calendar', roles: ['director', 'deputy', 'member'] },
  ];

  const directorItems = [
    { path: '/manage-events', icon: PlusCircle, label: 'Manage Events', roles: ['director', 'deputy'] },
    { path: '/ndr-reports', icon: ClipboardList, label: 'NDR Reports', roles: ['director', 'deputy'] },
    { path: '/members', icon: Users, label: 'Members', roles: ['director', 'deputy'] },
    { path: '/address-blacklist', icon: Shield, label: 'Address Blacklist', roles: ['director', 'deputy'] },
  ];

  // Filter items based on role only
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
  }, [location.pathname]);

  return (
    <>
      <nav className="bg-[#79F200] text-gray-900 shadow-2xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo/Brand */}
            <Link to="/" className="flex items-center space-x-3 hover:opacity-80 transition group">
              <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-lg transform group-hover:scale-110 transition p-1.5">
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
              <span className="text-xl font-black hidden sm:block text-gray-900">
                TAMU Carpool
              </span>
            </Link>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center space-x-1">
              {filteredItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl transition-all font-bold ${
                    isActive(item.path)
                      ? 'bg-white text-gray-900 shadow-lg'
                      : 'text-gray-900 hover:bg-white/30'
                  }`}
                >
                  <item.icon size={20} />
                  <span>{item.label}</span>
                </Link>
              ))}

              {/* Director Dropdown */}
              {filteredDirectorItems.length > 0 && (
                <div className="relative" ref={directorDropdownRef}>
                  <button
                    onClick={() => setShowDirectorDropdown(!showDirectorDropdown)}
                    className="flex items-center space-x-2 px-4 py-2.5 rounded-xl text-gray-900 hover:bg-white/30 transition-all font-bold"
                  >
                    <ClipboardList size={20} />
                    <span>Director</span>
                    <ChevronDown size={18} className={`transition-transform ${showDirectorDropdown ? 'rotate-180' : ''}`} />
                  </button>

                  {showDirectorDropdown && (
                    <div className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-2xl py-2 z-50 border-2 border-gray-100">
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
                  className="flex items-center space-x-2 px-3 py-2 rounded-xl hover:bg-white/30 transition"
                >
                  <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-[#79F200] font-black text-base shadow-lg">
                    {user?.name?.charAt(0) || 'U'}
                  </div>
                  <span className="hidden sm:block font-bold text-gray-900">{user?.name || 'User'}</span>
                  <ChevronDown size={18} className={`transition-transform ${showUserDropdown ? 'rotate-180' : ''}`} />
                </button>

                {showUserDropdown && (
                  <div className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-2xl py-2 z-50 border-2 border-gray-100">
                    <div className="px-4 py-3 border-b-2 border-gray-100">
                      <p className="text-sm font-bold text-gray-900">{user?.name}</p>
                      <p className="text-xs text-[#79F200] capitalize mt-1 font-semibold">{user?.role}</p>
                    </div>
                    <button
                      onClick={logout}
                      className="w-full flex items-center space-x-3 px-4 py-3 text-red-600 hover:bg-red-50 transition font-semibold"
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
                className="md:hidden p-2 rounded-xl hover:bg-white/30 transition"
              >
                {showMobileMenu ? <X size={28} /> : <Menu size={28} />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Navigation */}
        {showMobileMenu && (
          <div className="md:hidden bg-[#79F200] border-t-2 border-white/20">
            <div className="px-4 pt-2 pb-4 space-y-1">
              {filteredItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center space-x-3 px-4 py-3 rounded-xl transition-all font-bold ${
                    isActive(item.path)
                      ? 'bg-white text-gray-900 shadow-lg'
                      : 'text-gray-900 hover:bg-white/30'
                  }`}
                >
                  <item.icon size={22} />
                  <span>{item.label}</span>
                </Link>
              ))}

              {filteredDirectorItems.length > 0 && (
                <>
                  <div className="border-t-2 border-white/20 my-3"></div>
                  <div className="px-4 py-2 text-xs font-black text-gray-900 uppercase tracking-wider">Director Tools</div>
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
            </div>
          </div>
        )}
      </nav>

      {/* NDR Status Indicator */}
      {!ndrLoading && (
        hasActiveNDR ? (
          <div className="bg-green-600 text-white text-center py-2.5 px-4 text-sm font-black shadow-lg">
            <span className="inline-flex items-center gap-2">
              <span className="w-2.5 h-2.5 bg-white rounded-full animate-pulse"></span>
              ACTIVE NDR - PHONE ROOM & RIDE MANAGEMENT ONLINE
            </span>
          </div>
        ) : (
          <div className="bg-red-600 text-white text-center py-2.5 px-4 text-sm font-black shadow-lg">
            <span className="inline-flex items-center gap-2">
              <span className="w-2.5 h-2.5 bg-white rounded-full"></span>
              NO ACTIVE NDR - DIRECTORS MUST ACTIVATE TO ACCEPT REQUESTS
            </span>
          </div>
        )
      )}
    </>
  );
};

export default TopNavigation;