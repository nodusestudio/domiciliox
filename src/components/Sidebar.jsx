import React from 'react';
import { 
  LayoutDashboard, 
  Bike,
  Users, 
  Truck,
  BarChart3,
  Settings,
  X,
  ChevronRight
} from 'lucide-react';
import Logo from './Logo';

const MENU_ITEMS = [
  { id: 'panel', label: 'Panel', icon: LayoutDashboard, hint: 'Resumen ejecutivo' },
  { id: 'pedidos', label: 'Pedidos', icon: Bike, hint: 'Despacho y seguimiento' },
  { id: 'clientes', label: 'Clientes', icon: Users, hint: 'Relacion y retencion' },
  { id: 'repartidores', label: 'Repartidores', icon: Truck, hint: 'Flota y asignaciones' },
  { id: 'analytics', label: 'Reportes', icon: BarChart3, hint: 'Metricas y cierres' },
  { id: 'settings', label: 'Configuracion', icon: Settings, hint: 'Parametros del sistema' },
];

const Sidebar = ({ isOpen, setIsOpen, activeSection, setActiveSection }) => {
  return (
    <>
      {/* Overlay para móvil */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside 
        className={`
          glass-panel-strong fixed inset-y-0 left-0 z-50 m-2 mr-0 rounded-[22px]
          transition-all duration-300 ease-in-out
          ${isOpen ? 'w-[248px]' : 'w-0 lg:w-[86px]'}
          overflow-hidden lg:sticky lg:top-2 lg:z-20 lg:m-2 lg:h-[calc(100vh-16px)] lg:flex-shrink-0
        `}
      >
        <div className="flex h-full flex-col">
          {/* Header */}
          <div className="border-b border-white/10 px-3 py-3.5">
            <div className="flex items-center justify-between gap-3">
              <Logo compact={!isOpen} className="min-w-0" />
              <button
                onClick={() => setIsOpen(!isOpen)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-white/5 text-white transition-colors hover:bg-white/10 lg:hidden"
                aria-label="Cerrar navegacion"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
          </div>

          {/* Menu Items */}
          <nav className="flex-1 space-y-1.5 px-2 py-3">
            {MENU_ITEMS.map((item) => {
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
                    group w-full rounded-[18px] border px-2.5 py-2.5 text-left transition-all duration-200
                    ${isActive 
                      ? 'border-[rgba(78,205,196,0.35)] bg-[linear-gradient(135deg,rgba(78,205,196,0.18),rgba(255,138,61,0.16))] text-white shadow-[0_10px_30px_rgba(0,0,0,0.22)]' 
                      : 'border-transparent text-gray-300 hover:border-white/10 hover:bg-white/5 hover:text-white'
                    }
                  `}
                >
                  <div className="flex items-center gap-3">
                    <div className={`inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[16px] ${isActive ? 'bg-black/20 text-white' : 'bg-white/5 text-[var(--app-text-soft)] group-hover:text-white'}`}>
                      <Icon className="h-4.5 w-4.5" />
                    </div>

                    {isOpen && (
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold">{item.label}</div>
                        <div className="truncate text-[11px] text-[var(--app-text-soft)]">{item.hint}</div>
                      </div>
                    )}

                    {isOpen && (
                      <ChevronRight className={`h-4 w-4 transition-transform ${isActive ? 'translate-x-0 text-white' : '-translate-x-1 text-transparent group-hover:translate-x-0 group-hover:text-[var(--app-text-soft)]'}`} />
                    )}
                  </div>
                </button>
              );
            })}
          </nav>

          <div className="mx-2 mb-3 rounded-[18px] border border-white/10 bg-white/5 p-3">
            {isOpen ? (
              <>
                <div className="surface-label mb-2">Control tower</div>
                <div className="text-xs font-semibold leading-5 text-white">Monitorea pedidos, repartidores y cierres desde una sola vista.</div>
                <div className="mt-2.5 flex items-center gap-2 text-[11px] text-[var(--app-text-soft)]">
                  <span className="h-2 w-2 rounded-full bg-[var(--app-primary)] shadow-[0_0_10px_rgba(78,205,196,0.8)]" />
                  Sistema listo para operar
                </div>
              </>
            ) : (
              <div className="flex justify-center">
                <span className="h-3 w-3 rounded-full bg-[var(--app-primary)] shadow-[0_0_12px_rgba(78,205,196,0.85)]" />
              </div>
            )}
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
