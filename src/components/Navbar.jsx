import React from 'react';
import { Menu, Search } from 'lucide-react';

const Navbar = ({
  toggleSidebar,
  sectionTitle = '',
  activeSection = 'pedidos',
  consultaDireccion = '',
  setConsultaDireccion = () => {},
  loadingSugerenciaCosto = false,
  sugerenciaCosto = null,
  navbarSummary = null,
}) => {
  const compactTitle = activeSection === 'pedidos' ? 'Despacho' : sectionTitle;
  const costoTexto = loadingSugerenciaCosto
    ? '...'
    : sugerenciaCosto?.costoSugerido
      ? `$${Number(sugerenciaCosto.costoSugerido).toLocaleString()}`
      : '$0';

  return (
    <nav className="px-2.5 pb-1 pt-2 sm:px-3 lg:px-4">
      <div className="glass-panel-strong flex items-center justify-between rounded-[18px] px-2.5 py-2 sm:px-3">
        <div className="flex min-w-0 items-center gap-2">
          <button
            onClick={toggleSidebar}
            className="soft-ring inline-flex h-9 w-9 items-center justify-center rounded-[14px] bg-white/5 text-white transition-all hover:bg-white/10"
            aria-label="Abrir navegacion"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="min-w-0 rounded-[14px] border border-white/10 bg-white/5 px-2.5 py-1.5">
            <p className="truncate text-xs font-semibold uppercase tracking-[0.16em] text-[var(--app-text-soft)]">
              {compactTitle}
            </p>
          </div>

          {activeSection === 'pedidos' && (
            <div className="flex min-w-0 items-center gap-1.5 rounded-[14px] border border-white/10 bg-slate-950/35 px-1.5 py-1 sm:gap-2 sm:px-2 sm:py-1.5">
              <Search className="hidden h-3.5 w-3.5 text-[var(--app-text-soft)] sm:block" />
              <input
                type="text"
                value={consultaDireccion}
                onChange={(e) => setConsultaDireccion(String(e.target.value || '').toUpperCase())}
                placeholder="Costo"
                className="w-[74px] bg-transparent text-[11px] text-white outline-none placeholder:text-gray-500 sm:w-[112px] sm:text-xs"
              />
              <span className="rounded-full bg-white/5 px-1.5 py-0.5 text-[9px] font-semibold text-[var(--app-primary)] sm:px-2 sm:text-[10px]">
                {costoTexto}
              </span>
            </div>
          )}
        </div>

        {activeSection === 'pedidos' && navbarSummary && (
          <div className="mx-3 hidden min-w-0 flex-1 lg:flex lg:justify-center">
            <div className="flex min-w-0 items-center gap-2 rounded-[16px] border border-white/10 bg-slate-950/25 px-3 py-1.5">
              <div className="min-w-0 pr-2">
                <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--app-text-soft)]">Repartidor</div>
                <div className="truncate text-sm font-semibold text-white">{navbarSummary.nombre}</div>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                <div className="rounded-[12px] bg-white/5 px-2 py-1 text-center">
                  <div className="text-[9px] uppercase tracking-[0.14em] text-[var(--app-text-soft)]">Pedidos</div>
                  <div className="mt-0.5 text-xs font-semibold text-white">{navbarSummary.pedidos}</div>
                </div>
                <div className="rounded-[12px] bg-white/5 px-2 py-1 text-center">
                  <div className="text-[9px] uppercase tracking-[0.14em] text-[var(--app-text-soft)]">Domicilios</div>
                  <div className="mt-0.5 text-xs font-semibold text-[var(--app-accent)]">${Number(navbarSummary.domicilios || 0).toLocaleString()}</div>
                </div>
                <div className="rounded-[12px] bg-white/5 px-2 py-1 text-center">
                  <div className="text-[9px] uppercase tracking-[0.14em] text-[var(--app-text-soft)]">Total</div>
                  <div className="mt-0.5 text-xs font-bold text-[var(--app-primary)]">${Number(navbarSummary.total || 0).toLocaleString()}</div>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="ml-3 flex items-center gap-2">
          <span className="hidden h-2 w-2 rounded-full bg-[var(--app-primary)] shadow-[0_0_10px_rgba(78,205,196,0.85)] sm:block" />
          <div className="rounded-[14px] border border-white/10 bg-gradient-to-br from-white/10 to-white/5 px-2.5 py-1.5 text-right">
            <h1 className="brand-gradient text-sm font-bold sm:text-base">
              DomicilioX
            </h1>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
