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
import { db } from '../config/firebase';
import toast from 'react-hot-toast';

// ==================== PEDIDOS DOMICILIO ====================
export const pedidosCollection = 'pedidos_domicilio';

export const getPedidos = async () => {
  try {
    const querySnapshot = await getDocs(
      query(collection(db, pedidosCollection), orderBy('fechaCreacion', 'desc'))
    );
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('Error al obtener pedidos:', error);
    toast.error('Error al cargar pedidos');
    return [];
  }
};

export const addPedido = async (pedido) => {
  try {
    const pedidoConFecha = {
      ...pedido,
      fechaCreacion: Timestamp.now(),
      estado: pedido.estado || 'pendiente'
    };
    await addDoc(collection(db, pedidosCollection), pedidoConFecha);
    toast.success('Información guardada con éxito');
  } catch (error) {
    console.error('Error al agregar pedido:', error);
    toast.error('Error al guardar pedido');
    throw error;
  }
};

export const updatePedido = async (id, pedido) => {
  try {
    await updateDoc(doc(db, pedidosCollection, id), pedido);
    toast.success('Información guardada con éxito');
  } catch (error) {
    console.error('Error al actualizar pedido:', error);
    toast.error('Error al actualizar pedido');
    throw error;
  }
};

export const deletePedido = async (id) => {
  try {
    await deleteDoc(doc(db, pedidosCollection, id));
    toast.success('Información guardada con éxito');
  } catch (error) {
    console.error('Error al eliminar pedido:', error);
    toast.error('Error al eliminar pedido');
    throw error;
  }
};

// ==================== REPARTIDORES ====================
export const repartidoresCollection = 'repartidores';

export const getRepartidores = async () => {
  try {
    const querySnapshot = await getDocs(collection(db, repartidoresCollection));
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('Error al obtener repartidores:', error);
    toast.error('Error al cargar repartidores');
    return [];
  }
};

export const addRepartidor = async (repartidor) => {
  try {
    await addDoc(collection(db, repartidoresCollection), {
      ...repartidor,
      activo: true,
      fechaRegistro: Timestamp.now()
    });
    toast.success('Información guardada con éxito');
  } catch (error) {
    console.error('Error al agregar repartidor:', error);
    toast.error('Error al guardar repartidor');
    throw error;
  }
};

export const updateRepartidor = async (id, repartidor) => {
  try {
    await updateDoc(doc(db, repartidoresCollection, id), repartidor);
    toast.success('Información guardada con éxito');
  } catch (error) {
    console.error('Error al actualizar repartidor:', error);
    toast.error('Error al actualizar repartidor');
    throw error;
  }
};

export const deleteRepartidor = async (id) => {
  try {
    await deleteDoc(doc(db, repartidoresCollection, id));
    toast.success('Información guardada con éxito');
  } catch (error) {
    console.error('Error al eliminar repartidor:', error);
    toast.error('Error al eliminar repartidor');
    throw error;
  }
};

// ==================== CLIENTES ====================
export const clientesCollection = 'clientes';

export const getClientes = async () => {
  try {
    const querySnapshot = await getDocs(collection(db, clientesCollection));
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('Error al obtener clientes:', error);
    toast.error('Error al cargar clientes');
    return [];
  }
};

export const addCliente = async (cliente) => {
  try {
    await addDoc(collection(db, clientesCollection), {
      ...cliente,
      fechaRegistro: Timestamp.now()
    });
    toast.success('Información guardada con éxito');
  } catch (error) {
    console.error('Error al agregar cliente:', error);
    toast.error('Error al guardar cliente');
    throw error;
  }
};

export const updateCliente = async (id, cliente) => {
  try {
    await updateDoc(doc(db, clientesCollection, id), cliente);
    toast.success('Información guardada con éxito');
  } catch (error) {
    console.error('Error al actualizar cliente:', error);
    toast.error('Error al actualizar cliente');
    throw error;
  }
};

export const deleteCliente = async (id) => {
  try {
    await deleteDoc(doc(db, clientesCollection, id));
    toast.success('Información guardada con éxito');
  } catch (error) {
    console.error('Error al eliminar cliente:', error);
    toast.error('Error al eliminar cliente');
    throw error;
  }
};
