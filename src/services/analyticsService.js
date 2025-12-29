// Motor Analítico Avanzado para DomicilioX

/**
 * Calcula el promedio de días entre pedidos consecutivos de un cliente
 * 
 * Algoritmo Inteligente:
 * 1. Ordena cronológicamente todos los pedidos del cliente
 * 2. Calcula la diferencia en días entre cada par de pedidos consecutivos
 * 3. Promedia todas las diferencias para obtener la frecuencia típica
 * 
 * Utilidad Comercial:
 * - Identifica patrones de consumo (cliente semanal, quincenal, mensual)
 * - Permite predecir cuándo volverá a pedir un cliente
 * - Base para alertas de inactividad y campañas de reactivación
 * 
 * @param {Array} pedidos - Array de objetos pedido con campos timestamp o fecha
 * @returns {number} Promedio de días entre pedidos (0 si hay menos de 2 pedidos)
 */
export const calcularFrecuenciaPedidos = (pedidos) => {
  if (!pedidos || pedidos.length < 2) return 0;

  // Ordenar pedidos cronológicamente (más antiguo primero)
  const pedidosOrdenados = [...pedidos].sort((a, b) => {
    const fechaA = new Date(a.timestamp || a.fecha);
    const fechaB = new Date(b.timestamp || b.fecha);
    return fechaA - fechaB;
  });

  // Calcular diferencia en días entre cada par de pedidos consecutivos
  const diferencias = [];
  for (let i = 1; i < pedidosOrdenados.length; i++) {
    const fechaActual = new Date(pedidosOrdenados[i].timestamp || pedidosOrdenados[i].fecha);
    const fechaAnterior = new Date(pedidosOrdenados[i - 1].timestamp || pedidosOrdenados[i - 1].fecha);
    const diff = (fechaActual - fechaAnterior) / (1000 * 60 * 60 * 24); // Conversión de ms a días
    diferencias.push(diff);
  }

  // Calcular promedio aritmético de todas las diferencias
  const promedio = diferencias.reduce((a, b) => a + b, 0) / diferencias.length;
  return Math.round(promedio);
};

/**
 * Calcula el valor promedio de compra (ticket promedio) de un cliente
 * 
 * Algoritmo:
 * 1. Suma todos los valores de pedidos del cliente
 * 2. Divide entre el número total de pedidos
 * 
 * Utilidad Comercial:
 * - Segmenta clientes por poder adquisitivo (alto, medio, bajo valor)
 * - Permite crear ofertas personalizadas según capacidad de gasto
 * - Identifica oportunidades de upselling en clientes de bajo ticket
 * - Métrica clave para calcular el Customer Lifetime Value (CLV)
 * 
 * @param {Array} pedidos - Array de objetos pedido con campo valor_pedido
 * @returns {number} Valor promedio de compra redondeado a entero
 */
export const calcularTicketPromedio = (pedidos) => {
  if (!pedidos || pedidos.length === 0) return 0;
  
  const total = pedidos.reduce((sum, p) => sum + (p.valor_pedido || 0), 0);
  return Math.round(total / pedidos.length);
};

/**
 * Identifica el día de la semana en que el cliente más frecuentemente realiza pedidos
 * 
 * Algoritmo:
 * 1. Crea un contador para cada día de la semana (0=Domingo, 6=Sábado)
 * 2. Recorre todos los pedidos y cuenta ocurrencias por día
 * 3. Retorna el nombre del día con mayor frecuencia
 * 
 * Utilidad Comercial:
 * - Permite programar promociones en días específicos para cada cliente
 * - Ayuda a predecir demanda por día de la semana
 * - Optimiza logística al anticipar días de mayor actividad
 * - Base para recordatorios automáticos personalizados
 * 
 * @param {Array} pedidos - Array de objetos pedido con campo timestamp o fecha
 * @returns {string} Nombre del día de la semana más frecuente ('Lunes', 'Martes', etc.)
 */
export const calcularDiaFavorito = (pedidos) => {
  if (!pedidos || pedidos.length === 0) return 'N/A';

  const diasSemana = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  const contadorDias = new Array(7).fill(0);

  // Contar pedidos por día de la semana
  pedidos.forEach(pedido => {
    const fecha = new Date(pedido.timestamp || pedido.fecha);
    const dia = fecha.getDay(); // 0=Domingo, 1=Lunes, ..., 6=Sábado
    contadorDias[dia]++;
  });

  // Encontrar el día con mayor cantidad de pedidos
  const diaMaxIndex = contadorDias.indexOf(Math.max(...contadorDias));
  return diasSemana[diaMaxIndex];
};

/**
 * Calcula cuántos días han pasado desde el último pedido del cliente
 * 
 * Algoritmo:
 * 1. Encuentra la fecha más reciente entre todos los pedidos
 * 2. Calcula la diferencia en días entre hoy y esa fecha
 * 3. Redondea hacia abajo para obtener días completos
 * 
 * Utilidad Comercial:
 * - Métrica crítica para detectar clientes en riesgo de abandono
 * - Activa alertas de reactivación cuando supera umbrales
 * - Permite segmentar clientes activos vs inactivos
 * - Input principal para campañas de recuperación de clientes
 * 
 * @param {Array} pedidos - Array de objetos pedido con campo timestamp o fecha
 * @returns {number|null} Días completos desde el último pedido (null si no hay pedidos)
 */
