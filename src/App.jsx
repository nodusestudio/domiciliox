import React, { useState } from 'react';
import { Toaster } from 'react-hot-toast';
import Sidebar from './components/Sidebar';
import Navbar from './components/Navbar';
import Dashboard from './pages/Dashboard';

function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeSection, setActiveSection] = useState('dashboard');

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  const renderContent = () => {
    switch (activeSection) {
      case 'dashboard':
        return <Dashboard />;
      case 'pedidos':
        return (
          <div className="bg-dark-card rounded-lg p-6 border border-dark-border">
            <h2 className="text-2xl font-bold text-white mb-4">Pedidos</h2>
            <p className="text-gray-400">Gestión de pedidos de domicilio</p>
          </div>
        );
      case 'clientes':
        return (
          <div className="bg-dark-card rounded-lg p-6 border border-dark-border">
            <h2 className="text-2xl font-bold text-white mb-4">Clientes</h2>
            <p className="text-gray-400">Administración de clientes</p>
          </div>
        );
      case 'repartidores':
        return (
          <div className="bg-dark-card rounded-lg p-6 border border-dark-border">
            <h2 className="text-2xl font-bold text-white mb-4">Repartidores</h2>
            <p className="text-gray-400">Gestión de equipo de reparto</p>
          </div>
        );
      case 'analytics':
        return (
          <div className="bg-dark-card rounded-lg p-6 border border-dark-border">
            <h2 className="text-2xl font-bold text-white mb-4">Análisis</h2>
            <p className="text-gray-400">Reportes y estadísticas</p>
          </div>
        );
      case 'settings':
        return (
          <div className="bg-dark-card rounded-lg p-6 border border-dark-border">
            <h2 className="text-2xl font-bold text-white mb-4">Configuración</h2>
            <p className="text-gray-400">Ajustes del sistema</p>
          </div>
        );
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className="flex h-screen bg-dark-bg">
      {/* Sidebar */}
      <Sidebar 
        isOpen={sidebarOpen}
        setIsOpen={setSidebarOpen}
        activeSection={activeSection}
        setActiveSection={setActiveSection}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Navbar */}
        <Navbar toggleSidebar={toggleSidebar} />

        {/* Content Area */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          {renderContent()}
        </main>
      </div>

      {/* Toast Notifications */}
      <Toaster 
        position="top-right"
        toastOptions={{
          duration: 3000,
          style: {
            background: '#1f2937',
            color: '#fff',
            border: '1px solid #374151',
          },
          success: {
            iconTheme: {
              primary: '#10B981',
              secondary: '#fff',
            },
          },
          error: {
            iconTheme: {
              primary: '#EF4444',
              secondary: '#fff',
            },
          },
        }}
      />
    </div>
  );
}

export default App;
