// Archivar pedidos en lote usando writeBatch
export const batchArchivarPedidos = async (ids = []) => {
  if (!Array.isArray(ids) || ids.length === 0) {
    alert('Error: No se proporcionaron IDs de pedidos para archivar.');
    throw new Error('No se proporcionaron IDs de pedidos para archivar.');
  }
  try {
    if (USE_LOCAL_STORAGE || !db) {
      const pedidos = getPedidosLocalData();
      const idsSet = new Set(ids.map(String));
      const actualizados = pedidos.map(p => {
        const firestoreId = p.firestoreId ? String(p.firestoreId) : '';
        const id = p.id ? String(p.id) : '';
        if (idsSet.has(firestoreId) || idsSet.has(id)) {
          return { ...p, archivado: true };
        }
        return p;
      });
      setPedidosLocalData(actualizados);
      toast.success('Pedidos archivados correctamente');
      return;
    }

    const batch = writeBatch(db);
    for (const id of ids) {
      if (!id) continue;

      const primaryRef = doc(db, pedidosCollection, id);
      const primarySnap = await getDoc(primaryRef);
      if (primarySnap.exists()) {
        batch.update(primaryRef, { archivado: true });
        continue;
      }

      const legacyRef = doc(db, legacyPedidosCollection, id);
      const legacySnap = await getDoc(legacyRef);
      if (legacySnap.exists()) {
        batch.update(legacyRef, { archivado: true });
      }
    }
    await batch.commit();
    invalidateCache('pedidos');
    toast.success('Pedidos archivados correctamente');
  } catch (error) {
    alert('Error al archivar pedidos en lote.');
    console.error('Error en batchArchivarPedidos:', error);
    throw error;
  }
};
import { 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  getDocs, 
  getDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  Timestamp,
  writeBatch
} from 'firebase/firestore';
import { db, auth } from '../config/firebase';
import toast from 'react-hot-toast';

// ==================== CONFIGURACIÓN ADAPTADOR LOCAL ====================
// Se activa automáticamente si Firebase no está configurado en desarrollo.
const USE_LOCAL_STORAGE = import.meta.env.VITE_USE_LOCAL_STORAGE === 'true' || !db;

// Colecciones de Firebase
const cierresDiariosCollection = 'cierres_diarios';
const cierresTurnoCollection = 'cierres_turno';
const legacyPedidosCollection = 'pedidos';

// ==================== SISTEMA DE CACHÉ SWR ====================
// Caché en memoria para respuesta instantánea
const cache = {
  clientes: { data: null, timestamp: 0, loading: false },
  pedidos: { data: null, timestamp: 0, loading: false },
  repartidores: { data: null, timestamp: 0, loading: false }
};

const CACHE_TTL = 30000; // 30 segundos de validez
const CACHE_STALE_TIME = 5 * 60 * 1000; // 5 minutos para considerar muy viejo

const getRangoHoyFirestore = () => {
  const ahora = new Date();
  const inicio = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate(), 0, 0, 0, 0);
  const fin = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate(), 23, 59, 59, 999);
  return {
    inicio: Timestamp.fromDate(inicio),
    fin: Timestamp.fromDate(fin)
  };
};

const esFechaDeHoy = (fechaValue) => {
  if (!fechaValue) return false;
  const hoy = new Date();
  const toDate = (value) => {
    if (value?.toDate) return value.toDate();
    if (value instanceof Date) return value;
    if (typeof value === 'string') {
      const soloFecha = value.split(' ')[0];
      const partes = soloFecha.split('/');
      if (partes.length === 3) {
        const [dia, mes, anio] = partes.map(Number);
        if (Number.isFinite(dia) && Number.isFinite(mes) && Number.isFinite(anio)) {
          return new Date(anio, mes - 1, dia);
        }
      }
      const parsed = new Date(value);
      if (!Number.isNaN(parsed.getTime())) return parsed;
    }
    return null;
  };

  const fecha = toDate(fechaValue);
  if (!fecha) return false;
  return (
    fecha.getFullYear() === hoy.getFullYear() &&
    fecha.getMonth() === hoy.getMonth() &&
    fecha.getDate() === hoy.getDate()
  );
};

/**
 * Verifica si la caché es válida (fresca)
 */
const isCacheFresh = (cacheKey) => {
  const cached = cache[cacheKey];
  if (!cached.data) return false;
  const age = Date.now() - cached.timestamp;
  return age < CACHE_TTL;
};

/**
 * Escuchar pedidos en tiempo real (sin caché, solo para UI)
 */
export const listenPedidosRealtime = (callback) => {
  if (USE_LOCAL_STORAGE || !db) {
    callback(getPedidosLocal());
    return () => {};
  }

  try {
    const pedidosRef = query(
      collection(db, pedidosCollection),
      where('eliminado', '==', false),
      where('archivado', '==', false),
      limit(200)
    );
    return onSnapshot(pedidosRef, (snapshot) => {
      const pedidos = snapshot.docs
      .filter(docSnap => {
        const data = docSnap.data() || {};
        return !data.eliminado && !data.archivado && esFechaDeHoy(data.fecha);
      })
      .map(doc => {
        const data = doc.data();
        return {
          id: String(doc.id || ''),
          firestoreId: String(doc.id || ''),
          cliente: String(data.cliente || ''),
          direccion: String(data.direccion || data.direccion_habitual || data.domicilio || ''),
          telefono: String(data.telefono || ''),
          productos_pedido: Array.isArray(data.productos_pedido) ? data.productos_pedido : [],
          valor_pedido: Number(data.valor_pedido) || 0,
          costo_envio: Number(data.costo_envio) || 0,
          total_a_recibir: Number(data.total_a_recibir) || 0,
          metodo_pago: data.metodo_pago ? String(data.metodo_pago) : '',
          repartidor_id: data.repartidor_id ? String(data.repartidor_id) : null,
          repartidor_nombre: data.repartidor_nombre || 'Sin Asignar',
          estadoPago: data.estadoPago ? String(data.estadoPago) : '',
          entregado: typeof data.entregado === 'boolean' ? data.entregado : null,
          estado: String(data.estado || 'Recibido'),
          fecha: data.fecha?.toDate ? data.fecha.toDate().toLocaleDateString('es-ES') : String(data.fecha || 'N/A'),
          hora: String(data.hora || ''),
          hora_repartidor: String(data.hora_repartidor || ''),
          hora_metodo_pago: String(data.hora_metodo_pago || ''),
          hora_estado_pago: String(data.hora_estado_pago || ''),
          hora_entregado: String(data.hora_entregado || ''),
          timestamp: data.fecha?.toDate ? data.fecha.toDate().toISOString() : new Date().toISOString(),
          archivado: Boolean(data.archivado),
          eliminado: Boolean(data.eliminado)
        };
      })
      .sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0));
      callback(pedidos);
    });
  } catch (error) {
    console.error('Error al escuchar pedidos en tiempo real:', error);
    callback([]);
  }
};

