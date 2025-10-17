import React, { useState, useRef, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Calendar, Users, Phone, Car, Home, ClipboardList, PlusCircle, LogOut, ChevronDown, Menu, X } from 'lucide-react';

const TopNavigation = ({ user, logout }) => {
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [showDirectorDropdown, setShowDirectorDropdown] = useState(false);
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const location = useLocation();
  
  const directorDropdownRef = useRef(null);
  const userDropdownRef = useRef(null);

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
  }, [location.pathname]);

  return (
    <>
      <nav className="bg-gradient-to-r from-lime-500 via-lime-400 to-lime-500 shadow-2xl sticky top-0 z-50 border-b-4 border-lime-600">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo/Brand */}
            <Link to="/" className="flex items-center gap-3 flex-shrink-0">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center">
                <Car className="text-gray-900" size={28} strokeWidth={2.5} />
              </div>
              <div className="hidden sm:block">
                <h1 className="text-xl font-bold text-gray-900">
                  CARPOOL
                </h1>
                <p className="text-[10px] text-gray-700 font-medium -mt-1">Texas A&M</p>
              </div>
            </Link>

            {/* Desktop Navigation */}
            <div className="hidden lg:flex items-center gap-1">
              {filteredItems.map(item => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all duration-200 ${
                    isActive(item.path)
                      ? 'bg-white bg-opacity-20 backdrop-blur-sm text-gray-900 font-bold border border-white border-opacity-30'
                      : 'text-gray-900 hover:bg-white hover:bg-opacity-10 font-medium'
                  }`}
                >
                  <item.icon size={18} strokeWidth={isActive(item.path) ? 2.5 : 2} />
                  <span className="text-sm">{item.label}</span>
                </Link>
              ))}

              {/* Director Tools Dropdown */}
              {filteredDirectorItems.length > 0 && (
                <div className="relative" ref={directorDropdownRef}>
                  <button
                    onClick={() => setShowDirectorDropdown(!showDirectorDropdown)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all duration-200 ${
                      filteredDirectorItems.some(item => isActive(item.path))
                        ? 'bg-white bg-opacity-20 backdrop-blur-sm text-gray-900 font-bold border border-white border-opacity-30'
                        : 'text-gray-900 hover:bg-white hover:bg-opacity-10 font-medium'
                    }`}
                  >
                    <ClipboardList size={18} strokeWidth={2} />
                    <span className="text-sm">Director Tools</span>
                    <ChevronDown size={16} className={`transition-transform ${showDirectorDropdown ? 'rotate-180' : ''}`} />
                  </button>

                  {showDirectorDropdown && (
                    <div className="absolute top-full mt-2 right-0 w-56 bg-white rounded-xl shadow-2xl border-2 border-lime-500 py-2 animate-fadeIn">
                      {filteredDirectorItems.map(item => (
                        <Link
                          key={item.path}
                          to={item.path}
                          onClick={() => setShowDirectorDropdown(false)}
                          className={`flex items-center gap-3 px-4 py-2.5 transition-colors ${
                            isActive(item.path)
                              ? 'bg-lime-500 text-white font-semibold'
                              : 'text-gray-900 hover:bg-lime-50'
                          }`}
                        >
                          <item.icon size={18} strokeWidth={isActive(item.path) ? 2.5 : 2} />
                          <span className="text-sm font-medium">{item.label}</span>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* User Profile Dropdown (Desktop) */}
            <div className="hidden lg:flex items-center gap-4">
              {user && (
                <div className="relative" ref={userDropdownRef}>
                  <button
                    onClick={() => setShowUserDropdown(!showUserDropdown)}
                    className="flex items-center gap-3 px-3 py-2 bg-white bg-opacity-20 backdrop-blur-sm rounded-xl hover:bg-opacity-30 transition-all duration-200 border border-white border-opacity-30"
                  >
                    <div className="w-9 h-9 bg-white bg-opacity-90 rounded-lg flex items-center justify-center text-lime-700 font-bold text-sm">
                      {user.name?.charAt(0) || 'U'}
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-semibold text-gray-900 leading-tight">{user.name}</p>
                      <p className="text-xs text-gray-700 capitalize leading-tight font-medium">{user.role}</p>
                    </div>
                    <ChevronDown size={16} className={`text-gray-900 transition-transform ${showUserDropdown ? 'rotate-180' : ''}`} />
                  </button>

                  {showUserDropdown && (
                    <div className="absolute top-full mt-2 right-0 w-48 bg-white rounded-xl shadow-2xl border-2 border-lime-500 py-2 animate-fadeIn">
                      <div className="px-4 py-2 border-b border-gray-200">
                        <p className="text-xs text-gray-500">Signed in as</p>
                        <p className="text-sm font-semibold text-gray-900 truncate">{user.name}</p>
                      </div>
                      <button
                        onClick={() => {
                          logout();
                          setShowUserDropdown(false);
                        }}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-gray-900 hover:bg-red-50 hover:text-red-600 transition-colors"
                      >
                        <LogOut size={18} />
                        <span className="text-sm font-medium">Logout</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setShowMobileMenu(!showMobileMenu)}
              className="lg:hidden p-2 rounded-lg bg-white bg-opacity-20 backdrop-blur-sm text-gray-900 hover:bg-opacity-30 transition-colors border border-white border-opacity-30"
            >
              {showMobileMenu ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {showMobileMenu && (
          <div className="lg:hidden bg-lime-400 border-t-2 border-lime-600 animate-slideDown">
            <div className="px-4 py-4 space-y-1">
              {filteredItems.map(item => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                    isActive(item.path)
                      ? 'bg-white bg-opacity-20 backdrop-blur-sm text-gray-900 font-bold border border-white border-opacity-30'
                      : 'text-gray-900 hover:bg-white hover:bg-opacity-10 font-medium'
                  }`}
                >
                  <item.icon size={20} strokeWidth={isActive(item.path) ? 2.5 : 2} />
                  <span>{item.label}</span>
                </Link>
              ))}

              {filteredDirectorItems.length > 0 && (
                <>
                  <div className="pt-3 pb-2">
                    <p className="text-xs font-bold text-gray-900 uppercase tracking-wider px-4">
                      Director Tools
                    </p>
                  </div>
                  {filteredDirectorItems.map(item => (
                    <Link
                      key={item.path}
                      to={item.path}
                      className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                        isActive(item.path)
                          ? 'bg-white bg-opacity-20 backdrop-blur-sm text-gray-900 font-bold border border-white border-opacity-30'
                          : 'text-gray-900 hover:bg-white hover:bg-opacity-10 font-medium'
                      }`}
                    >
                      <item.icon size={20} strokeWidth={isActive(item.path) ? 2.5 : 2} />
                      <span>{item.label}</span>
                    </Link>
                  ))}
                </>
              )}

              {/* Mobile User Section */}
              {user && (
                <div className="pt-4 border-t-2 border-lime-600 mt-4">
                  <div className="px-4 py-3 bg-white bg-opacity-20 backdrop-blur-sm rounded-lg mb-2 border border-white border-opacity-30">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-white bg-opacity-90 rounded-lg flex items-center justify-center text-lime-700 font-bold">
                        {user.name?.charAt(0) || 'U'}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{user.name}</p>
                        <p className="text-xs text-gray-700 capitalize font-medium">{user.role}</p>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      logout();
                      setShowMobileMenu(false);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-gray-900 hover:bg-red-100 hover:text-red-600 rounded-lg transition-colors font-medium"
                  >
                    <LogOut size={20} />
                    <span>Logout</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </nav>

      <style jsx>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes slideDown {
          from {
            opacity: 0;
            max-height: 0;
          }
          to {
            opacity: 1;
            max-height: 1000px;
          }
        }

        .animate-fadeIn {
          animation: fadeIn 0.2s ease-out;
        }

        .animate-slideDown {
          animation: slideDown 0.3s ease-out;
        }
      `}</style>
    </>
  );
};

export default TopNavigation;