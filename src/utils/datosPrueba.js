import { addCliente, addRepartidor, addPedido } from '../services/firebaseService';

/**
 * Datos de prueba para cargar en Firebase
 */

const clientesPrueba = [
  { nombre: 'María González', direccion_habitual: 'Calle 10 #45-67', telefono: '3001234567', email: 'maria@example.com' },
  { nombre: 'Carlos Rodríguez', direccion_habitual: 'Carrera 15 #23-89', telefono: '3109876543', email: 'carlos@example.com' },
  { nombre: 'Ana Martínez', direccion_habitual: 'Avenida 7 #12-34', telefono: '3201112233', email: 'ana@example.com' },
  { nombre: 'Luis Pérez', direccion_habitual: 'Calle 20 #56-78', telefono: '3154445566', email: 'luis@example.com' },
  { nombre: 'Laura Sánchez', direccion_habitual: 'Carrera 8 #90-12', telefono: '3167778899', email: 'laura@example.com' },
  { nombre: 'Jorge Ramírez', direccion_habitual: 'Calle 5 #34-56', telefono: '3189990011', email: 'jorge@example.com' },
  { nombre: 'Diana Torres', direccion_habitual: 'Carrera 12 #78-90', telefono: '3003334455', email: 'diana@example.com' },
  { nombre: 'Pedro Gómez', direccion_habitual: 'Avenida 3 #23-45', telefono: '3105556677', email: 'pedro@example.com' }
];

const repartidoresPrueba = [
  { nombre: 'Juan Delivery', vehiculo: 'Moto', placa: 'ABC123', telefono: '3112223344', disponibilidad: true },
  { nombre: 'Miguel Express', vehiculo: 'Moto', placa: 'XYZ789', telefono: '3124445566', disponibilidad: true },
  { nombre: 'Roberto Fast', vehiculo: 'Bicicleta', placa: 'BIC001', telefono: '3136667788', disponibilidad: true }
];

const generarPedidosPrueba = (clientes, repartidores) => {
  const estados = ['Entregado', 'Entregado', 'Entregado', 'En camino', 'Recibido'];
  const metodosPago = ['Efectivo', 'Transferencia', 'Tarjeta'];
  
  const pedidos = [];
  const hoy = new Date();
  
  // Generar 15 pedidos aleatorios
  for (let i = 0; i < 15; i++) {
    const diasAtras = Math.floor(Math.random() * 30); // Últimos 30 días
    const fecha = new Date(hoy);
    fecha.setDate(fecha.getDate() - diasAtras);
    
    const clienteAleatorio = clientes[Math.floor(Math.random() * clientes.length)];
    const repartidorAleatorio = repartidores[Math.floor(Math.random() * repartidores.length)];
    const estado = estados[Math.floor(Math.random() * estados.length)];
    const metodoPago = metodosPago[Math.floor(Math.random() * metodosPago.length)];
    const total = 15000 + Math.floor(Math.random() * 50000); // Entre $15,000 y $65,000
    
    pedidos.push({
      cliente: clienteAleatorio.nombre,
      direccion: clienteAleatorio.direccion_habitual,
      telefono: clienteAleatorio.telefono,
      productos_pedido: [],
      total: total,
      metodo_pago: metodoPago,
      repartidor_id: repartidorAleatorio.id,
      estado: estado,
      timestamp: fecha.toISOString(),
      fecha: fecha
    });
  }
  
  return pedidos;
};

/**
 * Cargar todos los datos de prueba en Firebase
 */
export const cargarDatosPrueba = async () => {
  try {
    console.log('🚀 Iniciando carga de datos de prueba...');
    
    // 1. Cargar clientes
    console.log('📋 Cargando clientes...');
    const clientesCargados = [];
    for (const cliente of clientesPrueba) {
      const clienteCreado = await addCliente(cliente);
      clientesCargados.push(clienteCreado);
      await new Promise(resolve => setTimeout(resolve, 200)); // Esperar 200ms entre cada uno
    }
    console.log(`✅ ${clientesCargados.length} clientes cargados`);
    
    // 2. Cargar repartidores
    console.log('🏍️ Cargando repartidores...');
    const repartidoresCargados = [];
    for (const repartidor of repartidoresPrueba) {
      const repartidorCreado = await addRepartidor(repartidor);
      repartidoresCargados.push(repartidorCreado);
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    console.log(`✅ ${repartidoresCargados.length} repartidores cargados`);
    
    // 3. Generar y cargar pedidos
    console.log('📦 Generando pedidos...');
    const pedidosGenerados = generarPedidosPrueba(clientesCargados, repartidoresCargados);
    for (const pedido of pedidosGenerados) {
      await addPedido(pedido);
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    console.log(`✅ ${pedidosGenerados.length} pedidos cargados`);
    
    console.log('🎉 ¡Datos de prueba cargados exitosamente!');
    return {
      clientes: clientesCargados.length,
      repartidores: repartidoresCargados.length,
      pedidos: pedidosGenerados.length
    };
  } catch (error) {
    console.error('❌ Error al cargar datos de prueba:', error);
    throw error;
  }
};
