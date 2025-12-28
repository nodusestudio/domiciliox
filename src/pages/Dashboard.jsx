import React from 'react';
import { Package, Users, Truck, TrendingUp } from 'lucide-react';

const Dashboard = () => {
  const stats = [
    { 
      label: 'Pedidos Hoy', 
      value: '0', 
      icon: Package, 
      color: 'bg-primary',
      trend: '+0%'
    },
    { 
      label: 'Clientes Activos', 
      value: '0', 
      icon: Users, 
      color: 'bg-secondary',
      trend: '+0%'
    },
    { 
      label: 'Repartidores', 
      value: '0', 
      icon: Truck, 
      color: 'bg-warning',
      trend: '0'
    },
    { 
      label: 'Ingresos Hoy', 
      value: '$0', 
      icon: TrendingUp, 
      color: 'bg-success',
      trend: '+0%'
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white mb-2">Dashboard</h2>
        <p className="text-gray-400">Resumen general de operaciones</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <div 
              key={index}
              className="bg-dark-card border border-dark-border rounded-lg p-6 shadow-lg"
            >
              <div className="flex items-start justify-between mb-4">
                <div className={`${stat.color} p-3 rounded-lg`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
                <span className="text-success text-sm font-medium">
                  {stat.trend}
                </span>
              </div>
              <h3 className="text-3xl font-bold text-white mb-1">
                {stat.value}
              </h3>
              <p className="text-gray-400 text-sm">{stat.label}</p>
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
