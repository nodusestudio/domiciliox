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
  Timestamp 
} from 'firebase/firestore';
import { db, auth } from '../config/firebase';
import toast from 'react-hot-toast';

// ==================== CONFIGURACIÓN ADAPTADOR LOCAL ====================
// Cambiar a 'true' para usar localStorage, 'false' para Firebase
const USE_LOCAL_STORAGE = false;

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

// Versión FIREBASE
const getPedidosFirebase = async () => {
  try {
    console.log("Obteniendo pedidos desde Firebase...");
    
    // Primero intentar obtener todos los pedidos sin filtro de usuario
    const querySnapshot = await getDocs(
      query(
        collection(db, pedidosCollection),
        orderBy('fecha', 'desc')
      )
    );
    
    const pedidos = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    console.log(`Total de pedidos encontrados en Firebase: ${pedidos.length}`);
    return pedidos;
  } catch (error) {
    console.error('Error al obtener pedidos:', error);
    toast.error('Error al cargar pedidos');
    return [];
  }
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

// Versión FIREBASE
const addPedidoFirebase = async (pedidoData) => {
  try {
    const pedido = {
      cliente: pedidoData.cliente || '',
      direccion: pedidoData.direccion || '',
      telefono: pedidoData.telefono || '',
      productos_pedido: pedidoData.productos_pedido || [],
      total: pedidoData.total || 0,
      metodo_pago: pedidoData.metodo_pago || 'Efectivo',
      repartidor_id: pedidoData.repartidor_id || null,
      estado: pedidoData.estado || 'Recibido',
      fecha: Timestamp.now()
    };

    const docRef = await addDoc(collection(db, pedidosCollection), pedido);
    toast.success('Información guardada con éxito');
    return { id: docRef.id, ...pedido };
  } catch (error) {
    console.error('Error al agregar pedido:', error);
    toast.error('Error al guardar pedido');
    throw error;
  }
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

// Versión FIREBASE
const updatePedidoFirebase = async (id, pedidoData) => {
  try {
    await updateDoc(doc(db, pedidosCollection, id), pedidoData);
    toast.success('Información guardada con éxito');
  } catch (error) {
    console.error('Error al actualizar pedido:', error);
    toast.error('Error al actualizar pedido');
    throw error;
  }
};

export const updatePedido = USE_LOCAL_STORAGE ? updatePedidoLocal : updatePedidoFirebase;

// Versión LOCAL
const deletePedidoLocal = (id) => {
  const pedidos = getLocalData('pedidos_domicilio');
  const filtrados = pedidos.filter(p => p.id !== id);
  setLocalData('pedidos_domicilio', filtrados);
  toast.success('Información guardada con éxito');
};

// Versión FIREBASE
const deletePedidoFirebase = async (id) => {
  try {
    await deleteDoc(doc(db, pedidosCollection, id));
    toast.success('Información guardada con éxito');
  } catch (error) {
    console.error('Error al eliminar pedido:', error);
    toast.error('Error al eliminar pedido');
    throw error;
  }
};

export const deletePedido = USE_LOCAL_STORAGE ? deletePedidoLocal : deletePedidoFirebase;

// ==================== REPARTIDORES ====================
export const repartidoresCollection = 'repartidores';

// Versión LOCAL
const getRepartidoresLocal = () => {
  return getLocalData('repartidores');
};

// Versión FIREBASE
const getRepartidoresFirebase = async () => {
  try {
    console.log("Obteniendo repartidores desde Firebase...");
    
    const querySnapshot = await getDocs(
      collection(db, repartidoresCollection)
    );
    
    const repartidores = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    console.log(`Total de repartidores encontrados en Firebase: ${repartidores.length}`);
    return repartidores;
  } catch (error) {
    console.error('Error al obtener repartidores:', error);
    toast.error('Error al cargar repartidores');
    return [];
  }
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

// Versión FIREBASE
const addRepartidorFirebase = async (repartidorData) => {
  try {
    const repartidor = {
      nombre: repartidorData.nombre || '',
      vehiculo: repartidorData.vehiculo || '',
      placa: repartidorData.placa || '',
      telefono: repartidorData.telefono || '',
      disponibilidad: repartidorData.disponibilidad !== undefined ? repartidorData.disponibilidad : true,
      fechaRegistro: Timestamp.now()
    };

    const docRef = await addDoc(collection(db, repartidoresCollection), repartidor);
    toast.success('Información guardada con éxito');
    return { id: docRef.id, ...repartidor };
  } catch (error) {
    console.error('Error al agregar repartidor:', error);
    toast.error('Error al guardar repartidor');
    throw error;
  }
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

// Versión FIREBASE
const updateRepartidorFirebase = async (id, repartidorData) => {
  try {
    await updateDoc(doc(db, repartidoresCollection, id), repartidorData);
    toast.success('Información guardada con éxito');
  } catch (error) {
    console.error('Error al actualizar repartidor:', error);
    toast.error('Error al actualizar repartidor');
    throw error;
  }
};

export const updateRepartidor = USE_LOCAL_STORAGE ? updateRepartidorLocal : updateRepartidorFirebase;

// Versión LOCAL
const deleteRepartidorLocal = (id) => {
  const repartidores = getLocalData('repartidores');
  const filtrados = repartidores.filter(r => r.id !== id);
  setLocalData('repartidores', filtrados);
  toast.success('Información guardada con éxito');
};

// Versión FIREBASE
const deleteRepartidorFirebase = async (id) => {
  try {
    await deleteDoc(doc(db, repartidoresCollection, id));
    toast.success('Información guardada con éxito');
  } catch (error) {
    console.error('Error al eliminar repartidor:', error);
    toast.error('Error al eliminar repartidor');
    throw error;
  }
};

export const deleteRepartidor = USE_LOCAL_STORAGE ? deleteRepartidorLocal : deleteRepartidorFirebase;

// ==================== CLIENTES ====================
export const clientesCollection = 'clientes';

// Versión LOCAL
const getClientesLocal = () => {
  return getLocalData('clientes');
};

// Versión FIREBASE
const getClientesFirebase = async () => {
  try {
    console.log("Obteniendo clientes desde Firebase...");
    
    const querySnapshot = await getDocs(
      collection(db, clientesCollection)
    );
    
    const clientes = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    console.log(`Total de clientes encontrados en Firebase: ${clientes.length}`);
    return clientes;
  } catch (error) {
    console.error('Error al obtener clientes:', error);
    toast.error('Error al cargar clientes');
    return [];
  }
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

// Versión FIREBASE
const addClienteFirebase = async (clienteData) => {
  try {
    const cliente = {
      nombre: clienteData.nombre || '',
      direccion_habitual: clienteData.direccion_habitual || '',
      telefono: clienteData.telefono || '',
      email: clienteData.email || '',
      fechaRegistro: Timestamp.now()
    };

    const docRef = await addDoc(collection(db, clientesCollection), cliente);
    toast.success('Información guardada con éxito');
    return { id: docRef.id, ...cliente };
  } catch (error) {
    console.error('Error al agregar cliente:', error);
    toast.error('Error al guardar cliente');
    throw error;
  }
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

// Versión FIREBASE
const updateClienteFirebase = async (id, clienteData) => {
  try {
    await updateDoc(doc(db, clientesCollection, id), clienteData);
    toast.success('Información guardada con éxito');
  } catch (error) {
    console.error('Error al actualizar cliente:', error);
    toast.error('Error al actualizar cliente');
    throw error;
  }
};

export const updateCliente = USE_LOCAL_STORAGE ? updateClienteLocal : updateClienteFirebase;

// Versión LOCAL
const deleteClienteLocal = (id) => {
  const clientes = getLocalData('clientes');
  const filtrados = clientes.filter(c => c.id !== id);
  setLocalData('clientes', filtrados);
  toast.success('Información guardada con éxito');
};

// Versión FIREBASE
const deleteClienteFirebase = async (id) => {
  try {
    await deleteDoc(doc(db, clientesCollection, id));
    toast.success('Información guardada con éxito');
  } catch (error) {
    console.error('Error al eliminar cliente:', error);
    toast.error('Error al eliminar cliente');
    throw error;
  }
};

export const deleteCliente = USE_LOCAL_STORAGE ? deleteClienteLocal : deleteClienteFirebase;

// ==================== FUNCIONES ADICIONALES ====================

// Importar clientes desde Excel (guardar en localStorage)
export const importarClientesLocal = (clientesArray) => {
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
  return nuevosClientes.length;
};

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
