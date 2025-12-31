import React, { useState, useEffect } from 'react';
import { Search, TrendingUp, Calendar, DollarSign, Package, Clock, Download, AlertTriangle, TrendingDown } from 'lucide-react';
import { BarChart, Bar, LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import toast from 'react-hot-toast';
import { useClientAnalytics } from '../hooks/useClientAnalytics';
import * as XLSX from 'xlsx';
import {
  calcularFrecuenciaPedidos,
  calcularTicketPromedio,
  calcularDiaFavorito,
  calcularDiasDesdeUltimoPedido,
  detectarClientesInactivos,
  calcularCrecimiento,
  agruparPedidosPorMes,
  exportarPerfilInteligente
} from '../services/analyticsService';

export default function ClientIntelligence() {
  const [pedidosHistoricos, setPedidosHistoricos] = useState([]);
  const [clienteSeleccionado, setClienteSeleccionado] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showSugerencias, setShowSugerencias] = useState(false);

  useEffect(() => {
    cargarPedidosHistoricos();
    
    // Listener para detectar cambios en localStorage (cuando se guardan jornadas)
    const handleStorageChange = (e) => {
      if (e.key === 'historial_jornadas' || e.key === 'pedidos') {
        cargarPedidosHistoricos();
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    
    // También recargar cada vez que la ventana vuelve a tener foco
    const handleFocus = () => {
      cargarPedidosHistoricos();
    };
    
    window.addEventListener('focus', handleFocus);
    
    // Recargar datos cada 5 segundos para capturar cambios en la misma pestaña
    const interval = setInterval(cargarPedidosHistoricos, 5000);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('focus', handleFocus);
      clearInterval(interval);
    };
  }, []);

  const cargarPedidosHistoricos = () => {
    // Cargar pedidos actuales
    const pedidosActuales = JSON.parse(localStorage.getItem('pedidos') || '[]');
    
    // Cargar jornadas guardadas
    const jornadas = JSON.parse(localStorage.getItem('historial_jornadas') || '[]');
    
    // Extraer todos los pedidos de las jornadas
    const pedidosDeJornadas = jornadas.flatMap(jornada => jornada.pedidos || []);
    
    // Combinar todos los pedidos
    const todosPedidos = [...pedidosActuales, ...pedidosDeJornadas];
    
    setPedidosHistoricos(todosPedidos);
  };

  const { clientStats, top10Clientes, flujoPedidos } = useClientAnalytics(pedidosHistoricos);

  // Detectar clientes inactivos
  const clientesInactivos = detectarClientesInactivos(clientStats);

  // Agrupar pedidos por mes para gráfico de tendencias
  const tendenciasMensuales = agruparPedidosPorMes(pedidosHistoricos);

  const handleSearch = (e) => {
    const value = e.target.value;
    setSearchTerm(value);
    setShowSugerencias(value.length > 0);
  };

  const clientesFiltrados = clientStats.filter(c => 
    c.nombre.toLowerCase().includes(searchTerm.toLowerCase())
  ).slice(0, 10);

  const seleccionarCliente = (cliente) => {
    setClienteSeleccionado(cliente);
    setSearchTerm('');
    setShowSugerencias(false);
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-white mb-2">Inteligencia de Clientes</h2>
          <p className="text-gray-400">Análisis avanzado de comportamiento y tendencias</p>
        </div>
        <button
          onClick={cargarPedidosHistoricos}
          className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-[#1557b0] text-white rounded-lg transition-colors font-semibold"
        >
          <Download className="w-4 h-4" />
          Actualizar Datos
        </button>
      </div>

      {/* Estadísticas Generales */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-dark-card border border-dark-border rounded-lg p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-primary/20 rounded-lg">
              <Package className="w-5 h-5 text-primary" />
            </div>
            <p className="text-sm text-gray-400">Total Pedidos</p>
          </div>
          <p className="text-3xl font-bold text-white">{pedidosHistoricos.length}</p>
        </div>

        <div className="bg-dark-card border border-dark-border rounded-lg p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-success/20 rounded-lg">
              <TrendingUp className="w-5 h-5 text-success" />
            </div>
            <p className="text-sm text-gray-400">Clientes Activos</p>
          </div>
          <p className="text-3xl font-bold text-white">{clientStats.length}</p>
        </div>

        <div className="bg-dark-card border border-dark-border rounded-lg p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-warning/20 rounded-lg">
              <DollarSign className="w-5 h-5 text-warning" />
            </div>
            <p className="text-sm text-gray-400">Ticket Promedio</p>
          </div>
          <p className="text-3xl font-bold text-white">
            ${pedidosHistoricos.length > 0 
              ? Math.round(pedidosHistoricos.reduce((sum, p) => sum + (p.valor_pedido || 0), 0) / pedidosHistoricos.length).toLocaleString()
              : 0
            }
          </p>
        </div>

        <div className="bg-dark-card border border-dark-border rounded-lg p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-purple-500/20 rounded-lg">
              <Calendar className="w-5 h-5 text-purple-500" />
            </div>
            <p className="text-sm text-gray-400">Días Activos</p>
          </div>
          <p className="text-3xl font-bold text-white">{flujoPedidos.length}</p>
        </div>
      </div>

      {/* Buscador de Cliente */}
      <div className="bg-dark-card border border-dark-border rounded-lg p-6">
        <h3 className="text-xl font-bold text-white mb-4">Búsqueda Profunda de Cliente</h3>
        <div className="relative">
          <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Buscar cliente por nombre..."
            value={searchTerm}
            onChange={handleSearch}
            className="w-full pl-12 pr-4 py-3 bg-[#111827] border border-dark-border rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-primary focus:border-transparent"
          />

          {/* Sugerencias */}
          {showSugerencias && clientesFiltrados.length > 0 && (
            <div className="absolute z-10 w-full mt-2 bg-dark-card border border-dark-border rounded-lg shadow-xl max-h-60 overflow-y-auto">
              {clientesFiltrados.map((cliente, index) => (
                <button
                  key={index}
                  onClick={() => seleccionarCliente(cliente)}
                  className="w-full px-4 py-3 text-left hover:bg-dark-bg transition-colors border-b border-dark-border last:border-b-0"
                >
                  <div className="font-medium text-white">{cliente.nombre}</div>
                  <div className="text-sm text-gray-400 mt-1">
                    {cliente.cantidadPedidos} pedidos • ${cliente.totalGastado.toLocaleString()} total
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Alertas de Inactividad */}
      {clientesInactivos.length > 0 && (
        <div className="bg-dark-card border border-warning rounded-lg p-6">
          <div className="flex items-center gap-3 mb-4">
            <AlertTriangle className="w-6 h-6 text-warning" />
            <h3 className="text-xl font-bold text-white">Clientes Inactivos ({clientesInactivos.length})</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {clientesInactivos.map((cliente, index) => (
              <div 
                key={index}
                className="bg-[#111827] border border-warning/30 rounded-lg p-4 cursor-pointer hover:bg-warning/10 transition-colors"
                onClick={() => seleccionarCliente(cliente)}
              >
                <p className="font-bold text-white mb-2">{cliente.nombre}</p>
                <p className="text-sm text-gray-400">Frecuencia: {calcularFrecuenciaPedidos(cliente.pedidos)} días</p>
                <p className="text-sm text-warning font-semibold">
                  ⚠️ {calcularDiasDesdeUltimoPedido(cliente.pedidos)} días sin pedir
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Detalle del Cliente Seleccionado */}
      {clienteSeleccionado && (
        <div className="bg-dark-card border border-primary rounded-lg p-6 animate-fadeIn">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <h3 className="text-2xl font-bold text-white">{clienteSeleccionado.nombre}</h3>
              {calcularCrecimiento(clienteSeleccionado.pedidos) > 0 && (
                <span className="px-3 py-1 bg-success/20 text-success rounded-full text-sm font-semibold flex items-center gap-1">
                  <TrendingUp className="w-4 h-4" />
                  +{calcularCrecimiento(clienteSeleccionado.pedidos)}% Crecimiento
                </span>
              )}
              {calcularCrecimiento(clienteSeleccionado.pedidos) < 0 && (
                <span className="px-3 py-1 bg-red-500/20 text-red-500 rounded-full text-sm font-semibold flex items-center gap-1">
                  <TrendingDown className="w-4 h-4" />
                  {calcularCrecimiento(clienteSeleccionado.pedidos)}% Decrecimiento
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => exportarPerfilInteligente(clienteSeleccionado, XLSX)}
                className="flex items-center gap-2 px-4 py-2 bg-success text-white rounded-lg hover:bg-[#0d9668] transition-colors"
              >
                <Download className="w-5 h-5" />
                Exportar Perfil
              </button>
              <button
                onClick={() => setClienteSeleccionado(null)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Estadísticas del Cliente */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
            <div className="bg-[#111827] border border-dark-border rounded-lg p-4">
              <p className="text-sm text-gray-400 mb-1">Total Pedidos</p>
              <p className="text-2xl font-bold text-primary">{clienteSeleccionado.cantidadPedidos}</p>
            </div>

            <div className="bg-[#111827] border border-dark-border rounded-lg p-4">
              <p className="text-sm text-gray-400 mb-1">Gasto Total</p>
              <p className={`text-2xl font-bold ${calcularCrecimiento(clienteSeleccionado.pedidos) > 0 ? 'text-success' : 'text-white'}`}>
                ${clienteSeleccionado.totalGastado.toLocaleString()}
              </p>
            </div>

            <div className="bg-[#111827] border border-dark-border rounded-lg p-4">
              <p className="text-sm text-gray-400 mb-1">Ticket Promedio</p>
              <p className="text-2xl font-bold text-warning">
                ${calcularTicketPromedio(clienteSeleccionado.pedidos).toLocaleString()}
              </p>
            </div>

            <div className="bg-[#111827] border border-dark-border rounded-lg p-4">
              <p className="text-sm text-gray-400 mb-1">Frecuencia</p>
              <p className="text-2xl font-bold text-purple-500">
                {calcularFrecuenciaPedidos(clienteSeleccionado.pedidos) > 0 
                  ? `${calcularFrecuenciaPedidos(clienteSeleccionado.pedidos)} días`
                  : 'Único'
                }
              </p>
            </div>

            <div className="bg-[#111827] border border-dark-border rounded-lg p-4">
              <p className="text-sm text-gray-400 mb-1">Día Favorito</p>
              <p className="text-2xl font-bold text-primary">
                {calcularDiaFavorito(clienteSeleccionado.pedidos)}
              </p>
            </div>
          </div>

          {/* Alerta de Inactividad */}
          {calcularDiasDesdeUltimoPedido(clienteSeleccionado.pedidos) >= 10 && 
           calcularFrecuenciaPedidos(clienteSeleccionado.pedidos) <= 5 && (
            <div className="bg-warning/10 border border-warning rounded-lg p-4 mb-6">
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-6 h-6 text-warning" />
                <div>
                  <p className="text-warning font-bold">⚠️ Cliente Inactivo</p>
                  <p className="text-sm text-gray-300">
                    Lleva {calcularDiasDesdeUltimoPedido(clienteSeleccionado.pedidos)} días sin hacer pedidos 
                    (frecuencia habitual: {calcularFrecuenciaPedidos(clienteSeleccionado.pedidos)} días)
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Información de Contacto */}
          <div className="bg-[#111827] border border-dark-border rounded-lg p-4 mb-6">
            <p className="text-sm text-gray-400 mb-2">Información de Contacto</p>
            <p className="text-white">📍 {clienteSeleccionado.direccion}</p>
            <p className="text-white mt-1">📞 {clienteSeleccionado.telefono}</p>
          </div>

          {/* Línea de Tiempo */}
          <div className="bg-[#111827] border border-dark-border rounded-lg p-4">
            <h4 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Clock className="w-5 h-5 text-primary" />
              Línea de Tiempo de Pedidos
            </h4>
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {clienteSeleccionado.pedidos.map((pedido, index) => (
                <div key={index} className="flex items-center gap-4 border-l-2 border-primary pl-4">
                  <div className="flex-1">
                    <p className="text-white font-medium">${pedido.valor.toLocaleString()}</p>
                    <p className="text-sm text-gray-400">
                      {typeof pedido.fecha === 'string' 
                        ? pedido.fecha 
                        : pedido.fecha?.toLocaleDateString?.('es-ES', { 
                            day: '2-digit', 
                            month: 'short', 
                            year: 'numeric' 
                          }) || 'N/A'
                      }
                    </p>
                  </div>
                  <div className="w-2 h-2 bg-primary rounded-full"></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Gráficas */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Tendencias Mensuales - Gráfico de Área */}
        <div className="lg:col-span-3 bg-dark-card border border-dark-border rounded-lg p-6">
          <h3 className="text-xl font-bold text-white mb-4">Crecimiento de Pedidos por Mes</h3>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={tendenciasMensuales}>
              <defs>
                <linearGradient id="colorCantidad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10B981" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis 
                dataKey="mes" 
                stroke="#9CA3AF"
                angle={-45}
                textAnchor="end"
                height={100}
              />
              <YAxis stroke="#9CA3AF" />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#111827', 
                  border: '1px solid #374151',
                  borderRadius: '8px'
                }}
              />
              <Area 
                type="monotone" 
                dataKey="cantidad" 
                stroke="#10B981" 
                fillOpacity={1} 
                fill="url(#colorCantidad)"
                name="Pedidos"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Top 10 Clientes */}
        <div className="bg-dark-card border border-dark-border rounded-lg p-6">
          <h3 className="text-xl font-bold text-white mb-4">Top 10 Clientes con Más Pedidos</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={top10Clientes}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis 
                dataKey="nombre" 
                stroke="#9CA3AF"
                angle={-45}
                textAnchor="end"
                height={100}
              />
              <YAxis stroke="#9CA3AF" />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#1F2937', 
                  border: '1px solid #374151',
                  borderRadius: '8px'
                }}
              />
              <Bar dataKey="cantidadPedidos" fill="#206DDA" name="Pedidos" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Flujo de Pedidos */}
        <div className="bg-dark-card border border-dark-border rounded-lg p-6">
          <h3 className="text-xl font-bold text-white mb-4">Flujo de Pedidos por Fecha</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={flujoPedidos}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis 
                dataKey="fecha" 
                stroke="#9CA3AF"
                angle={-45}
                textAnchor="end"
                height={100}
              />
              <YAxis stroke="#9CA3AF" />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#1F2937', 
                  border: '1px solid #374151',
                  borderRadius: '8px'
                }}
              />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="cantidad" 
                stroke="#10B981" 
                strokeWidth={2}
                name="Cantidad de Pedidos"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Tabla de Todos los Clientes */}
      <div className="bg-dark-card border border-dark-border rounded-lg p-6">
        <h3 className="text-xl font-bold text-white mb-4">Ranking Completo de Clientes</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-[#111827]">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold text-white">#</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-white">Cliente</th>
                <th className="px-4 py-3 text-center text-sm font-semibold text-white">Pedidos</th>
                <th className="px-4 py-3 text-right text-sm font-semibold text-white">Gasto Total</th>
                <th className="px-4 py-3 text-right text-sm font-semibold text-white">Ticket Promedio</th>
                <th className="px-4 py-3 text-center text-sm font-semibold text-white">Día Favorito</th>
                <th className="px-4 py-3 text-center text-sm font-semibold text-white">Frecuencia</th>
                <th className="px-4 py-3 text-center text-sm font-semibold text-white">Tendencia</th>
                <th className="px-4 py-3 text-center text-sm font-semibold text-white">Último Pedido</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dark-border">
              {clientStats
                .sort((a, b) => b.cantidadPedidos - a.cantidadPedidos)
                .map((cliente, index) => {
                  const crecimiento = calcularCrecimiento(cliente.pedidos);
                  const diasDesdeUltimo = calcularDiasDesdeUltimoPedido(cliente.pedidos);
                  const frecuencia = calcularFrecuenciaPedidos(cliente.pedidos);
                  const esInactivo = frecuencia > 0 && frecuencia <= 5 && diasDesdeUltimo >= 10;
                  
                  return (
                    <tr 
                      key={index} 
                      className={`hover:bg-dark-bg transition-colors cursor-pointer ${
                        esInactivo ? 'bg-warning/5' : ''
                      }`}
                      onClick={() => seleccionarCliente(cliente)}
                    >
                      <td className="px-4 py-3 text-gray-400">{index + 1}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="text-white font-medium">{cliente.nombre}</span>
                          {esInactivo && <AlertTriangle className="w-4 h-4 text-warning" />}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="px-3 py-1 bg-primary/20 text-primary rounded-full text-sm font-semibold">
                          {cliente.cantidadPedidos}
                        </span>
                      </td>
                      <td className={`px-4 py-3 text-right font-semibold ${
                        crecimiento > 0 ? 'text-success' : 'text-white'
                      }`}>
                        ${cliente.totalGastado.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right text-warning">
                        ${calcularTicketPromedio(cliente.pedidos).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-center text-gray-300">
                        {calcularDiaFavorito(cliente.pedidos)}
                      </td>
                      <td className="px-4 py-3 text-center text-gray-300">
                        {frecuencia > 0 
                          ? `${frecuencia} días`
                          : 'Único'
                        }
                      </td>
                      <td className="px-4 py-3 text-center">
                        {crecimiento > 0 ? (
                          <span className="flex items-center justify-center gap-1 text-success">
                            <TrendingUp className="w-4 h-4" />
                            +{crecimiento}%
                          </span>
                        ) : crecimiento < 0 ? (
                          <span className="flex items-center justify-center gap-1 text-red-500">
                            <TrendingDown className="w-4 h-4" />
                            {crecimiento}%
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="text-gray-400">
                          {typeof cliente.ultimaFecha === 'string'
                            ? cliente.ultimaFecha
                            : cliente.ultimaFecha?.toLocaleDateString?.('es-ES') || 'N/A'
                          }
                          {diasDesdeUltimo > 0 && (
                            <p className={`text-xs ${esInactivo ? 'text-warning' : 'text-gray-500'}`}>
                              Hace {diasDesdeUltimo} días
                            </p>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
