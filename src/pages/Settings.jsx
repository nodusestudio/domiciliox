import React, { useState, useEffect } from 'react';
import { Save, Building2, Phone, MapPin, Edit2, Sun, Moon, Globe, Shield, Database, X } from 'lucide-react';
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

  // Estado de sincronización con Firestore
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSync, setLastSync] = useState(null);

  // Cargar configuración al montar el componente
  useEffect(() => {
    loadSettings();
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

  const t = translations[currentLanguage];

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-3xl font-bold text-white mb-2">{t.settings}</h2>
        <p className="text-gray-400">Personaliza DomicilioX según tus necesidades</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Columna Izquierda - Datos de la Empresa */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Tarjeta o Formulario de Datos de la Empresa */}
          <div className="bg-dark-card border border-dark-border rounded-lg p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <Building2 className="w-6 h-6 text-primary" />
                <h3 className="text-xl font-bold text-white">{t.companyData}</h3>
              </div>
              
              {!isEditing && (
                <button
                  onClick={handleEdit}
                  className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-[#1557b0] text-white rounded-lg transition-colors text-sm font-semibold"
                >
                  <Edit2 className="w-4 h-4" />
                  {t.edit}
                </button>
              )}
            </div>

            {!isEditing ? (
              // Vista de Tarjeta de Información
              <div className="space-y-4">
                <div className="flex items-start gap-3 p-4 bg-[#374151] rounded-lg">
                  <Building2 className="w-5 h-5 text-gray-400 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm text-gray-400 mb-1">Nombre de la Empresa</p>
                    <p className="text-white font-medium">
                      {companyData.nombre || t.noData}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-4 bg-[#374151] rounded-lg">
                  <Phone className="w-5 h-5 text-gray-400 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm text-gray-400 mb-1">Teléfono</p>
                    <p className="text-white font-medium">
                      {companyData.telefono || t.noData}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-4 bg-[#374151] rounded-lg">
                  <MapPin className="w-5 h-5 text-gray-400 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm text-gray-400 mb-1">Dirección Principal</p>
                    <p className="text-white font-medium">
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
                    className="w-full px-4 py-3 bg-[#374151] border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                  />
                </div>

                {/* Teléfono */}
                <div>
                  <label className="block text-sm font-medium text-white mb-2">
                    {t.phone}
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input
                      type="tel"
                      name="telefono"
                      value={editData.telefono}
                      onChange={handleEditDataChange}
                      placeholder="Ej: +57 300 123 4567"
                      className="w-full pl-10 pr-4 py-3 bg-[#374151] border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                    />
                  </div>
                </div>

                {/* Dirección */}
                <div>
                  <label className="block text-sm font-medium text-white mb-2">
                    {t.address}
                  </label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-3 text-gray-400 w-5 h-5" />
                    <textarea
                      name="direccion"
                      value={editData.direccion}
                      onChange={handleEditDataChange}
                      placeholder="Ej: Calle 123 #45-67, Bogotá, Colombia"
                      rows="2"
                      className="w-full pl-10 pr-4 py-3 bg-[#374151] border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-primary focus:border-transparent transition-all resize-none"
                    />
                  </div>
                </div>

                {/* Botones de Acción */}
                <div className="flex gap-3 pt-4">
                  <button
                    onClick={handleSaveCompanyData}
                    disabled={isSyncing}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-primary hover:bg-[#1557b0] text-white rounded-lg transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Save className="w-5 h-5" />
                    {isSyncing ? 'Guardando...' : t.save}
                  </button>
                  <button
                    onClick={handleCancel}
                    className="flex items-center justify-center gap-2 px-4 py-3 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors font-semibold"
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
        <div className="space-y-6">
          
          {/* Tarjeta de Preferencias */}
          <div className="bg-dark-card border border-dark-border rounded-lg p-6">
            <div className="flex items-center gap-3 mb-6">
              <Globe className="w-6 h-6 text-primary" />
              <h3 className="text-xl font-bold text-white">{t.preferences}</h3>
            </div>

            <div className="space-y-4">
              {/* Modo Oscuro/Claro */}
              <div>
                <p className="text-sm text-gray-400 mb-3">{t.appearance}</p>
                <div className="flex items-center justify-between p-3 bg-[#374151] rounded-lg">
                  <div className="flex items-center gap-2">
                    {isDarkMode ? (
                      <Moon className="w-5 h-5 text-gray-300" />
                    ) : (
                      <Sun className="w-5 h-5 text-gray-300" />
                    )}
                    <span className="text-white text-sm">
                      {isDarkMode ? t.darkMode : t.lightMode}
                    </span>
                  </div>

                  {/* Switch Toggle */}
                  <button
                    onClick={handleThemeToggle}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      isDarkMode ? 'bg-primary' : 'bg-gray-500'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        isDarkMode ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              </div>

              {/* Idioma */}
              <div>
                <p className="text-sm text-gray-400 mb-3">{t.language}</p>
                <select
                  value={currentLanguage}
                  onChange={handleLanguageChange}
                  className="w-full px-4 py-3 bg-[#374151] border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-primary focus:border-transparent transition-all cursor-pointer text-sm"
                >
                  <option value="es">{t.spanish}</option>
                  <option value="en">{t.english}</option>
                </select>
              </div>
            </div>
          </div>

          {/* Estado de Sincronización */}
          <div className="bg-dark-card border border-dark-border rounded-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <Database className="w-6 h-6 text-primary" />
              <h3 className="text-xl font-bold text-white">{t.syncStatus}</h3>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-[#374151] rounded-lg">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-300">Firebase Firestore</span>
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
          <div className="bg-dark-card border border-dark-border rounded-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <Shield className="w-6 h-6 text-primary" />
              <h3 className="text-xl font-bold text-white">{t.security}</h3>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-[#374151] rounded-lg">
                <span className="text-sm text-gray-300">{t.dataBackup}</span>
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
