import React from 'react';
import { 
  LayoutDashboard, 
  Package, 
  Users, 
  Truck,
  BarChart3,
  Settings,
  Menu,
  X,
  Brain
} from 'lucide-react';
import Logo from './Logo';

const Sidebar = ({ isOpen, setIsOpen, activeSection, setActiveSection }) => {
  const menuItems = [
    { id: 'panel', label: 'Panel', icon: LayoutDashboard },
    { id: 'pedidos', label: 'Pedidos', icon: Package },
    { id: 'clientes', label: 'Clientes', icon: Users },
    { id: 'repartidores', label: 'Repartidores', icon: Truck },
    { id: 'intelligence', label: 'Inteligencia', icon: Brain },
    { id: 'analytics', label: 'Reportes', icon: BarChart3 },
    { id: 'settings', label: 'Configuración', icon: Settings },
  ];

  return (
    <>
      {/* Overlay para móvil */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside 
        className={`
          fixed lg:static inset-y-0 left-0 z-50
          bg-dark-card border-r border-dark-border
          transition-all duration-300 ease-in-out
          ${isOpen ? 'w-64' : 'w-0 lg:w-20'}
          overflow-hidden
        `}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="p-4 border-b border-dark-border">
            <div className="flex items-center justify-between">
              {isOpen && <Logo />}
              <button
                onClick={() => setIsOpen(!isOpen)}
                className="lg:hidden p-2 rounded-lg hover:bg-dark-border transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
          </div>

          {/* Menu Items */}
          <nav className="flex-1 p-4 space-y-2">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeSection === item.id;
              
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveSection(item.id);
                    if (window.innerWidth < 1024) {
                      setIsOpen(false);
                    }
                  }}
                  className={`
                    w-full flex items-center gap-3 px-4 py-3 rounded-lg
                    transition-all duration-200
                    ${isActive 
                      ? 'bg-primary text-white' 
                      : 'text-gray-300 hover:bg-dark-border hover:text-white'
                    }
                  `}
                >
                  <Icon className="w-5 h-5 flex-shrink-0" />
                  {isOpen && (
                    <span className="font-medium">{item.label}</span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