/**
 * Verifica si la caché está obsoleta pero usable
 */
const isCacheStale = (cacheKey) => {
  const cached = cache[cacheKey];
  if (!cached.data) return false;
  const age = Date.now() - cached.timestamp;
  return age < CACHE_STALE_TIME;
};

/**
 * Invalida la caché para forzar re-fetch en la próxima llamada
 */
const invalidateCache = (cacheKey) => {
  if (cache[cacheKey]) {
    cache[cacheKey].timestamp = 0; // Forzar expiración
    console.log(`🗑️ Caché invalidada: ${cacheKey}`);
  }
};

// ==================== SISTEMA DE REINTENTOS Y MANEJO DE ERRORES ====================
const RETRY_CONFIG = {
  maxRetries: 3,
  initialDelay: 1000,
  maxDelay: 5000,
  backoffMultiplier: 2
};

// Estado de la conexión
let connectionState = {
  isOnline: true,
  permissionDeniedCount: 0,
  lastPermissionCheck: null
};

/**
 * Determina si un error es de permisos de Firebase
 */
const esErrorPermisos = (error) => {
  if (!error) return false;
  
  const codigosPermisos = [
    'permission-denied',
    'PERMISSION_DENIED',
    'insufficient-permissions'
  ];
  
  return codigosPermisos.some(codigo => 
    error.code?.includes(codigo) || 
    error.message?.toLowerCase().includes('permission')
  );
};

/**
 * Determina si un error es recuperable (merece reintento)
 */
const esErrorRecuperable = (error) => {
  if (!error) return false;
  
  const erroresRecuperables = [
    'unavailable',
    'deadline-exceeded',
    'resource-exhausted',
    'aborted',
    'cancelled',
    'network-request-failed',
    'timeout'
  ];
  
  return erroresRecuperables.some(tipo => 
    error.code?.includes(tipo) || 
    error.message?.toLowerCase().includes(tipo)
  );
};

/**
 * Espera con delay exponencial
 */
const esperarConBackoff = (intento) => {
  const delay = Math.min(
    RETRY_CONFIG.initialDelay * Math.pow(RETRY_CONFIG.backoffMultiplier, intento),
    RETRY_CONFIG.maxDelay
  );
  return new Promise(resolve => setTimeout(resolve, delay));
};

/**
 * Ejecuta una operación de Firebase con reintentos automáticos
 */
const ejecutarConReintentos = async (operacion, nombreOperacion = 'Operación') => {
  let ultimoError = null;
  
  for (let intento = 0; intento < RETRY_CONFIG.maxRetries; intento++) {
    try {
      const resultado = await operacion();
      
      // Si la operación tuvo éxito, resetear contador de errores de permisos
      if (connectionState.permissionDeniedCount > 0) {
        connectionState.permissionDeniedCount = 0;
        console.log('✅ Conexión a Firebase restablecida exitosamente');
        toast.success('Conexión restablecida');
      }
      
      return resultado;
      
    } catch (error) {
      ultimoError = error;
      
      // Manejar errores de permisos
      if (esErrorPermisos(error)) {
        connectionState.permissionDeniedCount++;
        connectionState.lastPermissionCheck = new Date();
        
        console.warn(`⚠️ Error de permisos en Firebase (intento ${intento + 1}/${RETRY_CONFIG.maxRetries}):`, error.message);
        
        if (intento === 0) {
          toast.error('Error de permisos. Verificando reglas de Firebase...');
        }
        
        // Esperar antes de reintentar (las reglas pueden haberse actualizado)
        if (intento < RETRY_CONFIG.maxRetries - 1) {
          await esperarConBackoff(intento);
          console.log('🔄 Reintentando operación después de error de permisos...');
          continue;
        }
      }
      
      // Manejar errores recuperables (red, timeout, etc.)
      if (esErrorRecuperable(error)) {
        console.warn(`⚠️ Error temporal en ${nombreOperacion} (intento ${intento + 1}/${RETRY_CONFIG.maxRetries}):`, error.message);
        
        if (intento < RETRY_CONFIG.maxRetries - 1) {
          await esperarConBackoff(intento);
          console.log(`🔄 Reintentando ${nombreOperacion}...`);
          continue;
        }
      }
      
      // Si no es recuperable, lanzar inmediatamente
      console.error(`❌ Error no recuperable en ${nombreOperacion}:`, error);
      throw error;
    }
  }
  
  // Si agotamos los reintentos
  console.error(`❌ Agotados los reintentos para ${nombreOperacion}`);
  throw ultimoError;
};

// ==================== UTILIDADES LOCALSTORAGE ====================
const getLocalData = (key) => {
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error(`Error al leer ${key}:`, error);
    return [];
  }
};

const setLocalData = (key, data) => {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (error) {
    console.error(`Error al guardar ${key}:`, error);
  }
};

const getPedidosLocalData = () => {
  try {
    const pedidosRaw = localStorage.getItem('pedidos');
    if (pedidosRaw !== null) {
      const parsed = JSON.parse(pedidosRaw);
      return Array.isArray(parsed) ? parsed : [];
    }
  } catch (error) {
    console.error('Error al leer pedidos:', error);
  }
  return getLocalData('pedidos_domicilio');
};

const setPedidosLocalData = (data) => {
  setLocalData('pedidos', data);
  setLocalData('pedidos_domicilio', data);
};

// ==================== PEDIDOS DOMICILIO ====================
export const pedidosCollection = 'pedidos_domicilio';

const getPedidoDocRefConFallback = async (id) => {
  const primaryRef = doc(db, pedidosCollection, id);
  const primarySnap = await getDoc(primaryRef);
  if (primarySnap.exists()) return primaryRef;

  const legacyRef = doc(db, legacyPedidosCollection, id);
  const legacySnap = await getDoc(legacyRef);
  if (legacySnap.exists()) return legacyRef;

  return primaryRef;
};

// Versión LOCAL
const getPedidosLocal = () => {
  const pedidos = getPedidosLocalData();
  // Ordenar por fecha descendente (más reciente primero)
  return pedidos.sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0));
};

