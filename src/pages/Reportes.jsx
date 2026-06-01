import React, { useState, useEffect } from 'react';
import { Calendar, Search, Download, TrendingUp, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';

export default function Reportes() {
  const [historial, setHistorial] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [jornadaExpandida, setJornadaExpandida] = useState(null);

  useEffect(() => {
    // Establecer fechas por defecto (últimos 7 días)
    const hoy = new Date();
    const hace7Dias = new Date();
    hace7Dias.setDate(hoy.getDate() - 7);
    
    setFechaFin(hoy.toISOString().split('T')[0]);
    setFechaInicio(hace7Dias.toISOString().split('T')[0]);
    
    // Cargar historial automáticamente
    cargarHistorial({ silent: true });
    
    // Listener para detectar cambios en localStorage
    const handleStorageChange = (e) => {
      if (e.key === 'historial_jornadas') {
        cargarHistorial({ silent: true });
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    
    // Recargar cuando la ventana vuelve a tener foco
    const handleFocus = () => {
      cargarHistorial({ silent: true });
    };
    
    window.addEventListener('focus', handleFocus);
    
    // Recargar datos cada 5 segundos
    const interval = setInterval(() => {
      cargarHistorial({ silent: true });
    }, 5000);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('focus', handleFocus);
      clearInterval(interval);
    };
  }, []);

  const cargarHistorial = ({ silent = false } = {}) => {
    try {
      const datos = JSON.parse(localStorage.getItem('historial_jornadas') || '[]');
      setHistorial(datos);
      if (!silent && datos.length > 0) {
        toast.success(`${datos.length} jornada(s) cargadas`);
      }
    } catch (error) {
      if (!silent) {
        toast.error('Error al cargar reportes');
      }
    }
  };

  const buscarHistorial = async () => {
    if (!fechaInicio || !fechaFin) {
      toast.error('Selecciona el rango de fechas');
      return;
    }

    setLoading(true);

    try {
      const datos = JSON.parse(localStorage.getItem('historial_jornadas') || '[]');
      
      // Filtrar por rango de fechas
      const datosFiltrados = datos.filter(jornada => {
        const fechaJornada = new Date(jornada.timestamp).toISOString().split('T')[0];
        return fechaJornada >= fechaInicio && fechaJornada <= fechaFin;
      });

      setHistorial(datosFiltrados);
      
      if (datosFiltrados.length === 0) {
        toast('No se encontraron registros en este rango');
      } else {
        toast.success(`Se encontraron ${datosFiltrados.length} jornada(s)`);
      }

    } catch (error) {
      toast.error('Error al cargar reportes');
    } finally {
      setLoading(false);
    }
  };

  const toggleJornada = (id) => {
    setJornadaExpandida(jornadaExpandida === id ? null : id);
  };

  const eliminarJornada = (id) => {
    if (confirm('¿Eliminar esta jornada del historial?')) {
      try {
        const datos = JSON.parse(localStorage.getItem('historial_jornadas') || '[]');
        const actualizados = datos.filter(j => j.id !== id);
        localStorage.setItem('historial_jornadas', JSON.stringify(actualizados));
        setHistorial(actualizados);
        toast.success('Jornada eliminada');
      } catch (error) {
        toast.error('Error al eliminar la jornada');
      }
    }
  };

  const calcularTotalesGenerales = () => {
    const totalPedidos = historial.reduce((sum, j) => sum + (j.totales?.cantidad_pedidos || 0), 0);
    const totalIngresos = historial.reduce((sum, j) => sum + (j.totales?.total_a_recibir || 0), 0);
    const totalEfectivo = historial.reduce((sum, j) => sum + (j.totales?.total_efectivo || 0), 0);
    const totalTarjeta = historial.reduce((sum, j) => sum + (j.totales?.total_tarjeta || 0), 0);

    return { totalPedidos, totalIngresos, totalEfectivo, totalTarjeta };
  };

  const totalesGenerales = calcularTotalesGenerales();

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-3xl font-bold text-white mb-2">Reportes Históricos</h2>
        <p className="text-gray-400">Consulta jornadas guardadas por rango de fechas</p>
      </div>

      {/* Filtros de Búsqueda */}
      <div className="bg-dark-card border border-dark-border rounded-lg p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-white mb-2">
              Fecha Inicio
            </label>
            <input
              type="date"
              value={fechaInicio}
              onChange={(e) => setFechaInicio(e.target.value)}
              className="w-full px-4 py-2 bg-[#374151] border border-dark-border rounded-lg text-white focus:ring-2 focus:ring-primary focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-white mb-2">
              Fecha Fin
            </label>
            <input
              type="date"
              value={fechaFin}
              onChange={(e) => setFechaFin(e.target.value)}
              className="w-full px-4 py-2 bg-[#374151] border border-dark-border rounded-lg text-white focus:ring-2 focus:ring-primary focus:border-transparent"
            />
          </div>

          <div className="flex items-end">
            <button
              onClick={buscarHistorial}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 px-6 py-2 bg-primary text-white rounded-lg hover:bg-[#1557b0] transition-colors font-semibold disabled:opacity-50"
            >
              <Search className="w-5 h-5" />
              {loading ? 'Buscando...' : 'Buscar'}
            </button>
          </div>
        </div>
      </div>

      {/* Resumen General */}
      {historial.length > 0 && (
        <div className="bg-dark-card border border-dark-border rounded-lg p-6">
          <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-success" />
            Resumen del Período
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-dark-bg border border-dark-border rounded-lg p-4">
              <p className="text-sm text-gray-400 mb-1">Jornadas</p>
              <p className="text-2xl font-bold text-white">{historial.length}</p>
            </div>

            <div className="bg-dark-bg border border-dark-border rounded-lg p-4">
              <p className="text-sm text-gray-400 mb-1">Total Pedidos</p>
              <p className="text-2xl font-bold text-primary">{totalesGenerales.totalPedidos}</p>
            </div>

            <div className="bg-dark-bg border border-dark-border rounded-lg p-4">
              <p className="text-sm text-gray-400 mb-1">Ingresos Totales</p>
              <p className="text-2xl font-bold text-success">${totalesGenerales.totalIngresos.toLocaleString()}</p>
            </div>

            <div className="bg-dark-bg border border-dark-border rounded-lg p-4">
              <p className="text-sm text-gray-400 mb-1">Efectivo / Tarjeta</p>
              <div className="flex gap-2 mt-1">
                <span className="text-sm font-semibold text-warning">${totalesGenerales.totalEfectivo.toLocaleString()}</span>
                <span className="text-gray-500">/</span>
                <span className="text-sm font-semibold text-primary">${totalesGenerales.totalTarjeta.toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tabla de Métricas por Cliente */}
      {historial.length > 0 && (
        <div className="bg-dark-card border border-dark-border rounded-lg p-6 mb-6">
          <h3 className="text-lg font-bold text-white mb-4">Métricas por Cliente</h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-[#374151]">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-white">Cliente</th>
                  <th className="px-4 py-2 text-center text-xs font-semibold text-white">Pedidos</th>
                  <th className="px-4 py-2 text-right text-xs font-semibold text-white">Total Gastado</th>
                  <th className="px-4 py-2 text-right text-xs font-semibold text-white">Ticket Promedio</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dark-border">
                {(() => {
                  // Agrupar pedidos por cliente
                  const pedidos = historial.flatMap(j => j.pedidos || []);
                  const clientes = {};
                  pedidos.forEach(p => {
                    if (!p.cliente) return;
                    if (!clientes[p.cliente]) clientes[p.cliente] = { pedidos: 0, total: 0 };
                    clientes[p.cliente].pedidos++;
                    clientes[p.cliente].total += Number(p.valor_pedido) || 0;
                  });
                  // Convertir a array y calcular ticket promedio
                  const rows = Object.entries(clientes).map(([nombre, data]) => ({
                    nombre,
                    pedidos: data.pedidos,
                    total: data.total,
                    ticket: data.pedidos > 0 ? Math.round(data.total / data.pedidos) : 0
                  }));
                  // Ordenar por total gastado desc
                  rows.sort((a, b) => b.total - a.total);
                  return rows.map((row, idx) => (
                    <tr key={idx} className="hover:bg-dark-card transition-colors">
                      <td className="px-4 py-3 text-sm text-white font-semibold">{row.nombre}</td>
                      <td className="px-4 py-3 text-sm text-center text-primary font-bold">{row.pedidos}</td>
                      <td className="px-4 py-3 text-sm text-right text-success font-bold">${row.total.toLocaleString()}</td>
                      <td className="px-4 py-3 text-sm text-right text-warning">${row.ticket.toLocaleString()}</td>
                    </tr>
                  ));
                })()}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {/* ...existing code de jornadas... */}
      <div className="space-y-3">
        {/* ...existing code de jornadas... */}
      </div>
    </div>
  );
}
