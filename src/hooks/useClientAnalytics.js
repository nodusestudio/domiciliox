import { useMemo } from 'react';

export const useClientAnalytics = (pedidos) => {
  const clientStats = useMemo(() => {
    if (!pedidos || pedidos.length === 0) return [];

    // Agrupar pedidos por cliente
    const clientesMap = {};

    pedidos.forEach(pedido => {
      const cliente = pedido.cliente;
      if (!clientesMap[cliente]) {
        clientesMap[cliente] = {
          nombre: cliente,
          pedidos: [],
          totalGastado: 0,
          cantidadPedidos: 0
        };
      }

      clientesMap[cliente].pedidos.push({
        fecha: new Date(pedido.timestamp || pedido.fecha),
        valor: pedido.valor_pedido || 0,
        timestamp: pedido.timestamp,
        direccion: pedido.direccion,
        telefono: pedido.telefono
      });
      clientesMap[cliente].totalGastado += pedido.valor_pedido || 0;
      clientesMap[cliente].cantidadPedidos++;
    });

    // Calcular estadísticas para cada cliente
    const stats = Object.values(clientesMap).map(cliente => {
      // Ordenar pedidos por fecha
      cliente.pedidos.sort((a, b) => a.fecha - b.fecha);

      // Calcular promedio de días entre pedidos
      let promedioDias = 0;
      if (cliente.pedidos.length > 1) {
        const diferencias = [];
        for (let i = 1; i < cliente.pedidos.length; i++) {
          const diff = (cliente.pedidos[i].fecha - cliente.pedidos[i - 1].fecha) / (1000 * 60 * 60 * 24);
          diferencias.push(diff);
        }
        promedioDias = diferencias.reduce((a, b) => a + b, 0) / diferencias.length;
      }

      // Gasto promedio
      const gastoPromedio = cliente.totalGastado / cliente.cantidadPedidos;

      // Última fecha
      const ultimaFecha = cliente.pedidos[cliente.pedidos.length - 1].fecha;

      return {
        nombre: cliente.nombre,
        cantidadPedidos: cliente.cantidadPedidos,
        totalGastado: cliente.totalGastado,
        gastoPromedio: gastoPromedio,
        promedioDias: promedioDias,
        ultimaFecha: ultimaFecha,
        pedidos: cliente.pedidos,
        direccion: cliente.pedidos[0].direccion,
        telefono: cliente.pedidos[0].telefono
      };
    });

    return stats;
  }, [pedidos]);

  // Top 10 clientes
  const top10Clientes = useMemo(() => {
    return [...clientStats]
      .sort((a, b) => b.cantidadPedidos - a.cantidadPedidos)
      .slice(0, 10);
  }, [clientStats]);

  // Flujo de pedidos por fecha
  const flujoPedidos = useMemo(() => {
    if (!pedidos || pedidos.length === 0) return [];

    const pedidosPorFecha = {};
    
    pedidos.forEach(pedido => {
      const fecha = new Date(pedido.timestamp || pedido.fecha);
      const fechaKey = fecha.toLocaleDateString('es-ES');
      
      if (!pedidosPorFecha[fechaKey]) {
        pedidosPorFecha[fechaKey] = {
          fecha: fechaKey,
          cantidad: 0,
          total: 0
        };
      }
      
      pedidosPorFecha[fechaKey].cantidad++;
      pedidosPorFecha[fechaKey].total += pedido.valor_pedido || 0;
    });

    return Object.values(pedidosPorFecha)
      .sort((a, b) => {
        const [diaA, mesA, anoA] = a.fecha.split('/');
        const [diaB, mesB, anoB] = b.fecha.split('/');
        return new Date(anoA, mesA - 1, diaA) - new Date(anoB, mesB - 1, diaB);
      });
  }, [pedidos]);

  return {
    clientStats,
    top10Clientes,
    flujoPedidos
  };
};
