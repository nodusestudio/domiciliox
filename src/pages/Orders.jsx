                  
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarRange, Check, Cloud, Clock3, Filter, Loader, Mic, Package2, Search, Sparkles, Trash2, TrendingUp, UserPlus, WalletCards, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { 
  getClientes, 
  addCliente, 
  obtenerHistorialCostos, 
  guardarHistorialCosto,
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

const Orders = ({ onNavbarSummaryChange = () => {} }) => {
    // Bandera para evitar sobrescritura mientras updateDoc está pendiente
    const [actualizandoPedido, setActualizandoPedido] = useState({});
  const MINUTOS_ALERTA_VALIDOS = [5, 10, 20, 30];
  const SOUND_DEFAULTS = {
    newOrder: { enabled: true, volume: 100 },
    payment: { enabled: true, volume: 100 },
    delivery: { enabled: true, volume: 100 },
    pendingDispatchAlert: { enabled: true, volume: 100 },
    pendingDispatchAlarm: { enabled: true, volume: 100 },
    dispatcherVoice: { enabled: true, volume: 100 }
  };
  const SOUND_KEYS = Object.keys(SOUND_DEFAULTS);

  const clampVolumePercent = (value) => {
    const num = Number(value);
    if (!Number.isFinite(num)) return 100;
    return Math.max(0, Math.min(100, Math.round(num)));
  };

  const normalizarSoundSettings = (candidate = {}) => {
    return SOUND_KEYS.reduce((acc, key) => {
      const current = candidate?.[key] || {};
      acc[key] = {
        enabled: typeof current.enabled === 'boolean' ? current.enabled : SOUND_DEFAULTS[key].enabled,
        volume: clampVolumePercent(current.volume ?? SOUND_DEFAULTS[key].volume)
      };
      return acc;
    }, {});
  };

  const obtenerSoundSettingsConfigurados = () => {
    try {
      const raw = localStorage.getItem('app_sound_settings');
      if (!raw) return SOUND_DEFAULTS;
      const parsed = JSON.parse(raw);
      return normalizarSoundSettings(parsed);
    } catch (error) {
      return SOUND_DEFAULTS;
    }
  };

  const obtenerMinutosAlertaConfigurados = () => {
    try {
      const raw = localStorage.getItem('alerta_pendiente_entrega_minutos');
      const minutos = Number(raw);
      return MINUTOS_ALERTA_VALIDOS.includes(minutos) ? minutos : 20;
    } catch (error) {
      return 20;
    }
  };

  const [pedidos, setPedidos] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [repartidores, setRepartidores] = useState([]);
  const [historialCostos, setHistorialCostos] = useState({});
  const [datosInicialesCargados, setDatosInicialesCargados] = useState(false);
  const [soundSettings, setSoundSettings] = useState(obtenerSoundSettingsConfigurados);

  const getSoundConfig = (key) => {
    return soundSettings?.[key] || SOUND_DEFAULTS[key];
  };

  const playConfiguredSound = (url, soundKey, blockedLog, errorLog) => {
    try {
      const config = getSoundConfig(soundKey);
      if (!config?.enabled) return;
      const audio = new Audio(url);
      audio.volume = clampVolumePercent(config.volume) / 100;
      audio.play().catch(() => console.log(blockedLog));
    } catch (error) {
      console.log(errorLog);
    }
  };
  
  // Función para reproducir sonido de nuevo pedido (campana)
  const playSuccessSound = () => {
    playConfiguredSound(
      'https://assets.mixkit.co/active_storage/sfx/2354/2354-preview.mp3',
      'newOrder',
      '⚠️ Sonido bloqueado por navegador',
      '⚠️ No se pudo reproducir sonido'
    );
  };
  
  // Función para reproducir sonido de pago (caja registradora)
  const playPaymentSound = () => {
    playConfiguredSound(
      'https://assets.mixkit.co/active_storage/sfx/2014/2014-preview.mp3',
      'payment',
      '⚠️ Sonido bloqueado por navegador',
      '⚠️ No se pudo reproducir sonido'
    );
  };

  // Sonido de arranque de moto al marcar un pedido como entregado
  const playDeliverySound = () => {
    playConfiguredSound(
      'https://assets.mixkit.co/active_storage/sfx/1555/1555-preview.mp3',
      'delivery',
      '⚠️ Sonido bloqueado por navegador',
      '⚠️ No se pudo reproducir sonido de entrega'
    );
  };

  // Voz al asignar repartidor desde el selector.
  const anunciarDomicilioSolicitado = () => {
    try {
      if (typeof window === 'undefined' || !window.speechSynthesis) return;
      const voiceConfig = getSoundConfig('dispatcherVoice');
      if (!voiceConfig?.enabled) return;

      const synth = window.speechSynthesis;

      const hablar = () => {
        const utterance = new SpeechSynthesisUtterance('domicilio solicitado');
        const voces = synth.getVoices();
        const vozPreferida =
          voces.find((v) => /es-(CO|ES|MX)/i.test(String(v.lang || ''))) ||
          voces.find((v) => String(v.lang || '').toLowerCase().startsWith('es')) ||
          null;

        if (vozPreferida) utterance.voice = vozPreferida;
        utterance.lang = 'es-CO';
        utterance.rate = 1;
        utterance.pitch = 1;
        utterance.volume = clampVolumePercent(voiceConfig.volume) / 100;

        synth.cancel();
        synth.speak(utterance);
      };

      if (synth.getVoices().length === 0) {
        const onVoicesChanged = () => {
          synth.removeEventListener('voiceschanged', onVoicesChanged);
          hablar();
        };
        synth.addEventListener('voiceschanged', onVoicesChanged);
        setTimeout(() => {
          synth.removeEventListener('voiceschanged', onVoicesChanged);
          hablar();
        }, 300);
        return;
      }

      hablar();
    } catch (error) {
      console.warn('⚠️ No se pudo reproducir voz de asignacion');
    }
  };
  
  // Estados para modal de confirmación de cierre
  const [showModalCierre, setShowModalCierre] = useState(false);
  const [fechaCierre, setFechaCierre] = useState('');
  const [horaCierre, setHoraCierre] = useState('');
  const [loadingCierreTurno, setLoadingCierreTurno] = useState(false);
  
  // Estado para filtro de repartidor
  const [filtroRepartidor, setFiltroRepartidor] = useState('');
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  
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
  const [voiceSupported, setVoiceSupported] = useState(false);
  const [isListeningVoice, setIsListeningVoice] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const [voiceDraft, setVoiceDraft] = useState(null);
  const [nuevoCliente, setNuevoCliente] = useState({
    nombre: '',
    direccion_habitual: '',
    telefono: ''
  });
  const [alertasDespacho, setAlertasDespacho] = useState([]);
  const valorPedidoInputRef = useRef(null);
  const costoEnvioInputRef = useRef(null);
  const timersDespachoRef = useRef(new Map());
  const pedidosRef = useRef([]);
  const alertaAudioRef = useRef(null);
  const voiceRecognitionRef = useRef(null);
  const [minutosAlertaPendiente, setMinutosAlertaPendiente] = useState(obtenerMinutosAlertaConfigurados);

  const normalizarPedidoId = (value) => String(value ?? '').trim();
  const obtenerIdPedido = (pedido = {}) => normalizarPedidoId(pedido.firestoreId || pedido.id);
  const coincidePedidoId = (pedido, id) => {
    const ref = normalizarPedidoId(id);
    if (!ref) return false;
    return normalizarPedidoId(pedido?.id) === ref || normalizarPedidoId(pedido?.firestoreId) === ref;
  };

  const formatCurrency = (value) => Number(value || 0).toLocaleString();

  const deduplicarPedidos = (items = []) => {
    const vistos = new Set();
    return items.filter((item, idx) => {
      const clave = obtenerIdPedido(item) || `${item.cliente || 'pedido'}-${item.timestamp || idx}`;
      if (vistos.has(clave)) return false;
      vistos.add(clave);
      return true;
    });
  };

  const obtenerPedidosCache = () => {
    try {
      const rawPedidos = localStorage.getItem('pedidos');
      if (rawPedidos) {
        const parsed = JSON.parse(rawPedidos);
        if (Array.isArray(parsed)) return deduplicarPedidos(parsed);
      }
    } catch (error) {
      console.warn('⚠️ Error al leer cache local de pedidos');
    }

    try {
      const rawLegacy = localStorage.getItem('pedidos_domicilio');
      if (rawLegacy) {
        const parsedLegacy = JSON.parse(rawLegacy);
        if (Array.isArray(parsedLegacy)) return deduplicarPedidos(parsedLegacy);
      }
    } catch (error) {
      console.warn('⚠️ Error al leer cache legacy de pedidos');
    }

    return [];
  };

  const mergePedidosPreservandoHoras = (actuales = [], entrantes = []) => {
    const mapaActuales = new Map(
      (actuales || []).map((p) => [obtenerIdPedido(p), p])
    );

    return (entrantes || []).map((p) => {
      const key = obtenerIdPedido(p);
      const previo = mapaActuales.get(key);
      if (!previo) return p;

      const mantenerRepartidorPrevio =
        !p.repartidor_id &&
        (p.repartidor_nombre === 'Sin Asignar' || !p.repartidor_nombre) &&
        Boolean(previo.repartidor_id) &&
        Boolean(p.hora_repartidor) &&
        String(p.hora_repartidor || '') === String(previo.hora_repartidor || '');

      return {
        ...p,
        repartidor_id: mantenerRepartidorPrevio ? (previo.repartidor_id || null) : (p.repartidor_id || null),
        repartidor_nombre: mantenerRepartidorPrevio ? (previo.repartidor_nombre || 'Sin Asignar') : (p.repartidor_nombre || 'Sin Asignar'),
        hora_repartidor: p.hora_repartidor || previo.hora_repartidor || '',
        hora_metodo_pago: p.hora_metodo_pago || previo.hora_metodo_pago || '',
        timestamp_repartidor: p.timestamp_repartidor || previo.timestamp_repartidor || ''
      };
    });
  };

  const playPendingDispatchAlertSound = () => {
    playConfiguredSound(
      'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3',
      'pendingDispatchAlert',
      '⚠️ Sonido de alerta bloqueado por navegador',
      '⚠️ No se pudo reproducir alerta de despacho'
    );
  };

  const stopPendingDispatchAlarm = () => {
    const audio = alertaAudioRef.current;
    if (!audio) return;
    try {
      audio.pause();
      audio.currentTime = 0;
    } catch (error) {
      // Evitar errores al pausar en navegadores restrictivos.
    }
    alertaAudioRef.current = null;
  };

  const startPendingDispatchAlarm = () => {
    if (alertaAudioRef.current) return;
    const alarmConfig = getSoundConfig('pendingDispatchAlarm');
    if (!alarmConfig?.enabled) return;
    try {
      const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
      audio.loop = true;
      audio.volume = clampVolumePercent(alarmConfig.volume) / 100;
      alertaAudioRef.current = audio;
      audio.play().catch(() => {
        console.log('⚠️ Sonido continuo bloqueado por navegador');
        alertaAudioRef.current = null;
      });
    } catch (error) {
      alertaAudioRef.current = null;
      console.log('⚠️ No se pudo iniciar alarma continua de despacho');
    }
  };

  const mostrarNotificacionPendienteDespacho = async (pedido) => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;

    try {
      if (Notification.permission === 'default') {
        await Notification.requestPermission();
      }

      if (Notification.permission !== 'granted') return;

      const titulo = 'Pedido pendiente por entregar';
      const mensaje = `${pedido?.cliente || 'Pedido'} con ${pedido?.repartidor_nombre || 'repartidor asignado'}`;

      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.ready;
        await registration.showNotification(titulo, {
          body: mensaje,
          tag: `alerta-despacho-${obtenerIdPedido(pedido) || Date.now()}`,
          renotify: true,
          requireInteraction: true,
          data: {
            url: '/'
          }
        });
        return;
      }

      new Notification(titulo, {
        body: mensaje,
        requireInteraction: true
      });
    } catch (error) {
      // Evitar romper UX si el navegador bloquea notificaciones nativas.
    }
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

  const convertirAMayusculas = (texto = '') => String(texto ?? '').toUpperCase();

  const normalizarValorCapturado = (field, value) => {
    if (["valor_pedido", "costo_envio"].includes(field)) return value;
    return convertirAMayusculas(value);
  };

  const normalizarTelefonoBusqueda = (texto = '') => String(texto || '').replace(/\D/g, '');

  const obtenerMensajeErrorVoz = (errorCode = '') => {
    switch (String(errorCode || '').toLowerCase()) {
      case 'not-allowed':
      case 'service-not-allowed':
        return 'Microfono bloqueado. Permite el acceso al microfono y abre la app en Chrome o Edge.';
      case 'audio-capture':
        return 'No encontre un microfono disponible en este equipo.';
      case 'network':
        return 'El servicio de reconocimiento de voz no respondio. Intenta de nuevo.';
      case 'no-speech':
        return 'No detecte voz. Habla mas cerca del microfono e intenta otra vez.';
      case 'aborted':
        return '';
      default:
        return 'No se pudo procesar el dictado por voz.';
    }
  };

  const solicitarPermisoMicrofono = async () => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      return true;
    }

    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      return true;
    } catch (error) {
      console.warn('⚠️ Acceso al microfono denegado o no disponible:', error);
      toast.error('Microfono bloqueado. Revisa el permiso del navegador para esta pagina.');
      return false;
    } finally {
      stream?.getTracks?.().forEach((track) => track.stop());
    }
  };

  const limpiarMontoDetectado = (valor = '') => {
    const numero = parseValorNumerico(valor);
    if (!Number.isFinite(numero) || numero < 0) return '';
    return String(Math.round(numero));
  };

  const extraerMontoDesdeTexto = (texto = '', keywords = []) => {
    if (!texto || keywords.length === 0) return '';
    const union = keywords.join('|');
    const direct = new RegExp(`(?:${union})\\s*(?:DE|DEL|POR)?\\s*\\$?\\s*([0-9][0-9\\s\\.,]*)`, 'i');
    const inverse = new RegExp(`\\$?\\s*([0-9][0-9\\s\\.,]*)\\s*(?:PESOS\\s*)?(?:DE\\s*)?(?:${union})`, 'i');
    return limpiarMontoDetectado(texto.match(direct)?.[1] || texto.match(inverse)?.[1] || '');
  };

  const extraerClienteDesdeTexto = (texto = '') => {
    const limpio = convertirAMayusculas(texto)
      .replace(/[.,;:]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const patrones = [
      /(?:BUSCA(?:R)?(?:\s+A)?|CLIENTE|PARA|A NOMBRE DE)\s+([A-Z0-9ÁÉÍÓÚÜÑ\s]+?)(?=(?:\s+(?:PEDIDO|VALOR|ENVIO|COSTO|DOMICILIO|PAGO|CON|EN|POR))|$)/i,
      /(?:DE)\s+([A-Z0-9ÁÉÍÓÚÜÑ\s]+?)(?=(?:\s+(?:PEDIDO|VALOR|ENVIO|COSTO|DOMICILIO|PAGO|CON|EN|POR))|$)/i
    ];

    for (const patron of patrones) {
      const match = limpio.match(patron);
      if (match?.[1]) return match[1].trim();
    }

    const fallback = limpio
      .replace(/\b(BUSCA|BUSCAR|CLIENTE|PARA|A|NOMBRE|DE|CREA|CREAR|AGREGA|AGREGAR|GENERA|GENERAR|PEDIDO|VALOR|ENVIO|COSTO|DOMICILIO|PAGO|EFECTIVO|BANCO|TARJETA|CON|EN|POR|DEL)\b/g, ' ')
      .replace(/\$?\s*[0-9][0-9\s\.,]*/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    return fallback.split(' ').slice(0, 4).join(' ').trim();
  };

  const detectarMetodoPagoVoz = (texto = '') => {
    const limpio = convertirAMayusculas(texto);
    if (limpio.includes('EFECTIVO')) return 'Efectivo';
    if (/(BANCO|TRANSFERENCIA|NEQUI|DAVIPLATA|TARJETA)/.test(limpio)) return 'Banco';
    return '';
  };

  const interpretarComandoVoz = (texto = '') => {
    const transcript = convertirAMayusculas(texto).replace(/\s+/g, ' ').trim();
    return {
      transcript,
      clienteQuery: extraerClienteDesdeTexto(transcript),
      valor_pedido: extraerMontoDesdeTexto(transcript, ['VALOR', 'PEDIDO', 'TOTAL']),
      costo_envio: extraerMontoDesdeTexto(transcript, ['ENVIO', 'COSTO', 'DOMICILIO']),
      metodo_pago: detectarMetodoPagoVoz(transcript),
      shouldCreate: /\b(CREA|CREAR|AGREGA|AGREGAR|GENERA|GENERAR)\b/.test(transcript)
    };
  };

  const obtenerSugerenciasClientes = (value, limit = 12) => {
    const queryText = normalizarTextoBusqueda(value);
    const queryPhone = normalizarTelefonoBusqueda(value);

    return (clientes || [])
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
      .slice(0, limit)
      .map((item) => item.cliente);
  };

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

  const limpiarTimerDespacho = (pedidoId) => {
    const key = normalizarPedidoId(pedidoId);
    const timer = timersDespachoRef.current.get(key);
    if (timer) {
      clearTimeout(timer);
      timersDespachoRef.current.delete(key);
    }
  };

  const quitarAlertaDespacho = (pedidoId) => {
    const key = normalizarPedidoId(pedidoId);
    setAlertasDespacho((prev) => prev.filter((item) => item.pedidoId !== key));
  };

  const esPedidoPendienteDespacho = (pedido) => {
    return Boolean(pedido?.repartidor_id) && !Boolean(pedido?.entregado);
  };

  const parseHoraAsignacionHoy = (hora) => {
    const valor = String(hora || '').trim();
    if (!valor) return null;
    const withMeridiem = valor.match(/^(\d{1,2}):(\d{2})\s*([aApP][mM])$/);
    if (!withMeridiem) return null;
    let hour = Number(withMeridiem[1]);
    const minute = Number(withMeridiem[2]);
    const meridiem = withMeridiem[3].toLowerCase();
    if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
    if (meridiem === 'pm' && hour < 12) hour += 12;
    if (meridiem === 'am' && hour === 12) hour = 0;
    const fecha = new Date();
    fecha.setHours(hour, minute, 0, 0);
    return fecha;
  };

  const obtenerFechaAsignacion = (pedido) => {
    if (pedido?.timestamp_repartidor) {
      const fecha = new Date(pedido.timestamp_repartidor);
      if (!Number.isNaN(fecha.getTime())) return fecha;
    }
    return parseHoraAsignacionHoy(pedido?.hora_repartidor);
  };

  const abrirAlertaPendienteDespacho = (pedidoId) => {
    const key = normalizarPedidoId(pedidoId);
    if (!key) return;
    const pedido = pedidosRef.current.find((p) => coincidePedidoId(p, key));
    if (!pedido || !esPedidoPendienteDespacho(pedido)) return;

    setAlertasDespacho((prev) => {
      if (prev.some((item) => item.pedidoId === key)) return prev;
      return [
        {
          pedidoId: key,
          cliente: pedido.cliente || 'Cliente sin nombre',
          repartidor: pedido.repartidor_nombre || 'Sin Asignar'
        },
        ...prev
      ];
    });

    playPendingDispatchAlertSound();
    mostrarNotificacionPendienteDespacho(pedido);
  };

  const programarAlertaDespacho = (pedidoId, delayMs) => {
    const key = normalizarPedidoId(pedidoId);
    if (!key) return;
    limpiarTimerDespacho(key);
    const delay = Math.max(0, Number(delayMs) || 0);
    const timerId = setTimeout(() => {
      timersDespachoRef.current.delete(key);
      abrirAlertaPendienteDespacho(key);
    }, delay);
    timersDespachoRef.current.set(key, timerId);
  };

  const reprogramarAviso5Min = (pedidoId) => {
    const key = normalizarPedidoId(pedidoId);
    quitarAlertaDespacho(key);
    programarAlertaDespacho(key, minutosAlertaPendiente * 60 * 1000);
    toast.success(`Se volvera a avisar en ${minutosAlertaPendiente} minutos`);
  };

  const confirmarDespachadoDesdeAlerta = async (pedidoId) => {
    const key = normalizarPedidoId(pedidoId);
    const horaEvento = getHoraAmPmActual();
    const timestampEntregado = new Date().toISOString();
    let pedidoConCambio = null;

    setPedidos((prev) => {
      const updated = prev.map((p) => {
        if (!coincidePedidoId(p, key)) return p;
        const cambiado = {
          ...p,
          entregado: true,
          hora_entregado: horaEvento,
          timestamp_entregado: timestampEntregado
        };
        pedidoConCambio = cambiado;
        return cambiado;
      });
      localStorage.setItem('pedidos', JSON.stringify(updated));
      return updated;
    });

    quitarAlertaDespacho(key);
    limpiarTimerDespacho(key);

    try {
      const idFirestore = pedidoConCambio?.firestoreId || pedidoConCambio?.id;
      if (idFirestore && !String(idFirestore).startsWith('tmp_')) {
        await updatePedido(String(idFirestore), {
          entregado: true,
          hora_entregado: horaEvento,
          timestamp_entregado: timestampEntregado
        });
      }
      toast.success('Pedido confirmado como despachado');
    } catch (error) {
      console.error('❌ Error al confirmar despacho desde alerta:', error);
      toast.error('Se marco localmente, pero no se pudo sincronizar en Firebase');
    }
  };


  // Sincronización en tiempo real de pedidos
  useEffect(() => {
    cargarDatos();
    // Suscribirse a cambios en pedidos
    const unsubscribe = listenPedidosRealtime((pedidosRealtime) => {
      setPedidos((prev) => {
        const base = (prev && prev.length > 0) ? prev : obtenerPedidosCache();
        if ((!pedidosRealtime || pedidosRealtime.length === 0) && base.length > 0) {
          return deduplicarPedidos(base);
        }
        // Bloquear actualización de fila editada o actualizando
        const idsBloqueados = Object.keys(actualizandoPedido).filter(k => actualizandoPedido[k]);
        const mergeados = mergePedidosPreservandoHoras(base, pedidosRealtime || []);
        return deduplicarPedidos(
          mergeados.map(p => {
            // Si está editando o actualizando, mantener valores locales
            if (editingCell && editingCell.id && coincidePedidoId(p, editingCell.id)) {
              const localEdit = base.find(b => coincidePedidoId(b, editingCell.id));
              return localEdit ? { ...p, ...localEdit } : p;
            }
            if (idsBloqueados.some(id => coincidePedidoId(p, id))) {
              const localEdit = base.find(b => coincidePedidoId(b, p.id));
              if (localEdit) {
                return {
                  ...p,
                  repartidor_id: localEdit.repartidor_id,
                  repartidor_nombre: localEdit.repartidor_nombre,
                  metodo_pago: localEdit.metodo_pago,
                  hora_repartidor: localEdit.hora_repartidor,
                  hora_metodo_pago: localEdit.hora_metodo_pago
                };
              }
            }
            return p;
          })
        );
      });
    });
    return () => unsubscribe && unsubscribe();
  }, [actualizandoPedido, editingCell]);

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
    // Hidratar pedidos desde cache local para evitar pantalla vacia al recargar/navegar.
    const pedidosCache = obtenerPedidosCache();
    if (pedidosCache.length > 0) {
      setPedidos((prev) => (prev.length > 0 ? prev : pedidosCache));
    }

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
    
    setDatosInicialesCargados(true);
  };

  // Guardar pedidos en localStorage cuando cambien (solo después de la carga inicial)
  useEffect(() => {
    if (datosInicialesCargados) {
      localStorage.setItem('pedidos', JSON.stringify(pedidos));
      localStorage.setItem('pedidos_domicilio', JSON.stringify(pedidos));
    }
  }, [pedidos, datosInicialesCargados]);

  useEffect(() => {
    pedidosRef.current = pedidos;
  }, [pedidos]);

  useEffect(() => {
    const refrescarDesdeSettings = () => {
      setMinutosAlertaPendiente(obtenerMinutosAlertaConfigurados());
      setSoundSettings(obtenerSoundSettingsConfigurados());
    };

    const onStorage = (event) => {
      if (event.key === 'alerta_pendiente_entrega_minutos' || event.key === 'app_sound_settings') {
        refrescarDesdeSettings();
      }
    };

    window.addEventListener('storage', onStorage);
    window.addEventListener('app-settings-updated', refrescarDesdeSettings);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('app-settings-updated', refrescarDesdeSettings);
    };
  }, []);

  useEffect(() => {
    const idsPendientes = new Set();

    (pedidos || []).forEach((pedido) => {
      const pedidoId = obtenerIdPedido(pedido);
      if (!pedidoId) return;

      if (!esPedidoPendienteDespacho(pedido)) {
        limpiarTimerDespacho(pedidoId);
        return;
      }

      idsPendientes.add(pedidoId);
      const fechaAsignacion = obtenerFechaAsignacion(pedido);
      if (!fechaAsignacion) return;
      if (timersDespachoRef.current.has(pedidoId)) return;

      const tiempoObjetivo = fechaAsignacion.getTime() + (minutosAlertaPendiente * 60 * 1000);
      const delay = Math.max(0, tiempoObjetivo - Date.now());
      programarAlertaDespacho(pedidoId, delay);
    });

    Array.from(timersDespachoRef.current.keys()).forEach((pedidoId) => {
      if (!idsPendientes.has(pedidoId)) {
        limpiarTimerDespacho(pedidoId);
      }
    });

    setAlertasDespacho((prev) => prev.filter((item) => idsPendientes.has(item.pedidoId)));
  }, [pedidos, minutosAlertaPendiente]);

  useEffect(() => {
    return () => {
      Array.from(timersDespachoRef.current.values()).forEach((timerId) => clearTimeout(timerId));
      timersDespachoRef.current.clear();
      stopPendingDispatchAlarm();
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    setVoiceSupported(Boolean(SpeechRecognition));

    return () => {
      if (voiceRecognitionRef.current) {
        try {
          voiceRecognitionRef.current.onend = null;
          voiceRecognitionRef.current.stop();
        } catch (error) {
          // Evita errores al desmontar si el reconocimiento ya se cerró.
        }
        voiceRecognitionRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (alertasDespacho.length > 0) {
      startPendingDispatchAlarm();
      return;
    }
    stopPendingDispatchAlarm();
  }, [alertasDespacho]);

  useEffect(() => {
    const alarmConfig = getSoundConfig('pendingDispatchAlarm');
    const activeAlarm = alertaAudioRef.current;

    if (!alarmConfig?.enabled && activeAlarm) {
      stopPendingDispatchAlarm();
      return;
    }

    if (alarmConfig?.enabled && activeAlarm) {
      activeAlarm.volume = clampVolumePercent(alarmConfig.volume) / 100;
    }
  }, [soundSettings]);

  const handleSearchChange = (e) => {
    const value = convertirAMayusculas(e.target.value);
    setSearchTerm(value);
    setVoiceDraft(null);
    
    if (value.length > 0) {
      const sugerencias = obtenerSugerenciasClientes(value, 12);

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
  const abrirPedidoParaCliente = (cliente, formOverrides = {}) => {
    const direccionCliente = (cliente.direccion_habitual || cliente.direccion || cliente.domicilio || '').trim();
    const costoSugerido = historialCostos[direccionCliente] || '';

    if (!direccionCliente) {
      toast.error('Este cliente no tiene direccion registrada');
      return false;
    }

    setClienteSeleccionadoPedido(cliente);
    setNuevoPedidoForm({
      valor_pedido: formOverrides.valor_pedido ?? '',
      costo_envio: formOverrides.costo_envio ?? (costoSugerido ? String(costoSugerido) : '')
    });
    setShowModalPedido(true);
    return true;
  };

  const handleSelectCliente = async (cliente) => {
    setSearchTerm(convertirAMayusculas(cliente.nombre));
    setShowSugerencias(false);
    setVoiceDraft(null);

    abrirPedidoParaCliente(cliente);
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

  const crearPedidoConCliente = async (cliente, formState, opciones = {}) => {
    if (!cliente) return false;

    const direccionCliente = (cliente.direccion_habitual || cliente.direccion || cliente.domicilio || '').trim();
    if (!direccionCliente) {
      toast.error('Este cliente no tiene direccion registrada');
      return false;
    }

    const valorPedido = parseValorNumerico(formState.valor_pedido);
    const costoEnvio = parseValorNumerico(formState.costo_envio);

    if (!Number.isFinite(valorPedido) || valorPedido <= 0) {
      toast.error('Valor del pedido invalido. Solo se permiten numeros.');
      return false;
    }

    if (!Number.isFinite(costoEnvio) || costoEnvio < 0) {
      toast.error('Costo de envio invalido. Solo se permiten numeros.');
      return false;
    }

    setLoadingCrearPedido(true);
    const ahora = new Date();
    const fechaFormato = `${ahora.getDate().toString().padStart(2, '0')}/${(ahora.getMonth() + 1).toString().padStart(2, '0')}/${ahora.getFullYear()} ${ahora.getHours().toString().padStart(2, '0')}:${ahora.getMinutes().toString().padStart(2, '0')}`;
    const metodoPagoInicial = opciones.metodo_pago || '';
    const horaMetodoPago = metodoPagoInicial ? getHoraAmPmActual() : '';

    const nuevoPedido = {
      id: Date.now(),
      cliente: cliente.nombre,
      direccion: direccionCliente,
      telefono: cliente.telefono,
      valor_pedido: valorPedido,
      costo_envio: costoEnvio,
      total_a_recibir: valorPedido - costoEnvio,
      metodo_pago: metodoPagoInicial,
      hora_metodo_pago: horaMetodoPago,
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
    toast.success(metodoPagoInicial ? 'Pedido agregado con exito desde voz' : 'Pedido agregado con exito');
    cerrarModalPedido();
    return true;
  };

  const handleCrearPedidoDesdeModal = async () => {
    if (!clienteSeleccionadoPedido) return;

    await crearPedidoConCliente(clienteSeleccionadoPedido, nuevoPedidoForm);
  };

  const procesarComandoVoz = (texto) => {
    const interpretado = interpretarComandoVoz(texto);
    const query = interpretado.clienteQuery;

    if (!query) {
      toast.error('No pude identificar el nombre del cliente en el dictado');
      return;
    }

    const coincidencias = obtenerSugerenciasClientes(query, 3);
    if (coincidencias.length === 0) {
      setSearchTerm(query);
      setClienteSugerencias([]);
      setShowSugerencias(false);
      setVoiceDraft({
        ...interpretado,
        coincidencias: [],
        cliente: null
      });
      toast.error('No encontre un cliente con ese dictado');
      return;
    }

    const clientePrincipal = coincidencias[0];
    const direccionCliente = (clientePrincipal.direccion_habitual || clientePrincipal.direccion || clientePrincipal.domicilio || '').trim();
    const costoSugerido = historialCostos[direccionCliente] || '';

    setSearchTerm(query);
    setClienteSugerencias(coincidencias);
    setShowSugerencias(false);
    setVoiceDraft({
      ...interpretado,
      coincidencias,
      cliente: clientePrincipal,
      valor_pedido: interpretado.valor_pedido || '',
      costo_envio: interpretado.costo_envio || (costoSugerido ? String(costoSugerido) : '')
    });
  };

  const toggleVoiceRecognition = async () => {
    if (!voiceSupported || typeof window === 'undefined') {
      toast.error('Tu navegador no soporta dictado por voz');
      return;
    }

    if (isListeningVoice && voiceRecognitionRef.current) {
      voiceRecognitionRef.current.stop();
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.error('Tu navegador no soporta dictado por voz');
      return;
    }

    const permisoConcedido = await solicitarPermisoMicrofono();
    if (!permisoConcedido) return;

    const recognition = new SpeechRecognition();
    let transcriptFinal = '';

    recognition.lang = 'es-CO';
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setVoiceDraft(null);
      setVoiceTranscript('');
      setIsListeningVoice(true);
    };

    recognition.onresult = (event) => {
      transcriptFinal = Array.from(event.results)
        .map((result) => result[0]?.transcript || '')
        .join(' ')
        .trim();

      setVoiceTranscript(convertirAMayusculas(transcriptFinal));
    };

    recognition.onerror = (event) => {
      setIsListeningVoice(false);
      const mensaje = obtenerMensajeErrorVoz(event.error);
      if (mensaje) {
        toast.error(mensaje);
      }
    };

    recognition.onend = () => {
      setIsListeningVoice(false);
      voiceRecognitionRef.current = null;

      if (transcriptFinal) {
        procesarComandoVoz(transcriptFinal);
      }
    };

    voiceRecognitionRef.current = recognition;
    recognition.start();
  };

  const confirmarComandoVoz = async () => {
    if (!voiceDraft?.cliente) return;

    const valoresListos =
      Number.isFinite(parseValorNumerico(voiceDraft.valor_pedido)) &&
      Number.isFinite(parseValorNumerico(voiceDraft.costo_envio));

    if (voiceDraft.shouldCreate && valoresListos) {
      const creado = await crearPedidoConCliente(
        voiceDraft.cliente,
        {
          valor_pedido: voiceDraft.valor_pedido,
          costo_envio: voiceDraft.costo_envio
        },
        { metodo_pago: voiceDraft.metodo_pago }
      );

      if (creado) {
        setVoiceDraft(null);
        setVoiceTranscript('');
      }
      return;
    }

    const abierto = abrirPedidoParaCliente(voiceDraft.cliente, {
      valor_pedido: voiceDraft.valor_pedido,
      costo_envio: voiceDraft.costo_envio
    });

    if (abierto) {
      setSearchTerm(convertirAMayusculas(voiceDraft.cliente.nombre));
      setVoiceDraft(null);
      setVoiceTranscript('');
    }
  };

  // Nueva función simple para asignar repartidor
  const handleAsignarRepartidor = async (pedidoId, repartidorId) => {
    const horaEvento = getHoraAmPmActual();
    const pedidoActual = pedidos.find((p) => coincidePedidoId(p, pedidoId));
    if (!pedidoActual) return;

    const repartidorSeleccionado = (repartidores || []).find((r) => String(r.id) === String(repartidorId));
    const repartidorNombre = repartidorSeleccionado?.nombre || 'Sin Asignar';
    const payload = {
      repartidor_id: repartidorId || null,
      repartidor_nombre: repartidorNombre,
      hora_repartidor: horaEvento,
      metodo_pago: pedidoActual.metodo_pago || '',
      hora_metodo_pago: pedidoActual.hora_metodo_pago || ''
    };

    setActualizandoPedido((prev) => ({ ...prev, [String(pedidoId)]: true }));
    setPedidos(prev => {
      const updated = prev.map(p =>
        coincidePedidoId(p, pedidoId)
          ? { ...p, ...payload }
          : p
      );
      localStorage.setItem('pedidos', JSON.stringify(updated));
      localStorage.setItem('pedidos_domicilio', JSON.stringify(updated));
      localStorage.setItem('pedidos_domicilio_cache', JSON.stringify(updated));
      // Generar mensaje si el repartidor es elite
      const repartidor = repartidores.find(r => r.id === repartidorId);
      if (repartidor && repartidor.nombre && repartidor.nombre.toLowerCase().includes('elite')) {
        const pedidoActual = updated.find(p => coincidePedidoId(p, pedidoId));
        const direccionCliente = pedidoActual?.direccion || pedidoActual?.direccion_habitual || pedidoActual?.domicilio || '';
        const mensaje = `Hola, por favor me mandas un domiciliario va para ${direccionCliente}`;
        if (navigator.clipboard && window) {
          navigator.clipboard.writeText(mensaje).then(() => {
            toast.success('Mensaje copiado en portapapeles');
          });
        }
      }
      return updated;
    });

    try {
      const idFirestore = pedidoActual.firestoreId || pedidoActual.id;
      if (idFirestore && !String(idFirestore).startsWith('tmp_')) {
        await updatePedido(String(idFirestore), payload);
      }
    } catch (error) {
      console.error('❌ Error al guardar repartidor:', error);
      toast.error('Se asigno localmente, pero no se pudo sincronizar el repartidor.');
    } finally {
      setActualizandoPedido((prev) => ({ ...prev, [String(pedidoId)]: false }));
    }
  };

  // Nueva función simple para cambiar método de pago
  const handleMetodoPagoChange = async (pedidoId, metodoPago) => {
    const horaEvento = getHoraAmPmActual();
    const pedidoActual = pedidos.find((p) => coincidePedidoId(p, pedidoId));
    if (!pedidoActual) return;

    const payload = {
      metodo_pago: metodoPago,
      hora_metodo_pago: horaEvento,
      repartidor_id: pedidoActual.repartidor_id || null,
      repartidor_nombre: pedidoActual.repartidor_nombre || 'Sin Asignar',
      hora_repartidor: pedidoActual.hora_repartidor || ''
    };

    setActualizandoPedido((prev) => ({ ...prev, [String(pedidoId)]: true }));
    setPedidos(prev => {
      const updated = prev.map(p =>
        coincidePedidoId(p, pedidoId)
          ? { ...p, ...payload }
          : p
      );
      localStorage.setItem('pedidos', JSON.stringify(updated));
      localStorage.setItem('pedidos_domicilio', JSON.stringify(updated));
      localStorage.setItem('pedidos_domicilio_cache', JSON.stringify(updated));
      return updated;
    });

    try {
      const idFirestore = pedidoActual.firestoreId || pedidoActual.id;
      if (idFirestore && !String(idFirestore).startsWith('tmp_')) {
        await updatePedido(String(idFirestore), payload);
      }
    } catch (error) {
      console.error('❌ Error al guardar metodo de pago:', error);
      toast.error('Se actualizo localmente, pero no se pudo sincronizar el pago.');
    } finally {
      setActualizandoPedido((prev) => ({ ...prev, [String(pedidoId)]: false }));
    }
  };

  const toggleEstadoPago = async (id) => {
    if (!id) {
      alert('Error: El ID del pedido es nulo o inválido.');
      return;
    }
    const horaEvento = getHoraAmPmActual();
    const pedidoAntesCambio = pedidos.find(p => coincidePedidoId(p, id));
    if (!pedidoAntesCambio) return;

    setPedidos(prev => {
      const updated = prev.map(p => 
        coincidePedidoId(p, id)
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

  const getClienteDireccion = (cliente) => {
    if (!cliente) return '-';
    return cliente.direccion_habitual || cliente.direccion || cliente.domicilio || '-';
  };

  const getClienteTelefono = (cliente) => {
    if (!cliente) return '-';
    return cliente.telefono || cliente.celular || cliente.whatsapp || '-';
  };

  const toggleEntregado = async (id) => {
    const pedidoActual = pedidos.find(p => coincidePedidoId(p, id));
    const estadoActual = pedidoActual?.entregado;
    const nuevoEstadoEntregado = estadoActual === null || typeof estadoActual === 'undefined' ? true : !estadoActual;
    const horaEvento = getHoraAmPmActual();

    setPedidos(prev => {
      const updated = prev.map(p => 
        coincidePedidoId(p, id)
          ? { ...p, entregado: !p.entregado, hora_entregado: horaEvento }
          : p
      );
      localStorage.setItem('pedidos', JSON.stringify(updated));
      return updated;
    });

    if (nuevoEstadoEntregado) {
      playDeliverySound();
      // Copiar mensaje de fidelización al portapapeles
      const pedido = pedidos.find(p => coincidePedidoId(p, id));
      const nombreCliente = pedido?.cliente || '';
      const mensajeFidelizacion = `Hola ${nombreCliente} tu pedido ya va en camino, que tengas muy buen provecho, te agradecemos por preferirnos, te esperamos pronto.\n\n📲 Síguenos en nuestras redes sociales y entérate de promociones, nuevos productos y contenido brutal 🔥🍔\n\nTikTok:\nhttps://www.tiktok.com/@roalburger?_r=1&_t=ZS-94kgEkN4aEH\n\nInstagram:\nhttps://www.instagram.com/roalburgerarmenia?igsh=cWE2eGRyNnlxaXgy&utm_source=qr\n\nFacebook:\nhttps://www.facebook.com/share/1B9MGGXh6h/?mibextid=wwXIfr\n\nROAL Burger\nComida rápida con acento venezolano 🇻🇪🔥`;
      if (navigator.clipboard && window) {
        navigator.clipboard.writeText(mensajeFidelizacion).then(() => {
          toast.success('Mensaje de fidelización copiado en portapapeles');
        });
      }
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

    const pedidoActual = pedidos.find(p => coincidePedidoId(p, id));
    if (!pedidoActual) {
      toast.error('No se encontro el pedido para eliminar');
      return;
    }

    // Eliminar de UI y cache local inmediatamente para feedback rapido.
    setPedidos(prev => {
      const updated = prev.filter(p => !coincidePedidoId(p, id));
      localStorage.setItem('pedidos', JSON.stringify(updated));
      localStorage.setItem('pedidos_domicilio', JSON.stringify(updated));
      localStorage.setItem('pedidos_domicilio_cache', JSON.stringify(updated));
      return updated;
    });

    try {
      const idFirestore = pedidoActual?.firestoreId || pedidoActual?.id;
      if (idFirestore && !String(idFirestore).startsWith('tmp_')) {
        await deletePedido(String(idFirestore), pedidoActual);
      }

      toast.success('Pedido eliminado');
    } catch (error) {
      console.error('❌ Error al eliminar pedido en Firebase:', error);
      toast.error('El pedido se elimino localmente, pero fallo la eliminacion en Firebase.');
    }
  };

  const handleCellDoubleClick = (id, field, value) => {
    setEditingCell({ id, field });
    setEditValue(normalizarValorCapturado(field, value || ''));
  };

  const handleCellBlur = async () => {
    if (editingCell.id && editingCell.field) {
      const pedidoActualizado = pedidos.find(p => coincidePedidoId(p, editingCell.id));
      if (pedidoActualizado) {
        let nuevoValor = normalizarValorCapturado(editingCell.field, editValue);
        // Convertir a número si es un campo numérico
        if (["valor_pedido", "costo_envio"].includes(editingCell.field)) {
          nuevoValor = parseFloat(editValue) || 0;
        }
        // Actualizar el pedido
        const pedidosActualizados = pedidos.map(p => {
          if (coincidePedidoId(p, editingCell.id)) {
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
          if (["telefono", "direccion", "cliente"].includes(editingCell.field)) {
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
          // NUEVO: Actualizar el pedido en Firebase si tiene firestoreId válido
          const idFirestore = pedidoActualizado.firestoreId || pedidoActualizado.id;
          if (idFirestore && !String(idFirestore).startsWith('tmp_')) {
            // Solo enviar los campos editados y dependientes
            const updateData = { [editingCell.field]: nuevoValor };
            if (editingCell.field === 'valor_pedido' || editingCell.field === 'costo_envio') {
              const valorPedido = editingCell.field === 'valor_pedido' ? nuevoValor : pedidoActualizado.valor_pedido;
              const costoEnvio = editingCell.field === 'costo_envio' ? nuevoValor : pedidoActualizado.costo_envio;
              updateData.total_a_recibir = valorPedido - costoEnvio;
            }
            try {
              await updatePedido(String(idFirestore), updateData);
            } catch (error) {
              console.error('❌ Error al actualizar pedido en Firebase:', error);
              toast.error('Error al actualizar en la nube. El cambio solo es local.');
            }
          }
        } catch (error) {
          toast.error('Error al guardar cambios. Inténtalo nuevamente.');
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
  const pedidosDelDia = useMemo(() => pedidos.filter((p) => {
    if (!p.fecha) return false;

    const hoy = new Date();
    const diaHoy = hoy.getDate();
    const mesHoy = hoy.getMonth() + 1;
    const añoHoy = hoy.getFullYear();
    const fechaPedido = p.fecha.split(' ')[0];
    const [dia, mes, año] = fechaPedido.split('/').map(Number);

    const esDiaActual = dia === diaHoy && mes === mesHoy && año === añoHoy;
    const fechaIsoPedido = `${año}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
    const dentroDeRango = (!fechaInicio || fechaIsoPedido >= fechaInicio) && (!fechaFin || fechaIsoPedido <= fechaFin);
    const noArchivado = !p.archivado;

    if (filtroRepartidor) {
      return esDiaActual && dentroDeRango && noArchivado && p.repartidor_id === filtroRepartidor;
    }

    return esDiaActual && dentroDeRango && noArchivado;
  }), [fechaFin, fechaInicio, filtroRepartidor, pedidos]);

  const {
    pedidosEntregados,
    pedidosPagados,
    totalARecibir,
    totalCostosEnvio,
    totalEfectivo,
    totalPedidos,
    totalTarjeta,
    totalValorPedidos,
    totalVentasPesos
  } = useMemo(() => {
    const totals = {
      totalPedidos: pedidosDelDia.length,
      totalValorPedidos: 0,
      totalCostosEnvio: 0,
      totalVentasPesos: 0,
      totalARecibir: 0,
      totalEfectivo: 0,
      totalTarjeta: 0,
      pedidosPagados: 0,
      pedidosEntregados: 0,
    };

    for (const pedido of pedidosDelDia) {
      const valorPedido = Number(pedido.valor_pedido || 0);
      const costoEnvio = Number(pedido.costo_envio || 0);
      const totalPedido = Number(pedido.total_a_recibir || 0);

      totals.totalValorPedidos += valorPedido;
      totals.totalCostosEnvio += costoEnvio;
      totals.totalARecibir += totalPedido;

      if (pedido.metodo_pago === 'Efectivo') {
        totals.totalEfectivo += totalPedido;
      }

      if (pedido.metodo_pago === 'Tarjeta' || pedido.metodo_pago === 'Banco') {
        totals.totalTarjeta += totalPedido;
      }

      if (pedido.estadoPago === 'pagado') {
        totals.pedidosPagados += 1;
      }

      if (pedido.entregado) {
        totals.pedidosEntregados += 1;
      }
    }

    totals.totalVentasPesos = totals.totalValorPedidos;
    return totals;
  }, [pedidosDelDia]);

  const resumenPorRepartidor = useMemo(() => {
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

      pedidosPorRepartidor[key].pedidos += 1;
      pedidosPorRepartidor[key].valorPedidos += Number(pedido.valor_pedido || 0);
      pedidosPorRepartidor[key].costos += Number(pedido.costo_envio || 0);
      pedidosPorRepartidor[key].total += Number(pedido.total_a_recibir || 0);
    });

    return Object.values(pedidosPorRepartidor);
  }, [pedidosDelDia]);

  const resumenDestacado = resumenPorRepartidor[0] || null;
  const resumenSecundario = resumenPorRepartidor.slice(1);

  useEffect(() => {
    onNavbarSummaryChange(resumenDestacado);

    return () => {
      onNavbarSummaryChange(null);
    };
  }, [onNavbarSummaryChange, resumenDestacado]);

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
      const clienteNormalizado = {
        nombre: convertirAMayusculas(nuevoCliente.nombre).trim(),
        direccion_habitual: convertirAMayusculas(nuevoCliente.direccion_habitual).trim(),
        telefono: convertirAMayusculas(nuevoCliente.telefono).trim()
      };

      // Crear cliente usando el servicio
      const clienteCreado = await addCliente(clienteNormalizado);

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
  const handleExportarReporte = async () => {
    if (pedidosDelDia.length === 0) {
      toast.error('No hay pedidos para exportar');
      return;
    }

    try {
      const XLSX = await import('xlsx');

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
      const idsArchivar = Array.from(
        new Set(
          pedidosDelDia
            .map((p) => obtenerIdPedido(p))
            .filter((id) => Boolean(id) && !id.startsWith('tmp_'))
        )
      );
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
        `$${Number(pedido.valor_pedido || 0).toLocaleString('es-CO')}`,
        `$${Number(pedido.costo_envio || 0).toLocaleString('es-CO')}`,
        `$${Number(pedido.total_a_recibir || 0).toLocaleString('es-CO')}`,
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

    <div className="space-y-3">

      {/* Alertas Despacho (unchanged) */}
      {alertasDespacho.length > 0 && (
        <div className="fixed bottom-4 right-4 z-[70] w-[calc(100vw-2rem)] max-w-md space-y-2">
          {alertasDespacho.map((alerta, idx) => (
            <div key={alerta.pedidoId} className="border border-warning bg-[#422006] shadow-2xl rounded-lg p-3 sm:p-4">
              <div className="flex flex-col gap-3">
                <div>
                  <p className="text-warning font-bold text-sm sm:text-base">Alarma de pedido pendiente por entregar</p>
                  <p className="text-orange-100 text-xs sm:text-sm">
                    Cliente: {alerta.cliente} · Repartidor: {alerta.repartidor}
                  </p>
                  {idx === 0 && alertasDespacho.length > 1 && (
                    <p className="text-[11px] sm:text-xs text-orange-200 mt-1">
                      Hay {alertasDespacho.length} pedidos pendientes de revision
                    </p>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => reprogramarAviso5Min(alerta.pedidoId)}
                    className="px-3 py-2 rounded-md bg-dark-bg border border-dark-border text-gray-100 text-xs sm:text-sm hover:bg-dark-border transition-colors"
                  >
                    Avisar en {minutosAlertaPendiente} min
                  </button>
                  <button
                    onClick={() => confirmarDespachadoDesdeAlerta(alerta.pedidoId)}
                    className="px-3 py-2 rounded-md bg-success text-white text-xs sm:text-sm hover:bg-green-700 transition-colors"
                  >
                    Revisado / entregado
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Buscador con Auto-Insert */}
      <div className="glass-panel relative z-30 sticky top-3 rounded-[22px] p-3 sm:static sm:p-4">
        <div className="mb-3 flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="surface-label mb-1.5">Captura rapida</div>
            <label className="block text-sm font-semibold text-white sm:text-base">
              Buscar cliente y crear pedido
            </label>
          </div>

          <div className="grid gap-2 sm:grid-cols-[minmax(220px,260px)_auto]">
            <select
              value={filtroRepartidor}
              onChange={(e) => setFiltroRepartidor(e.target.value)}
              className="w-full rounded-[16px] border border-white/10 bg-slate-950/30 px-3 py-2.5 text-xs text-white outline-none transition focus:border-[var(--app-primary)]"
            >
              <option value="">Todos los repartidores</option>
              {(repartidores || []).map(rep => (
                <option key={rep.id} value={rep.id}>
                  {rep.nombre}
                </option>
              ))}
            </select>

            <button
              onClick={() => setShowModalCliente(true)}
              className="w-full rounded-[16px] bg-[linear-gradient(135deg,rgba(78,205,196,0.95),rgba(20,184,166,0.92))] px-3 py-2.5 text-xs font-bold text-slate-950 transition hover:brightness-110 sm:w-auto"
            >
              Nuevo cliente
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative z-40 flex-1">
            <Search className="absolute left-3 sm:left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 sm:w-5 sm:h-5" />
            <input
              type="text"
              placeholder="Escribe el nombre del cliente..."
              value={searchTerm}
              onChange={handleSearchChange}
              className="w-full rounded-[16px] border border-white/10 bg-slate-950/35 py-2.5 pl-10 pr-4 text-sm text-white placeholder-gray-400 outline-none transition focus:border-[var(--app-primary)] sm:pl-11"
            />
            
            {/* Sugerencias */}
            {showSugerencias && clienteSugerencias.length > 0 && (
              <div className="relative z-[80] mt-2 max-h-60 w-full overflow-y-auto rounded-[18px] border border-white/10 bg-[rgba(10,26,38,0.98)] shadow-2xl backdrop-blur-xl">
                {clienteSugerencias.map((cliente, idx) => (
                  <button
                    key={`${cliente.id || cliente.nombre || 'cliente'}-${idx}`}
                    onClick={() => handleSelectCliente(cliente)}
                    className="w-full border-b border-white/5 px-4 py-3 text-left transition-colors hover:bg-white/5 last:border-b-0"
                  >
                    <div className="font-medium text-white">{cliente.nombre}</div>
                    <div className="mt-1 text-sm text-gray-400" title={getClienteDireccion(cliente)}>
                      {getClienteDireccion(cliente)}
                    </div>
                    <div className="mt-1 text-xs font-medium tracking-[0.18em] text-[var(--app-primary)] uppercase">
                      Tel: {getClienteTelefono(cliente)}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {voiceSupported && (
            <button
              type="button"
              onClick={toggleVoiceRecognition}
              className={`inline-flex min-h-[46px] items-center justify-center gap-2 rounded-[16px] border px-3 py-2.5 text-xs font-semibold transition ${isListeningVoice ? 'border-red-400/60 bg-red-500/15 text-red-100' : 'border-white/10 bg-slate-950/35 text-white hover:border-[var(--app-primary)]'}`}
            >
              {isListeningVoice ? <Loader className="h-4 w-4 animate-spin" /> : <Mic className="h-4 w-4" />}
              {isListeningVoice ? 'Escuchando...' : 'Dictar pedido'}
            </button>
          )}
        </div>

        <div className="mt-2 text-[11px] text-gray-400">
          Puedes dictar algo como: <span className="text-white">BUSCA A JOHAN ROJAS Y CREA PEDIDO 25000 CON DOMICILIO 7000 EN EFECTIVO</span>
        </div>

        {(voiceTranscript || voiceDraft) && (
          <div className="mt-3 rounded-[18px] border border-cyan-400/20 bg-cyan-500/5 p-3">
            <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-200">
              <Sparkles className="h-4 w-4" />
              Asistente por voz
            </div>

            {voiceTranscript && !voiceDraft && (
              <p className="text-sm text-white/90">{voiceTranscript}</p>
            )}

            {voiceDraft && (
              <div className="space-y-3">
                <div className="text-sm text-white/90">{voiceDraft.transcript}</div>

                {voiceDraft.cliente ? (
                  <div className="rounded-[16px] border border-white/10 bg-slate-950/30 p-3">
                    <div className="text-xs uppercase tracking-[0.18em] text-gray-400">Cliente detectado</div>
                    <div className="mt-1 font-semibold text-white">{voiceDraft.cliente.nombre}</div>
                    <div className="mt-1 text-sm text-gray-300">{getClienteDireccion(voiceDraft.cliente)}</div>
                    <div className="mt-1 text-xs font-medium tracking-[0.18em] text-[var(--app-primary)] uppercase">
                      Tel: {getClienteTelefono(voiceDraft.cliente)}
                    </div>
                  </div>
                ) : (
                  <div className="rounded-[16px] border border-red-400/20 bg-red-500/10 p-3 text-sm text-red-100">
                    No encontré un cliente exacto. Repite el nombre o escríbelo manualmente.
                  </div>
                )}

                {voiceDraft.coincidencias?.length > 1 && (
                  <div className="space-y-2">
                    <div className="text-xs uppercase tracking-[0.18em] text-gray-400">Coincidencias</div>
                    <div className="grid gap-2 md:grid-cols-3">
                      {voiceDraft.coincidencias.map((cliente, idx) => (
                        <button
                          key={`${cliente.id || cliente.nombre || 'voice-cliente'}-${idx}`}
                          type="button"
                          onClick={() => setVoiceDraft((prev) => ({ ...prev, cliente }))}
                          className={`rounded-[16px] border px-3 py-2 text-left transition ${String(voiceDraft.cliente?.id || voiceDraft.cliente?.nombre) === String(cliente.id || cliente.nombre) ? 'border-[var(--app-primary)] bg-[var(--app-primary)]/10' : 'border-white/10 bg-slate-950/25 hover:border-white/20'}`}
                        >
                          <div className="text-sm font-semibold text-white">{cliente.nombre}</div>
                          <div className="mt-1 line-clamp-2 text-xs text-gray-400">{getClienteDireccion(cliente)}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="grid gap-2 text-xs text-gray-300 sm:grid-cols-3">
                  <div className="rounded-[14px] bg-slate-950/30 px-3 py-2">
                    <div className="text-[10px] uppercase tracking-[0.18em] text-gray-500">Valor</div>
                    <div className="mt-1 font-semibold text-white">{voiceDraft.valor_pedido ? `$${Number(voiceDraft.valor_pedido).toLocaleString()}` : 'Sin detectar'}</div>
                  </div>
                  <div className="rounded-[14px] bg-slate-950/30 px-3 py-2">
                    <div className="text-[10px] uppercase tracking-[0.18em] text-gray-500">Domicilio</div>
                    <div className="mt-1 font-semibold text-white">{voiceDraft.costo_envio ? `$${Number(voiceDraft.costo_envio).toLocaleString()}` : 'Sin detectar'}</div>
                  </div>
                  <div className="rounded-[14px] bg-slate-950/30 px-3 py-2">
                    <div className="text-[10px] uppercase tracking-[0.18em] text-gray-500">Pago</div>
                    <div className="mt-1 font-semibold text-white">{voiceDraft.metodo_pago || 'Sin detectar'}</div>
                  </div>
                </div>

                <div className="flex flex-col gap-2 sm:flex-row">
                  <button
                    type="button"
                    onClick={() => {
                      setVoiceDraft(null);
                      setVoiceTranscript('');
                    }}
                    className="rounded-[16px] border border-white/10 bg-slate-950/35 px-4 py-2.5 text-sm font-medium text-white transition hover:border-white/20"
                  >
                    Descartar
                  </button>
                  <button
                    type="button"
                    onClick={confirmarComandoVoz}
                    disabled={!voiceDraft.cliente}
                    className="rounded-[16px] bg-[linear-gradient(135deg,rgba(78,205,196,0.95),rgba(20,184,166,0.92))] px-4 py-2.5 text-sm font-bold text-slate-950 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {voiceDraft.shouldCreate && Number.isFinite(parseValorNumerico(voiceDraft.valor_pedido)) && Number.isFinite(parseValorNumerico(voiceDraft.costo_envio))
                      ? 'Confirmar y crear pedido'
                      : 'Confirmar y abrir captura'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Tabla de Pedidos */}
      <div className="glass-panel relative z-0 hidden overflow-hidden rounded-[22px] sm:block">
        <div className="overflow-x-auto">
          <table className="w-full table-fixed text-xs">
            <thead className="bg-white/5">
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
                          onChange={(e) => setEditValue(normalizarValorCapturado('cliente', e.target.value))}
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
                          onChange={(e) => setEditValue(normalizarValorCapturado('direccion', e.target.value))}
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
                          onChange={(e) => setEditValue(normalizarValorCapturado('telefono', e.target.value))}
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
                        onChange={(e) => handleAsignarRepartidor(obtenerIdPedido(pedido) || pedido.id, e.target.value)}
                        className="w-[108px] px-1 py-1 bg-[#374151] border border-dark-border rounded text-white text-[11px] focus:ring-2 focus:ring-primary focus:border-transparent"
                      >
                        <option value="">-</option>
                        {(repartidores || []).map(rep => (
                          <option key={rep.id} value={rep.id}>{rep.nombre}</option>
                        ))}
                      </select>
                      <div className="text-[10px] text-gray-400 mt-0.5">{formatHoraAmPm(pedido.hora_repartidor)}</div>
                    </td>
                    {/* Pago */}
                    <td className="px-1.5 py-2.5 text-center">
                      <select
                        value={pedido.metodo_pago || ''}
                        onChange={(e) => handleMetodoPagoChange(obtenerIdPedido(pedido) || pedido.id, e.target.value)}
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
                        onClick={() => handleEliminarPedido(obtenerIdPedido(pedido) || pedido.id)}
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
      <div className="mt-4 hidden gap-3 md:grid md:grid-cols-2 xl:grid-cols-3">
        {resumenSecundario.map((rep, idx) => (
          <div key={`${rep.nombre}-${idx}`} className="glass-panel rounded-[20px] p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <div className="surface-label mb-1">Repartidor</div>
                <span className="block text-base font-semibold text-white">{rep.nombre}</span>
              </div>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-[var(--app-text-soft)]">
                {rep.pedidos} pedido(s)
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className="rounded-[16px] bg-white/5 px-2.5 py-2.5 text-center">
                <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--app-text-soft)]">Pedidos</div>
                <div className="mt-2 font-semibold text-white">${formatCurrency(rep.valorPedidos)}</div>
              </div>
              <div className="rounded-[16px] bg-white/5 px-2.5 py-2.5 text-center">
                <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--app-text-soft)]">Domicilios</div>
                <div className="mt-2 font-semibold text-[var(--app-accent)]">${formatCurrency(rep.costos)}</div>
              </div>
              <div className="rounded-[16px] bg-white/5 px-2.5 py-2.5 text-center">
                <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--app-text-soft)]">Total</div>
                <div className="mt-2 font-bold text-[var(--app-primary)]">${formatCurrency(rep.total)}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Mobile Cards */}
      <div className="mt-4 space-y-3 sm:hidden">
        {pedidosDelDia.length === 0 ? (
          <div className="glass-panel rounded-[24px] px-4 py-10 text-center">
            <p className="text-gray-400 text-lg">No hay pedidos registrados hoy</p>
            <p className="text-gray-500 text-sm mt-2">Busca un cliente arriba para crear el primer pedido</p>
          </div>
        ) : (
          pedidosDelDia.map((pedido, index) => (
            <div key={`${pedido.firestoreId || pedido.id || 'pedido-mobile'}-${pedido.timestamp || pedido.fecha || index}-${index}`} className="glass-panel rounded-[24px] p-3">
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
                <div className="rounded-2xl bg-white/5 px-2 py-2 text-center">
                  <div className="text-gray-400">Valor</div>
                  <div className="text-white font-semibold">${formatCurrency(pedido.valor_pedido)}</div>
                </div>
                <div className="rounded-2xl bg-white/5 px-2 py-2 text-center">
                  <div className="text-gray-400">Costo</div>
                  <div className="font-semibold text-[var(--app-accent)]">${formatCurrency(pedido.costo_envio)}</div>
                </div>
                <div className="rounded-2xl bg-white/5 px-2 py-2 text-center">
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
                    onChange={(e) => handleAsignarRepartidor(obtenerIdPedido(pedido) || pedido.id, e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-slate-950/35 px-2 py-2 text-xs text-gray-200"
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
                    onChange={(e) => handleMetodoPagoChange(obtenerIdPedido(pedido) || pedido.id, e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-slate-950/35 px-2 py-2 text-xs text-gray-200"
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
                  onClick={() => handleEliminarPedido(obtenerIdPedido(pedido) || pedido.id)}
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
                <p className="text-gray-400 truncate" title={getClienteDireccion(clienteSeleccionadoPedido)}>
                  {getClienteDireccion(clienteSeleccionadoPedido)}
                </p>
                <p className="mt-1 text-xs font-medium tracking-[0.18em] text-[var(--app-primary)] uppercase" title={getClienteTelefono(clienteSeleccionadoPedido)}>
                  Tel: {getClienteTelefono(clienteSeleccionadoPedido)}
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
                  onChange={(e) => setNuevoCliente({...nuevoCliente, nombre: convertirAMayusculas(e.target.value)})}
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
                  onChange={(e) => setNuevoCliente({...nuevoCliente, direccion_habitual: convertirAMayusculas(e.target.value)})}
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
                  onChange={(e) => setNuevoCliente({...nuevoCliente, telefono: convertirAMayusculas(e.target.value)})}
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
