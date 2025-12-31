import React from 'react';
import { Menu } from 'lucide-react';

const Navbar = ({ toggleSidebar }) => {
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
        </div>

        {/* Right side - Company Name */}
        <div className="flex items-center">
          <h1 className="text-xl font-bold text-white tracking-wide" style={{ fontFamily: 'Georgia, serif' }}>
            DomicilioX
          </h1>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;


export default Navbar;
