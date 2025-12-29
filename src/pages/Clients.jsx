import React, { useState, useEffect } from 'react';
import { Plus, Search, Edit2, Trash2, X, Upload, Download, Cloud, Trash } from 'lucide-react';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';
import ImportModal from '../components/ImportModal';
import { 
  getClientes, 
  addCliente, 
  updateCliente,
  deleteCliente, 
  importarClientesLocal,
  sincronizarConNube 
} from '../services/firebaseService';

const Clients = () => {
  const [clientes, setClientes] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editingCell, setEditingCell] = useState({ id: null, field: null });
  const [editValue, setEditValue] = useState('');
  const [formData, setFormData] = useState({
    nombre: '',
    direccion_habitual: '',
    telefono: '',
    email: ''
  });

  // Cargar clientes al montar componente
  useEffect(() => {
    cargarClientes();
  }, []);

  const cargarClientes = () => {
    const clientesCargados = getClientes();
    setClientes(clientesCargados);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (editingId) {
      // Actualizar cliente existente
      updateCliente(editingId, formData);
    } else {
      // Agregar nuevo cliente
      addCliente(formData);
    }
    
    setFormData({
      nombre: '',
      direccion_habitual: '',
      telefono: '',
      email: ''
    });
    setEditingId(null);
    setShowModal(false);
    cargarClientes(); // Recargar lista
  };

  const handleDelete = (id) => {
    if (confirm('¿Estás seguro de eliminar este cliente?')) {
      deleteCliente(id);
      cargarClientes(); // Recargar lista
    }
  };

  const handleEdit = (cliente) => {
    setEditingId(cliente.id);
    setFormData({
      nombre: cliente.nombre,
      direccion_habitual: cliente.direccion_habitual,
      telefono: cliente.telefono,
      email: cliente.email || ''
    });
    setShowModal(true);
  };

  const handleCellDoubleClick = (cliente, field) => {
    setEditingCell({ id: cliente.id, field });
    setEditValue(cliente[field] || '');
  };

  const handleCellBlur = () => {
    if (editingCell.id && editingCell.field) {
      const clienteActualizado = clientes.find(c => c.id === editingCell.id);
      if (clienteActualizado && clienteActualizado[editingCell.field] !== editValue) {
        const datosActualizados = { [editingCell.field]: editValue };
        updateCliente(editingCell.id, datosActualizados);
        cargarClientes();
        toast.success('Campo actualizado');
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

  const handleImportFromModal = (data) => {
    setLoading(true);
    setProgress(0);
    setProgressMessage('Importando clientes...');

    setTimeout(() => {
      setProgress(50);
      const clientesImportados = data.map(row => ({
        nombre: row.nombre || '',
        direccion_habitual: row.direccion || '',
        telefono: row.telefono || '',
        email: ''
      }));

      setProgress(80);
      const cantidad = importarClientesLocal(clientesImportados);
      
      setProgress(100);
      setProgressMessage('¡Importación completada!');
      cargarClientes();
      toast.success(`${cantidad} clientes importados con éxito`);
      
      setTimeout(() => {
        setLoading(false);
        setProgress(0);
        setProgressMessage('');
        setShowImportModal(false);
      }, 1000);
    }, 500);
  };

  const handleExportExcel = () => {
    if (clientes.length === 0) {
      toast.error('No hay clientes para exportar');
      return;
    }

    const dataToExport = clientes.map(cliente => ({
      Nombre: cliente.nombre,
      Dirección: cliente.direccion_habitual,
      Teléfono: cliente.telefono,
      Email: cliente.email || '',
      'Fecha Registro': cliente.fechaRegistro
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Clientes');

    const fileName = `Clientes_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(workbook, fileName);
    
    toast.success('Información guardada con éxito');
  };

  const handleSincronizacion = async () => {
    try {
      const resultado = await sincronizarConNube();
      // Sincronización completada exitosamente
    } catch (error) {
      toast.error('Error al sincronizar con la nube');
    }
  };

  const handleDeleteAll = () => {
    if (clientes.length === 0) {
      toast.error('No hay clientes para eliminar');
      return;
    }

    if (confirm(`¿Estás seguro de eliminar TODOS los ${clientes.length} clientes? Esta acción no se puede deshacer.`)) {
      setLoading(true);
      setProgress(0);
      setProgressMessage('Preparando eliminación...');

      setTimeout(() => {
        setProgress(50);
        setProgressMessage(`Eliminando ${clientes.length} clientes...`);
        
        setTimeout(() => {
          localStorage.setItem('clientes', JSON.stringify([]));
          setClientes([]);
          setProgress(100);
          setProgressMessage('¡Eliminación completada!');
          toast.success('Todos los clientes han sido eliminados');
          
          setTimeout(() => {
            setLoading(false);
            setProgress(0);
            setProgressMessage('');
          }, 1000);
        }, 800);
      }, 500);
    }
  };

  const filteredClientes = clientes.filter(cliente => 
    cliente.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
    cliente.telefono.includes(searchTerm)
  );

  return (
    <div className="space-y-6">
      {/* Barra de Progreso */}
      {loading && (
        <div className="bg-dark-card border border-dark-border rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-white">{progressMessage}</span>
            <span className="text-sm font-bold text-primary">{progress}%</span>
          </div>
          <div className="w-full bg-gray-700 rounded-full h-3 overflow-hidden">
            <div 
              className="bg-gradient-to-r from-primary to-secondary h-3 rounded-full transition-all duration-300 ease-out"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white mb-2">Clientes</h2>
          <p className="text-gray-400">Administración de clientes</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setShowImportModal(true)}
            className="flex items-center gap-2 bg-secondary hover:bg-[#3d8b40] text-white px-4 py-2 rounded-lg transition-colors font-medium"
          >
            <Upload className="w-5 h-5" />
            Importar Excel
          </button>
          <button
            onClick={handleExportExcel}
            className="flex items-center gap-2 bg-primary hover:bg-[#1557b0] text-white px-4 py-2 rounded-lg transition-colors font-medium"
          >
            <Download className="w-5 h-5" />
            Exportar Excel
          </button>
          <button
            onClick={handleDeleteAll}
            className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors font-medium"
          >
            <Trash className="w-5 h-5" />
            Eliminar Todos
          </button>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 bg-primary hover:bg-[#1557b0] text-white px-4 py-2 rounded-lg transition-colors font-medium"
          >
            <Plus className="w-5 h-5" />
            Nuevo Cliente
          </button>
          {/* Botón oculto para sincronización futura */}
          <button
            onClick={handleSincronizacion}
            className="hidden items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg transition-colors font-medium"
            title="Sincronizar con la Nube"
          >
            <Cloud className="w-5 h-5" />
            Sincronizar con la Nube
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="bg-dark-card border border-dark-border rounded-lg p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Buscar por nombre o teléfono..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-[#374151] border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-primary focus:border-transparent"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-dark-card border border-dark-border rounded-lg shadow-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-[#374151]">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-white">Nombre</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-white hidden md:table-cell">Dirección</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-white">Teléfono</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-white hidden lg:table-cell">Email</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-white hidden sm:table-cell">Fecha Registro</th>
                <th className="px-4 py-3 text-center text-sm font-medium text-white">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dark-border">
              {filteredClientes.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-4 py-8 text-center text-gray-400">
                    No hay clientes registrados
                  </td>
                </tr>
              ) : (
                filteredClientes.map((cliente) => (
                  <tr key={cliente.id} className="hover:bg-[#374151] transition-colors">
                    {/* Nombre - Editable */}
                    <td 
                      className="px-4 py-3 text-sm text-white font-medium cursor-pointer"
                      onDoubleClick={() => handleCellDoubleClick(cliente, 'nombre')}
                      title="Doble clic para editar"
                    >
                      {editingCell.id === cliente.id && editingCell.field === 'nombre' ? (
                        <input
                          type="text"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={handleCellBlur}
                          onKeyDown={handleCellKeyDown}
                          autoFocus
                          className="w-full px-2 py-1 bg-[#374151] border border-primary rounded text-white focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                      ) : (
                        cliente.nombre
                      )}
                    </td>
                    
                    {/* Dirección - Editable */}
                    <td 
                      className="px-4 py-3 text-sm text-gray-300 hidden md:table-cell cursor-pointer"
                      onDoubleClick={() => handleCellDoubleClick(cliente, 'direccion_habitual')}
                      title="Doble clic para editar"
                    >
                      {editingCell.id === cliente.id && editingCell.field === 'direccion_habitual' ? (
                        <input
                          type="text"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={handleCellBlur}
                          onKeyDown={handleCellKeyDown}
                          autoFocus
                          className="w-full px-2 py-1 bg-[#374151] border border-primary rounded text-white focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                      ) : (
                        cliente.direccion_habitual
                      )}
                    </td>
                    
                    {/* Teléfono - Editable */}
                    <td 
                      className="px-4 py-3 text-sm text-gray-300 cursor-pointer"
                      onDoubleClick={() => handleCellDoubleClick(cliente, 'telefono')}
                      title="Doble clic para editar"
                    >
                      {editingCell.id === cliente.id && editingCell.field === 'telefono' ? (
                        <input
                          type="text"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={handleCellBlur}
                          onKeyDown={handleCellKeyDown}
                          autoFocus
                          className="w-full px-2 py-1 bg-[#374151] border border-primary rounded text-white focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                      ) : (
                        cliente.telefono
                      )}
                    </td>
                    
                    {/* Email - Editable */}
                    <td 
                      className="px-4 py-3 text-sm text-gray-300 hidden lg:table-cell cursor-pointer"
                      onDoubleClick={() => handleCellDoubleClick(cliente, 'email')}
                      title="Doble clic para editar"
                    >
                      {editingCell.id === cliente.id && editingCell.field === 'email' ? (
                        <input
                          type="email"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={handleCellBlur}
                          onKeyDown={handleCellKeyDown}
                          autoFocus
                          className="w-full px-2 py-1 bg-[#374151] border border-primary rounded text-white focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                      ) : (
                        cliente.email || '-'
                      )}
                    </td>
                    
                    <td className="px-4 py-3 text-sm text-gray-300 hidden sm:table-cell">{cliente.fechaRegistro}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-2">
                        <button 
                          onClick={() => handleEdit(cliente)}
                          className="p-2 hover:bg-dark-bg rounded-lg transition-colors"
                          title="Editar cliente"
                        >
                          <Edit2 className="w-4 h-4 text-primary" />
                        </button>
                        <button 
                          onClick={() => handleDelete(cliente.id)}
                          className="p-2 hover:bg-dark-bg rounded-lg transition-colors"
                          title="Eliminar cliente"
                        >
                          <Trash2 className="w-4 h-4 text-error" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal - Formulario Nuevo Cliente */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-dark-card rounded-xl shadow-2xl w-full max-w-2xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-dark-border">
              <h3 className="text-xl font-bold text-white">
                {editingId ? 'Editar Cliente' : 'Nuevo Cliente'}
              </h3>
              <button
                onClick={() => {
                  setShowModal(false);
                  setEditingId(null);
                  setFormData({ nombre: '', direccion_habitual: '', telefono: '', email: '' });
                }}
                className="p-2 hover:bg-dark-border rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Nombre *
                </label>
                <input
                  type="text"
                  name="nombre"
                  value={formData.nombre}
                  onChange={handleInputChange}
                  required
                  className="w-full px-4 py-2 bg-[#374151] border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-primary focus:border-transparent"
                  placeholder="Nombre completo"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Dirección Habitual *
                </label>
                <input
                  type="text"
                  name="direccion_habitual"
                  value={formData.direccion_habitual}
                  onChange={handleInputChange}
                  required
                  className="w-full px-4 py-2 bg-[#374151] border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-primary focus:border-transparent"
                  placeholder="Dirección principal"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-white mb-2">
                    Teléfono *
                  </label>
                  <input
                    type="tel"
                    name="telefono"
                    value={formData.telefono}
                    onChange={handleInputChange}
                    required
                    className="w-full px-4 py-2 bg-[#374151] border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-primary focus:border-transparent"
                    placeholder="Número de contacto"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-white mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 bg-[#374151] border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-primary focus:border-transparent"
                    placeholder="correo@ejemplo.com"
                  />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setEditingId(null);
                    setFormData({ nombre: '', direccion_habitual: '', telefono: '', email: '' });
                  }}
                  className="flex-1 px-6 py-3 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 px-6 py-3 bg-primary hover:bg-[#1557b0] text-white rounded-lg transition-colors font-medium"
                >
                  {editingId ? 'Actualizar' : 'Guardar Cliente'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Importación */}
      <ImportModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onImport={handleImportFromModal}
        requiredColumns={['Nombre', 'Dirección', 'Teléfono']}
      />
    </div>
  );
};

export default Clients;
