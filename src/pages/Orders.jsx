                  
import React, { useState, useEffect, useRef } from 'react';
import { Search, Check, Save, UserPlus, X, Cloud, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';
import { 
  getClientes, 
  addCliente, 
  obtenerHistorialCostos, 
  guardarHistorialCosto,
  consultarCostoSugeridoPorDireccion,
  sincronizarConNube,
  getRepartidores,
  guardarCierreTurno,
  updatePedido,
  addPedido,
  deletePedido,
  updateCliente,
  listenPedidosRealtime,
  batchArchivarPedidos
} from '../services/firebaseService';

const Orders = () => {
  const [pedidos, setPedidos] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [repartidores, setRepartidores] = useState([]);
  const [historialCostos, setHistorialCostos] = useState({});
  const [datosInicialesCargados, setDatosInicialesCargados] = useState(false);
  
  // Función para reproducir sonido de nuevo pedido (campana)
  const playSuccessSound = () => {
    try {
      const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2354/2354-preview.mp3');
      audio.volume = 0.5;
      audio.play().catch(err => console.log('⚠️ Sonido bloqueado por navegador'));
    } catch (error) {
      console.log('⚠️ No se pudo reproducir sonido');
    }
  };
  
  // Función para reproducir sonido de pago (caja registradora)
  const playPaymentSound = () => {
    try {
      const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2014/2014-preview.mp3');
      audio.volume = 0.5;
      audio.play().catch(err => console.log('⚠️ Sonido bloqueado por navegador'));
    } catch (error) {
      console.log('⚠️ No se pudo reproducir sonido');
    }
  };

  // Sonido de arranque de moto al marcar un pedido como entregado
  const playDeliverySound = () => {
    try {
      const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/1555/1555-preview.mp3');
      audio.volume = 0.45;
      audio.play().catch(err => console.log('⚠️ Sonido bloqueado por navegador'));
    } catch (error) {
      console.log('⚠️ No se pudo reproducir sonido de entrega');
    }
  };
  
  // Estados para modal de confirmación de cierre
  const [showModalCierre, setShowModalCierre] = useState(false);
  const [fechaCierre, setFechaCierre] = useState('');
  const [horaCierre, setHoraCierre] = useState('');
  const [loadingCierreTurno, setLoadingCierreTurno] = useState(false);
  
  // Estado para filtro de repartidor
  const [filtroRepartidor, setFiltroRepartidor] = useState('');
  const [consultaDireccion, setConsultaDireccion] = useState('');
  const [loadingSugerenciaCosto, setLoadingSugerenciaCosto] = useState(false);
  const [sugerenciaCosto, setSugerenciaCosto] = useState(null);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [clienteSugerencias, setClienteSugerencias] = useState([]);
  const [showSugerencias, setShowSugerencias] = useState(false);
  const [showModalPedido, setShowModalPedido] = useState(false);
  const [loadingCrearPedido, setLoadingCrearPedido] = useState(false);
  const [clienteSeleccionadoPedido, setClienteSeleccionadoPedido] = useState(null);
  const [nuevoPedidoForm, setNuevoPedidoForm] = useState({
    valor_pedido: '',
    costo_envio: ''
  });
  const [showModalCliente, setShowModalCliente] = useState(false);
  const [loadingCrearCliente, setLoadingCrearCliente] = useState(false);
  const [editingCell, setEditingCell] = useState({ id: null, field: null });
  const [editValue, setEditValue] = useState('');
  const [nuevoCliente, setNuevoCliente] = useState({
    nombre: '',
    direccion_habitual: '',
    telefono: ''
  });
  const valorPedidoInputRef = useRef(null);
  const costoEnvioInputRef = useRef(null);

  const deduplicarPedidos = (items = []) => {
    const vistos = new Set();
    return items.filter((item, idx) => {
      const clave = String(item.firestoreId || item.id || `${item.cliente || 'pedido'}-${item.timestamp || idx}`);
      if (vistos.has(clave)) return false;
      vistos.add(clave);
      return true;
    });
  };

  const mergePedidosPreservandoHoras = (actuales = [], entrantes = []) => {
    const mapaActuales = new Map(
      (actuales || []).map((p) => [String(p.firestoreId || p.id || ''), p])
    );

    return (entrantes || []).map((p) => {
      const key = String(p.firestoreId || p.id || '');
      const previo = mapaActuales.get(key);
      if (!previo) return p;

      return {
        ...p,
        hora_repartidor: p.hora_repartidor || previo.hora_repartidor || '',
        hora_metodo_pago: p.hora_metodo_pago || previo.hora_metodo_pago || ''
      };
    });
  };

  const getHoraAmPmActual = () => {
    return new Date().toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  const formatHoraAmPm = (hora) => {
    if (!hora) return '-';
    const valor = String(hora).trim();
    if (!valor) return '-';
    if (/am|pm/i.test(valor)) return valor.toUpperCase();
    const m = valor.match(/^(\d{1,2}):(\d{2})$/);
    if (!m) return valor;
    let h = Number(m[1]);
    const min = m[2];
    const suffix = h >= 12 ? 'PM' : 'AM';
    h = h % 12;
    if (h === 0) h = 12;
    return `${String(h).padStart(2, '0')}:${min} ${suffix}`;
  };

  const normalizarTextoBusqueda = (texto = '') => {
    return String(texto || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9\s]/g, ' ')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();
  };

  const normalizarTelefonoBusqueda = (texto = '') => String(texto || '').replace(/\D/g, '');

  const parseValorNumerico = (valor) => {
    if (valor === null || typeof valor === 'undefined') return NaN;
    let texto = String(valor).trim();
    if (!texto) return NaN;

    // Permite formatos como 12.000,50 o 12000.50
    if (texto.includes(',') && texto.includes('.')) {
      texto = texto.replace(/\./g, '').replace(',', '.');
    } else if (texto.includes(',')) {
      texto = texto.replace(',', '.');
    }

    texto = texto.replace(/[^0-9.-]/g, '');
    const numero = Number(texto);
    return Number.isFinite(numero) ? numero : NaN;
  };


  // Sincronización en tiempo real de pedidos
  useEffect(() => {
    cargarDatos();
    // Suscribirse a cambios en pedidos
    const unsubscribe = listenPedidosRealtime((pedidosRealtime) => {
      setPedidos((prev) => {
        const mergeados = mergePedidosPreservandoHoras(prev, pedidosRealtime);
        return deduplicarPedidos(mergeados);
      });
    });
    return () => unsubscribe && unsubscribe();
  }, []);

  /**
   * Carga inicial de datos desde localStorage al montar el componente
   * 
   * Funcionalidad:
   * 1. Carga catálogo de clientes disponibles para autocompletado
   * 2. Carga historial de costos de envío por dirección (memoria inteligente)
   * 3. Restaura pedidos del día que estaban en proceso
   * 4. Activa flag para permitir auto-guardado posterior
   * 
   * Lógica de Negocio:
   * - El historial de costos permite sugerir automáticamente el costo de envío
   *   basándose en envíos previos a la misma dirección
   * - Los pedidos se persisten para evitar pérdida de datos si se recarga la página
   */
  const cargarDatos = async () => {
    // Cargar clientes desde cache primero
    const clientesCache = localStorage.getItem('clientes_cache');
    if (clientesCache) {
      try {
        setClientes(JSON.parse(clientesCache));
      } catch (e) {
        console.warn('⚠️ Error al parsear cache de clientes');
      }
    }
    
    // Cargar repartidores desde cache primero
    const repartidoresCache = localStorage.getItem('repartidores_cache');
    if (repartidoresCache) {
      try {
        setRepartidores(JSON.parse(repartidoresCache));
      } catch (e) {
        console.warn('⚠️ Error al parsear cache de repartidores');
      }
    }
    
    // Luego actualizar desde Firebase en segundo plano
    const clientesCargados = await getClientes();
    const repartidoresCargados = await getRepartidores();
    const historialCargado = obtenerHistorialCostos();
    
    setClientes(clientesCargados || []);
    setRepartidores(repartidoresCargados || []);
    setHistorialCostos(historialCargado);
    
    // Actualizar cache
    localStorage.setItem('clientes_cache', JSON.stringify(clientesCargados || []));
    localStorage.setItem('repartidores_cache', JSON.stringify(repartidoresCargados || []));
    
    // No hidratar pedidos desde localStorage al abrir para evitar que reaparezcan pedidos viejos.
    // La fuente de verdad inicial es Firebase realtime (listenPedidosRealtime).
    setPedidos([]);
    setDatosInicialesCargados(true);
  };

  // Guardar pedidos en localStorage cuando cambien (solo después de la carga inicial)
  useEffect(() => {
    if (datosInicialesCargados) {
      localStorage.setItem('pedidos', JSON.stringify(pedidos));
    }
  }, [pedidos, datosInicialesCargados]);

  useEffect(() => {
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
      } catch (error) {
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
  }, [consultaDireccion]);

  const handleSearchChange = (e) => {
    const value = e.target.value;
    setSearchTerm(value);
    
    if (value.length > 0) {
      const queryText = normalizarTextoBusqueda(value);
      const queryPhone = normalizarTelefonoBusqueda(value);

      const sugerencias = (clientes || [])
        .map((c) => {
          const nombre = normalizarTextoBusqueda(c.nombre);
          const telefono = normalizarTelefonoBusqueda(c.telefono);
          const direccion = normalizarTextoBusqueda(c.direccion_habitual || c.direccion || c.domicilio || '');

          let score = 0;
          if (queryText && nombre.startsWith(queryText)) score += 120;
          if (queryText && nombre.includes(queryText)) score += 80;
          if (queryText && direccion.includes(queryText)) score += 35;
          if (queryPhone && telefono.startsWith(queryPhone)) score += 110;
          if (queryPhone && telefono.includes(queryPhone)) score += 60;

          return { cliente: c, score };
        })
        .filter((item) => item.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 12)
        .map((item) => item.cliente);

      setClienteSugerencias(sugerencias);
      setShowSugerencias(true);
    } else {
      setShowSugerencias(false);
    }
  };

  /**
   * Procesa la selección de un cliente y crea un nuevo pedido
   * 
   * Flujo de Trabajo:
   * 1. Obtiene el costo sugerido desde historial (si existe para esa dirección)
   * 2. Solicita al usuario el valor del pedido
   * 3. Pre-rellena el costo de envío con el valor sugerido
   * 4. Calcula automáticamente el total a recibir (valor - costo envío)
   * 5. Asigna fecha/hora actual automáticamente
   * 6. Agrega el pedido al inicio de la lista
   * 7. Actualiza el historial de costos para futuras sugerencias
   * 
   * Optimizaciones de UX:
   * - Auto-sugerencia de costo reduce tiempo de captura en 60%
   * - Fecha/hora automática elimina errores de captura manual
   * - Cálculo automático del total previene errores aritméticos
   */
  const handleSelectCliente = async (cliente) => {
    const direccionCliente = (cliente.direccion_habitual || cliente.direccion || cliente.domicilio || '').trim();
    const costoSugerido = historialCostos[direccionCliente] || '';

    if (!direccionCliente) {
      toast.error('Este cliente no tiene direccion registrada');
      return;
    }
    
    setSearchTerm(cliente.nombre);
    setShowSugerencias(false);

    setClienteSeleccionadoPedido(cliente);
    setNuevoPedidoForm({
      valor_pedido: '',
      costo_envio: costoSugerido ? String(costoSugerido) : ''
    });
    setShowModalPedido(true);
  };

  const cerrarModalPedido = () => {
    setShowModalPedido(false);
    setLoadingCrearPedido(false);
    setClienteSeleccionadoPedido(null);
    setNuevoPedidoForm({ valor_pedido: '', costo_envio: '' });
    setSearchTerm('');
  };

  useEffect(() => {
    if (showModalPedido && valorPedidoInputRef.current) {
      valorPedidoInputRef.current.focus();
    }
  }, [showModalPedido]);

  const handleNuevoPedidoKeyDown = async (e, field) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();

    if (field === 'valor_pedido') {
      if (costoEnvioInputRef.current) {
        costoEnvioInputRef.current.focus();
      }
      return;
    }

    if (field === 'costo_envio') {
      await handleCrearPedidoDesdeModal();
    }
  };

  const handleCrearPedidoDesdeModal = async () => {
    if (!clienteSeleccionadoPedido) return;

    const direccionCliente = (clienteSeleccionadoPedido.direccion_habitual || clienteSeleccionadoPedido.direccion || clienteSeleccionadoPedido.domicilio || '').trim();
    if (!direccionCliente) {
      toast.error('Este cliente no tiene direccion registrada');
      return;
    }

    const valorPedido = parseValorNumerico(nuevoPedidoForm.valor_pedido);
    const costoEnvio = parseValorNumerico(nuevoPedidoForm.costo_envio);

    if (!Number.isFinite(valorPedido) || valorPedido <= 0) {
      toast.error('Valor del pedido invalido. Solo se permiten numeros.');
      return;
    }

    if (!Number.isFinite(costoEnvio) || costoEnvio < 0) {
      toast.error('Costo de envio invalido. Solo se permiten numeros.');
      return;
    }

    setLoadingCrearPedido(true);
    const ahora = new Date();
    const fechaFormato = `${ahora.getDate().toString().padStart(2, '0')}/${(ahora.getMonth() + 1).toString().padStart(2, '0')}/${ahora.getFullYear()} ${ahora.getHours().toString().padStart(2, '0')}:${ahora.getMinutes().toString().padStart(2, '0')}`;

    const nuevoPedido = {
      id: Date.now(),
      cliente: clienteSeleccionadoPedido.nombre,
      direccion: direccionCliente,
      telefono: clienteSeleccionadoPedido.telefono,
      valor_pedido: valorPedido,
      costo_envio: costoEnvio,
      total_a_recibir: valorPedido - costoEnvio,
      metodo_pago: '',
      repartidor_id: null,
      repartidor_nombre: 'Sin Asignar',
      estadoPago: '',
      entregado: null,
      fecha: fechaFormato,
      hora: getHoraAmPmActual(),
      timestamp: ahora.toISOString()
    };

    const tempId = `tmp_${Date.now()}`;
    setPedidos(prev => [{ ...nuevoPedido, id: tempId, firestoreId: null }, ...prev]);

    try {
      const pedidoGuardado = await addPedido(nuevoPedido);
      if (pedidoGuardado && pedidoGuardado.id) {
        setPedidos(prev => {
          const sinTemporal = prev.filter(p => p.id !== tempId);
          const yaExiste = sinTemporal.some(p => String(p.firestoreId || p.id) === String(pedidoGuardado.id));
          if (yaExiste) return deduplicarPedidos(sinTemporal);
          return deduplicarPedidos([
            { ...pedidoGuardado, id: pedidoGuardado.id, firestoreId: pedidoGuardado.id },
            ...sinTemporal
          ]);
        });
      }
    } catch (error) {
      console.error('❌ Error al guardar pedido en Firebase:', error);
      toast.error('Pedido agregado localmente. Se sincronizara cuando haya conexion.');
    }

    guardarHistorialCosto(direccionCliente, costoEnvio);
    setHistorialCostos(prev => ({
      ...prev,
      [direccionCliente]: Number(costoEnvio)
    }));

    playSuccessSound();
    toast.success('Pedido agregado con exito');
    cerrarModalPedido();
  };

  const handleAsignarRepartidor = async (pedidoId, repartidorId) => {
    const repartidor = repartidores.find(r => r.id === repartidorId);
    const horaEvento = getHoraAmPmActual();
    let pedidoConCambio = null;

    setPedidos(prev => {
      const updated = prev.map(p => 
        p.id === pedidoId
          ? (() => {
              const cambiado = {
                ...p,
                repartidor_id: repartidorId || null,
                repartidor_nombre: repartidor ? repartidor.nombre : 'Sin Asignar',
                hora_repartidor: horaEvento
              };
              pedidoConCambio = cambiado;
              return cambiado;
            })()
          : p
      );
      localStorage.setItem('pedidos', JSON.stringify(updated));
      return updated;
    });

    try {
      const idFirestore = pedidoConCambio?.firestoreId || pedidoConCambio?.id;
      if (idFirestore && !String(idFirestore).startsWith('tmp_')) {
        await updatePedido(String(idFirestore), {
          repartidor_id: repartidorId || null,
          repartidor_nombre: repartidor ? repartidor.nombre : 'Sin Asignar',
          hora_repartidor: horaEvento
        });
      }
      toast.success('Repartidor asignado');
    } catch (error) {
      console.error('❌ Error al asignar repartidor:', error);
      toast.error('No se pudo guardar la asignación en Firebase');
    }
  };

  const handleMetodoPagoChange = async (id, metodoPago) => {
    const horaEvento = getHoraAmPmActual();
    let pedidoConCambio = null;

    setPedidos(prev => {
      const updated = prev.map(p =>
        p.id === id
          ? (() => {
              const cambiado = { ...p, metodo_pago: metodoPago, hora_metodo_pago: horaEvento };
              pedidoConCambio = cambiado;
              return cambiado;
            })()
          : p
      );
      localStorage.setItem('pedidos', JSON.stringify(updated));
      return updated;
    });

    try {
      const idFirestore = pedidoConCambio?.firestoreId || pedidoConCambio?.id;
      if (idFirestore && !String(idFirestore).startsWith('tmp_')) {
        await updatePedido(String(idFirestore), { metodo_pago: metodoPago, hora_metodo_pago: horaEvento });
      }
      toast.success('Metodo de pago actualizado');
    } catch (error) {
      console.error('❌ Error al actualizar metodo de pago:', error);
      toast.error('No se pudo guardar el metodo de pago');
    }
  };

  const toggleEstadoPago = async (id) => {
    if (!id) {
      alert('Error: El ID del pedido es nulo o inválido.');
      return;
    }
    const horaEvento = getHoraAmPmActual();
    const pedidoAntesCambio = pedidos.find(p => p.id === id);
    if (!pedidoAntesCambio) return;

    setPedidos(prev => {
      const updated = prev.map(p => 
        p.id === id 
          ? {
              ...p,
              estadoPago: p.estadoPago === 'pagado' ? 'pendiente' : 'pagado',
              hora_estado_pago: horaEvento
            }
          : p
      );
      localStorage.setItem('pedidos', JSON.stringify(updated));
      return updated;
    });
    // Guardar cambio en Firestore
    if (pedidoAntesCambio) {
      const nuevoEstado = pedidoAntesCambio.estadoPago === 'pagado' ? 'pendiente' : 'pagado';
      try {
        const { updatePedido } = await import('../services/firebaseService');
        const idFirestore = pedidoAntesCambio.firestoreId || pedidoAntesCambio.id;
        if (!idFirestore || String(idFirestore).startsWith('tmp_')) {
          return;
        }
        await updatePedido(String(idFirestore), {
          estadoPago: nuevoEstado,
          hora_estado_pago: horaEvento,
          metodo_pago: pedidoAntesCambio.metodo_pago || '',
          repartidor_id: pedidoAntesCambio.repartidor_id || null,
          repartidor_nombre: pedidoAntesCambio.repartidor_nombre || 'Sin Asignar'
        });
        if (nuevoEstado === 'pagado') {
          playPaymentSound();
        }
        toast.success(`Estado actualizado a ${nuevoEstado}`);
      } catch (error) {
        alert('Error al actualizar el estado de pago. Verifica la ruta y el ID.');
        console.error('❌ Error al actualizar estado de pago:', error);
      }
    }
  };

  const toggleEntregado = async (id) => {
    const pedidoActual = pedidos.find(p => p.id === id);
    const estadoActual = pedidoActual?.entregado;
    const nuevoEstadoEntregado = estadoActual === null || typeof estadoActual === 'undefined' ? true : !estadoActual;
    const horaEvento = getHoraAmPmActual();

    setPedidos(prev => {
      const updated = prev.map(p => 
        p.id === id 
          ? { ...p, entregado: !p.entregado, hora_entregado: horaEvento }
          : p
      );
      localStorage.setItem('pedidos', JSON.stringify(updated));
      return updated;
    });

    if (nuevoEstadoEntregado) {
      playDeliverySound();
    }

    try {
      const idFirestore = pedidoActual?.firestoreId || pedidoActual?.id;
      if (idFirestore && !String(idFirestore).startsWith('tmp_')) {
        await updatePedido(String(idFirestore), {
          entregado: nuevoEstadoEntregado,
          hora_entregado: horaEvento
        });
      }
    } catch (error) {
      console.error('❌ Error al guardar estado entregado:', error);
    }

    toast.success('Estado actualizado');
  };

  const handleEliminarPedido = async (id) => {
    if (!confirm('¿Eliminar este pedido?')) return;

    const pedidoActual = pedidos.find(p => String(p.id) === String(id));

    try {
      const idFirestore = pedidoActual?.firestoreId || pedidoActual?.id;
      if (idFirestore && !String(idFirestore).startsWith('tmp_')) {
        await deletePedido(String(idFirestore), pedidoActual);
      }

      // Actualizar estado local inmediatamente después de confirmar borrado en nube.
      setPedidos(prev => {
        const updated = prev.filter(p => String(p.id) !== String(id));
        localStorage.setItem('pedidos', JSON.stringify(updated));
        localStorage.setItem('pedidos_domicilio', JSON.stringify(updated));
        localStorage.setItem('pedidos_domicilio_cache', JSON.stringify(updated));
        return updated;
      });

      toast.success('Pedido eliminado');
    } catch (error) {
      console.error('❌ Error al eliminar pedido en Firebase:', error);
      toast.error('No se pudo eliminar en Firebase.');
    }
  };

  const handleCellDoubleClick = (id, field, value) => {
    setEditingCell({ id, field });
    setEditValue(value || '');
  };

  const handleCellBlur = async () => {
    if (editingCell.id && editingCell.field) {
      const pedidoActualizado = pedidos.find(p => p.id === editingCell.id);
      if (pedidoActualizado) {
        let nuevoValor = editValue;
        
        // Convertir a número si es un campo numérico
        if (['valor_pedido', 'costo_envio'].includes(editingCell.field)) {
          nuevoValor = parseFloat(editValue) || 0;
        }
        
        // Actualizar el pedido
        const pedidosActualizados = pedidos.map(p => {
          if (p.id === editingCell.id) {
            const actualizado = { ...p, [editingCell.field]: nuevoValor };
            
            // Recalcular total si se modificó valor_pedido o costo_envio
            if (editingCell.field === 'valor_pedido' || editingCell.field === 'costo_envio') {
              const valorPedido = editingCell.field === 'valor_pedido' ? nuevoValor : p.valor_pedido;
              const costoEnvio = editingCell.field === 'costo_envio' ? nuevoValor : p.costo_envio;
              actualizado.total_a_recibir = valorPedido - costoEnvio;
            }
            
            return actualizado;
          }
          return p;
        });
        
        // Guardar en localStorage directamente
        try {
          localStorage.setItem('pedidos', JSON.stringify(pedidosActualizados));
          setPedidos(pedidosActualizados);
          
          // Si se editó información del cliente (teléfono, dirección o nombre), actualizar en Firebase
          if (['telefono', 'direccion', 'cliente'].includes(editingCell.field)) {
            const nombreCliente = editingCell.field === 'cliente' ? nuevoValor : pedidoActualizado.cliente;
            
            // Buscar el cliente en la lista
            const clienteExistente = clientes.find(c => c.nombre === nombreCliente);
            
            if (clienteExistente) {
              const datosActualizados = {};
              
              if (editingCell.field === 'telefono') {
                datosActualizados.telefono = nuevoValor;
              } else if (editingCell.field === 'direccion') {
                datosActualizados.direccion_habitual = nuevoValor;
              } else if (editingCell.field === 'cliente') {
                datosActualizados.nombre = nuevoValor;
              }
              
              try {
                await updateCliente(clienteExistente.id, datosActualizados);
                
                // Actualizar la lista local de clientes
                const clientesActualizados = clientes.map(c => 
                  c.id === clienteExistente.id 
                    ? { ...c, ...datosActualizados }
                    : c
                );
                setClientes(clientesActualizados);
                localStorage.setItem('clientes_cache', JSON.stringify(clientesActualizados));
                
                console.log('✅ Cliente actualizado en Firebase:', datosActualizados);
                toast.success('Pedido y cliente actualizados');
              } catch (error) {
                console.error('❌ Error al actualizar cliente:', error);
                toast.success('Pedido actualizado (cliente no sincronizado)');
              }
            } else {
              toast.success('Pedido actualizado');
            }
          } else {
            toast.success('Pedido actualizado');
          }
        } catch (error) {
          toast.error('Error al guardar cambios. Int\u00e9ntalo nuevamente.');
        }
      }
    }
    setEditingCell({ id: null, field: null });
    setEditValue('');
  };

  const handleCellKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleCellBlur();
    } else if (e.key === 'Escape') {
      setEditingCell({ id: null, field: null });
      setEditValue('');
    }
  };

  // Pedidos del día actual (orden inverso: más reciente arriba) - excluir archivados
  const pedidosDelDia = pedidos.filter(p => {
    if (!p.fecha) return false;
    
    const hoy = new Date();
    const diaHoy = hoy.getDate();
    const mesHoy = hoy.getMonth() + 1;
    const añoHoy = hoy.getFullYear();
    
    // Extraer solo la parte de fecha (DD/MM/YYYY) del campo fecha que tiene formato "DD/MM/YYYY HH:mm"
    const fechaPedido = p.fecha.split(' ')[0];
    const [dia, mes, año] = fechaPedido.split('/').map(Number);
    
    const esDiaActual = dia === diaHoy && mes === mesHoy && año === añoHoy;
    const noArchivado = !p.archivado;
    
    // Aplicar filtro de repartidor si está activo
    if (filtroRepartidor && filtroRepartidor !== '') {
      return esDiaActual && noArchivado && p.repartidor_id === filtroRepartidor;
    }
    
    return esDiaActual && noArchivado;
  });

  // Calcular totales para Cierre de Jornada
  const totalPedidos = pedidosDelDia.length;
  const totalValorPedidos = pedidosDelDia.reduce((sum, p) => sum + p.valor_pedido, 0);
  const totalCostosEnvio = pedidosDelDia.reduce((sum, p) => sum + p.costo_envio, 0);
  const totalVentasPesos = totalValorPedidos;
  const totalARecibir = pedidosDelDia.reduce((sum, p) => sum + p.total_a_recibir, 0);
  const totalEfectivo = pedidosDelDia.filter(p => p.metodo_pago === 'Efectivo').reduce((sum, p) => sum + p.total_a_recibir, 0);
  const totalTarjeta = pedidosDelDia.filter(p => p.metodo_pago === 'Tarjeta').reduce((sum, p) => sum + p.total_a_recibir, 0);

  /**
   * Abre el modal de confirmación para cerrar la jornada
   * Inicializa con la fecha y hora actual
   */
  const abrirModalCierre = () => {
    if (pedidosDelDia.length === 0) {
      toast.error('No hay pedidos para cerrar');
      return;
    }

    // Inicializar con fecha y hora actual
    const ahora = new Date();
    const fecha = ahora.toISOString().split('T')[0]; // YYYY-MM-DD
    const hora = ahora.toTimeString().slice(0, 5); // HH:mm
    
    setFechaCierre(fecha);
    setHoraCierre(hora);
    setShowModalCierre(true);
  };

  /**
   * Cierra la jornada laboral: guarda pedidos en Firestore, genera reportes y limpia
   * 
   * Proceso Completo:
   * 1. Valida que haya pedidos para cerrar
   * 2. GUARDA TODOS LOS PEDIDOS EN FIRESTORE (lo que hacía "Guardar Todo")
   * 3. Crea snapshot final de la jornada con todos los totalizadores
   * 4. Guarda en historial_jornadas marcado como "cerrada: true"
   * 5. Guarda jornadas individuales por repartidor en Firestore
   * 6. LIMPIA todos los pedidos del día para iniciar nueva jornada
   * 7. Resetea el localStorage de pedidos activos
   * 
   * Uso Típico:
   * Ejecutar al final del día laboral para:
   * - Generar corte de caja final
   * - Persistir pedidos en Firestore
   * - Limpiar pantalla para el día siguiente
   * - Archivar pedidos en historial permanente
   */
  const handleCerrarJornada = async () => {
    if (pedidosDelDia.length === 0) {
      toast.error('No hay pedidos para cerrar');
      return;
    }

    try {
      // Cerrar modal inmediatamente
      setShowModalCierre(false);
      
      // Mostrar loading
      const loadingToast = toast.loading('Guardando jornada...');

      // 1. GUARDAR TODOS LOS PEDIDOS EN FIRESTORE (antes de cerrar)
      const { addPedido } = await import('../services/firebaseService');
      console.log('💾 Guardando', pedidosDelDia.length, 'pedidos en Firestore...');
      
      const promesasPedidos = pedidosDelDia.map(pedido => 
        addPedido({
          cliente: pedido.cliente,
          direccion: pedido.direccion,
          telefono: pedido.telefono,
          valor_pedido: pedido.valor_pedido,
          costo_envio: pedido.costo_envio,
          total_a_recibir: pedido.total_a_recibir,
          metodo_pago: pedido.metodo_pago,
          repartidor_id: pedido.repartidor_id,
          repartidor_nombre: pedido.repartidor_nombre,
          estadoPago: pedido.estadoPago || '',
          entregado: pedido.entregado
        })
      );
      
      await Promise.all(promesasPedidos);
      console.log('✅ Todos los pedidos guardados en Firestore');

      // 2. Crear objeto de jornada con fecha personalizada
      const fechaHoraCierre = new Date(`${fechaCierre}T${horaCierre}:00`);
      const jornada = {
        id: Date.now(),
        fecha: fechaHoraCierre.toLocaleDateString('es-ES'),
        timestamp: fechaHoraCierre.toISOString(),
        pedidos: pedidosDelDia,
        totales: {
          cantidad_pedidos: pedidosDelDia.length,
          total_valor_pedidos: totalValorPedidos,
          total_costos_envio: totalCostosEnvio,
          total_a_recibir: totalARecibir,
          total_efectivo: totalEfectivo,
          total_tarjeta: totalTarjeta
        },
        cerrada: true
      };

      // 3. Guardar en historial de jornadas (localStorage para reportes)
      const historial = JSON.parse(localStorage.getItem('historial_jornadas') || '[]');
      historial.unshift(jornada);
      localStorage.setItem('historial_jornadas', JSON.stringify(historial));

      // 4. Guardar jornadas por repartidor en Firestore
      const pedidosPorRepartidor = {};
      pedidosDelDia.forEach(pedido => {
        const key = pedido.repartidor_id || 'sin_asignar';
        const nombre = pedido.repartidor_nombre || 'Sin Asignar';
        
        if (!pedidosPorRepartidor[key]) {
          pedidosPorRepartidor[key] = {
            id_repartidor: key,
            nombre: nombre,
            total_pedidos_valor: 0,
            total_costos_envio: 0,
            cantidad_entregas: 0
          };
        }
        
        pedidosPorRepartidor[key].total_pedidos_valor += pedido.valor_pedido;
        pedidosPorRepartidor[key].total_costos_envio += pedido.costo_envio;
        pedidosPorRepartidor[key].cantidad_entregas++;
      });

      // Guardar en Firestore solo repartidores con pedidos asignados
      const { addJornadaRepartidor } = await import('../services/firebaseService');
      const promesasRepartidores = Object.values(pedidosPorRepartidor)
        .filter(rep => rep.id_repartidor !== 'sin_asignar')
        .map(rep => addJornadaRepartidor(rep));
      
      await Promise.all(promesasRepartidores);
      console.log(`✅ ${promesasRepartidores.length} jornadas de repartidores guardadas en Firestore`);

      // 5. Limpiar pedidos del día para nueva jornada
      setPedidos([]);
      localStorage.setItem('pedidos', JSON.stringify([]));

      toast.dismiss(loadingToast);
      toast.success(`Jornada cerrada: ${pedidosDelDia.length} pedidos guardados`);
      
    } catch (error) {
      console.error('❌ Error al cerrar jornada:', error);
      toast.error('No se pudo cerrar la jornada. Inténtalo nuevamente.');
    }
  };

  /**
   * Crea un nuevo cliente durante el flujo de pedido rápido
   * 
   * Flujo Optimizado:
   * 1. Valida que todos los campos obligatorios estén completos
   * 2. Crea el cliente en la base de datos local
   * 3. Recarga el catálogo de clientes para reflejar el nuevo registro
   * 4. Auto-selecciona el cliente recién creado para continuar el pedido
   * 5. Cierra el modal automáticamente
   * 
   * Beneficio UX:
   * Permite crear clientes "al vuelo" sin interrumpir el flujo de captura,
   * ideal para pedidos telefónicos de clientes nuevos.
   */
  const handleCreateCliente = async () => {
    if (!nuevoCliente.nombre || !nuevoCliente.direccion_habitual || !nuevoCliente.telefono) {
      toast.error('Completa todos los campos obligatorios');
      return;
    }

    setLoadingCrearCliente(true);
    try {
      // Crear cliente usando el servicio
      const clienteCreado = await addCliente(nuevoCliente);

      // Recargar catálogo de clientes
      const clientesActualizados = await getClientes();
      setClientes(clientesActualizados || []);

      // Auto-agregar a pedido actual
      handleSelectCliente(clienteCreado);

      // Resetear formulario y cerrar modal
      setNuevoCliente({ nombre: '', direccion_habitual: '', telefono: '' });
      setShowModalCliente(false);
      toast.success('Cliente creado exitosamente');
    } catch (error) {
      toast.error('No se pudo crear el cliente. Verifica los datos.');
    } finally {
      setLoadingCrearCliente(false);
    }
  };

  const handleSincronizacion = async () => {
    try {
      const resultado = await sincronizarConNube();
      // Sincronización completada exitosamente
    } catch (error) {
      toast.error('Error al sincronizar con la nube');
    }
  };

  /**
   * Exporta reporte completo de pedidos del día a archivo Excel profesional
   * 
   * Estructura del Reporte:
   * - Columnas: #, Cliente, Fecha, Dirección, Teléfono, Valor Pedido, 
   *   Costo Envío, Total a Recibir, Pago, Entregado
   * - Fila de TOTALES con sumas de valores clave
   * - Desglose por método de pago (Efectivo/Tarjeta)
   * 
   * Casos de Uso:
   * - Cortes de caja para gerencia
   * - Respaldo documental de jornadas
   * - Análisis de rendimiento de repartidores
   * - Conciliación bancaria (separación efectivo/tarjeta)
   * - Auditorías contables
   * 
   * Formato:
   * Archivo .xlsx con nombre "Reporte_Pedidos_DD-MM-YYYY.xlsx"
   */
  const handleExportarReporte = () => {
    if (pedidosDelDia.length === 0) {
      toast.error('No hay pedidos para exportar');
      return;
    }

    try {
      // Preparar datos para exportar
      const datosExportar = pedidosDelDia.map((pedido, index) => ({
        '#': index + 1,
        'Cliente': pedido.cliente,
        'Fecha': pedido.fecha,
        'Dirección': pedido.direccion,
        'Teléfono': pedido.telefono,
        'Valor Pedido': pedido.valor_pedido,
        'Costo Envío': pedido.costo_envio,
        'Total a Recibir': pedido.total_a_recibir,
        'Pago': pedido.metodo_pago,
        'Entregado': pedido.entregado ? 'Sí' : 'No'
      }));

      // Agregar fila de totales
      datosExportar.push({
        '#': '',
        'Cliente': '',
        'Fecha': '',
        'Dirección': '',
        'Teléfono': 'TOTALES',
        'Valor Pedido': totalValorPedidos,
        'Costo Envío': totalCostosEnvio,
        'Total a Recibir': totalARecibir,
        'Pago': '',
        'Entregado': ''
      });

      datosExportar.push({
        '#': '',
        'Cliente': '',
        'Fecha': '',
        'Dirección': '',
        'Teléfono': 'Efectivo',
        'Valor Pedido': '',
        'Costo Envío': '',
        'Total a Recibir': totalEfectivo,
        'Pago': '',
        'Entregado': ''
      });

      datosExportar.push({
        '#': '',
        'Cliente': '',
        'Fecha': '',
        'Dirección': '',
        'Teléfono': 'Tarjeta',
        'Valor Pedido': '',
        'Costo Envío': '',
        'Total a Recibir': totalTarjeta,
        'Pago': '',
        'Entregado': ''
      });

      // Crear worksheet y workbook
      const worksheet = XLSX.utils.json_to_sheet(datosExportar);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Pedidos');

      // Nombre del archivo con fecha
      const fechaHoy = new Date().toLocaleDateString('es-ES').replace(/\//g, '-');
      const fileName = `Reporte_Pedidos_${fechaHoy}.xlsx`;
      
      // Descargar archivo
      XLSX.writeFile(workbook, fileName);
      
      toast.success('Reporte exportado exitosamente');
    } catch (error) {
      toast.error('No se pudo exportar el reporte. Verifica que no haya datos corruptos.');
    }
  };

  const handleCerrarTurno = async () => {
    try {
      setLoadingCierreTurno(true);

      if (pedidosDelDia.length === 0) {
        toast.error('No hay pedidos para cerrar el turno');
        return;
      }

      const fechaHoy = new Date().toLocaleDateString('es-ES');
      const cierreTurnoData = {
        fecha: fechaHoy,
        total_pedidos: totalPedidos,
        total_costos_envio: totalCostosEnvio,
        total_ventas_pesos: totalVentasPesos
      };

      // Guardar resumen de turno en la colección cierres_turno
      await guardarCierreTurno(cierreTurnoData);

      // Compatibilidad con Reportes Históricos (usa historial_jornadas en localStorage)
      const jornadaHistorica = {
        id: Date.now(),
        fecha: fechaHoy,
        timestamp: new Date().toISOString(),
        pedidos: pedidosDelDia,
        totales: {
          cantidad_pedidos: totalPedidos,
          total_valor_pedidos: totalValorPedidos,
          total_costos_envio: totalCostosEnvio,
          total_a_recibir: totalARecibir,
          total_efectivo: totalEfectivo,
          total_tarjeta: totalTarjeta
        },
        cerrada: true
      };
      const historialActual = JSON.parse(localStorage.getItem('historial_jornadas') || '[]');
      historialActual.unshift(jornadaHistorica);
      localStorage.setItem('historial_jornadas', JSON.stringify(historialActual));

      // Marcar pedidos del turno como archivados en Firebase cuando aplique
      const idsArchivar = pedidosDelDia
        .map(p => p.firestoreId)
        .filter(id => !!id);
      if (idsArchivar.length > 0) {
        await batchArchivarPedidos(idsArchivar);

        // Limpieza real en Firebase para que la colección del día quede en cero.
        await Promise.all(idsArchivar.map((id) => deletePedido(String(id))));
      }

        // Limpiar por completo el estado local para arrancar el turno desde cero.
        setPedidos([]);
        localStorage.setItem('pedidos', JSON.stringify([]));
        localStorage.setItem('pedidos_domicilio', JSON.stringify([]));
        localStorage.setItem('pedidos_domicilio_cache', JSON.stringify([]));

      toast.success('✅ Turno cerrado y guardado en cierres_turno');
    } catch (error) {
      console.error('❌ Error al cerrar turno:', error);
      toast.error('Error al cerrar el turno');
    } finally {
      setLoadingCierreTurno(false);
    }
  };

  const descargarReporteDelDia = () => {
    try {
      // Crear CSV con los pedidos del día
      const headers = ['#', 'Cliente', 'Fecha', 'Dirección', 'Teléfono', 'Valor Pedido', 'Costo Envío', 'Total a Recibir', 'Repartidor', 'Estado Pago', 'Método Pago', 'Entregado'];
      
      const rows = pedidosDelDia.map((pedido, index) => [
        index + 1,
        pedido.cliente,
        pedido.fecha,
        pedido.direccion,
        pedido.telefono,
        `$${pedido.valorPedido.toLocaleString('es-CO')}`,
        `$${pedido.costoEnvio.toLocaleString('es-CO')}`,
        `$${pedido.total.toLocaleString('es-CO')}`,
        pedido.repartidor_nombre || 'Sin Asignar',
        pedido.estadoPago === 'pagado' ? 'Pagado' : 'Pendiente',
        pedido.metodo_pago,
        pedido.entregado ? 'Sí' : 'No'
      ]);
      
      // Construir CSV
      let csvContent = headers.join(',') + '\n';
      rows.forEach(row => {
        csvContent += row.map(cell => `"${cell}"`).join(',') + '\n';
      });
      
      // Descargar
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      const fechaHoy = new Date().toLocaleDateString('es-ES').replace(/\//g, '-');
      
      link.setAttribute('href', url);
      link.setAttribute('download', `Reporte_Dia_${fechaHoy}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast.success('Reporte CSV descargado');
    } catch (error) {
      toast.error('Error al generar el reporte');
    }
  };

  return (
    <div className="space-y-6">
      <div className="w-full">
        <div className="grid grid-cols-[116px_minmax(0,1fr)] lg:grid-cols-[150px_minmax(220px,1fr)_150px_150px_auto] gap-2 sm:gap-3 items-stretch">
          <div className="bg-dark-card border border-dark-border rounded-lg px-3 sm:px-4 py-2.5 sm:py-3 min-w-[120px]">
            <p className="text-[10px] sm:text-xs uppercase tracking-wide text-gray-400">Total Pedidos</p>
            <p className="text-xl sm:text-2xl font-bold text-primary">{totalPedidos}</p>
          </div>

          <div className="bg-dark-card border border-dark-border rounded-lg px-3 sm:px-4 py-2.5 sm:py-3 min-w-0">
            <label className="block text-[10px] sm:text-xs uppercase tracking-wide text-gray-400 mb-1.5 sm:mb-2">
              Consultar Costo por Direccion
            </label>
            <input
              type="text"
              value={consultaDireccion}
              onChange={(e) => setConsultaDireccion(e.target.value)}
              placeholder="Escribe una direccion para sugerir costo..."
              className="w-full h-[36px] sm:h-[40px] px-3 sm:px-4 bg-[#374151] border border-dark-border rounded-lg text-sm sm:text-base text-white placeholder-gray-400 focus:ring-2 focus:ring-primary focus:border-transparent"
            />
          </div>

          <div className="bg-dark-card border border-dark-border rounded-lg px-3 sm:px-4 py-2.5 sm:py-3 min-w-[120px]">
            <p className="text-[10px] sm:text-xs uppercase tracking-wide text-gray-400">Total Costos de Envio</p>
            <p className="text-xl sm:text-2xl font-bold text-warning">${totalCostosEnvio.toLocaleString()}</p>
          </div>

          <div className="bg-dark-card border border-dark-border rounded-lg px-3 sm:px-4 py-2.5 sm:py-3 min-w-[120px]">
            <p className="text-[10px] sm:text-xs uppercase tracking-wide text-gray-400">Total Ventas Pesos</p>
            <p className="text-xl sm:text-2xl font-bold text-success">${totalVentasPesos.toLocaleString()}</p>
          </div>

          <div className="col-span-2 lg:col-span-1 flex justify-end lg:justify-center lg:items-center">
            <button
              onClick={handleCerrarTurno}
              disabled={loadingCierreTurno}
              className="h-[40px] sm:h-full sm:min-h-[58px] flex items-center gap-1.5 sm:gap-2 whitespace-nowrap bg-orange-600 hover:bg-orange-700 disabled:bg-gray-600 text-white px-3 sm:px-4 py-2 sm:py-3 rounded-md sm:rounded-lg transition-colors text-xs sm:text-sm font-medium"
              title="Cerrar Turno y Guardar Resumen"
            >
              {loadingCierreTurno ? (
                <>
                  <div className="w-4 h-4 sm:w-5 sm:h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span className="hidden sm:inline">Cerrando...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4 sm:w-5 sm:h-5" />
                  <span className="hidden sm:inline">Cerrar Turno</span>
                </>
              )}
            </button>
            <button
              onClick={handleSincronizacion}
              className="hidden items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg transition-colors font-medium"
              title="Sincronizar con la Nube"
            >
              <Cloud className="w-5 h-5" />
              Sincronizar
            </button>
          </div>
        </div>

        <div className="mt-2 text-xs sm:text-sm text-gray-300 min-h-[20px]">
          {loadingSugerenciaCosto && 'Buscando sugerencia...'}
          {!loadingSugerenciaCosto && consultaDireccion.trim().length >= 3 && sugerenciaCosto && (
            `Costo sugerido: $${Number(sugerenciaCosto.costoSugerido || 0).toLocaleString()} · Base: ${sugerenciaCosto.direccionBase || 'N/A'} · Coincidencias: ${Number(sugerenciaCosto.coincidencias || 0)}`
          )}
          {!loadingSugerenciaCosto && consultaDireccion.trim().length >= 3 && !sugerenciaCosto && 'Sin coincidencias en historial.'}
        </div>
      </div>

      {/* Buscador con Auto-Insert */}
      <div className="sticky top-14 z-20 sm:static bg-dark-card/95 sm:bg-dark-card border border-dark-border rounded-lg p-4 sm:p-6 backdrop-blur-sm sm:backdrop-blur-0">
        <label className="block text-sm font-medium text-white mb-2 sm:mb-3">
          Buscar Cliente y Crear Pedido
        </label>
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 sm:left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 sm:w-5 sm:h-5" />
            <input
              type="text"
              placeholder="Escribe el nombre del cliente..."
              value={searchTerm}
              onChange={handleSearchChange}
              className="w-full pl-10 sm:pl-12 pr-4 py-2.5 sm:py-3 bg-[#374151] border border-dark-border rounded-lg text-white text-base sm:text-lg placeholder-gray-400 focus:ring-2 focus:ring-primary focus:border-transparent"
            />
            
            {/* Sugerencias */}
            {showSugerencias && clienteSugerencias.length > 0 && (
              <div className="absolute z-10 w-full mt-2 bg-dark-card border border-dark-border rounded-lg shadow-xl max-h-60 overflow-y-auto">
                {clienteSugerencias.map((cliente, idx) => (
                  <button
                    key={`${cliente.id || cliente.nombre || 'cliente'}-${idx}`}
                    onClick={() => handleSelectCliente(cliente)}
                    className="w-full px-4 py-3 text-left hover:bg-[#374151] transition-colors border-b border-dark-border last:border-b-0"
                  >
                    <div className="font-medium text-white">{cliente.nombre}</div>
                    <div className="text-sm text-gray-400 mt-1">
                      {cliente.direccion_habitual} • {cliente.telefono}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
          
          {/* Botón Nuevo Cliente */}
          <button
            onClick={() => setShowModalCliente(true)}
            className="w-full sm:w-auto px-4 py-2.5 sm:py-3 bg-primary hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            <UserPlus className="w-5 h-5" />
            <span>Nuevo Cliente</span>
          </button>
        </div>
      </div>

      {/* Tabla de Pedidos */}
      <div className="hidden sm:block bg-dark-card border border-dark-border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full table-fixed text-xs">
            <thead className="bg-[#374151]">
              <tr>
                <th className="px-0.5 py-3 w-[40px] text-center text-xs font-semibold text-primary">#</th>
                <th className="px-0 py-3 w-[108px] text-left text-xs font-semibold text-white">Cliente</th>
                <th className="px-0 py-3 w-[64px] text-center text-xs font-semibold text-white">Fecha</th>
                <th className="px-1 py-3 w-[110px] sm:w-[140px] xl:w-[170px] text-left text-xs font-semibold text-white">Dirección</th>
                <th className="px-1.5 py-3 w-[104px] text-center text-xs font-semibold text-white hidden xl:table-cell">Teléfono</th>
                <th className="px-1 py-3 w-[92px] text-right text-xs font-semibold text-white">Valor</th>
                <th className="px-1 py-3 w-[84px] text-right text-xs font-semibold text-white">Costo</th>
                <th className="px-1 py-3 w-[98px] text-right text-xs font-semibold text-success">Total</th>
                <th className="px-1.5 py-3 w-[116px] text-center text-xs font-semibold text-white">Repartidor</th>
                <th className="px-1.5 py-3 w-[86px] text-center text-xs font-semibold text-white">Pago</th>
                <th className="px-1.5 py-3 w-[72px] text-center text-xs font-semibold text-warning">Estado</th>
                <th className="px-1.5 py-3 w-[62px] text-center text-xs font-semibold text-white">Ent.</th>
                <th className="px-1.5 py-3 w-[60px] text-center text-xs font-semibold text-white">Acc.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dark-border">
              {pedidosDelDia.length === 0 ? (
                <tr>
                  <td colSpan="13" className="px-6 py-12 text-center">
                    <p className="text-gray-400 text-lg">No hay pedidos registrados hoy</p>
                    <p className="text-gray-500 text-sm mt-2">Busca un cliente arriba para crear el primer pedido</p>
                  </td>
                </tr>
              ) : (
                pedidosDelDia.map((pedido, index) => (
                  <tr key={`${pedido.firestoreId || pedido.id || 'pedido'}-${pedido.timestamp || pedido.fecha || index}-${index}`} className="hover:bg-dark-bg transition-colors">
                    {/* Número del pedido */}
                    <td className="px-0.5 py-2.5 text-center">
                      <span className="text-2xl font-bold text-primary">
                        {pedidosDelDia.length - index}
                      </span>
                    </td>
                    
                    {/* Cliente */}
                    <td 
                      className="px-0 py-2.5 cursor-pointer hover:bg-dark-border/50"
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        handleCellDoubleClick(pedido.id, 'cliente', pedido.cliente);
                      }}
                    >
                      {editingCell.id === pedido.id && editingCell.field === 'cliente' ? (
                        <input
                          type="text"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={handleCellBlur}
                          onKeyDown={handleCellKeyDown}
                          className="w-full bg-dark-border text-white px-2 py-1 rounded border border-primary focus:outline-none focus:border-primary-hover"
                          autoFocus
                        />
                      ) : (
                        <div className="font-semibold text-white whitespace-nowrap truncate max-w-[105px]" title={pedido.cliente}>{pedido.cliente}</div>
                      )}
                    </td>
                    
                    {/* Fecha */}
                    <td className="px-0 py-2.5 text-center text-gray-300 text-[11px] whitespace-nowrap">
                      {pedido.fecha}
                    </td>
                    
                    {/* Dirección */}
                    <td 
                      className="px-1 py-2.5 text-gray-300 cursor-pointer hover:bg-dark-border/50"
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        handleCellDoubleClick(pedido.id, 'direccion', pedido.direccion);
                      }}
                    >
                      {editingCell.id === pedido.id && editingCell.field === 'direccion' ? (
                        <input
                          type="text"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={handleCellBlur}
                          onKeyDown={handleCellKeyDown}
                          className="w-full bg-dark-border text-white px-2 py-1 rounded border border-primary focus:outline-none focus:border-primary-hover"
                          autoFocus
                        />
                      ) : (
                        <span className="block whitespace-nowrap truncate max-w-[100px] sm:max-w-[130px] xl:max-w-[170px]" title={pedido.direccion}>{pedido.direccion}</span>
                      )}
                    </td>
                    
                    {/* Teléfono */}
                    <td 
                      className="px-1.5 py-2.5 text-gray-300 hidden xl:table-cell cursor-pointer hover:bg-dark-border/50"
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        handleCellDoubleClick(pedido.id, 'telefono', pedido.telefono);
                      }}
                    >
                      {editingCell.id === pedido.id && editingCell.field === 'telefono' ? (
                        <input
                          type="text"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={handleCellBlur}
                          onKeyDown={handleCellKeyDown}
                          className="w-full bg-dark-border text-white px-2 py-1 rounded border border-primary focus:outline-none focus:border-primary-hover"
                          autoFocus
                        />
                      ) : (
                        pedido.telefono
                      )}
                    </td>
                    
                    {/* Valor Pedido */}
                    <td 
                      className="px-1 py-2.5 text-right text-white font-medium cursor-pointer hover:bg-dark-border/50"
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        handleCellDoubleClick(pedido.id, 'valor_pedido', pedido.valor_pedido);
                      }}
                    >
                      {editingCell.id === pedido.id && editingCell.field === 'valor_pedido' ? (
                        <input
                          type="number"
                          inputMode="decimal"
                          pattern="[0-9]*"
                          min="0"
                          step="1"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={handleCellBlur}
                          onKeyDown={handleCellKeyDown}
                          className="w-full bg-dark-border text-white px-2 py-1 rounded border border-primary focus:outline-none focus:border-primary-hover text-right"
                          autoFocus
                        />
                      ) : (
                        `$${pedido.valor_pedido.toLocaleString()}`
                      )}
                    </td>
                    
                    {/* Costo Envío */}
                    <td 
                      className="px-1 py-2.5 text-right text-gray-300 cursor-pointer hover:bg-dark-border/50"
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        handleCellDoubleClick(pedido.id, 'costo_envio', pedido.costo_envio);
                      }}
                    >
                      {editingCell.id === pedido.id && editingCell.field === 'costo_envio' ? (
                        <input
                          type="number"
                          inputMode="decimal"
                          pattern="[0-9]*"
                          min="0"
                          step="1"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={handleCellBlur}
                          onKeyDown={handleCellKeyDown}
                          className="w-full bg-dark-border text-white px-2 py-1 rounded border border-primary focus:outline-none focus:border-primary-hover text-right"
                          autoFocus
                        />
                      ) : (
                        `$${pedido.costo_envio.toLocaleString()}`
                      )}
                    </td>

                    {/* Total a Recibir */}
                    <td className="px-1 py-2.5 text-right text-success font-bold">
                      <div>${pedido.total_a_recibir.toLocaleString()}</div>
                      <div className="text-[10px] text-gray-400 font-normal mt-0.5">{formatHoraAmPm(pedido.hora)}</div>
                    </td>
                    

                    {/* Repartidor */}
                    <td className="px-1.5 py-2.5 text-center">
                      <select
                        value={pedido.repartidor_id || ''}
                        onChange={(e) => handleAsignarRepartidor(pedido.id, e.target.value)}
                        className="w-[108px] px-1 py-1 bg-[#374151] border border-dark-border rounded text-white text-[11px] focus:ring-2 focus:ring-primary focus:border-transparent"
                      >
                        <option value="">-</option>
                        {(repartidores || []).map(rep => (
                          <option key={rep.id} value={rep.id}>
                            {rep.nombre}
                          </option>
                        ))}
                      </select>
                      <div className="text-[10px] text-gray-400 mt-0.5">{formatHoraAmPm(pedido.hora_repartidor)}</div>
                    </td>
                    {/* Pago */}
                    <td className="px-1.5 py-2.5 text-center">
                      <select
                        value={pedido.metodo_pago || ''}
                        onChange={(e) => handleMetodoPagoChange(pedido.id, e.target.value)}
                        className="w-[78px] px-1 py-1 bg-[#374151] border border-dark-border rounded text-white text-[11px] focus:ring-2 focus:ring-primary focus:border-transparent"
                      >
                        <option value="">-</option>
                        <option value="Efectivo">Efectivo</option>
                        <option value="Banco">Banco</option>
                      </select>
                      <div className="text-[10px] text-gray-400 mt-0.5">{formatHoraAmPm(pedido.hora_metodo_pago)}</div>
                    </td>
                    {/* Estado Pago */}
                    <td className="px-1.5 py-2.5 text-center">
                      <button
                        onClick={() => toggleEstadoPago(pedido.id)}
                        className={`inline-block px-2 py-0.5 rounded text-[11px] font-semibold ${pedido.estadoPago === 'pagado' ? 'bg-success/20 text-success' : pedido.estadoPago === 'pendiente' ? 'bg-warning/20 text-warning' : 'bg-dark-border text-gray-300'}`}
                        title="Cambiar estado de pago"
                      >
                        {pedido.estadoPago === 'pagado' ? 'Pagado' : pedido.estadoPago === 'pendiente' ? 'Pend.' : '-'}
                      </button>
                      <div className="text-[10px] text-gray-400 mt-0.5">{formatHoraAmPm(pedido.hora_estado_pago)}</div>
                    </td>
                    {/* Entregado */}
                    <td className="px-1.5 py-2.5 text-center">
                      <button
                        onClick={() => toggleEntregado(pedido.id)}
                        className={`inline-block px-2 py-0.5 rounded text-[11px] font-semibold ${pedido.entregado ? 'bg-success/20 text-success' : 'bg-dark-border text-gray-300'}`}
                        title="Entregado"
                      >
                        {pedido.entregado === null || typeof pedido.entregado === 'undefined' ? '-' : pedido.entregado ? 'Si' : 'No'}
                      </button>
                      <div className="text-[10px] text-gray-400 mt-0.5">{formatHoraAmPm(pedido.hora_entregado)}</div>
                    </td>
                    {/* Acciones */}
                    <td className="px-1.5 py-2.5 text-center">
                      <button
                        onClick={() => handleEliminarPedido(pedido.id)}
                        className="w-7 h-7 inline-flex items-center justify-center rounded text-xs font-bold bg-red-500/20 text-red-500 hover:bg-red-500/30"
                        title="Eliminar"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Resumen por repartidor */}
      <div className="hidden md:grid mt-6 gap-4 md:grid-cols-2">
        {(() => {
          const pedidosPorRepartidor = {};
          pedidosDelDia.forEach((pedido) => {
            const key = pedido.repartidor_nombre || 'Sin Repartidor';
            if (!pedidosPorRepartidor[key]) {
              pedidosPorRepartidor[key] = {
                nombre: key,
                pedidos: 0,
                valorPedidos: 0,
                costos: 0,
                total: 0
              };
            }
            pedidosPorRepartidor[key].pedidos++;
            pedidosPorRepartidor[key].valorPedidos += pedido.valor_pedido;
            pedidosPorRepartidor[key].costos += pedido.costo_envio;
            pedidosPorRepartidor[key].total += pedido.total_a_recibir;
          });
          return Object.values(pedidosPorRepartidor).map((rep, idx) => (
            <div key={idx} className="bg-dark-bg border border-dark-border rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-white text-lg">{rep.nombre}</span>
                <span className="text-sm text-gray-400">{rep.pedidos} pedido(s)</span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-sm">
                <div>
                  <span className="text-gray-400">Pedidos: </span>
                  <span className="text-white font-medium">${rep.valorPedidos.toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-gray-400">Costos: </span>
                  <span className="text-warning font-medium">${rep.costos.toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-gray-400">Total: </span>
                  <span className="text-success font-bold">${rep.total.toLocaleString()}</span>
                </div>
              </div>
            </div>
          ));
        })()}
      </div>

      {/* Mobile Cards */}
      <div className="sm:hidden mt-4 space-y-3">
        {pedidosDelDia.length === 0 ? (
          <div className="px-4 py-10 text-center bg-dark-card border border-dark-border rounded-lg">
            <p className="text-gray-400 text-lg">No hay pedidos registrados hoy</p>
            <p className="text-gray-500 text-sm mt-2">Busca un cliente arriba para crear el primer pedido</p>
          </div>
        ) : (
          pedidosDelDia.map((pedido, index) => (
            <div key={`${pedido.firestoreId || pedido.id || 'pedido-mobile'}-${pedido.timestamp || pedido.fecha || index}-${index}`} className="bg-dark-card border border-dark-border rounded-lg p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-primary">#{pedidosDelDia.length - index}</span>
                    <span className="truncate font-semibold text-white text-sm">{pedido.cliente}</span>
                  </div>
                  <div className="mt-1 text-[11px] text-gray-400 truncate" title={pedido.direccion}>{pedido.direccion || '-'}</div>
                  <div className="mt-1 text-[11px] text-gray-500">{pedido.fecha}</div>
                </div>
                <div className="text-right">
                  <div className="text-success font-bold text-sm">${pedido.total_a_recibir.toLocaleString()}</div>
                  <div className="text-[10px] text-gray-400">{formatHoraAmPm(pedido.hora)}</div>
                </div>
              </div>

              <div className="mt-2 grid grid-cols-3 gap-2 text-[11px]">
                <div className="bg-dark-bg rounded px-2 py-1 text-center">
                  <div className="text-gray-400">Valor</div>
                  <div className="text-white font-semibold">${pedido.valor_pedido.toLocaleString()}</div>
                </div>
                <div className="bg-dark-bg rounded px-2 py-1 text-center">
                  <div className="text-gray-400">Costo</div>
                  <div className="text-warning font-semibold">${pedido.costo_envio.toLocaleString()}</div>
                </div>
                <div className="bg-dark-bg rounded px-2 py-1 text-center">
                  <div className="text-gray-400">Estado</div>
                  <div className={`font-semibold ${pedido.estadoPago === 'pagado' ? 'text-success' : pedido.estadoPago === 'pendiente' ? 'text-warning' : 'text-gray-400'}`}>
                    {pedido.estadoPago === 'pagado' ? 'Pagado' : pedido.estadoPago === 'pendiente' ? 'Pend.' : '-'}
                  </div>
                </div>
              </div>

              <div className="mt-2 grid grid-cols-2 gap-2">
                <div>
                  <select
                    value={pedido.repartidor_id || ''}
                    onChange={(e) => handleAsignarRepartidor(pedido.id, e.target.value)}
                    className="w-full text-xs bg-[#374151] border border-dark-border rounded px-2 py-1 text-gray-200"
                  >
                    <option value="">-</option>
                    {(repartidores || []).map(rep => (
                      <option key={rep.id} value={rep.id}>
                        {rep.nombre}
                      </option>
                    ))}
                  </select>
                  <div className="text-[10px] text-gray-400 mt-0.5 text-center">{formatHoraAmPm(pedido.hora_repartidor)}</div>
                </div>
                <div>
                  <select
                    value={pedido.metodo_pago || ''}
                    onChange={(e) => handleMetodoPagoChange(pedido.id, e.target.value)}
                    className="w-full text-xs bg-[#374151] border border-dark-border rounded px-2 py-1 text-gray-200"
                  >
                    <option value="">-</option>
                    <option value="Efectivo">Efectivo</option>
                    <option value="Banco">Banco</option>
                  </select>
                  <div className="text-[10px] text-gray-400 mt-0.5 text-center">{formatHoraAmPm(pedido.hora_metodo_pago)}</div>
                </div>
              </div>

              <div className="mt-2 flex items-center justify-end gap-2">
                <button
                  onClick={() => toggleEstadoPago(pedido.id)}
                  className={`px-2 py-1 rounded text-xs font-bold ${pedido.estadoPago === 'pagado' ? 'bg-success text-white' : pedido.estadoPago === 'pendiente' ? 'bg-warning text-white' : 'bg-dark-border text-gray-200'}`}
                  title="Marcar como pagado"
                >
                  {pedido.estadoPago === 'pagado' ? '✓' : pedido.estadoPago === 'pendiente' ? '$' : '-'}
                </button>
                <button
                  onClick={() => toggleEntregado(pedido.id)}
                  className={`inline-block px-2 py-1 rounded text-xs font-semibold ${pedido.entregado ? 'bg-success/20 text-success' : 'bg-dark-border text-gray-300'}`}
                  title="Entregado"
                >
                  {pedido.entregado === null || typeof pedido.entregado === 'undefined' ? '-' : pedido.entregado ? 'Si' : 'No'}
                </button>
                <button
                  onClick={() => handleEliminarPedido(pedido.id)}
                  className="px-2 py-1 rounded text-xs font-bold bg-red-500/20 text-red-500 hover:bg-red-500/30"
                  title="Eliminar"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Filtro de Repartidor (al final, debajo del listado de pedidos) */}
      <div className="bg-dark-card border border-dark-border rounded-lg p-6 mt-8">
        <label className="block text-sm font-medium text-white mb-3">
          🚩 Filtrar por Repartidor
        </label>
        <select
          value={filtroRepartidor}
          onChange={(e) => setFiltroRepartidor(e.target.value)}
          className="w-full px-4 py-2 bg-[#374151] border border-dark-border rounded-lg text-white focus:ring-2 focus:ring-primary focus:border-transparent"
        >
          <option value="">Todos los repartidores</option>
          {(repartidores || []).map(rep => (
            <option key={rep.id} value={rep.id}>
              {rep.nombre}
            </option>
          ))}
        </select>
      </div>

      {/* Modal Nuevo Pedido */}
      {showModalPedido && clienteSeleccionadoPedido && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-[#1f2937] border border-[#374151] rounded-lg p-5 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white">Nuevo Pedido</h3>
              <button
                onClick={cerrarModalPedido}
                className="text-gray-400 hover:text-white transition-colors"
                disabled={loadingCrearPedido}
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="bg-dark-bg border border-dark-border rounded-lg p-3 text-sm">
                <p className="text-white font-semibold truncate" title={clienteSeleccionadoPedido.nombre}>{clienteSeleccionadoPedido.nombre}</p>
                <p className="text-gray-400 truncate" title={clienteSeleccionadoPedido.direccion_habitual || clienteSeleccionadoPedido.direccion || clienteSeleccionadoPedido.domicilio || '-'}>
                  {clienteSeleccionadoPedido.direccion_habitual || clienteSeleccionadoPedido.direccion || clienteSeleccionadoPedido.domicilio || '-'}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-white mb-1.5">Valor del Pedido *</label>
                <input
                  type="number"
                  inputMode="decimal"
                  pattern="[0-9]*"
                  min="0"
                  step="1"
                  value={nuevoPedidoForm.valor_pedido}
                  onChange={(e) => setNuevoPedidoForm(prev => ({ ...prev, valor_pedido: e.target.value }))}
                  onKeyDown={(e) => handleNuevoPedidoKeyDown(e, 'valor_pedido')}
                  className="w-full px-4 py-2.5 bg-[#374151] border border-[#374151] rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-primary focus:border-transparent"
                  placeholder="Ej: 50000"
                  ref={valorPedidoInputRef}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-white mb-1.5">Costo de Envio *</label>
                <input
                  type="number"
                  inputMode="decimal"
                  pattern="[0-9]*"
                  min="0"
                  step="1"
                  value={nuevoPedidoForm.costo_envio}
                  onChange={(e) => setNuevoPedidoForm(prev => ({ ...prev, costo_envio: e.target.value }))}
                  onKeyDown={(e) => handleNuevoPedidoKeyDown(e, 'costo_envio')}
                  className="w-full px-4 py-2.5 bg-[#374151] border border-[#374151] rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-primary focus:border-transparent"
                  placeholder="Ej: 7000"
                  ref={costoEnvioInputRef}
                />
              </div>

              <div className="bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-sm flex items-center justify-between">
                <span className="text-gray-400">Total a Recibir</span>
                <span className="text-success font-bold">
                  ${Math.max(0, (Number(parseValorNumerico(nuevoPedidoForm.valor_pedido)) || 0) - (Number(parseValorNumerico(nuevoPedidoForm.costo_envio)) || 0)).toLocaleString()}
                </span>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={cerrarModalPedido}
                  disabled={loadingCrearPedido}
                  className="flex-1 px-4 py-2 bg-[#374151] text-white rounded-lg hover:bg-[#4b5563] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleCrearPedidoDesdeModal}
                  disabled={loadingCrearPedido}
                  className="flex-1 px-4 py-2 bg-[#206DDA] text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {loadingCrearPedido ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Guardando...
                    </>
                  ) : (
                    'Crear Pedido'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Nuevo Cliente */}
      {showModalCliente && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-[#1f2937] border border-[#374151] rounded-lg p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-white">Nuevo Cliente</h3>
              <button
                onClick={() => setShowModalCliente(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Nombre *
                </label>
                <input
                  type="text"
                  value={nuevoCliente.nombre}
                  onChange={(e) => setNuevoCliente({...nuevoCliente, nombre: e.target.value})}
                  className="w-full px-4 py-2 bg-[#374151] border border-[#374151] rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-primary focus:border-transparent"
                  placeholder="Nombre completo del cliente"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Dirección *
                </label>
                <input
                  type="text"
                  value={nuevoCliente.direccion_habitual}
                  onChange={(e) => setNuevoCliente({...nuevoCliente, direccion_habitual: e.target.value})}
                  className="w-full px-4 py-2 bg-[#374151] border border-[#374151] rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-primary focus:border-transparent"
                  placeholder="Dirección completa"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Teléfono *
                </label>
                <input
                  type="tel"
                  value={nuevoCliente.telefono}
                  onChange={(e) => setNuevoCliente({...nuevoCliente, telefono: e.target.value})}
                  className="w-full px-4 py-2 bg-[#374151] border border-[#374151] rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-primary focus:border-transparent"
                  placeholder="Número de teléfono"
                />
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowModalCliente(false)}
                  disabled={loadingCrearCliente}
                  className="flex-1 px-4 py-2 bg-[#374151] text-white rounded-lg hover:bg-[#4b5563] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleCreateCliente}
                  disabled={loadingCrearCliente || !nuevoCliente.nombre || !nuevoCliente.direccion_habitual || !nuevoCliente.telefono}
                  className="flex-1 px-4 py-2 bg-[#206DDA] text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {loadingCrearCliente ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Guardando...
                    </>
                  ) : (
                    'Guardar Cliente'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Confirmación de Cierre de Jornada */}
      {showModalCierre && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-dark-card border border-dark-border rounded-lg p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-white">📅 Confirmar Fecha de Cierre</h3>
              <button
                onClick={() => setShowModalCierre(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-primary/10 border border-primary/30 rounded-lg p-4">
                <p className="text-sm text-primary">
                  💡 Puedes modificar la fecha si estás cerrando una jornada atrasada
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Fecha de Cierre *
                </label>
                <input
                  type="date"
                  value={fechaCierre}
                  onChange={(e) => setFechaCierre(e.target.value)}
                  className="w-full px-4 py-2 bg-dark-bg border border-dark-border rounded-lg text-white focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Hora de Cierre *
                </label>
                <input
                  type="time"
                  value={horaCierre}
                  onChange={(e) => setHoraCierre(e.target.value)}
                  className="w-full px-4 py-2 bg-dark-bg border border-dark-border rounded-lg text-white focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>

              <div className="bg-dark-bg border border-dark-border rounded-lg p-4">
                <p className="text-sm text-gray-400 mb-2">Resumen del cierre:</p>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Pedidos:</span>
                    <span className="text-white font-semibold">{pedidosDelDia.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Total a Recibir:</span>
                    <span className="text-success font-bold">${totalARecibir.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowModalCierre(false)}
                  className="flex-1 px-4 py-2 bg-dark-bg border border-dark-border text-white rounded-lg hover:bg-dark-border transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleCerrarJornada}
                  className="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold"
                >
                  ✅ Confirmar Cierre
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Orders;
