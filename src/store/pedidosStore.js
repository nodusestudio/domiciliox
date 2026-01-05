import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Store de Zustand con Persistencia para Despacho Rápido
 * 
 * Funcionalidad:
 * - Persistencia automática en localStorage
 * - Hydration automática al recargar la página
 * - Estado sincronizado entre pestañas
 * 
 * Datos persistidos:
 * - pedidos: Lista de pedidos del día
 * - historialCostos: Memoria de costos de envío por dirección
 */
export const usePedidosStore = create(
  persist(
    (set, get) => ({
      // Estado
      pedidos: [],
      historialCostos: {},
      datosInicialesCargados: false,

      // Acciones
      setPedidos: (pedidos) => set({ pedidos }),

      agregarPedido: (pedido) => set((state) => ({
        pedidos: [...state.pedidos, pedido]
      })),

      actualizarPedido: (id, cambios) => set((state) => ({
        pedidos: state.pedidos.map(p => 
          p.id === id ? { ...p, ...cambios } : p
        )
      })),

      eliminarPedido: (id) => set((state) => ({
        pedidos: state.pedidos.filter(p => p.id !== id)
      })),

      limpiarPedidos: () => set({ pedidos: [] }),

      setHistorialCostos: (historial) => set({ historialCostos: historial }),

      actualizarHistorialCosto: (direccion, costo) => set((state) => ({
        historialCostos: {
          ...state.historialCostos,
          [direccion]: costo
        }
      })),

      setDatosInicialesCargados: (cargado) => set({ datosInicialesCargados: cargado }),

      // Acción para inicializar datos desde Firebase
      cargarDatosIniciales: async (pedidosIniciales, historialInicial) => {
        set({
          pedidos: pedidosIniciales || [],
          historialCostos: historialInicial || {},
          datosInicialesCargados: true
        });
      },

      // Toggle de estados
      toggleMetodoPago: (id) => set((state) => ({
        pedidos: state.pedidos.map(p => 
          p.id === id 
            ? { ...p, metodo_pago: p.metodo_pago === 'Efectivo' ? 'Tarjeta' : 'Efectivo' }
            : p
        )
      })),

      toggleEstadoPago: (id) => set((state) => ({
        pedidos: state.pedidos.map(p => 
          p.id === id 
            ? { ...p, estadoPago: p.estadoPago === 'pendiente' ? 'pagado' : 'pendiente' }
            : p
        )
      })),

      toggleEntregado: (id) => set((state) => ({
        pedidos: state.pedidos.map(p => 
          p.id === id 
            ? { ...p, entregado: !p.entregado }
            : p
        )
      })),

      asignarRepartidor: (id, repartidorId, repartidorNombre) => set((state) => ({
        pedidos: state.pedidos.map(p => 
          p.id === id 
            ? { ...p, repartidor_id: repartidorId, repartidor_nombre: repartidorNombre }
            : p
        )
      }))
    }),
    {
      name: 'despacho-rapido-storage', // Nombre en localStorage
      partialize: (state) => ({
        pedidos: state.pedidos,
        historialCostos: state.historialCostos
        // No persistir datosInicialesCargados para que se recargue en cada sesión
      }),
      // Hydration automática al cargar
      onRehydrateStorage: () => (state) => {
        if (state) {
          console.log('✅ Estado de despacho rápido restaurado desde localStorage');
          console.log(`📦 ${state.pedidos.length} pedidos recuperados`);
        }
      }
    }
  )
);
