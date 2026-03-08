import React, { useState, useEffect, useRef } from 'react';
import { Save, Building2, Phone, MapPin, Edit2, Sun, Moon, Globe, Shield, Database, X, Play } from 'lucide-react';
import toast from 'react-hot-toast';
import { db } from '../firebase/config';
import { doc, setDoc, getDoc } from 'firebase/firestore';

/**
 * Página de Configuración de DomicilioX
 * Formato InventarioX con tarjeta informativa y edición modal
 * Integrado con Firebase Firestore
 * 
 * Funcionalidades:
 * 1. Perfil de Empresa - Vista en tarjeta con opción de edición (sincroniza con Firestore)
 * 2. Preferencias - Tema y idioma en columna derecha (localStorage)
 * 3. Estado de Sincronización - Información de almacenamiento
 */

// Estructura de traducciones (preparado para i18n)
const translations = {
  es: {
    settings: 'Configuración',
    companyData: 'Perfil de Empresa',
    companyName: 'Nombre de la Empresa',
    phone: 'Teléfono',
    address: 'Dirección Principal',
    edit: 'Editar',
    save: 'Guardar',
    cancel: 'Cancelar',
    preferences: 'Preferencias',
    appearance: 'Apariencia',
    darkMode: 'Modo Oscuro',
    lightMode: 'Modo Claro',
    language: 'Idioma',
    selectLanguage: 'Seleccionar Idioma',
    spanish: 'Español',
    english: 'Inglés',
    pendingAlertTimer: 'Alarma pedido pendiente por entregar',
    pendingAlertHelp: 'Define en cuántos minutos se activa la alarma automática.',
    sounds: 'Sonidos',
    soundsHelp: 'Activa o desactiva cada sonido y ajusta su volumen.',
    soundNewOrder: 'Nuevo pedido',
    soundPayment: 'Pago confirmado',
    soundDelivery: 'Pedido entregado',
    soundPendingAlert: 'Aviso pendiente por entregar',
    soundPendingAlarm: 'Alarma continua pendiente por entregar',
    soundDispatcherVoice: 'Voz al asignar repartidor',
    enabled: 'Activo',
    volume: 'Volumen',
    preview: 'Probar',
    enableToPreview: 'Activa este sonido para probarlo',
    previewBlocked: 'Tu navegador bloqueó la reproducción de audio',
    syncStatus: 'Estado de Sincronización',
    localStorage: 'Almacenamiento Local',
    security: 'Seguridad',
    dataBackup: 'Respaldo de Datos',
    saved: 'Configuración guardada exitosamente',
    error: 'Error al guardar la configuración',
    noData: 'No configurado'
  },
  en: {
    settings: 'Settings',
    companyData: 'Company Profile',
    companyName: 'Company Name',
    phone: 'Phone',
    address: 'Main Address',
    edit: 'Edit',
    save: 'Save',
    cancel: 'Cancel',
    preferences: 'Preferences',
    appearance: 'Appearance',
    darkMode: 'Dark Mode',
    lightMode: 'Light Mode',
    language: 'Language',
    selectLanguage: 'Select Language',
    spanish: 'Spanish',
    english: 'English',
    pendingAlertTimer: 'Pending delivery alarm timer',
    pendingAlertHelp: 'Define after how many minutes the automatic alarm appears.',
    sounds: 'Sounds',
    soundsHelp: 'Enable or disable each sound and set its volume.',
    soundNewOrder: 'New order',
    soundPayment: 'Payment confirmed',
    soundDelivery: 'Order delivered',
    soundPendingAlert: 'Pending delivery reminder',
    soundPendingAlarm: 'Continuous pending delivery alarm',
    soundDispatcherVoice: 'Voice when assigning courier',
    enabled: 'Enabled',
    volume: 'Volume',
    preview: 'Preview',
    enableToPreview: 'Enable this sound to preview it',
    previewBlocked: 'Your browser blocked audio playback',
    syncStatus: 'Sync Status',
    localStorage: 'Local Storage',
    security: 'Security',
    dataBackup: 'Data Backup',
    saved: 'Settings saved successfully',
    error: 'Error saving settings',
    noData: 'Not configured'
  }
};

