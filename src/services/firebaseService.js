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
  Timestamp,
  writeBatch
} from 'firebase/firestore';
import { db, auth } from '../config/firebase';
import toast from 'react-hot-toast';

// ==================== CONFIGURACIÓN ADAPTADOR LOCAL ====================
// Cambiar a 'true' para usar localStorage, 'false' para Firebase
const USE_LOCAL_STORAGE = false;

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

// ==================== PEDIDOS DOMICILIO ====================
export const pedidosCollection = 'pedidos_domicilio';

// Versión LOCAL
const getPedidosLocal = () => {
  const pedidos = getLocalData('pedidos_domicilio');
  // Ordenar por fecha descendente (más reciente primero)
  return pedidos.sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0));
};

// Versión FIREBASE optimizada con reintentos
const getPedidosFirebase = async () => {
  return ejecutarConReintentos(async () => {
    console.log("Obteniendo pedidos desde Firebase...");
    
    const querySnapshot = await getDocs(
      query(
        collection(db, pedidosCollection),
        orderBy('fecha', 'desc')
      )
    );
    
    const pedidos = querySnapshot.docs.map(doc => {
      const data = doc.data();
      
      // Convertir Timestamp a string para evitar error React #31
      return {
        id: doc.id,
        cliente: data.cliente || '',
        direccion: data.direccion || '',
        telefono: data.telefono || '',
        productos_pedido: data.productos_pedido || [],
        total: data.total || 0,
        metodo_pago: data.metodo_pago || 'Efectivo',
        repartidor_id: data.repartidor_id || null,
        estado: data.estado || 'Recibido',
        fecha: data.fecha?.toDate
          ? data.fecha.toDate().toLocaleDateString('es-ES')
          : data.fecha || new Date().toLocaleDateString('es-ES'),
        timestamp: data.fecha?.toDate
          ? data.fecha.toDate().toISOString()
          : new Date().toISOString()
      };
    });
    
    console.log(`✅ ${pedidos.length} pedidos obtenidos de Firebase`);
    
    // Guardar en caché local como respaldo
    if (pedidos.length > 0) {
      try {
        setLocalData('pedidos_domicilio_cache', pedidos);
      } catch (e) {
        console.warn('No se pudo guardar caché de pedidos:', e);
      }
    }
    
    return pedidos;
  }, 'getPedidos').catch(error => {
    console.error('Error al obtener pedidos:', error);
    
    // Intentar usar caché local como fallback
    const cache = getLocalData('pedidos_domicilio_cache');
    if (cache && cache.length > 0) {
      toast.error('Usando datos en caché. Verifica tu conexión.');
      return cache;
    }
    
    toast.error('Error al cargar pedidos');
    return [];
  });
};

export const getPedidos = USE_LOCAL_STORAGE ? getPedidosLocal : getPedidosFirebase;

// Versión LOCAL
const addPedidoLocal = (pedidoData) => {
  const pedidos = getLocalData('pedidos_domicilio');
  const nuevoPedido = {
    id: Date.now().toString(),
    cliente: pedidoData.cliente || '',
    direccion: pedidoData.direccion || '',
    telefono: pedidoData.telefono || '',
    productos_pedido: pedidoData.productos_pedido || [],
    total: pedidoData.total || 0,
    metodo_pago: pedidoData.metodo_pago || 'Efectivo',
    repartidor_id: pedidoData.repartidor_id || null,
    estado: pedidoData.estado || 'Recibido',
    timestamp: new Date().toISOString(),
    fecha: new Date()
  };
  
  pedidos.unshift(nuevoPedido); // Agregar al inicio
  setLocalData('pedidos_domicilio', pedidos);
  toast.success('Información guardada con éxito');
  return nuevoPedido;
};

