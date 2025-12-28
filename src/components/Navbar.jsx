import React from 'react';
import { Menu, Bell, User } from 'lucide-react';
import { useSettings } from '../hooks/useSettings';

const Navbar = ({ toggleSidebar }) => {
  const { companyName } = useSettings();

  return (
    <nav className="bg-dark-card border-b border-dark-border px-4 py-3">
      <div className="flex items-center justify-between">
        {/* Left side */}
        <div className="flex items-center gap-4">
          <button
            onClick={toggleSidebar}
            className="p-2 rounded-lg hover:bg-dark-border transition-colors"
          >
            <Menu className="w-6 h-6" />
          </button>
          <h1 className="text-xl font-semibold text-white hidden sm:block">
            {companyName}
          </h1>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-2">
          <button className="p-2 rounded-lg hover:bg-dark-border transition-colors relative">
            <Bell className="w-5 h-5" />
            <span className="absolute top-1 right-1 w-2 h-2 bg-error rounded-full"></span>
          </button>
          <button className="p-2 rounded-lg hover:bg-dark-border transition-colors">
            <User className="w-5 h-5" />
          </button>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