const Settings = () => {
  const MINUTOS_ALERTA_VALIDOS = [5, 10, 20, 30];
  const SOUND_SETTING_KEYS = [
    'newOrder',
    'payment',
    'delivery',
    'pendingDispatchAlert',
    'pendingDispatchAlarm',
    'dispatcherVoice'
  ];
  const DEFAULT_SOUND_SETTINGS = {
    newOrder: { enabled: true, volume: 100 },
    payment: { enabled: true, volume: 100 },
    delivery: { enabled: true, volume: 100 },
    pendingDispatchAlert: { enabled: true, volume: 100 },
    pendingDispatchAlarm: { enabled: true, volume: 100 },
    dispatcherVoice: { enabled: true, volume: 100 }
  };
  const SOUND_PREVIEW_URLS = {
    newOrder: 'https://assets.mixkit.co/active_storage/sfx/2354/2354-preview.mp3',
    payment: 'https://assets.mixkit.co/active_storage/sfx/2014/2014-preview.mp3',
    delivery: 'https://assets.mixkit.co/active_storage/sfx/1555/1555-preview.mp3',
    pendingDispatchAlert: 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3',
    pendingDispatchAlarm: 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3'
  };

  const clampVolume = (value) => {
    const num = Number(value);
    if (!Number.isFinite(num)) return 100;
    return Math.min(100, Math.max(0, Math.round(num)));
  };

  const normalizarSoundSettings = (candidate = {}) => {
    return SOUND_SETTING_KEYS.reduce((acc, key) => {
      const entry = candidate?.[key] || {};
      acc[key] = {
        enabled: typeof entry.enabled === 'boolean' ? entry.enabled : DEFAULT_SOUND_SETTINGS[key].enabled,
        volume: clampVolume(entry.volume ?? DEFAULT_SOUND_SETTINGS[key].volume)
      };
      return acc;
    }, {});
  };

  const obtenerMinutosAlerta = () => {
    try {
      const raw = localStorage.getItem('alerta_pendiente_entrega_minutos');
      const minutos = Number(raw);
      return MINUTOS_ALERTA_VALIDOS.includes(minutos) ? minutos : 20;
    } catch (error) {
      return 20;
    }
  };

  // Estado de configuración de empresa
  const [companyData, setCompanyData] = useState({
    nombre: '',
    telefono: '',
    direccion: ''
  });

  // Estado para controlar modo de edición
  const [isEditing, setIsEditing] = useState(false);

  // Estado temporal para edición (no afecta datos reales hasta guardar)
  const [editData, setEditData] = useState({
    nombre: '',
    telefono: '',
    direccion: ''
  });

  // Estado de preferencias de UI
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [currentLanguage, setCurrentLanguage] = useState('es');
  const [minutosAlertaPendiente, setMinutosAlertaPendiente] = useState(20);
  const [soundSettings, setSoundSettings] = useState(DEFAULT_SOUND_SETTINGS);
  const previewAudioRef = useRef(null);

  // Estado de sincronización con Firestore
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSync, setLastSync] = useState(null);

  // Cargar configuración al montar el componente
  useEffect(() => {
    loadSettings();
  }, []);

  useEffect(() => {
    return () => {
      if (previewAudioRef.current) {
        try {
          previewAudioRef.current.pause();
          previewAudioRef.current.currentTime = 0;
        } catch (error) {
          // Evitar errores al desmontar en navegadores restrictivos.
        }
        previewAudioRef.current = null;
      }
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  /**
   * Carga la configuración guardada desde Firestore y localStorage
   */
  const loadSettings = async () => {
    try {
      // Cargar datos de empresa desde Firestore
      const docRef = doc(db, 'configuracion', 'empresa');
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        const data = docSnap.data();
        setCompanyData(data);
        setEditData(data);
        setLastSync(new Date());
      }

      // Cargar preferencia de tema desde localStorage
      const savedTheme = localStorage.getItem('theme');
      if (savedTheme) {
        const dark = savedTheme === 'dark';
        setIsDarkMode(dark);
        applyTheme(dark);
      }

      // Cargar idioma desde localStorage
      const savedLanguage = localStorage.getItem('language');
      if (savedLanguage) {
        setCurrentLanguage(savedLanguage);
      }

      setMinutosAlertaPendiente(obtenerMinutosAlerta());

      const rawSoundSettings = localStorage.getItem('app_sound_settings');
      if (rawSoundSettings) {
        try {
          const parsed = JSON.parse(rawSoundSettings);
          setSoundSettings(normalizarSoundSettings(parsed));
        } catch (error) {
          setSoundSettings(DEFAULT_SOUND_SETTINGS);
        }
      } else {
        setSoundSettings(DEFAULT_SOUND_SETTINGS);
      }
    } catch (error) {
      console.error('Error al cargar configuración:', error);
      toast.error('Error al cargar la configuración desde Firebase');
    }
  };

  /**
   * Aplica el tema (claro u oscuro) al documento
   * 
   * @param {boolean} dark - true para modo oscuro, false para modo claro
   */
  const applyTheme = (dark) => {
    const root = document.documentElement;
    if (dark) {
      root.classList.add('dark');
      document.body.style.backgroundColor = '#111827';
    } else {
      root.classList.remove('dark');
      document.body.style.backgroundColor = '#F3F4F6';
    }
  };

  /**
   * Abre el formulario de edición
   */
  const handleEdit = () => {
    setEditData({ ...companyData });
    setIsEditing(true);
  };

  /**
   * Cancela la edición y cierra el formulario
   */
  const handleCancel = () => {
    setEditData({ ...companyData });
    setIsEditing(false);
  };

  /**
   * Maneja cambios en los campos del formulario de edición
   */
  const handleEditDataChange = (e) => {
    const { name, value } = e.target;
    setEditData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  /**
   * Guarda los cambios de datos de empresa en Firestore
   */
  const handleSaveCompanyData = async () => {
    try {
      // Validar campos obligatorios
      if (!editData.nombre) {
        toast.error('El nombre de la empresa es obligatorio');
        return;
      }

      setIsSyncing(true);

      // Guardar datos en Firestore
      const docRef = doc(db, 'configuracion', 'empresa');
      await setDoc(docRef, editData);

      // Actualizar estado local
      setCompanyData(editData);
      setIsEditing(false);
      setLastSync(new Date());
      setIsSyncing(false);
      
      toast.success(translations[currentLanguage].saved);
    } catch (error) {
      setIsSyncing(false);
      console.error('Error al guardar:', error);
      toast.error(translations[currentLanguage].error);
    }
  };

  /**
   * Cambia entre modo claro y oscuro
   */
  const handleThemeToggle = () => {
    const newDarkMode = !isDarkMode;
    setIsDarkMode(newDarkMode);
    applyTheme(newDarkMode);
    localStorage.setItem('theme', newDarkMode ? 'dark' : 'light');
    toast.success(`Modo ${newDarkMode ? 'oscuro' : 'claro'} activado`);
  };

  /**
   * Cambia el idioma de la aplicación
   */
  const handleLanguageChange = (e) => {
    const newLanguage = e.target.value;
    setCurrentLanguage(newLanguage);
    localStorage.setItem('language', newLanguage);
    toast.success(translations[newLanguage].saved);
  };

  const handlePendingAlertMinutesChange = (e) => {
    const minutos = Number(e.target.value);
    if (!MINUTOS_ALERTA_VALIDOS.includes(minutos)) return;

    setMinutosAlertaPendiente(minutos);
    localStorage.setItem('alerta_pendiente_entrega_minutos', String(minutos));
    window.dispatchEvent(new Event('app-settings-updated'));
    toast.success(`Alarma configurada a ${minutos} minutos`);
  };

  const persistSoundSettings = (nextSettings) => {
    localStorage.setItem('app_sound_settings', JSON.stringify(nextSettings));
    window.dispatchEvent(new Event('app-settings-updated'));
  };

  const stopSoundPreview = () => {
    if (previewAudioRef.current) {
      try {
        previewAudioRef.current.pause();
        previewAudioRef.current.currentTime = 0;
      } catch (error) {
        // Ignorar errores de reproducción al detener preview.
      }
      previewAudioRef.current = null;
    }
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  };

  const playVoicePreview = (volumePercent) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;

    const synth = window.speechSynthesis;
    const hablar = () => {
      const utterance = new SpeechSynthesisUtterance('domicilio solicitado');
      const voices = synth.getVoices();
      const vozPreferida =
        voices.find((v) => /es-(CO|ES|MX)/i.test(String(v.lang || ''))) ||
        voices.find((v) => String(v.lang || '').toLowerCase().startsWith('es')) ||
        null;

      if (vozPreferida) utterance.voice = vozPreferida;
      utterance.lang = 'es-CO';
      utterance.rate = 1;
      utterance.pitch = 1;
      utterance.volume = clampVolume(volumePercent) / 100;

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
  };

  const handlePreviewSound = (soundKey) => {
    const config = soundSettings[soundKey] || DEFAULT_SOUND_SETTINGS[soundKey];
    if (!config?.enabled) {
      toast(t.enableToPreview);
      return;
    }

    stopSoundPreview();

    if (soundKey === 'dispatcherVoice') {
      playVoicePreview(config.volume);
      return;
    }

    const previewUrl = SOUND_PREVIEW_URLS[soundKey];
    if (!previewUrl) return;

    try {
      const audio = new Audio(previewUrl);
      audio.volume = clampVolume(config.volume) / 100;
      previewAudioRef.current = audio;
      audio.onended = () => {
        if (previewAudioRef.current === audio) {
          previewAudioRef.current = null;
        }
      };
      audio.play().catch(() => toast.error(t.previewBlocked));
    } catch (error) {
      toast.error(t.previewBlocked);
    }
  };

  const handleSoundEnabledToggle = (soundKey) => {
    const nextSettings = {
      ...soundSettings,
      [soundKey]: {
        ...soundSettings[soundKey],
        enabled: !soundSettings[soundKey].enabled
      }
    };
    setSoundSettings(nextSettings);
    persistSoundSettings(nextSettings);
  };

  const handleSoundVolumeChange = (soundKey, value) => {
    const nextSettings = {
      ...soundSettings,
      [soundKey]: {
        ...soundSettings[soundKey],
        volume: clampVolume(value)
      }
    };
    setSoundSettings(nextSettings);
    persistSoundSettings(nextSettings);
  };

  const t = translations[currentLanguage];
  const soundRows = [
    { key: 'newOrder', label: t.soundNewOrder },
    { key: 'payment', label: t.soundPayment },
    { key: 'delivery', label: t.soundDelivery },
    { key: 'pendingDispatchAlert', label: t.soundPendingAlert },
    { key: 'pendingDispatchAlarm', label: t.soundPendingAlarm },
    { key: 'dispatcherVoice', label: t.soundDispatcherVoice }
  ];

  return (
    <div className="p-3 sm:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-4 sm:mb-6">
        <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2">{t.settings}</h2>
        <p className="text-sm sm:text-base text-gray-400">Personaliza DomicilioX según tus necesidades</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Columna Izquierda - Datos de la Empresa */}
        <div className="lg:col-span-2 space-y-4 sm:space-y-6">
          
          {/* Tarjeta o Formulario de Datos de la Empresa */}
          <div className="bg-dark-card border border-dark-border rounded-xl shadow-lg p-4 sm:p-6 w-full">
            <div className="flex items-center justify-between mb-4 sm:mb-6">
              <div className="flex items-center gap-2 sm:gap-3">
                <Building2 className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
                <h3 className="text-lg sm:text-xl font-bold text-white">{t.companyData}</h3>
              </div>
              
              {!isEditing && (
                <button
                  onClick={handleEdit}
                  className="flex items-center gap-2 px-4 sm:px-5 h-11 sm:h-12 bg-primary hover:bg-[#1557b0] text-white rounded-xl transition-all shadow-md hover:shadow-lg active:scale-95 text-sm sm:text-base font-semibold touch-manipulation"
                >
                  <Edit2 className="w-4 h-4 sm:w-5 sm:h-5" />
                  <span className="hidden sm:inline">{t.edit}</span>
                  <span className="sm:hidden">Editar</span>
                </button>
              )}
            </div>

            {!isEditing ? (
              // Vista de Tarjeta de Información
              <div className="space-y-3 sm:space-y-4">
                <div className="flex items-start gap-3 p-3 sm:p-4 bg-[#374151] rounded-xl shadow-sm">
                  <Building2 className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs sm:text-sm text-gray-400 mb-1">Nombre de la Empresa</p>
                    <p className="text-sm sm:text-base text-white font-medium break-words">
                      {companyData.nombre || t.noData}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 sm:p-4 bg-[#374151] rounded-xl shadow-sm">
                  <Phone className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs sm:text-sm text-gray-400 mb-1">Teléfono</p>
                    <p className="text-sm sm:text-base text-white font-medium break-words">
                      {companyData.telefono || t.noData}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 sm:p-4 bg-[#374151] rounded-xl shadow-sm">
                  <MapPin className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs sm:text-sm text-gray-400 mb-1">Dirección Principal</p>
                    <p className="text-sm sm:text-base text-white font-medium break-words">
                      {companyData.direccion || t.noData}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              // Formulario de Edición
              <div className="space-y-4">
                {/* Nombre de la Empresa */}
                <div>
                  <label className="block text-sm font-medium text-white mb-2">
                    {t.companyName} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="nombre"
                    value={editData.nombre}
                    onChange={handleEditDataChange}
                    placeholder="Ej: DomicilioX S.A.S."
                    className="w-full px-4 py-3 sm:py-3.5 bg-[#374151] border border-gray-600 rounded-xl text-white placeholder-gray-400 focus:ring-2 focus:ring-primary focus:border-transparent transition-all text-base shadow-sm touch-manipulation"
                  />
                </div>

                {/* Teléfono */}
                <div>
                  <label className="block text-sm font-medium text-white mb-2">
                    {t.phone}
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5 pointer-events-none" />
                    <input
                      type="tel"
                      name="telefono"
                      value={editData.telefono}
                      onChange={handleEditDataChange}
                      placeholder="Ej: +57 300 123 4567"
                      inputMode="numeric"
                      className="w-full pl-10 pr-4 py-3 sm:py-3.5 bg-[#374151] border border-gray-600 rounded-xl text-white placeholder-gray-400 focus:ring-2 focus:ring-primary focus:border-transparent transition-all text-base shadow-sm touch-manipulation"
                    />
                  </div>
                </div>

                {/* Dirección */}
                <div>
                  <label className="block text-sm font-medium text-white mb-2">
                    {t.address}
                  </label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-3 text-gray-400 w-5 h-5 pointer-events-none" />
                    <textarea
                      name="direccion"
                      value={editData.direccion}
                      onChange={handleEditDataChange}
                      placeholder="Ej: Calle 123 #45-67, Bogotá, Colombia"
                      rows="3"
                      className="w-full pl-10 pr-4 py-3 bg-[#374151] border border-gray-600 rounded-xl text-white placeholder-gray-400 focus:ring-2 focus:ring-primary focus:border-transparent transition-all resize-none text-base shadow-sm touch-manipulation"
                    />
                  </div>
                </div>

                {/* Botones de Acción */}
                <div className="flex flex-col sm:flex-row gap-3 pt-4">
                  <button
                    onClick={handleSaveCompanyData}
                    disabled={isSyncing}
                    className="flex items-center justify-center gap-2 px-5 h-12 sm:h-14 bg-primary hover:bg-[#1557b0] text-white rounded-xl transition-all font-semibold disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl active:scale-95 text-base touch-manipulation flex-1"
                  >
                    <Save className="w-5 h-5" />
                    {isSyncing ? 'Guardando...' : t.save}
                  </button>
                  <button
                    onClick={handleCancel}
                    className="flex items-center justify-center gap-2 px-5 h-12 sm:h-14 bg-gray-600 hover:bg-gray-700 text-white rounded-xl transition-all font-semibold shadow-md hover:shadow-lg active:scale-95 text-base touch-manipulation sm:flex-initial sm:min-w-[120px]"
                  >
                    <X className="w-5 h-5" />
                    {t.cancel}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Columna Derecha - Preferencias y Estado */}
        <div className="space-y-4 sm:space-y-6">
          
          {/* Tarjeta de Preferencias */}
          <div className="bg-dark-card border border-dark-border rounded-xl shadow-lg p-4 sm:p-6">
            <div className="flex items-center gap-2 sm:gap-3 mb-4 sm:mb-6">
              <Globe className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
              <h3 className="text-lg sm:text-xl font-bold text-white">{t.preferences}</h3>
            </div>

            <div className="space-y-4">
              {/* Modo Oscuro/Claro */}
              <div>
                <p className="text-xs sm:text-sm text-gray-400 mb-3">{t.appearance}</p>
                <div className="flex items-center justify-between p-3 bg-[#374151] rounded-xl shadow-sm min-h-[48px]">
                  <div className="flex items-center gap-2">
                    {isDarkMode ? (
                      <Moon className="w-5 h-5 text-gray-300" />
                    ) : (
                      <Sun className="w-5 h-5 text-gray-300" />
                    )}
                    <span className="text-white text-sm sm:text-base">
                      {isDarkMode ? t.darkMode : t.lightMode}
                    </span>
                  </div>

                  {/* Switch Toggle */}
                  <button
                    onClick={handleThemeToggle}
                    className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors touch-manipulation ${
                      isDarkMode ? 'bg-primary' : 'bg-gray-500'
                    }`}
                  >
                    <span
                      className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform shadow-md ${
                        isDarkMode ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              </div>

              {/* Idioma */}
              <div>
                <p className="text-xs sm:text-sm text-gray-400 mb-3">{t.language}</p>
                <select
                  value={currentLanguage}
                  onChange={handleLanguageChange}
                  className="w-full px-4 py-3 bg-[#374151] border border-gray-600 rounded-xl text-white focus:ring-2 focus:ring-primary focus:border-transparent transition-all cursor-pointer text-sm sm:text-base shadow-sm touch-manipulation h-12"
                >
                  <option value="es">{t.spanish}</option>
                  <option value="en">{t.english}</option>
                </select>
              </div>

              {/* Temporizador de alarma de pedido pendiente */}
              <div>
                <p className="text-xs sm:text-sm text-gray-400 mb-3">{t.pendingAlertTimer}</p>
                <select
                  value={minutosAlertaPendiente}
                  onChange={handlePendingAlertMinutesChange}
                  className="w-full px-4 py-3 bg-[#374151] border border-gray-600 rounded-xl text-white focus:ring-2 focus:ring-primary focus:border-transparent transition-all cursor-pointer text-sm sm:text-base shadow-sm touch-manipulation h-12"
                >
                  {MINUTOS_ALERTA_VALIDOS.map((min) => (
                    <option key={min} value={min}>{min} min</option>
                  ))}
                </select>
                <p className="text-xs text-gray-400 mt-2">{t.pendingAlertHelp}</p>
              </div>

              <div>
                <p className="text-xs sm:text-sm text-gray-400 mb-3">{t.sounds}</p>
                <div className="space-y-3">
                  {soundRows.map((soundItem) => {
                    const current = soundSettings[soundItem.key] || DEFAULT_SOUND_SETTINGS[soundItem.key];
                    return (
                      <div key={soundItem.key} className="p-3 bg-[#374151] rounded-xl shadow-sm space-y-3">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-white text-sm sm:text-base leading-tight">{soundItem.label}</span>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handlePreviewSound(soundItem.key)}
                              className="inline-flex items-center gap-1 px-3 h-8 rounded-lg bg-primary/20 hover:bg-primary/30 text-primary transition-colors text-xs sm:text-sm"
                              aria-label={`${t.preview}: ${soundItem.label}`}
                            >
                              <Play className="w-3.5 h-3.5" />
                              <span>{t.preview}</span>
                            </button>
                            <button
                              onClick={() => handleSoundEnabledToggle(soundItem.key)}
                              className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors touch-manipulation ${
                                current.enabled ? 'bg-primary' : 'bg-gray-500'
                              }`}
                              aria-label={`${t.enabled}: ${soundItem.label}`}
                            >
                              <span
                                className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform shadow-md ${
                                  current.enabled ? 'translate-x-6' : 'translate-x-1'
                                }`}
                              />
                            </button>
                          </div>
                        </div>

                        <div>
                          <div className="flex items-center justify-between text-xs text-gray-300 mb-2">
                            <span>{t.volume}</span>
                            <span>{current.volume}%</span>
                          </div>
                          <input
                            type="range"
                            min="0"
                            max="100"
                            step="1"
                            value={current.volume}
                            disabled={!current.enabled}
                            onChange={(e) => handleSoundVolumeChange(soundItem.key, e.target.value)}
                            className="w-full accent-primary disabled:opacity-50"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
                <p className="text-xs text-gray-400 mt-2">{t.soundsHelp}</p>
              </div>
            </div>
          </div>

          {/* Estado de Sincronización */}
          <div className="bg-dark-card border border-dark-border rounded-xl shadow-lg p-4 sm:p-6">
            <div className="flex items-center gap-2 sm:gap-3 mb-4">
              <Database className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
              <h3 className="text-lg sm:text-xl font-bold text-white">{t.syncStatus}</h3>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-[#374151] rounded-xl shadow-sm">
                <div className="flex items-center gap-2">
                  <span className="text-xs sm:text-sm text-gray-300">Firebase Firestore</span>
                  {isSyncing && (
                    <div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                  )}
                </div>
                <div className={`w-2 h-2 rounded-full ${lastSync ? 'bg-green-500' : 'bg-gray-500'}`}></div>
              </div>
              <p className="text-xs text-gray-400">
                {lastSync 
                  ? `Última sincronización: ${lastSync.toLocaleTimeString('es-ES')}`
                  : 'Datos del perfil sincronizados con la nube'}
              </p>
            </div>
          </div>

          {/* Seguridad */}
          <div className="bg-dark-card border border-dark-border rounded-xl shadow-lg p-4 sm:p-6">
            <div className="flex items-center gap-2 sm:gap-3 mb-4">
              <Shield className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
              <h3 className="text-lg sm:text-xl font-bold text-white">{t.security}</h3>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-[#374151] rounded-xl shadow-sm">
                <span className="text-xs sm:text-sm text-gray-300">{t.dataBackup}</span>
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              </div>
              <p className="text-xs text-gray-400">
                Exporta tus datos regularmente desde cada módulo
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