// Versión FIREBASE optimizada con reintentos
const getPedidosFirebase = async () => {
  return ejecutarConReintentos(async () => {
    console.log("🔄 Obteniendo pedidos desde Firebase...");
    
    const querySnapshot = await getDocs(
      query(
        collection(db, pedidosCollection),
        where('eliminado', '==', false),
        where('archivado', '==', false),
        limit(200)
      )
    );
    const pedidos = querySnapshot.docs
    .filter(docSnap => {
      const data = docSnap.data() || {};
      return !data.eliminado && !data.archivado && esFechaDeHoy(data.fecha);
    })
    .map(doc => {
      const data = doc.data();
      return {
        id: String(doc.id || ''),
        cliente: String(data.cliente || ''),
        direccion: String(data.direccion || data.direccion_habitual || data.domicilio || ''),
        telefono: String(data.telefono || ''),
        productos_pedido: Array.isArray(data.productos_pedido) ? data.productos_pedido : [],
        total: Number(data.total) || 0,
        metodo_pago: data.metodo_pago ? String(data.metodo_pago) : '',
        repartidor_id: data.repartidor_id ? String(data.repartidor_id) : null,
        estado: String(data.estado || 'Recibido'),
        fecha: data.fecha?.toDate ? data.fecha.toDate().toLocaleDateString('es-ES') : String(data.fecha || 'N/A'),
        hora: String(data.hora || ''),
        hora_repartidor: String(data.hora_repartidor || ''),
        hora_metodo_pago: String(data.hora_metodo_pago || ''),
        hora_estado_pago: String(data.hora_estado_pago || ''),
        hora_entregado: String(data.hora_entregado || ''),
        timestamp: data.fecha?.toDate ? data.fecha.toDate().toISOString() : new Date().toISOString(),
        eliminado: Boolean(data.eliminado)
      };
    })
    .sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0));

    console.log(`✅ ${pedidos.length} pedidos obtenidos`);
    return pedidos;
  }, 'getPedidos').catch(error => {
    console.error('Error al obtener pedidos:', error);
    toast.error('Error al cargar pedidos');
    return [];
  });
};

export const getPedidos = USE_LOCAL_STORAGE ? getPedidosLocal : getPedidosFirebase;

// Versión LOCAL
const addPedidoLocal = (pedidoData) => {
  const pedidos = getPedidosLocalData();
  const horaPedido = pedidoData.hora || new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  const nuevoPedido = {
    id: Date.now().toString(),
    cliente: pedidoData.cliente || '',
    direccion: pedidoData.direccion || '',
    telefono: pedidoData.telefono || '',
    productos_pedido: pedidoData.productos_pedido || [],
    total: pedidoData.total || 0,
    metodo_pago: pedidoData.metodo_pago || '',
    repartidor_id: pedidoData.repartidor_id || null,
    estado: pedidoData.estado || 'Recibido',
    hora: horaPedido,
    timestamp: new Date().toISOString(),
    fecha: new Date()
  };
  
  pedidos.unshift(nuevoPedido); // Agregar al inicio
  setPedidosLocalData(pedidos);
  toast.success('Información guardada con éxito');
  return nuevoPedido;
};

// Versión FIREBASE optimizada con reintentos
const addPedidoFirebase = async (pedidoData) => {
  return ejecutarConReintentos(async () => {
    const ahora = Timestamp.now();
    const horaPedido = pedidoData.hora || new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    const pedido = {
      cliente: pedidoData.cliente || '',
      direccion: pedidoData.direccion || '',
      telefono: pedidoData.telefono || '',
      valor_pedido: pedidoData.valor_pedido || 0,
      costo_envio: pedidoData.costo_envio || 0,
      total_a_recibir: pedidoData.total_a_recibir || 0,
      metodo_pago: pedidoData.metodo_pago || '',
      repartidor_id: pedidoData.repartidor_id || null,
      repartidor_nombre: pedidoData.repartidor_nombre || 'Sin Asignar',
      estadoPago: pedidoData.estadoPago || '',
      entregado: typeof pedidoData.entregado === 'boolean' ? pedidoData.entregado : null,
      archivado: false,
      eliminado: false,
      hora: horaPedido,
      fecha: ahora
    };

    const docRef = await addDoc(collection(db, pedidosCollection), pedido);
    invalidateCache('pedidos'); // Invalidar caché para refrescar datos
    console.log('✅ Pedido guardado en Firebase con ID:', docRef.id);
    
    // Devolver con fecha como string para evitar error React #31
    return { 
      id: docRef.id,
      cliente: pedido.cliente,
      direccion: pedido.direccion,
      telefono: pedido.telefono,
      valor_pedido: pedido.valor_pedido,
      costo_envio: pedido.costo_envio,
      total_a_recibir: pedido.total_a_recibir,
      metodo_pago: pedido.metodo_pago,
      repartidor_id: pedido.repartidor_id,
      repartidor_nombre: pedido.repartidor_nombre,
      estadoPago: pedido.estadoPago,
      entregado: pedido.entregado,
      hora: pedido.hora,
      fecha: ahora.toDate().toLocaleDateString('es-ES'),
      timestamp: ahora.toDate().toISOString()
    };
  }, 'addPedido').catch(error => {
    console.error('❌ Error al agregar pedido:', error);
    // No mostrar toast aquí porque ya se maneja en Orders.jsx
    throw error;
  });
};

export const addPedido = USE_LOCAL_STORAGE ? addPedidoLocal : addPedidoFirebase;

// Versión LOCAL
const updatePedidoLocal = (id, pedidoData) => {
  const pedidos = getPedidosLocalData();
  const index = pedidos.findIndex(p => p.id === id);
  
  if (index !== -1) {
    pedidos[index] = { ...pedidos[index], ...pedidoData };
    setPedidosLocalData(pedidos);
    toast.success('Información guardada con éxito');
  } else {
    toast.error('Pedido no encontrado');
  }
};

// Versión FIREBASE optimizada con reintentos

const updatePedidoFirebase = async (id, pedidoData) => {
  if (!id) {
    const msg = 'Error: El ID del pedido es nulo o inválido.';
    alert(msg);
    throw new Error(msg);
  }
  return ejecutarConReintentos(async () => {
    try {
      const pedidoRef = await getPedidoDocRefConFallback(id);
      await updateDoc(pedidoRef, pedidoData);
      invalidateCache('pedidos');
      toast.success('Información guardada con éxito');
    } catch (error) {
      alert('Error al actualizar el pedido. Verifica la ruta y el ID.');
      throw error;
    }
  }, 'updatePedido').catch(error => {
    console.error('Error al actualizar pedido:', error);
    toast.error('Error al actualizar pedido. Verifica los permisos.');
    throw error;
  });
};

export const updatePedido = USE_LOCAL_STORAGE ? updatePedidoLocal : updatePedidoFirebase;

