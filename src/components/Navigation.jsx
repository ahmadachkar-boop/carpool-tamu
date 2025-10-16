import React from 'react';
import { Calendar, Users, Phone, Car, BarChart3, Settings, Home, ClipboardList, PlusCircle, LogOut } from 'lucide-react';

const Navigation = ({ currentPage, setCurrentPage, isMobile, setShowMobileMenu, user, logout }) => {
  const navItems = [
    { id: 'dashboard', icon: Home, label: 'Dashboard', roles: ['director', 'deputy', 'member'] },
    { id: 'phone-room', icon: Phone, label: 'Phone Room', roles: ['director', 'deputy', 'member'] },
    { id: 'rides', icon: Car, label: 'Ride Management', roles: ['director', 'deputy', 'member'] },
    { id: 'calendar', icon: Calendar, label: 'Event Calendar', roles: ['director', 'deputy', 'member'] },
    { id: 'members', icon: Users, label: 'Members', roles: ['director', 'deputy'] },
    { id: 'points', icon: BarChart3, label: 'Points Management', roles: ['director', 'deputy'] },
    { id: 'statistics', icon: BarChart3, label: 'Statistics', roles: ['director', 'deputy'] },
    { id: 'settings', icon: Settings, label: 'Settings', roles: ['director', 'deputy'] },
  ];

  const directorItems = [
    { id: 'manage-events', icon: PlusCircle, label: 'Manage Events', roles: ['director'] },
    { id: 'ndr', icon: ClipboardList, label: 'NDR Reports', roles: ['director'] },
  ];

  const filteredItems = navItems.filter(item => item.roles.includes(user?.role));
  const filteredDirectorItems = directorItems.filter(item => item.roles.includes(user?.role));

  const handleNavClick = (id) => {
    setCurrentPage(id);
    if (isMobile) setShowMobileMenu(false);
  };

  return (
    <nav className="bg-gray-800 text-white h-full overflow-y-auto">
      <div className="p-4 border-b border-gray-700">
        <h1 className="text-xl font-bold text-red-500">CARPOOL</h1>
        <p className="text-xs text-gray-400">Texas A&M</p>
        {user && (
          <div className="mt-2 pt-2 border-t border-gray-700">
            <p className="text-sm font-medium">{user.name}</p>
            <p className="text-xs text-gray-400 capitalize">{user.role}</p>
          </div>
        )}
      </div>

      <div className="p-4">
        <ul className="space-y-2">
          {filteredItems.map(item => (
            <li key={item.id}>
              <button
                onClick={() => handleNavClick(item.id)}
                className={`w-full flex items-center space-x-3 px-4 py-3 rounded transition ${
                  currentPage === item.id ? 'bg-red-600' : 'hover:bg-gray-700'
                }`}
              >
                <item.icon size={20} />
                <span>{item.label}</span>
              </button>
            </li>
          ))}
        </ul>

        {filteredDirectorItems.length > 0 && (
          <div className="mt-6">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 px-4">
              Director Tools
            </p>
            <ul className="space-y-2">
              {filteredDirectorItems.map(item => (
                <li key={item.id}>
                  <button
                    onClick={() => handleNavClick(item.id)}
                    className={`w-full flex items-center space-x-3 px-4 py-3 rounded transition ${
                      currentPage === item.id ? 'bg-red-600' : 'hover:bg-gray-700'
                    }`}
                  >
                    <item.icon size={20} />
                    <span>{item.label}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="absolute bottom-0 w-full p-4 border-t border-gray-700">
        <button
          onClick={logout}
          className="w-full flex items-center space-x-3 px-4 py-3 rounded hover:bg-gray-700 transition"
        >
          <LogOut size={20} />
          <span>Logout</span>
        </button>
      </div>
    </nav>
  );
};

export default Navigation;