// Versión FIREBASE optimizada con reintentos
const addPedidoFirebase = async (pedidoData) => {
  return ejecutarConReintentos(async () => {
    const ahora = Timestamp.now();
    const pedido = {
      cliente: pedidoData.cliente || '',
      direccion: pedidoData.direccion || '',
      telefono: pedidoData.telefono || '',
      productos_pedido: pedidoData.productos_pedido || [],
      total: pedidoData.total || 0,
      metodo_pago: pedidoData.metodo_pago || 'Efectivo',
      repartidor_id: pedidoData.repartidor_id || null,
      estado: pedidoData.estado || 'Recibido',
      fecha: ahora
    };

    const docRef = await addDoc(collection(db, pedidosCollection), pedido);
    toast.success('Información guardada con éxito');
    
    // Devolver con fecha como string para evitar error React #31
    return { 
      id: docRef.id,
      cliente: pedido.cliente,
      direccion: pedido.direccion,
      telefono: pedido.telefono,
      productos_pedido: pedido.productos_pedido,
      total: pedido.total,
      metodo_pago: pedido.metodo_pago,
      repartidor_id: pedido.repartidor_id,
      estado: pedido.estado,
      fecha: ahora.toDate().toLocaleDateString('es-ES'),
      timestamp: ahora.toDate().toISOString()
    };
  }, 'addPedido').catch(error => {
    console.error('Error al agregar pedido:', error);
    toast.error('Error al guardar pedido. Verifica los permisos de Firebase.');
    throw error;
  });
};

export const addPedido = USE_LOCAL_STORAGE ? addPedidoLocal : addPedidoFirebase;

// Versión LOCAL
const updatePedidoLocal = (id, pedidoData) => {
  const pedidos = getLocalData('pedidos_domicilio');
  const index = pedidos.findIndex(p => p.id === id);
  
  if (index !== -1) {
    pedidos[index] = { ...pedidos[index], ...pedidoData };
    setLocalData('pedidos_domicilio', pedidos);
    toast.success('Información guardada con éxito');
  } else {
    toast.error('Pedido no encontrado');
  }
};

// Versión FIREBASE optimizada con reintentos
const updatePedidoFirebase = async (id, pedidoData) => {
  return ejecutarConReintentos(async () => {
    await updateDoc(doc(db, pedidosCollection, id), pedidoData);
    toast.success('Información guardada con éxito');
  }, 'updatePedido').catch(error => {
    console.error('Error al actualizar pedido:', error);
    toast.error('Error al actualizar pedido. Verifica los permisos.');
    throw error;
  });
};

export const updatePedido = USE_LOCAL_STORAGE ? updatePedidoLocal : updatePedidoFirebase;

// Versión LOCAL
const deletePedidoLocal = (id) => {
  const pedidos = getLocalData('pedidos_domicilio');
  const filtrados = pedidos.filter(p => p.id !== id);
  setLocalData('pedidos_domicilio', filtrados);
  toast.success('Información guardada con éxito');
};