// Versión LOCAL
const deletePedidoLocal = (id) => {
  const pedidos = getPedidosLocalData();
  const idTexto = String(id || '');
  const filtrados = pedidos.filter(p => {
    const pid = String(p.id || '');
    const fid = String(p.firestoreId || '');
    return pid !== idTexto && fid !== idTexto;
  });
  setPedidosLocalData(filtrados);
  setLocalData('pedidos_domicilio_cache', filtrados);
  toast.success('Información guardada con éxito');
};

// Versión FIREBASE optimizada con reintentos
const deletePedidoFirebase = async (id, pedidoData = null) => {
  return ejecutarConReintentos(async () => {
    const pedidoId = String(id || '').trim();
    if (!pedidoId) {
      throw new Error('ID de pedido invalido para eliminar');
    }

    const refsToDelete = [
      doc(db, pedidosCollection, pedidoId),
      doc(db, legacyPedidosCollection, pedidoId)
    ];

    let softDeleteOk = false;
    let hardDeleteOk = false;

    for (const ref of refsToDelete) {
      try {
        await updateDoc(ref, {
          eliminado: true,
          archivado: true,
          fecha_eliminado: Timestamp.now()
        });
        softDeleteOk = true;
      } catch (error) {
        // Si el doc no existe o no permite update, seguimos intentando delete directo.
      }
    }

    // Borrado físico directo por ID en ambas colecciones.
    for (const ref of refsToDelete) {
      try {
        await deleteDoc(ref);
        hardDeleteOk = true;
      } catch (error) {
        console.warn('⚠️ No se pudo eliminar físicamente en', ref.path, error?.message || error);
      }
    }

    // Compatibilidad solicitada: forzar borrado explícito en colección deliveries con el ID correcto.
    if (pedidoId) {
      await deleteDoc(doc(db, 'deliveries', pedidoId))
        .then(() => console.log('Eliminado de la nube'))
        .catch(() => {});
    }

    if (!softDeleteOk && !hardDeleteOk) {
      throw new Error(`No se pudo eliminar el pedido (id: ${pedidoId})`);
    }

    // Limpiar cachés locales para evitar rehidratación de pedidos eliminados.
    const pedidosLocales = getPedidosLocalData();
    const idTexto = pedidoId;
    const filtrados = pedidosLocales.filter((p) => {
      const pid = String(p.id || '');
      const fid = String(p.firestoreId || '');
      return pid !== idTexto && fid !== idTexto;
    });
    setPedidosLocalData(filtrados);
    setLocalData('pedidos_domicilio_cache', filtrados);

    invalidateCache('pedidos');
    toast.success('Información guardada con éxito');
  }, 'deletePedido').catch(error => {
    console.error('Error al eliminar pedido:', error);
    toast.error('Error al eliminar pedido. Verifica los permisos.');
    throw error;
  });
};

export const deletePedido = USE_LOCAL_STORAGE ? deletePedidoLocal : deletePedidoFirebase;

// ==================== REPARTIDORES ====================
export const repartidoresCollection = 'repartidores';

// Versión LOCAL
const getRepartidoresLocal = () => {
  return getLocalData('repartidores');
};

// Versión FIREBASE SIN CACHÉ (consulta directa)
const getRepartidoresFirebase = async () => {
  return ejecutarConReintentos(async () => {
    console.log("🔄 Consultando repartidores directamente desde Firebase...");
    
    const querySnapshot = await getDocs(collection(db, repartidoresCollection));
    const repartidores = querySnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: String(doc.id || ''),
        nombre: String(data.nombre || ''),
        vehiculo: String(data.vehiculo || ''),
        placa: String(data.placa || ''),
        telefono: String(data.telefono || ''),
        disponibilidad: Boolean(data.disponibilidad !== undefined ? data.disponibilidad : true),
        fechaRegistro: data.fechaRegistro?.toDate ? data.fechaRegistro.toDate().toLocaleDateString('es-ES') : String(data.fechaRegistro || 'N/A')
      };
    });
    
    console.log(`✅ ${repartidores.length} repartidores obtenidos desde Firebase`);
    return repartidores;
  }, 'getRepartidores').catch(error => {
    console.error('❌ Error al obtener repartidores:', error);
    toast.error('Error al cargar repartidores. Verifica la conexión.');
    return [];
  });
};

export const getRepartidores = USE_LOCAL_STORAGE ? getRepartidoresLocal : getRepartidoresFirebase;

// Versión LOCAL
const addRepartidorLocal = (repartidorData) => {
  const repartidores = getLocalData('repartidores');
  const nuevoRepartidor = {
    id: Date.now().toString(),
    nombre: repartidorData.nombre || '',
    vehiculo: repartidorData.vehiculo || '',
    placa: repartidorData.placa || '',
    telefono: repartidorData.telefono || '',
    disponibilidad: repartidorData.disponibilidad !== undefined ? repartidorData.disponibilidad : true,
    fechaRegistro: new Date().toLocaleDateString('es-ES'),
    timestamp: new Date().toISOString()
  };
  
  repartidores.unshift(nuevoRepartidor);
  setLocalData('repartidores', repartidores);
  toast.success('Información guardada con éxito');
  return nuevoRepartidor;
};

// Versión FIREBASE optimizada con reintentos
const addRepartidorFirebase = async (repartidorData) => {
  return ejecutarConReintentos(async () => {
    console.log('💾 Guardando repartidor en Firebase...', repartidorData);
    const ahora = Timestamp.now();
    const repartidor = {
      nombre: String(repartidorData.nombre || ''),
      vehiculo: String(repartidorData.vehiculo || ''),
      placa: String(repartidorData.placa || ''),
      telefono: String(repartidorData.telefono || ''),
      disponibilidad: Boolean(repartidorData.disponibilidad !== undefined ? repartidorData.disponibilidad : true),
      fechaRegistro: ahora
    };

    const docRef = await addDoc(collection(db, repartidoresCollection), repartidor);
    console.log('✅ Repartidor guardado con ID:', docRef.id);
    toast.success('Repartidor guardado correctamente');
    
    // Devolver con fechaRegistro como string para evitar error React #31
    return { 
      id: String(docRef.id),
      nombre: String(repartidor.nombre),
      vehiculo: String(repartidor.vehiculo),
      placa: String(repartidor.placa),
      telefono: String(repartidor.telefono),
      disponibilidad: Boolean(repartidor.disponibilidad),
      fechaRegistro: ahora.toDate().toLocaleDateString('es-ES')
    };
  }, 'addRepartidor').catch(error => {
    console.error('❌ Error al agregar repartidor:', error);
    toast.error('Error al guardar repartidor. Verifica los permisos de Firebase.');
    throw error;
  });
};

export const addRepartidor = USE_LOCAL_STORAGE ? addRepartidorLocal : addRepartidorFirebase;

