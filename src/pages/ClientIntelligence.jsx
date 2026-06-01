
import React, { useState, useEffect, useMemo } from 'react';
import { nowBogotaDate } from '../utils/fechaBogota';
import { Search, TrendingUp, Calendar, DollarSign, Package, Clock, Download, AlertTriangle, TrendingDown, Filter, Database, Target } from 'lucide-react';
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
  const [filtroPeriodo, setFiltroPeriodo] = useState('30d');
  const [filtroFuente, setFiltroFuente] = useState('all');
  const [vistaMetrica, setVistaMetrica] = useState('all');
  const [periodoAInicio, setPeriodoAInicio] = useState('');
  const [periodoAFin, setPeriodoAFin] = useState('');
  const [periodoBInicio, setPeriodoBInicio] = useState('');
  const [periodoBFin, setPeriodoBFin] = useState('');

  const parsePedidoFecha = (pedido) => {
    if (!pedido) return null;
    const candidate = pedido.timestamp || pedido.fecha;
    const fecha = new Date(candidate);
    // Ajustar a Bogotá si es hoy
    if (!Number.isNaN(fecha.getTime())) {
      return new Date(fecha.getTime() - (fecha.getTimezoneOffset() * 60000) - (5 * 60 * 60 * 1000));
    }
    return null;
  };

  const parsePedidoValor = (pedido) => {
    const value = Number(pedido?.valor_pedido || 0);
    return Number.isFinite(value) ? value : 0;
  };

  const toIsoDate = (date) => {
    const d = new Date(date);
    if (Number.isNaN(d.getTime())) return '';
    return d.toISOString().slice(0, 10);
  };

  const calcularDelta = (actual, previo) => {
    if (!Number.isFinite(actual) || !Number.isFinite(previo)) return 0;
    if (previo === 0) return actual > 0 ? 100 : 0;
    return Math.round(((actual - previo) / previo) * 100);
  };

  const aplicarPresetVentanas = (dias) => {
    const hoy = new Date();
    const inicioA = new Date(hoy);
    inicioA.setDate(inicioA.getDate() - (dias - 1));

    const finB = new Date(inicioA);
    finB.setDate(finB.getDate() - 1);

    const inicioB = new Date(finB);
    inicioB.setDate(inicioB.getDate() - (dias - 1));

    setPeriodoAInicio(toIsoDate(inicioA));
    setPeriodoAFin(toIsoDate(hoy));
    setPeriodoBInicio(toIsoDate(inicioB));
    setPeriodoBFin(toIsoDate(finB));
  };

  const aplicarPresetMesActualVsPasado = () => {
    const hoy = new Date();
    const y = hoy.getFullYear();
    const m = hoy.getMonth();

    const inicioA = new Date(y, m, 1);
    const finA = hoy;

    const inicioB = new Date(y, m - 1, 1);
    const diasMesPasado = new Date(y, m, 0).getDate();
    const diaCorte = Math.min(hoy.getDate(), diasMesPasado);
    const finB = new Date(y, m - 1, diaCorte);

    setPeriodoAInicio(toIsoDate(inicioA));
    setPeriodoAFin(toIsoDate(finA));
    setPeriodoBInicio(toIsoDate(inicioB));
    setPeriodoBFin(toIsoDate(finB));
  };

  const aplicarPresetTrimestreActualVsPasado = () => {
    const hoy = new Date();
    const y = hoy.getFullYear();
    const m = hoy.getMonth();
    const trimestreActualInicioMes = Math.floor(m / 3) * 3;

    const inicioA = new Date(y, trimestreActualInicioMes, 1);
    const finA = hoy;

    const inicioB = new Date(y, trimestreActualInicioMes - 3, 1);
    const finBCompleto = new Date(y, trimestreActualInicioMes, 0);
    const diaCorte = Math.min(hoy.getDate(), finBCompleto.getDate());
    const finB = new Date(
      finBCompleto.getFullYear(),
      finBCompleto.getMonth(),
      diaCorte
    );

    setPeriodoAInicio(toIsoDate(inicioA));
    setPeriodoAFin(toIsoDate(finA));
    setPeriodoBInicio(toIsoDate(inicioB));
    setPeriodoBFin(toIsoDate(finB));
  };

  const obtenerVentanaDias = (periodo) => {
    if (periodo === '7d') return 7;
    if (periodo === '30d') return 30;
    if (periodo === '90d') return 90;
    if (periodo === '365d') return 365;
    return null;
  };

  const explicarVariacion = (pedidos, daysWindow = 30) => {
    if (!Array.isArray(pedidos) || pedidos.length === 0) {
      return {
        titulo: 'Sin datos suficientes',
        detalle: 'No hay pedidos para calcular variación en este filtro.',
        ordersDelta: 0,
        ticketDelta: 0,
        trend: 'neutral'
      };
    }

    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    const ventana = Math.max(7, Number(daysWindow) || 30);

    const pedidosRecientes = pedidos.filter((p) => {
      const fecha = parsePedidoFecha(p);
      return fecha && (now - fecha.getTime()) <= ventana * dayMs;
    });

    const pedidosPrevios = pedidos.filter((p) => {
      const fecha = parsePedidoFecha(p);
      if (!fecha) return false;
      const edad = now - fecha.getTime();
      return edad > ventana * dayMs && edad <= ventana * 2 * dayMs;
    });

    const countRecientes = pedidosRecientes.length;
    const countPrevios = pedidosPrevios.length;
    const ticketReciente = countRecientes > 0
      ? pedidosRecientes.reduce((sum, p) => sum + parsePedidoValor(p), 0) / countRecientes
      : 0;
    const ticketPrevio = countPrevios > 0
      ? pedidosPrevios.reduce((sum, p) => sum + parsePedidoValor(p), 0) / countPrevios
      : 0;

    const ordersDelta = countPrevios > 0
      ? Math.round(((countRecientes - countPrevios) / countPrevios) * 100)
      : (countRecientes > 0 ? 100 : 0);

    const ticketDelta = ticketPrevio > 0
      ? Math.round(((ticketReciente - ticketPrevio) / ticketPrevio) * 100)
      : (ticketReciente > 0 ? 100 : 0);

    let titulo = 'Comportamiento estable';
    let trend = 'neutral';
    let detalle = 'La variación entre periodos es baja y no hay un factor dominante.';

    if (ordersDelta > 0 || ticketDelta > 0) {
      trend = 'up';
      if (Math.abs(ordersDelta) >= Math.abs(ticketDelta)) {
        titulo = 'Crecimiento por frecuencia';
        detalle = `Suben los pedidos (${ordersDelta}%) y eso impulsa el resultado más que el ticket.`;
      } else {
        titulo = 'Crecimiento por valor de compra';
        detalle = `El ticket promedio sube (${ticketDelta}%) y explica la mayor parte del crecimiento.`;
      }
    }

    if (ordersDelta < 0 || ticketDelta < 0) {
      trend = 'down';
      if (Math.abs(ordersDelta) >= Math.abs(ticketDelta)) {
        titulo = 'Caída por menor frecuencia';
        detalle = `Bajan los pedidos (${ordersDelta}%) y esa es la principal causa del descenso.`;
      } else {
        titulo = 'Caída por menor ticket';
        detalle = `El ticket promedio cae (${ticketDelta}%), afectando los ingresos por pedido.`;
      }
    }

    return { titulo, detalle, ordersDelta, ticketDelta, trend };
  };

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

  useEffect(() => {
    const hoy = new Date();
    const hace30 = new Date(hoy);
    hace30.setDate(hace30.getDate() - 29);
    const hace60 = new Date(hoy);
    hace60.setDate(hace60.getDate() - 59);
    const finComparacion = new Date(hace30);
    finComparacion.setDate(finComparacion.getDate() - 1);

    setPeriodoAInicio(toIsoDate(hace30));
    setPeriodoAFin(toIsoDate(hoy));
    setPeriodoBInicio(toIsoDate(hace60));
    setPeriodoBFin(toIsoDate(finComparacion));
  }, []);

  const cargarPedidosHistoricos = () => {
    // Cargar pedidos actuales
    const pedidosActuales = JSON.parse(localStorage.getItem('pedidos') || '[]');
    
    // Cargar jornadas guardadas
    const jornadas = JSON.parse(localStorage.getItem('historial_jornadas') || '[]');
    
    // Extraer todos los pedidos de las jornadas
    const pedidosDeJornadas = jornadas.flatMap(jornada =>
      (jornada.pedidos || []).map((pedido) => ({
        ...pedido,
        __source: 'jornada',
        __sourceLabel: 'Jornada cerrada',
        __jornadaFecha: jornada?.fecha || null
      }))
    );

    const pedidosActualesEnriquecidos = (pedidosActuales || []).map((pedido) => ({
      ...pedido,
      __source: 'actual',
      __sourceLabel: 'Pedidos en curso'
    }));
    
    // Combinar todos los pedidos
    const todosPedidos = [...pedidosActualesEnriquecidos, ...pedidosDeJornadas];
    
    setPedidosHistoricos(todosPedidos);
  };

  const pedidosFiltrados = useMemo(() => {
    const days = obtenerVentanaDias(filtroPeriodo);
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;

    return (pedidosHistoricos || []).filter((pedido) => {
      if (filtroFuente !== 'all' && pedido.__source !== filtroFuente) return false;

      if (days === null) return true;
      const fecha = parsePedidoFecha(pedido);
      if (!fecha) return false;
      return (now - fecha.getTime()) <= days * dayMs;
    });
  }, [pedidosHistoricos, filtroPeriodo, filtroFuente]);

  const { clientStats, top10Clientes, flujoPedidos } = useClientAnalytics(pedidosFiltrados);

  // Detectar clientes inactivos
  const clientesInactivos = detectarClientesInactivos(clientStats);

  // Agrupar pedidos por mes para gráfico de tendencias
  const tendenciasMensuales = agruparPedidosPorMes(pedidosFiltrados);

  const totalIngresosFiltrados = useMemo(() => {
    return pedidosFiltrados.reduce((sum, p) => sum + parsePedidoValor(p), 0);
  }, [pedidosFiltrados]);

  const metricasOrigen = useMemo(() => {
    const base = {
      actual: { source: 'Pedidos en curso', cantidad: 0, total: 0 },
      jornada: { source: 'Jornadas cerradas', cantidad: 0, total: 0 }
    };

    pedidosFiltrados.forEach((pedido) => {
      const key = pedido.__source === 'jornada' ? 'jornada' : 'actual';
      base[key].cantidad += 1;
      base[key].total += parsePedidoValor(pedido);
    });

    return Object.values(base).map((item) => ({
      ...item,
      porcentajePedidos: pedidosFiltrados.length > 0 ? Math.round((item.cantidad / pedidosFiltrados.length) * 100) : 0,
      porcentajeIngresos: totalIngresosFiltrados > 0 ? Math.round((item.total / totalIngresosFiltrados) * 100) : 0
    }));
  }, [pedidosFiltrados, totalIngresosFiltrados]);

  const causasGlobales = useMemo(() => {
    const ventana = obtenerVentanaDias(filtroPeriodo) || 30;
    return explicarVariacion(pedidosFiltrados, ventana);
  }, [pedidosFiltrados, filtroPeriodo]);

  const causasClienteSeleccionado = useMemo(() => {
    if (!clienteSeleccionado) return null;
    const pedidosClienteRaw = (pedidosFiltrados || []).filter((p) => p.cliente === clienteSeleccionado.nombre);
    const ventana = obtenerVentanaDias(filtroPeriodo) || 30;
    return explicarVariacion(pedidosClienteRaw, ventana);
  }, [clienteSeleccionado, pedidosFiltrados, filtroPeriodo]);

  const comparativoPeriodos = useMemo(() => {
    if (!periodoAInicio || !periodoAFin || !periodoBInicio || !periodoBFin) return null;

    const inicioA = new Date(`${periodoAInicio}T00:00:00`);
    const finA = new Date(`${periodoAFin}T23:59:59`);
    const inicioB = new Date(`${periodoBInicio}T00:00:00`);
    const finB = new Date(`${periodoBFin}T23:59:59`);

    if (
      Number.isNaN(inicioA.getTime()) ||
      Number.isNaN(finA.getTime()) ||
      Number.isNaN(inicioB.getTime()) ||
      Number.isNaN(finB.getTime()) ||
      inicioA > finA ||
      inicioB > finB
    ) {
      return null;
    }

    const sourceMatch = (pedido) => filtroFuente === 'all' || pedido.__source === filtroFuente;

    const inRange = (pedido, from, to) => {
      const fecha = parsePedidoFecha(pedido);
      if (!fecha) return false;
      return fecha >= from && fecha <= to;
    };

    const periodoA = (pedidosHistoricos || []).filter((p) => sourceMatch(p) && inRange(p, inicioA, finA));
    const periodoB = (pedidosHistoricos || []).filter((p) => sourceMatch(p) && inRange(p, inicioB, finB));

    const ingresosA = periodoA.reduce((sum, p) => sum + parsePedidoValor(p), 0);
    const ingresosB = periodoB.reduce((sum, p) => sum + parsePedidoValor(p), 0);
    const pedidosA = periodoA.length;
    const pedidosB = periodoB.length;
    const ticketA = pedidosA > 0 ? Math.round(ingresosA / pedidosA) : 0;
    const ticketB = pedidosB > 0 ? Math.round(ingresosB / pedidosB) : 0;

    return {
      periodoA: { pedidos: pedidosA, ingresos: ingresosA, ticket: ticketA },
      periodoB: { pedidos: pedidosB, ingresos: ingresosB, ticket: ticketB },
      delta: {
        pedidos: calcularDelta(pedidosA, pedidosB),
        ingresos: calcularDelta(ingresosA, ingresosB),
        ticket: calcularDelta(ticketA, ticketB)
      }
    };
  }, [pedidosHistoricos, periodoAInicio, periodoAFin, periodoBInicio, periodoBFin, filtroFuente]);

  useEffect(() => {
    if (!clienteSeleccionado) return;
    const actualizado = clientStats.find((c) => c.nombre === clienteSeleccionado.nombre);
    if (!actualizado) {
      setClienteSeleccionado(null);
      return;
    }
    setClienteSeleccionado(actualizado);
  }, [clientStats]);

  const shouldShow = (section) => vistaMetrica === 'all' || vistaMetrica === section;

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
          <p className="text-gray-400">Análisis medible con trazabilidad de origen y explicación de causas</p>
        </div>
        <button
          onClick={cargarPedidosHistoricos}
          className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-[#1557b0] text-white rounded-lg transition-colors font-semibold"
        >
          <Download className="w-4 h-4" />
          Actualizar Datos
        </button>
      </div>

      {/* Filtros de inteligencia */}
      <div className="bg-dark-card border border-dark-border rounded-lg p-4 sm:p-6">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-bold text-white">Selecciona qué quieres ver</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <select
            value={filtroPeriodo}
            onChange={(e) => setFiltroPeriodo(e.target.value)}
            className="w-full px-4 py-3 bg-[#111827] border border-dark-border rounded-lg text-white"
          >
            <option value="7d">Últimos 7 días</option>
            <option value="30d">Últimos 30 días</option>
            <option value="90d">Últimos 90 días</option>
            <option value="365d">Últimos 12 meses</option>
            <option value="all">Todo el histórico</option>
          </select>

          <select
            value={filtroFuente}
            onChange={(e) => setFiltroFuente(e.target.value)}
            className="w-full px-4 py-3 bg-[#111827] border border-dark-border rounded-lg text-white"
          >
            <option value="all">Todas las fuentes</option>
            <option value="actual">Solo pedidos en curso</option>
            <option value="jornada">Solo jornadas cerradas</option>
          </select>

          <select
            value={vistaMetrica}
            onChange={(e) => setVistaMetrica(e.target.value)}
            className="w-full px-4 py-3 bg-[#111827] border border-dark-border rounded-lg text-white"
          >
            <option value="all">Ver todo</option>
            <option value="general">Vista general</option>
            <option value="origen">Origen de datos</option>
            <option value="causas">Causas de variación</option>
            <option value="riesgo">Riesgo / inactividad</option>
            <option value="clientes">Clientes y ranking</option>
          </select>
        </div>
      </div>

      {(shouldShow('general') || shouldShow('causas')) && (
        <div className="bg-dark-card border border-dark-border rounded-lg p-4 sm:p-6">
          <div className="flex items-center gap-2 mb-4">
            <Calendar className="w-5 h-5 text-primary" />
            <h3 className="text-lg font-bold text-white">Comparar dos periodos personalizados</h3>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
            <div className="bg-[#111827] border border-dark-border rounded-lg p-4">
              <p className="text-sm text-gray-400 mb-3">Periodo A (actual)</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  type="date"
                  value={periodoAInicio}
                  onChange={(e) => setPeriodoAInicio(e.target.value)}
                  className="w-full px-3 py-2 bg-dark-card border border-dark-border rounded-lg text-white"
                />
                <input
                  type="date"
                  value={periodoAFin}
                  onChange={(e) => setPeriodoAFin(e.target.value)}
                  className="w-full px-3 py-2 bg-dark-card border border-dark-border rounded-lg text-white"
                />
              </div>
            </div>

            <div className="bg-[#111827] border border-dark-border rounded-lg p-4">
              <p className="text-sm text-gray-400 mb-3">Periodo B (comparación)</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  type="date"
                  value={periodoBInicio}
                  onChange={(e) => setPeriodoBInicio(e.target.value)}
                  className="w-full px-3 py-2 bg-dark-card border border-dark-border rounded-lg text-white"
                />
                <input
                  type="date"
                  value={periodoBFin}
                  onChange={(e) => setPeriodoBFin(e.target.value)}
                  className="w-full px-3 py-2 bg-dark-card border border-dark-border rounded-lg text-white"
                />
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 mb-4">
            <button
              onClick={aplicarPresetMesActualVsPasado}
              className="px-3 py-2 bg-primary/20 hover:bg-primary/30 text-primary rounded-lg text-sm font-semibold transition-colors"
            >
              Este mes vs mes pasado
            </button>
            <button
              onClick={aplicarPresetTrimestreActualVsPasado}
              className="px-3 py-2 bg-primary/20 hover:bg-primary/30 text-primary rounded-lg text-sm font-semibold transition-colors"
            >
              Este trimestre vs trimestre pasado
            </button>
            <button
              onClick={() => aplicarPresetVentanas(7)}
              className="px-3 py-2 bg-[#111827] hover:bg-dark-bg text-white rounded-lg text-sm font-semibold transition-colors border border-dark-border"
            >
              Últimos 7 vs 7 anteriores
            </button>
            <button
              onClick={() => aplicarPresetVentanas(30)}
              className="px-3 py-2 bg-[#111827] hover:bg-dark-bg text-white rounded-lg text-sm font-semibold transition-colors border border-dark-border"
            >
              Últimos 30 vs 30 anteriores
            </button>
          </div>

          {comparativoPeriodos ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-[#111827] border border-dark-border rounded-lg p-4">
                <p className="text-sm text-gray-400">Pedidos</p>
                <p className="text-xl font-bold text-white mt-1">{comparativoPeriodos.periodoA.pedidos} vs {comparativoPeriodos.periodoB.pedidos}</p>
                <p className={`text-sm mt-1 ${comparativoPeriodos.delta.pedidos >= 0 ? 'text-success' : 'text-red-500'}`}>
                  {comparativoPeriodos.delta.pedidos >= 0 ? '+' : ''}{comparativoPeriodos.delta.pedidos}%
                </p>
              </div>

              <div className="bg-[#111827] border border-dark-border rounded-lg p-4">
                <p className="text-sm text-gray-400">Ingresos</p>
                <p className="text-xl font-bold text-white mt-1">
                  ${Math.round(comparativoPeriodos.periodoA.ingresos).toLocaleString()} vs ${Math.round(comparativoPeriodos.periodoB.ingresos).toLocaleString()}
                </p>
                <p className={`text-sm mt-1 ${comparativoPeriodos.delta.ingresos >= 0 ? 'text-success' : 'text-red-500'}`}>
                  {comparativoPeriodos.delta.ingresos >= 0 ? '+' : ''}{comparativoPeriodos.delta.ingresos}%
                </p>
              </div>

              <div className="bg-[#111827] border border-dark-border rounded-lg p-4">
                <p className="text-sm text-gray-400">Ticket Promedio</p>
                <p className="text-xl font-bold text-white mt-1">
                  ${comparativoPeriodos.periodoA.ticket.toLocaleString()} vs ${comparativoPeriodos.periodoB.ticket.toLocaleString()}
                </p>
                <p className={`text-sm mt-1 ${comparativoPeriodos.delta.ticket >= 0 ? 'text-success' : 'text-red-500'}`}>
                  {comparativoPeriodos.delta.ticket >= 0 ? '+' : ''}{comparativoPeriodos.delta.ticket}%
                </p>
              </div>
            </div>
          ) : (
            <div className="bg-warning/10 border border-warning rounded-lg p-4">
              <p className="text-sm text-warning">Revisa los rangos: la fecha de inicio debe ser menor o igual a la fecha final en ambos periodos.</p>
            </div>
          )}
        </div>
      )}

      {/* Estadísticas Generales */}
      {shouldShow('general') && (
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-dark-card border border-dark-border rounded-lg p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-primary/20 rounded-lg">
              <Package className="w-5 h-5 text-primary" />
            </div>
            <p className="text-sm text-gray-400">Total Pedidos</p>
          </div>
          <p className="text-3xl font-bold text-white">{pedidosFiltrados.length}</p>
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
            ${pedidosFiltrados.length > 0 
              ? Math.round(totalIngresosFiltrados / pedidosFiltrados.length).toLocaleString()
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
      )}

      {shouldShow('origen') && (
        <div className="bg-dark-card border border-dark-border rounded-lg p-6">
          <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <Database className="w-5 h-5 text-primary" />
            Trazabilidad: de dónde vienen los datos
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {metricasOrigen.map((item) => (
              <div key={item.source} className="bg-[#111827] border border-dark-border rounded-lg p-4">
                <p className="text-white font-semibold mb-2">{item.source}</p>
                <p className="text-sm text-gray-400">Pedidos: <span className="text-white">{item.cantidad}</span> ({item.porcentajePedidos}%)</p>
                <p className="text-sm text-gray-400">Ingresos: <span className="text-white">${Math.round(item.total).toLocaleString()}</span> ({item.porcentajeIngresos}%)</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {shouldShow('causas') && (
        <div className="bg-dark-card border border-dark-border rounded-lg p-6">
          <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <Target className="w-5 h-5 text-primary" />
            Por qué vienen los cambios
          </h3>
          <div className="bg-[#111827] border border-dark-border rounded-lg p-4 mb-4">
            <p className="text-white font-semibold">{causasGlobales.titulo}</p>
            <p className="text-sm text-gray-300 mt-1">{causasGlobales.detalle}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
              <p className="text-sm text-gray-400">Variación pedidos: <span className="text-white">{causasGlobales.ordersDelta}%</span></p>
              <p className="text-sm text-gray-400">Variación ticket: <span className="text-white">{causasGlobales.ticketDelta}%</span></p>
            </div>
          </div>
          {clienteSeleccionado && causasClienteSeleccionado && (
            <div className="bg-primary/10 border border-primary/30 rounded-lg p-4">
              <p className="text-white font-semibold">Causa para {clienteSeleccionado.nombre}</p>
              <p className="text-sm text-gray-300 mt-1">{causasClienteSeleccionado.detalle}</p>
            </div>
          )}
        </div>
      )}

      {/* Buscador de Cliente */}
      {shouldShow('clientes') && (
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
      )}

      {/* Alertas de Inactividad */}
      {shouldShow('riesgo') && clientesInactivos.length > 0 && (
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
      {shouldShow('clientes') && clienteSeleccionado && (
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
      {shouldShow('general') && (
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
      )}

      {/* Tabla de Todos los Clientes */}
      {shouldShow('clientes') && (
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
      )}
    </div>
  );
}