export const calcularDiasDesdeUltimoPedido = (pedidos) => {
  if (!pedidos || pedidos.length === 0) return null;

  // Encontrar la fecha más reciente de todos los pedidos
  const ultimaFecha = new Date(Math.max(...pedidos.map(p => new Date(p.timestamp || p.fecha))));
  const hoy = new Date();
  const diff = (hoy - ultimaFecha) / (1000 * 60 * 60 * 24); // Conversión de ms a días
  
  return Math.floor(diff); // Redondear hacia abajo para días completos
};

/**
 * Detecta clientes en riesgo de abandono basándose en patrones de comportamiento
 * 
 * Criterios de Detección:
 * - Cliente debe tener frecuencia establecida (promedio > 0 días)
 * - Cliente debe ser frecuente (pide cada 5 días o menos)
 * - Cliente no ha pedido en 10+ días (el doble de su frecuencia normal)
 * 
 * Lógica de Negocio:
 * Si un cliente que normalmente pide cada 3-5 días lleva 10+ días sin pedir,
 * es una anomalía que requiere intervención (llamada, promoción, recordatorio)
 * 
 * Utilidad Comercial:
 * - Prioriza clientes valiosos que están abandonando
 * - Automatiza alertas de recuperación antes de perder al cliente
 * - Maximiza retención enfocándose en clientes de alta frecuencia
 * - ROI alto: recuperar un cliente existente es 5x más barato que adquirir uno nuevo
 * 
 * @param {Array} clientesStats - Array de objetos cliente con campo pedidos
 * @returns {Array} Clientes que cumplen criterios de inactividad anómala
 */
export const detectarClientesInactivos = (clientesStats) => {
  return clientesStats.filter(cliente => {
    const promedioDias = calcularFrecuenciaPedidos(cliente.pedidos);
    const diasDesdeUltimo = calcularDiasDesdeUltimoPedido(cliente.pedidos);
    
    // Filtrar solo clientes frecuentes (<=5 días) que llevan 10+ días inactivos
    return promedioDias > 0 && promedioDias <= 5 && diasDesdeUltimo >= 10;
  });
};

/**
 * Calcula el crecimiento del valor de compra del cliente a lo largo del tiempo
 * 
 * Algoritmo:
 * 1. Divide la historia de pedidos en dos mitades (primera mitad vs segunda mitad)
 * 2. Calcula el ticket promedio de cada mitad
 * 3. Compara ambos promedios para obtener el porcentaje de crecimiento
 * 
 * Interpretación de Resultados:
 * - Positivo (+20%): Cliente está aumentando su gasto, excelente señal
 * - Neutro (0%): Cliente mantiene gasto estable, predecible
 * - Negativo (-15%): Cliente está reduciendo gasto, riesgo de abandono
 * 
 * Utilidad Comercial:
 * - Identifica clientes en crecimiento para programas VIP
 * - Detecta deterioro en la relación antes de perder al cliente
 * - Mide efectividad de estrategias de upselling
 * - Prioriza recursos en clientes con tendencia positiva
 * 
 * @param {Array} pedidos - Array de objetos pedido con campo valor_pedido
 * @returns {number} Porcentaje de crecimiento (positivo o negativo)
 */
export const calcularCrecimiento = (pedidos) => {
  if (!pedidos || pedidos.length < 2) return 0;

  // Ordenar cronológicamente para dividir en antes/después
  const pedidosOrdenados = [...pedidos].sort((a, b) => {
    const fechaA = new Date(a.timestamp || a.fecha);
    const fechaB = new Date(b.timestamp || b.fecha);
    return fechaA - fechaB;
  });

  // Dividir historia en dos mitades
  const mitad = Math.floor(pedidosOrdenados.length / 2);
  const primerosPedidos = pedidosOrdenados.slice(0, mitad);
  const ultimosPedidos = pedidosOrdenados.slice(mitad);

  // Calcular ticket promedio de cada mitad
  const promedioPrimeros = primerosPedidos.reduce((sum, p) => sum + (p.valor_pedido || 0), 0) / primerosPedidos.length;
  const promedioUltimos = ultimosPedidos.reduce((sum, p) => sum + (p.valor_pedido || 0), 0) / ultimosPedidos.length;

  // Calcular porcentaje de cambio
  const crecimiento = ((promedioUltimos - promedioPrimeros) / promedioPrimeros) * 100;
  return Math.round(crecimiento);
};