// Versión LOCAL
const updateRepartidorLocal = (id, repartidorData) => {
  const repartidores = getLocalData('repartidores');
  const index = repartidores.findIndex(r => r.id === id);
  
  if (index !== -1) {
    repartidores[index] = { ...repartidores[index], ...repartidorData };
    setLocalData('repartidores', repartidores);
    toast.success('Información guardada con éxito');
  } else {
    toast.error('Repartidor no encontrado');
  }
};

// Versión FIREBASE optimizada con reintentos
const updateRepartidorFirebase = async (id, repartidorData) => {
  return ejecutarConReintentos(async () => {
    console.log('📝 Actualizando repartidor:', id, repartidorData);
    await updateDoc(doc(db, repartidoresCollection, id), repartidorData);
    toast.success('Repartidor actualizado correctamente');
  }, 'updateRepartidor').catch(error => {
    console.error('❌ Error al actualizar repartidor:', error);
    toast.error('Error al actualizar repartidor. Verifica los permisos.');
    throw error;
  });
};

export const updateRepartidor = USE_LOCAL_STORAGE ? updateRepartidorLocal : updateRepartidorFirebase;

// Versión LOCAL
const deleteRepartidorLocal = (id) => {
  const repartidores = getLocalData('repartidores');
  const filtrados = repartidores.filter(r => r.id !== id);
  setLocalData('repartidores', filtrados);
  toast.success('Información guardada con éxito');
};

// Versión FIREBASE optimizada con reintentos
const deleteRepartidorFirebase = async (id) => {
  return ejecutarConReintentos(async () => {
    console.log('🗑️ Eliminando repartidor:', id);
    await deleteDoc(doc(db, repartidoresCollection, id));
    toast.success('Información guardada con éxito');
  }, 'deleteRepartidor').catch(error => {
    console.error('Error al eliminar repartidor:', error);
    toast.error('Error al eliminar repartidor. Verifica los permisos.');
    throw error;
  });
};

export const deleteRepartidor = USE_LOCAL_STORAGE ? deleteRepartidorLocal : deleteRepartidorFirebase;

// ==================== JORNADAS REPARTIDORES ====================
export const jornadasRepartidoresCollection = 'jornadas_repartidores';

// Versión LOCAL
const getJornadasRepartidorLocal = (repartidorId) => {
  const jornadas = getLocalData('jornadas_repartidores');
  return jornadas.filter(j => j.id_repartidor === repartidorId);
};

// Versión FIREBASE - Obtener historial de jornadas de un repartidor
const getJornadasRepartidorFirebase = async (repartidorId) => {
  return ejecutarConReintentos(async () => {
    console.log('🔍 Consultando jornadas de repartidor:', repartidorId);
    
    const q = query(
      collection(db, jornadasRepartidoresCollection),
      where('id_repartidor', '==', repartidorId),
      orderBy('fecha', 'desc')
    );
    
    const querySnapshot = await getDocs(q);
    const jornadas = querySnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: String(doc.id || ''),
        id_repartidor: String(data.id_repartidor || ''),
        nombre: String(data.nombre || ''),
        fecha: data.fecha?.toDate ? data.fecha.toDate().toLocaleDateString('es-ES') : String(data.fecha || 'N/A'),
        total_pedidos_valor: Number(data.total_pedidos_valor || 0),
        total_costos_envio: Number(data.total_costos_envio || 0),
        cantidad_entregas: Number(data.cantidad_entregas || 0),
        timestamp: data.fecha?.toDate ? data.fecha.toDate().toISOString() : new Date().toISOString()
      };
    });
    
    console.log(`✅ ${jornadas.length} jornadas encontradas para repartidor ${repartidorId}`);
    return jornadas;
  }, 'getJornadasRepartidor').catch(error => {
    console.error('❌ Error al obtener jornadas de repartidor:', error);
    toast.error('Error al cargar historial del repartidor');
    return [];
  });
};

export const getJornadasRepartidor = USE_LOCAL_STORAGE ? getJornadasRepartidorLocal : getJornadasRepartidorFirebase;

// Versión LOCAL
const addJornadaRepartidorLocal = (jornadaData) => {
  const jornadas = getLocalData('jornadas_repartidores');
  const nuevaJornada = {
    id: Date.now().toString(),
    id_repartidor: jornadaData.id_repartidor || '',
    nombre: jornadaData.nombre || '',
    fecha: new Date().toLocaleDateString('es-ES'),
    total_pedidos_valor: jornadaData.total_pedidos_valor || 0,
    total_costos_envio: jornadaData.total_costos_envio || 0,
    cantidad_entregas: jornadaData.cantidad_entregas || 0,
    timestamp: new Date().toISOString()
  };
  
  jornadas.unshift(nuevaJornada);
  setLocalData('jornadas_repartidores', jornadas);
  return nuevaJornada;
};

// Versión FIREBASE - Guardar jornada de repartidor
const addJornadaRepartidorFirebase = async (jornadaData) => {
  return ejecutarConReintentos(async () => {
    console.log('💾 Guardando jornada de repartidor:', jornadaData);
    const ahora = Timestamp.now();
    const jornada = {
      id_repartidor: String(jornadaData.id_repartidor || ''),
      nombre: String(jornadaData.nombre || ''),
      fecha: ahora,
      total_pedidos_valor: Number(jornadaData.total_pedidos_valor || 0),
      total_costos_envio: Number(jornadaData.total_costos_envio || 0),
      cantidad_entregas: Number(jornadaData.cantidad_entregas || 0)
    };

    const docRef = await addDoc(collection(db, jornadasRepartidoresCollection), jornada);
    console.log('✅ Jornada de repartidor guardada con ID:', docRef.id);
    
    return { 
      id: String(docRef.id),
      id_repartidor: String(jornada.id_repartidor),
      nombre: String(jornada.nombre),
      fecha: ahora.toDate().toLocaleDateString('es-ES'),
      total_pedidos_valor: Number(jornada.total_pedidos_valor),
      total_costos_envio: Number(jornada.total_costos_envio),
      cantidad_entregas: Number(jornada.cantidad_entregas),
      timestamp: ahora.toDate().toISOString()
    };
  }, 'addJornadaRepartidor').catch(error => {
    console.error('❌ Error al guardar jornada de repartidor:', error);
    toast.error('Error al guardar jornada del repartidor');
    throw error;
  });
};

export const addJornadaRepartidor = USE_LOCAL_STORAGE ? addJornadaRepartidorLocal : addJornadaRepartidorFirebase;

// ==================== CLIENTES ====================
export const clientesCollection = 'clientes';