// Versión FIREBASE optimizada con reintentos
const deletePedidoFirebase = async (id) => {
  return ejecutarConReintentos(async () => {
    await deleteDoc(doc(db, pedidosCollection, id));
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

// Versión FIREBASE optimizada con reintentos
const getRepartidoresFirebase = async () => {
  return ejecutarConReintentos(async () => {
    console.log("Obteniendo repartidores desde Firebase...");
    
    const querySnapshot = await getDocs(
      collection(db, repartidoresCollection)
    );
    
    const repartidores = querySnapshot.docs.map(doc => {
      const data = doc.data();
      
      // Convertir Timestamp a string para evitar error React #31
      return {
        id: doc.id,
        nombre: data.nombre || '',
        vehiculo: data.vehiculo || '',
        placa: data.placa || '',
        telefono: data.telefono || '',
        disponibilidad: data.disponibilidad !== undefined ? data.disponibilidad : true,
        fechaRegistro: data.fechaRegistro?.toDate
          ? data.fechaRegistro.toDate().toLocaleDateString('es-ES')
          : data.fechaRegistro || new Date().toLocaleDateString('es-ES')
      };
    });
    
    console.log(`✅ ${repartidores.length} repartidores obtenidos de Firebase`);
    
    // Guardar en caché local como respaldo
    if (repartidores.length > 0) {
      try {
        setLocalData('repartidores_cache', repartidores);
      } catch (e) {
        console.warn('No se pudo guardar caché de repartidores:', e);
      }
    }
    
    return repartidores;
  }, 'getRepartidores').catch(error => {
    console.error('Error al obtener repartidores:', error);
    
    // Intentar usar caché local como fallback
    const cache = getLocalData('repartidores_cache');
    if (cache && cache.length > 0) {
      toast.error('Usando datos en caché. Verifica tu conexión.');
      return cache;
    }
    
    toast.error('Error al cargar repartidores');
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
    const ahora = Timestamp.now();
    const repartidor = {
      nombre: repartidorData.nombre || '',
      vehiculo: repartidorData.vehiculo || '',
      placa: repartidorData.placa || '',
      telefono: repartidorData.telefono || '',
      disponibilidad: repartidorData.disponibilidad !== undefined ? repartidorData.disponibilidad : true,
      fechaRegistro: ahora
    };

    const docRef = await addDoc(collection(db, repartidoresCollection), repartidor);
    toast.success('Información guardada con éxito');
    
    // Devolver con fechaRegistro como string para evitar error React #31
    return { 
      id: docRef.id,
      nombre: repartidor.nombre,
      vehiculo: repartidor.vehiculo,
      placa: repartidor.placa,
      telefono: repartidor.telefono,
      disponibilidad: repartidor.disponibilidad,
      fechaRegistro: ahora.toDate().toLocaleDateString('es-ES')
    };
  }, 'addRepartidor').catch(error => {
    console.error('Error al agregar repartidor:', error);
    toast.error('Error al guardar repartidor. Verifica los permisos.');
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
    await updateDoc(doc(db, repartidoresCollection, id), repartidorData);
    toast.success('Información guardada con éxito');
  }, 'updateRepartidor').catch(error => {
    console.error('Error al actualizar repartidor:', error);
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
    await deleteDoc(doc(db, repartidoresCollection, id));
    toast.success('Información guardada con éxito');
  }, 'deleteRepartidor').catch(error => {
    console.error('Error al eliminar repartidor:', error);
    toast.error('Error al eliminar repartidor. Verifica los permisos.');
    throw error;
  });
};

export const deleteRepartidor = USE_LOCAL_STORAGE ? deleteRepartidorLocal : deleteRepartidorFirebase;

// ==================== CLIENTES ====================
export const clientesCollection = 'clientes';

// Versión LOCAL
const getClientesLocal = () => {
  return getLocalData('clientes');
};

// Versión FIREBASE optimizada con reintentos
const getClientesFirebase = async () => {
  return ejecutarConReintentos(async () => {
    console.log("Obteniendo clientes desde Firebase...");
    
    const querySnapshot = await getDocs(
      collection(db, clientesCollection)
    );
    
    const clientes = querySnapshot.docs.map(doc => {
      const data = doc.data();
      
      // Convertir Timestamp a string para evitar error React #31
      return {
        id: doc.id,
        nombre: data.nombre || '',
        direccion_habitual: data.direccion_habitual || '',
        telefono: data.telefono || '',
        email: data.email || '',
        fechaRegistro: data.fechaRegistro?.toDate 
          ? data.fechaRegistro.toDate().toLocaleDateString('es-ES')
          : data.fechaRegistro || new Date().toLocaleDateString('es-ES')
      };
    });
    
    console.log(`✅ ${clientes.length} clientes obtenidos de Firebase`);
    
    // Guardar en caché local como respaldo
    if (clientes.length > 0) {
      try {
        setLocalData('clientes_cache', clientes);
      } catch (e) {
        console.warn('No se pudo guardar caché de clientes:', e);
      }
    }
    
    return clientes;
  }, 'getClientes').catch(error => {
    console.error('Error al obtener clientes:', error);
    
    // Intentar usar caché local como fallback
    const cache = getLocalData('clientes_cache');
    if (cache && cache.length > 0) {
      toast.error('Usando datos en caché. Verifica tu conexión.');
      return cache;
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
    
    if (!silent) {
      console.log('✅ Cliente guardado exitosamente en Firestore con ID:', docRef.id);
      toast.success('Información guardada con éxito');
    }
    
    // Devolver con fechaRegistro como string para evitar error React #31
    return { 
      id: docRef.id, 
      nombre: cliente.nombre,
      direccion_habitual: cliente.direccion_habitual,
      telefono: cliente.telefono,
      email: cliente.email,
      fechaRegistro: ahora.toDate().toLocaleDateString('es-ES')
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

// ==================== SINCRONIZACIÓN FUTURA ====================
export const sincronizarConNube = async () => {
  try {
    const pedidos = getLocalData('pedidos_domicilio');
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