/**
 * Agrupa todos los pedidos por mes para visualización de tendencias temporales
 * 
 * Algoritmo:
 * 1. Extrae el mes y año de cada pedido (ej: "ene 2025")
 * 2. Agrupa pedidos por mes acumulando cantidad y valor total
 * 3. Ordena cronológicamente los meses resultantes
 * 
 * Formato de Salida:
 * [{
 *   mes: 'ene 2025',
 *   cantidad: 15,      // Total de pedidos en ese mes
 *   total: 850000      // Suma de valores de todos los pedidos
 * }, ...]
 * 
 * Utilidad Comercial:
 * - Visualiza estacionalidad y tendencias de ventas mensuales
 * - Identifica meses de alta/baja demanda para planificar inventario
 * - Detecta patrones de crecimiento o decrecimiento del negocio
 * - Base para gráficos de línea y área en dashboards analíticos
 * - Permite comparar año contra año para medir crecimiento
 * 
 * @param {Array} pedidos - Array de objetos pedido con campos timestamp/fecha y valor_pedido
 * @returns {Array} Array de objetos agrupados por mes ordenados cronológicamente
 */
export const agruparPedidosPorMes = (pedidos) => {
  if (!pedidos || pedidos.length === 0) return [];

  const pedidosPorMes = {};

  // Agrupar pedidos por mes y año
  pedidos.forEach(pedido => {
    const fecha = new Date(pedido.timestamp || pedido.fecha);
    const mesAno = `${fecha.toLocaleDateString('es-ES', { month: 'short' })} ${fecha.getFullYear()}`;
    
    if (!pedidosPorMes[mesAno]) {
      pedidosPorMes[mesAno] = {
        mes: mesAno,
        cantidad: 0,
        total: 0
      };
    }
    
    pedidosPorMes[mesAno].cantidad++;
    pedidosPorMes[mesAno].total += pedido.valor_pedido || 0;
  });

  // Convertir objeto a array y ordenar cronológicamente
  return Object.values(pedidosPorMes).sort((a, b) => {
    const [mesA, anoA] = a.mes.split(' ');
    const [mesB, anoB] = b.mes.split(' ');
    const mesesMap = { ene: 0, feb: 1, mar: 2, abr: 3, may: 4, jun: 5, jul: 6, ago: 7, sep: 8, oct: 9, nov: 10, dic: 11 };
    return new Date(anoA, mesesMap[mesA.toLowerCase()]) - new Date(anoB, mesesMap[mesB.toLowerCase()]);
  });
};

/**
 * Exporta el perfil completo de un cliente a un archivo Excel profesional
 * 
 * Contenido del Archivo:
 * 1. Encabezado con datos de contacto del cliente
 * 2. Panel de estadísticas clave (12 métricas analíticas)
 * 3. Historial completo de todos los pedidos del cliente
 * 
 * Utilidad Comercial:
 * - Genera reportes ejecutivos para análisis de clientes VIP
 * - Documenta patrones de comportamiento para estrategias comerciales
 * - Permite compartir perfiles con equipos de ventas/marketing
 * - Base para presentaciones a stakeholders sobre clientes clave
 * - Respaldo documental para decisiones de crédito o descuentos
 * 
 * @param {Object} cliente - Objeto con datos completos del cliente y sus pedidos
 * @param {Object} XLSX - Librería xlsx para generación de archivos Excel
 * @throws {Error} Si falla la generación o descarga del archivo
 */
export const exportarPerfilInteligente = (cliente, XLSX) => {
  try {
    // Estructura de datos para el Excel
    const datos = [
      ['PERFIL INTELIGENTE DE CLIENTE'],
      [],
      ['Cliente:', cliente.nombre],
      ['Dirección:', cliente.direccion],
      ['Teléfono:', cliente.telefono],
      [],
      ['ESTADÍSTICAS'],
      ['Total Pedidos:', cliente.cantidadPedidos],
      ['Gasto Total:', `$${cliente.totalGastado.toLocaleString()}`],
      ['Ticket Promedio:', `$${Math.round(cliente.gastoPromedio).toLocaleString()}`],
      ['Frecuencia Promedio:', `${cliente.promedioDias} días`],
      ['Día Favorito:', calcularDiaFavorito(cliente.pedidos)],
      ['Último Pedido:', cliente.ultimaFecha.toLocaleDateString('es-ES')],
      ['Días desde último pedido:', calcularDiasDesdeUltimoPedido(cliente.pedidos)],
      ['Crecimiento:', `${calcularCrecimiento(cliente.pedidos)}%`],
      [],
      ['HISTORIAL DE PEDIDOS'],
      ['Fecha', 'Valor', 'Dirección']
    ];

    // Agregar cada pedido al historial
    cliente.pedidos.forEach(pedido => {
      datos.push([
        pedido.fecha.toLocaleDateString('es-ES'),
        `$${pedido.valor.toLocaleString()}`,
        pedido.direccion
      ]);
    });

    // Crear archivo Excel
    const ws = XLSX.utils.aoa_to_sheet(datos);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Perfil Cliente');
    
    // Descargar archivo con nombre personalizado
    const nombreArchivo = `Perfil_${cliente.nombre.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, nombreArchivo);
  } catch (error) {
    throw new Error('Error al generar el archivo Excel del perfil del cliente');
  }
};