/**
 * Sanitiza un objeto de Firestore convirtiendo todos los valores a primitivos
 * Evita el error React #31 al intentar renderizar objetos
 */
const sanitizarDocumento = (data) => {
  const sanitizado = {};
  
  for (const [key, value] of Object.entries(data)) {
    if (value === null || value === undefined) {
      sanitizado[key] = '';
    } else if (value?.toDate && typeof value.toDate === 'function') {
      // Es un Timestamp de Firebase
      try {
        sanitizado[key] = value.toDate().toLocaleDateString('es-ES');
      } catch (e) {
        sanitizado[key] = '';
      }
    } else if (typeof value === 'object' && !Array.isArray(value)) {
      // Es un objeto (no array)
      sanitizado[key] = JSON.stringify(value);
    } else if (Array.isArray(value)) {
      // Es un array - mantener como está
      sanitizado[key] = value;
    } else {
      // Es un primitivo (string, number, boolean)
      sanitizado[key] = value;
    }
  }
  
  return sanitizado;
};

// Versión LOCAL
const getClientesLocal = () => {
  return getLocalData('clientes');
};

// Versión FIREBASE optimizada con reintentos
const getClientesFirebase = async () => {
  const cacheKey = 'clientes';
  
  // 1. Si la caché es fresca (< 30s), retornar inmediatamente
  if (isCacheFresh(cacheKey)) {
    console.log('⚡ Clientes desde caché fresca (< 30s)');
    return cache[cacheKey].data;
  }
  
  // 2. Si la caché está obsoleta pero usable, retornarla Y actualizar en background
  if (isCacheStale(cacheKey) && !cache[cacheKey].loading) {
    console.log('📦 Clientes desde caché obsoleta, actualizando en background...');
    const staleData = cache[cacheKey].data;
    
    // Actualizar en background sin esperar
    cache[cacheKey].loading = true;
    ejecutarConReintentos(async () => {
      const querySnapshot = await getDocs(collection(db, clientesCollection));
      const clientes = querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: String(doc.id || ''),
          nombre: String(data.nombre || ''),
          direccion_habitual: String(data.direccion_habitual || ''),
          telefono: String(data.telefono || ''),
          email: String(data.email || ''),
          fechaRegistro: data.fechaRegistro?.toDate 
            ? data.fechaRegistro.toDate().toLocaleDateString('es-ES')
            : String(data.fechaRegistro || 'N/A')
        };
      });
      
      cache[cacheKey] = { data: clientes, timestamp: Date.now(), loading: false };
      setLocalData('clientes_cache', clientes);
      console.log(`✅ ${clientes.length} clientes actualizados en background`);
    }, 'getClientes').catch(() => { cache[cacheKey].loading = false; });
    
    return staleData;
  }
  
  // 3. Sin caché válida, hacer fetch completo
  return ejecutarConReintentos(async () => {
    console.log("🔄 Obteniendo clientes desde Firebase...");
    cache[cacheKey].loading = true;
    
    const querySnapshot = await getDocs(collection(db, clientesCollection));
    const clientes = querySnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: String(doc.id || ''),
        nombre: String(data.nombre || ''),
        direccion_habitual: String(data.direccion_habitual || ''),
        telefono: String(data.telefono || ''),
        email: String(data.email || ''),
        fechaRegistro: data.fechaRegistro?.toDate 
          ? data.fechaRegistro.toDate().toLocaleDateString('es-ES')
          : String(data.fechaRegistro || 'N/A')
      };
    });
    
    cache[cacheKey] = { data: clientes, timestamp: Date.now(), loading: false };
    setLocalData('clientes_cache', clientes);
    console.log(`✅ ${clientes.length} clientes obtenidos de Firebase`);
    
    return clientes;
  }, 'getClientes').catch(error => {
    cache[cacheKey].loading = false;
    console.error('Error al obtener clientes:', error);
    const cachedData = getLocalData('clientes_cache');
    if (cachedData && cachedData.length > 0) {
      toast.error('Usando datos en caché. Verifica tu conexión.');
      return cachedData;
    }
    toast.error('Error al cargar clientes');
    return [];
  });
};

export const getClientes = USE_LOCAL_STORAGE ? getClientesLocal : getClientesFirebase;

// Versión LOCAL
const addClienteLocal = (clienteData) => {
  const clientes = getLocalData('clientes');
  const nuevoCliente = {
    id: Date.now().toString(),
    nombre: clienteData.nombre || '',
    direccion_habitual: clienteData.direccion_habitual || '',
    telefono: clienteData.telefono || '',
    email: clienteData.email || '',
    fechaRegistro: new Date().toLocaleDateString('es-ES'),
    timestamp: new Date().toISOString()
  };
  
  clientes.unshift(nuevoCliente); // Agregar al inicio
  setLocalData('clientes', clientes);
  toast.success('Información guardada con éxito');
  return nuevoCliente;
};

// Versión FIREBASE optimizada con reintentos
const addClienteFirebase = async (clienteData, silent = false) => {
  return ejecutarConReintentos(async () => {
    const ahora = Timestamp.now();
    const cliente = {
      nombre: clienteData.nombre || '',
      direccion_habitual: clienteData.direccion_habitual || '',
      telefono: clienteData.telefono || '',
      email: clienteData.email || '',
      fechaRegistro: ahora
    };

    if (!silent) {
      console.log('📤 Guardando cliente en Firebase...', cliente);
    }
    
    const docRef = await addDoc(collection(db, clientesCollection), cliente);
    invalidateCache('clientes');
    
    if (!silent) {
      console.log('✅ Cliente guardado exitosamente en Firestore con ID:', docRef.id);
      toast.success('Información guardada con éxito');
    }
    
    // Devolver SOLO primitivos para evitar error React #31
    return { 
      id: String(docRef.id),
      nombre: String(cliente.nombre),
      direccion_habitual: String(cliente.direccion_habitual),
      telefono: String(cliente.telefono),
      email: String(cliente.email),
      fechaRegistro: String(ahora.toDate().toLocaleDateString('es-ES'))
    };
  }, 'addCliente').catch(error => {
    console.error('❌ Error al agregar cliente:', error);
    if (!silent) {
      toast.error('Error al guardar cliente. Verifica los permisos.');
    }
    throw error;
  });
};

export const addCliente = USE_LOCAL_STORAGE ? addClienteLocal : addClienteFirebase;

// Versión LOCAL
const updateClienteLocal = (id, clienteData) => {
  const clientes = getLocalData('clientes');
  const index = clientes.findIndex(c => c.id === id);
  
  if (index !== -1) {
    clientes[index] = { ...clientes[index], ...clienteData };
    setLocalData('clientes', clientes);
    toast.success('Información guardada con éxito');
  } else {
    toast.error('Cliente no encontrado');
  }
};

