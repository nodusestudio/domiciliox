import React, { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { Toaster } from 'react-hot-toast';
import Sidebar from './components/Sidebar';
import Navbar from './components/Navbar';
import { consultarCostoSugeridoPorDireccion, verificarConexionFirebase } from './services/firebaseService';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const Orders = lazy(() => import('./pages/Orders'));
const Clients = lazy(() => import('./pages/Clients'));
const Repartidores = lazy(() => import('./pages/Repartidores'));
const Reportes = lazy(() => import('./pages/Reportes'));
const Settings = lazy(() => import('./pages/Settings'));

const SECTION_TITLES = {
  panel: 'Centro operativo',
  pedidos: 'Despacho rapido',
  clientes: 'Base de clientes',
  repartidores: 'Flota activa',
  analytics: 'Inteligencia operativa',
  settings: 'Configuracion general'
};

function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeSection, setActiveSection] = useState('pedidos');
  const [consultaDireccion, setConsultaDireccion] = useState('');
  const [loadingSugerenciaCosto, setLoadingSugerenciaCosto] = useState(false);
  const [sugerenciaCosto, setSugerenciaCosto] = useState(null);
  const hasVerifiedConnection = useRef(false);

  // Verificar conexión a Firebase al iniciar la app
  useEffect(() => {
    if (hasVerifiedConnection.current) return;

    hasVerifiedConnection.current = true;
    console.log('🚀 Iniciando aplicación DomicilioX...');
    verificarConexionFirebase();
  }, []);

  useEffect(() => {
    if (activeSection !== 'pedidos') return;

    const consulta = consultaDireccion.trim();
    if (consulta.length < 3) {
      setSugerenciaCosto(null);
      setLoadingSugerenciaCosto(false);
      return;
    }

    let cancelled = false;
    setLoadingSugerenciaCosto(true);

    const timeoutId = setTimeout(async () => {
      try {
        const sugerencia = await consultarCostoSugeridoPorDireccion(consulta);
        if (!cancelled) {
          setSugerenciaCosto(sugerencia);
        }
      } catch {
        if (!cancelled) {
          setSugerenciaCosto(null);
        }
      } finally {
        if (!cancelled) {
          setLoadingSugerenciaCosto(false);
        }
      }
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [activeSection, consultaDireccion]);

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  const renderContent = () => {
    switch (activeSection) {
      case 'panel':
        return <Dashboard />;
      case 'pedidos':
        return <Orders />;
      case 'clientes':
        return <Clients />;
      case 'repartidores':
        return <Repartidores />;
      case 'analytics':
        return <Reportes />;
      // case eliminado
      case 'settings':
        return <Settings />;
      default:
        return <Orders />;
    }
  };

  const navbarSectionTitle = activeSection === 'pedidos'
    ? 'Despacho rapido'
    : SECTION_TITLES[activeSection] || 'Operacion';

  return (
    <div className="app-shell flex min-h-screen text-white">
      {/* Sidebar */}
      <Sidebar 
        isOpen={sidebarOpen}
        setIsOpen={setSidebarOpen}
        activeSection={activeSection}
        setActiveSection={setActiveSection}
      />

      {/* Main Content */}
      <div className="flex min-h-screen min-w-0 flex-1 flex-col overflow-hidden">
        {/* Navbar */}
        <Navbar
          toggleSidebar={toggleSidebar}
          sectionTitle={navbarSectionTitle}
          activeSection={activeSection}
          consultaDireccion={consultaDireccion}
          setConsultaDireccion={setConsultaDireccion}
          loadingSugerenciaCosto={loadingSugerenciaCosto}
          sugerenciaCosto={sugerenciaCosto}
        />

        {/* Content Area */}
        <main className="section-shell flex-1 overflow-y-auto px-2.5 pb-4 pt-2 sm:px-3 sm:pb-5 lg:px-4 lg:pt-2.5">
          <Suspense fallback={<div className="glass-panel rounded-[22px] px-4 py-7 text-sm text-gray-300">Cargando seccion...</div>}>
            <div className="relative z-10">
              {renderContent()}
            </div>
          </Suspense>
        </main>
      </div>

      {/* Toast Notifications */}
      <Toaster 
        position="top-right"
        toastOptions={{
          duration: 3000,
          style: {
            background: 'rgba(10, 26, 38, 0.92)',
            color: '#eff7ff',
            border: '1px solid rgba(120, 164, 194, 0.18)',
            backdropFilter: 'blur(18px)',
          },
          success: {
            iconTheme: {
              primary: '#4ecdc4',
              secondary: '#fff',
            },
          },
          error: {
            iconTheme: {
              primary: '#ff6b6b',
              secondary: '#fff',
            },
          },
        }}
      />
    </div>
  );
}

export default App;
