import React, { useState, useEffect } from 'react';
import { Package, Users, Truck, TrendingUp } from 'lucide-react';
import toast from 'react-hot-toast';

const Dashboard = () => {
  const [pedidosHoy, setPedidosHoy] = useState(0);
  const [clientesActivos, setClientesActivos] = useState(0);
  const [repartidoresDisponibles, setRepartidoresDisponibles] = useState(0);
  const [ingresosHoy, setIngresosHoy] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    cargarEstadisticas();
    const interval = setInterval(cargarEstadisticas, 30000); // Actualizar cada 30s
    return () => clearInterval(interval);
  }, []);

  const cargarEstadisticas = () => {
    try {
      // Cargar historial de jornadas desde localStorage (misma fuente que Reportes)
      const historial = JSON.parse(localStorage.getItem('historial_jornadas') || '[]');
      
      if (historial.length > 0) {
        // Obtener jornada más reciente
        const jornadaReciente = historial[0];
        
        // Sanitizar y extraer totales con String/Number para evitar error React #31
        const cantidadPedidos = Number(jornadaReciente.totales?.cantidad_pedidos || 0);
        const totalIngresos = Number(jornadaReciente.totales?.total_a_recibir || 0);
        
        setPedidosHoy(cantidadPedidos);
        setIngresosHoy(totalIngresos);
        
        // Calcular clientes únicos de la jornada
        const pedidos = jornadaReciente.pedidos || [];
        const clientesUnicos = new Set(pedidos.map(p => String(p.cliente || ''))).size;
        setClientesActivos(clientesUnicos);
      }
      
      // Cargar repartidores desde localStorage
      const repartidores = JSON.parse(localStorage.getItem('repartidores') || '[]');
      const disponibles = repartidores.filter(r => r.disponibilidad === true).length;
      setRepartidoresDisponibles(disponibles);
      
      setLoading(false);
    } catch (error) {
      console.error('Error al cargar estadísticas:', error);
      setLoading(false);
    }
  };

  const stats = [
    { 
      label: 'Pedidos Totales', 
      value: String(pedidosHoy || 0), 
      icon: Package, 
      color: 'bg-primary',
      trend: `${pedidosHoy} pedidos`
    },
    { 
      label: 'Clientes Activos', 
      value: String(clientesActivos || 0), 
      icon: Users, 
      color: 'bg-secondary',
      trend: `${clientesActivos} clientes`
    },
    { 
      label: 'Repartidores', 
      value: String(repartidoresDisponibles || 0), 
      icon: Truck, 
      color: 'bg-warning',
      trend: 'disponibles'
    },
    { 
      label: 'Ingresos Totales', 
      value: `$${Number(ingresosHoy || 0).toLocaleString()}`, 
      icon: TrendingUp, 
      color: 'bg-success',
      trend: 'acumulado'
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white mb-2">Panel</h2>
        <p className="text-gray-400">
          {loading ? 'Cargando estadísticas...' : 'Resumen general de operaciones'}
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <div 
              key={index}
              className="bg-dark-card border border-dark-border rounded-lg p-6 shadow-lg hover:border-primary/50 transition-all"
            >
              <div className="flex items-start justify-between mb-4">
                <div className={`${stat.color} p-3 rounded-lg`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
                <span className="text-gray-400 text-xs font-medium">
                  {String(stat.trend || '')}
                </span>
              </div>
              <h3 className="text-3xl font-bold text-white mb-1">
                {String(stat.value || '0')}
              </h3>
              <p className="text-gray-400 text-sm">{String(stat.label || '')}</p>
            </div>
          );
        })}
      </div>

      {/* Welcome Card */}
      <div className="bg-dark-card border border-dark-border rounded-lg p-8 shadow-lg">
        <h3 className="text-xl font-semibold text-white mb-4">
          Bienvenido a DomicilioX
        </h3>
        <p className="text-gray-300 mb-4">
          Sistema de gestión de domicilios diseñado para optimizar tus entregas y mantener el control total de tu operación.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
          <div className="p-4 bg-dark-bg rounded-lg">
            <h4 className="font-semibold text-white mb-2">📦 Gestión de Pedidos</h4>
            <p className="text-sm text-gray-400">Controla todos tus pedidos en tiempo real</p>
          </div>
          <div className="p-4 bg-dark-bg rounded-lg">
            <h4 className="font-semibold text-white mb-2">🚚 Repartidores</h4>
            <p className="text-sm text-gray-400">Administra tu equipo de entrega</p>
          </div>
          <div className="p-4 bg-dark-bg rounded-lg">
            <h4 className="font-semibold text-white mb-2">📊 Análisis</h4>
            <p className="text-sm text-gray-400">Toma decisiones con datos precisos</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