// Versión FIREBASE optimizada con reintentos
const updateClienteFirebase = async (id, clienteData) => {
  return ejecutarConReintentos(async () => {
    await updateDoc(doc(db, clientesCollection, id), clienteData);
    invalidateCache('clientes');
    toast.success('Información guardada con éxito');
  }, 'updateCliente').catch(error => {
    console.error('Error al actualizar cliente:', error);
    toast.error('Error al actualizar cliente. Verifica los permisos.');
    throw error;
  });
};

export const updateCliente = USE_LOCAL_STORAGE ? updateClienteLocal : updateClienteFirebase;

// Versión LOCAL
const deleteClienteLocal = (id) => {
  const clientes = getLocalData('clientes');
  const filtrados = clientes.filter(c => c.id !== id);
  setLocalData('clientes', filtrados);
  toast.success('Información guardada con éxito');
};

// Versión FIREBASE optimizada con reintentos
const deleteClienteFirebase = async (id) => {
  return ejecutarConReintentos(async () => {
    await deleteDoc(doc(db, clientesCollection, id));
    invalidateCache('clientes');
    toast.success('Información guardada con éxito');
  }, 'deleteCliente').catch(error => {
    console.error('Error al eliminar cliente:', error);
    toast.error('Error al eliminar cliente. Verifica los permisos.');
    throw error;
  });
};

export const deleteCliente = USE_LOCAL_STORAGE ? deleteClienteLocal : deleteClienteFirebase;

// ==================== FUNCIONES ADICIONALES ====================

// Importar clientes desde Excel (guardar en localStorage)
export const importarClientesLocal = (clientesArray, onProgress = null) => {
  const clientesActuales = getLocalData('clientes');
  const nuevosClientes = clientesArray.map((cliente, index) => ({
    id: (Date.now() + index).toString(),
    nombre: cliente.nombre || '',
    direccion_habitual: cliente.direccion_habitual || '',
    telefono: cliente.telefono || '',
    email: cliente.email || '',
    fechaRegistro: new Date().toLocaleDateString('es-ES'),
    timestamp: new Date().toISOString()
  }));
  
  const todosClientes = [...nuevosClientes, ...clientesActuales];
  setLocalData('clientes', todosClientes);
  
  if (onProgress) {
    onProgress(100, `${nuevosClientes.length} clientes guardados`);
  }
  
  return nuevosClientes.length;
};

// Importar clientes a Firebase (versión optimizada con writeBatch)
export const importarClientesFirebase = async (clientesArray, onProgress = null) => {
  console.log(`📦 Iniciando importación por lotes de ${clientesArray.length} clientes a Firebase...`);
  
  if (!clientesArray || clientesArray.length === 0) {
    toast.error('No hay clientes para importar');
    return 0;
  }
  
  try {
    // Firestore tiene un límite de 500 operaciones por batch
    const BATCH_SIZE = 500;
    const totalClientes = clientesArray.length;
    let clientesGuardados = 0;
    
    // Dividir en lotes si hay más de 500 clientes
    for (let i = 0; i < totalClientes; i += BATCH_SIZE) {
      const lote = clientesArray.slice(i, Math.min(i + BATCH_SIZE, totalClientes));
      const batch = writeBatch(db);
      
      // Agregar todos los clientes del lote al batch
      lote.forEach((clienteData) => {
        const nuevoDocRef = doc(collection(db, clientesCollection));
        const cliente = {
          nombre: clienteData.nombre || '',
          direccion_habitual: clienteData.direccion_habitual || clienteData.direccion || '',
          telefono: clienteData.telefono || '',
          email: clienteData.email || '',
          fechaRegistro: Timestamp.now()
        };
        
        batch.set(nuevoDocRef, cliente);
      });
      
      // Ejecutar el batch (una sola operación para todos los clientes del lote)
      await batch.commit();
      
      clientesGuardados += lote.length;
      
      // Actualizar progreso
      const progreso = Math.round((clientesGuardados / totalClientes) * 100);
      console.log(`✅ Lote ${Math.floor(i / BATCH_SIZE) + 1} completado: ${clientesGuardados}/${totalClientes} clientes (${progreso}%)`);
      
      if (onProgress) {
        onProgress(progreso, `${clientesGuardados}/${totalClientes} clientes guardados`);
      }
    }
    
    console.log(`🎉 Importación completada exitosamente: ${clientesGuardados} clientes guardados en Firestore`);
    return clientesGuardados;
    
  } catch (error) {
    console.error('❌ Error en importación por lotes:', error);
    
    if (esErrorPermisos(error)) {
      toast.error('Error de permisos. Verifica las reglas de Firebase.');
    } else {
      toast.error('Error al importar clientes');
    }
    
    throw error;
  }
};

// Función de importación que se adapta según el modo
export const importarClientes = USE_LOCAL_STORAGE ? importarClientesLocal : importarClientesFirebase;

// Guardar historial de costos de envío
export const guardarHistorialCosto = (direccion, costo) => {
  if (!direccion || !costo) return;
  
  const historial = getLocalData('historial_costos');
  const historialObj = historial.length > 0 ? historial[0] : {};
  
  historialObj[direccion] = parseFloat(costo);
  setLocalData('historial_costos', [historialObj]);
};

// Obtener historial de costos
export const obtenerHistorialCostos = () => {
  const historial = getLocalData('historial_costos');
  return historial.length > 0 ? historial[0] : {};
};

const normalizarTexto = (texto = '') => {
  return String(texto)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
};

const extraerDireccion = (item = {}) => {
  return String(
    item.direccion ||
    item.direccion_habitual ||
    item.address ||
    item.zone ||
    ''
  );
};

const extraerCosto = (item = {}) => {
  return Number(
    item.costo_envio ||
    item.costoEnvio ||
    item.delivery_cost ||
    item.shippingCost ||
    item.costo ||
    0
  );
};

const calcularCostoSugerido = (items = [], direccionConsulta = '') => {
  const consulta = normalizarTexto(direccionConsulta);
  if (!consulta) return null;

  const coincidencias = (items || []).filter(item => {
    const direccion = normalizarTexto(extraerDireccion(item));
    return direccion && (direccion.includes(consulta) || consulta.includes(direccion));
  });

  if (coincidencias.length === 0) return null;

  const costos = coincidencias
    .map(extraerCosto)
    .filter(costo => Number.isFinite(costo) && costo > 0);

  if (costos.length === 0) return null;

  const promedio = Math.round(costos.reduce((sum, value) => sum + value, 0) / costos.length);
  return {
    costoSugerido: promedio,
    coincidencias: coincidencias.length,
    direccionBase: extraerDireccion(coincidencias[0])
  };
};

export const consultarCostoSugeridoPorDireccion = async (direccionConsulta = '') => {
  const consulta = String(direccionConsulta || '').trim();
  if (consulta.length < 3) return null;

  const pedidosLocales = getPedidosLocalData();
  const historialObj = obtenerHistorialCostos();
  const historialLocal = Object.entries(historialObj || {}).map(([direccion, costo]) => ({
    direccion,
    costo_envio: Number(costo) || 0
  }));

  if (USE_LOCAL_STORAGE || !db) {
    return calcularCostoSugerido([...pedidosLocales, ...historialLocal], consulta);
  }

  try {
    const snapshot = await getDocs(collection(db, 'deliveries'));
    const deliveries = snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));

    const sugerencia = calcularCostoSugerido(deliveries, consulta);
    if (sugerencia) return sugerencia;

    // Fallback adicional con datos locales para no dejar al usuario sin sugerencia.
    return calcularCostoSugerido([...pedidosLocales, ...historialLocal], consulta);
  } catch (error) {
    console.warn('⚠️ No se pudo consultar deliveries. Usando historial local.', error);
    return calcularCostoSugerido([...pedidosLocales, ...historialLocal], consulta);
  }
};

// ==================== SINCRONIZACIÓN FUTURA ====================
export const sincronizarConNube = async () => {
  try {
    const pedidos = getPedidosLocalData();
    const clientes = getLocalData('clientes');
    const repartidores = getLocalData('repartidores');
    
    // Preparar estadísticas de sincronización
    const stats = {
      pedidos: pedidos.length,
      clientes: clientes.length,
      repartidores: repartidores.length
    };
    
    // TODO: Implementar sincronización real con Firebase cuando esté disponible
    toast.success('Sincronización pendiente - Firebase no disponible');
    
    return stats;
  } catch (error) {
    toast.error('Error al preparar sincronización');
    throw error;
  }
};

// ==================== MONITOREO DE CONEXIÓN ====================

/**
 * Obtiene el estado actual de la conexión a Firebase
 */
export const getConnectionState = () => {
  return {
    ...connectionState,
    hasPermissionIssues: connectionState.permissionDeniedCount > 0,
    status: connectionState.isOnline ? 'online' : 'offline'
  };
};

/**
 * Reinicia los contadores de errores de permisos
 */
export const resetPermissionErrors = () => {
  connectionState.permissionDeniedCount = 0;
  connectionState.lastPermissionCheck = null;
  console.log('✅ Contadores de errores de permisos reiniciados');
};

/**
 * Verifica la conectividad con Firebase intentando una operación de lectura simple
 */
export const verificarConexionFirebase = async () => {
  if (USE_LOCAL_STORAGE || !db) {
    connectionState.isOnline = false;
    console.log('ℹ️ Firebase no configurado. Operando en modo local.');
    return false;
  }

  try {
    console.log('🔍 Verificando conexión a Firebase...');
    
    // Intentar una operación simple de lectura
    const testRef = collection(db, clientesCollection);
    await getDocs(query(testRef, where('__name__', '==', 'test-connection-dummy')));
    
    connectionState.isOnline = true;
    connectionState.permissionDeniedCount = 0;
    
    console.log('✅ Conexión a Firebase verificada exitosamente');
    toast.success('Conexión a Firebase activa');
    
    return true;
  } catch (error) {
    if (esErrorPermisos(error)) {
      console.warn('⚠️ Problemas de permisos detectados en Firebase');
      toast.error('Error de permisos. Verifica las reglas en la consola de Firebase.');
      connectionState.permissionDeniedCount++;
      return false;
    }
    
    console.error('❌ Error al verificar conexión:', error);
    connectionState.isOnline = false;
    toast.error('No se puede conectar a Firebase');
    return false;
  }
};

/**
 * Obtiene la configuración de la empresa desde Firebase
 * @returns {Promise<{nombreEmpresa: string}>} Configuración de la empresa
 */
export const getConfiguracionEmpresa = async () => {
  if (USE_LOCAL_STORAGE || !db) {
    return { nombreEmpresa: 'AliadoX' };
  }

  try {
    const configRef = collection(db, 'configuracion');
    const snapshot = await getDocs(configRef);
    
    if (!snapshot.empty) {
      const config = snapshot.docs[0].data();
      return {
        nombreEmpresa: String(config.nombreEmpresa || config.nombre_empresa || 'AliadoX')
      };
    }
    
    // Si no hay configuración, retornar valor por defecto
    return { nombreEmpresa: 'AliadoX' };
  } catch (error) {
    console.warn('⚠️ No se pudo cargar configuración de empresa desde Firebase:', error);
    return { nombreEmpresa: 'AliadoX' };
  }
};

// ==================== CIERRES DIARIOS ====================
export const guardarCierreDiario = async (cierreData) => {
  if (USE_LOCAL_STORAGE || !db) {
    const cierres = getLocalData(cierresDiariosCollection);
    const nuevoCierre = {
      id: String(Date.now()),
      ...cierreData,
      fechaCreacion: new Date().toISOString()
    };
    setLocalData(cierresDiariosCollection, [nuevoCierre, ...cierres]);
    console.log('✅ Cierre diario guardado en localStorage:', nuevoCierre.id);
    return nuevoCierre.id;
  }

  try {
    const docRef = await addDoc(collection(db, cierresDiariosCollection), {
      ...cierreData,
      fechaCreacion: Timestamp.now()
    });
    console.log('✅ Cierre diario guardado con ID:', docRef.id);
    return docRef.id;
  } catch (error) {
    console.error('❌ Error al guardar cierre diario:', error);
    throw error;
  }
};

export const guardarCierreTurno = async (cierreData) => {
  const payload = {
    fecha: cierreData.fecha || new Date().toLocaleDateString('es-ES'),
    total_pedidos: Number(cierreData.total_pedidos || 0),
    total_costos_envio: Number(cierreData.total_costos_envio || 0),
    total_ventas_pesos: Number(cierreData.total_ventas_pesos || 0)
  };

  if (USE_LOCAL_STORAGE || !db) {
    const cierres = getLocalData(cierresTurnoCollection);
    const nuevoCierre = {
      id: String(Date.now()),
      ...payload,
      fechaCreacion: new Date().toISOString()
    };
    setLocalData(cierresTurnoCollection, [nuevoCierre, ...cierres]);
    return nuevoCierre.id;
  }

  const docRef = await addDoc(collection(db, cierresTurnoCollection), {
    ...payload,
    fechaCreacion: Timestamp.now()
  });
  return docRef.id;
};

