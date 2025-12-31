import { useState, useEffect } from 'react';
import { Search, Plus, Pencil, Trash2, UserCheck, UserX, Cloud, History } from 'lucide-react';
import toast from 'react-hot-toast';
import { 
  getRepartidores, 
  addRepartidor, 
  updateRepartidor, 
  deleteRepartidor,
  sincronizarConNube,
  getJornadasRepartidor
} from '../services/firebaseService';

export default function Repartidores() {
  const [repartidores, setRepartidores] = useState([]);

  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showHistorialModal, setShowHistorialModal] = useState(false);
  const [historialJornadas, setHistorialJornadas] = useState([]);
  const [repartidorSeleccionado, setRepartidorSeleccionado] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    nombre: '',
    vehiculo: 'Moto',
    placa: '',
    telefono: '',
    disponibilidad: true
  });

  // Cargar repartidores al montar
  useEffect(() => {
    cargarRepartidores();
  }, []);

  const cargarRepartidores = async () => {
    console.log('🔄 Cargando repartidores...');
    const repartidoresCargados = await getRepartidores();
    console.log('✅ Repartidores cargados:', repartidoresCargados);
    setRepartidores(Array.isArray(repartidoresCargados) ? repartidoresCargados : []);
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const validateWhatsApp = (telefono) => {
    // Validar que solo contenga números y tenga 10 dígitos
    const regex = /^\d{10}$/;
    return regex.test(telefono);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.nombre || !formData.vehiculo || !formData.telefono) {
      toast.error('Por favor completa todos los campos obligatorios');
      return;
    }

    if (!validateWhatsApp(formData.telefono)) {
      toast.error('El teléfono debe tener 10 dígitos numéricos (formato WhatsApp)');
      return;
    }

    try {
      if (editingId) {
        // Actualizar repartidor
        console.log('🔄 Actualizando repartidor...', editingId, formData);
        await updateRepartidor(editingId, formData);
      } else {
        // Agregar nuevo repartidor
        console.log('➕ Agregando nuevo repartidor...', formData);
        await addRepartidor(formData);
      }

      resetForm();
      await cargarRepartidores(); // Recargar lista
    } catch (error) {
      console.error('❌ Error en handleSubmit:', error);
    }
  };

  const handleEdit = (repartidor) => {
    setEditingId(repartidor.id);
    setFormData({
      nombre: repartidor.nombre,
      vehiculo: repartidor.vehiculo,
      placa: repartidor.placa,
      telefono: repartidor.telefono,
      disponibilidad: repartidor.disponibilidad
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (confirm('¿Estás seguro de eliminar este repartidor?')) {
      try {
        console.log('🗑️ Eliminando repartidor...', id);
        await deleteRepartidor(id);
        await cargarRepartidores(); // Recargar lista
      } catch (error) {
        console.error('❌ Error al eliminar repartidor:', error);
      }
    }
  };

  const handleVerHistorial = async (repartidor) => {
    try {
      console.log('📊 Cargando historial de:', repartidor.nombre);
      setRepartidorSeleccionado(repartidor);
      const jornadas = await getJornadasRepartidor(repartidor.id);
      setHistorialJornadas(jornadas);
      setShowHistorialModal(true);
    } catch (error) {
      console.error('❌ Error al cargar historial:', error);
      toast.error('No se pudo cargar el historial');
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

  const toggleDisponibilidad = (id) => {
    setRepartidores(repartidores.map(r =>
      r.id === id ? { ...r, disponibilidad: !r.disponibilidad } : r
    ));
  };

  const resetForm = () => {
    setFormData({
      nombre: '',
      vehiculo: 'Moto',
      placa: '',
      telefono: '',
      disponibilidad: true
    });
    setEditingId(null);
    setShowModal(false);
  };

  const filteredRepartidores = repartidores.filter(r =>
    r.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.telefono.includes(searchTerm) ||
    r.placa.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Repartidores</h1>
          <p className="text-gray-400 mt-1">Gestiona tu equipo de entrega</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            <Plus className="w-5 h-5" />
            Nuevo Repartidor
          </button>
          {/* Botón oculto de sincronización */}
          <button
            onClick={handleSincronizacion}
            className="hidden items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg transition-colors"
            title="Sincronizar con la Nube"
          >
            <Cloud className="w-5 h-5" />
            Sincronizar
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="bg-dark-card border border-dark-border rounded-lg p-4 mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Buscar por nombre, teléfono o placa..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-dark-bg border border-dark-border rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-primary focus:border-transparent"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-dark-card border border-dark-border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-dark-bg border-b border-dark-border">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Nombre
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Vehículo
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Placa
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  WhatsApp
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Estado
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Registro
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dark-border">
              {filteredRepartidores.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-6 py-8 text-center text-gray-400">
                    No se encontraron repartidores
                  </td>
                </tr>
              ) : (
                filteredRepartidores.map((repartidor) => (
                  <tr key={repartidor.id} className="hover:bg-dark-bg transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-white">{String(repartidor.nombre || '')}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-300">{String(repartidor.vehiculo || '')}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-300">{String(repartidor.placa || '')}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-300">{String(repartidor.telefono || '')}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <button
                        onClick={() => toggleDisponibilidad(repartidor.id)}
                        className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold ${
                          repartidor.disponibilidad
                            ? 'bg-success/20 text-success'
                            : 'bg-error/20 text-error'
                        }`}
                      >
                        {repartidor.disponibilidad ? (
                          <>
                            <UserCheck className="w-3 h-3" />
                            Disponible
                          </>
                        ) : (
                          <>
                            <UserX className="w-3 h-3" />
                            No disponible
                          </>
                        )}
                      </button>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-400">{String(repartidor.fechaRegistro || 'N/A')}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleVerHistorial(repartidor)}
                          className="p-2 text-purple-400 hover:bg-purple-500/10 rounded-lg transition-colors"
                          title="Ver Historial"
                        >
                          <History className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleEdit(repartidor)}
                          className="p-2 text-blue-400 hover:bg-blue-500/10 rounded-lg transition-colors"
                          title="Editar"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(repartidor.id)}
                          className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                          title="Eliminar"
                        >
                          <Trash2 className="w-4 h-4" />
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

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-dark-card border border-dark-border rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-dark-border">
              <h2 className="text-xl font-bold text-white">
                {editingId ? 'Editar Repartidor' : 'Nuevo Repartidor'}
              </h2>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {/* Nombre */}
              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Nombre Completo *
                </label>
                <input
                  type="text"
                  name="nombre"
                  value={formData.nombre}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 bg-[#374151] border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-primary focus:border-transparent"
                  placeholder="Ingresa el nombre del repartidor"
                />
              </div>

              {/* Vehículo y Placa */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-white mb-2">
                    Vehículo *
                  </label>
                  <select
                    name="vehiculo"
                    value={formData.vehiculo}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 bg-[#374151] border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-primary focus:border-transparent"
                  >
                    <option value="Moto">Moto</option>
                    <option value="Bicicleta">Bicicleta</option>
                    <option value="Carro">Carro</option>
                    <option value="A pie">A pie</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-white mb-2">
                    Placa
                  </label>
                  <input
                    type="text"
                    name="placa"
                    value={formData.placa}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 bg-[#374151] border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-primary focus:border-transparent"
                    placeholder="ABC123 o N/A"
                  />
                </div>
              </div>

              {/* Teléfono (WhatsApp) */}
              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Teléfono WhatsApp *
                </label>
                <input
                  type="text"
                  name="telefono"
                  value={formData.telefono}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 bg-[#374151] border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-primary focus:border-transparent"
                  placeholder="3001234567 (10 dígitos)"
                  maxLength="10"
                />
                <p className="text-xs text-gray-400 mt-1">
                  Debe ser un número de 10 dígitos sin espacios ni guiones
                </p>
              </div>

              {/* Disponibilidad */}
              <div className="flex items-center gap-3 p-4 bg-dark-bg border border-dark-border rounded-lg">
                <input
                  type="checkbox"
                  id="disponibilidad"
                  name="disponibilidad"
                  checked={formData.disponibilidad}
                  onChange={handleInputChange}
                  className="w-5 h-5 text-primary bg-[#374151] border-gray-600 rounded focus:ring-2 focus:ring-primary"
                />
                <label htmlFor="disponibilidad" className="text-sm font-medium text-white cursor-pointer flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-success" />
                  Marcar como Disponible
                </label>
              </div>

              {/* Buttons */}
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={resetForm}
                  className="flex-1 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-blue-600 transition-colors"
                >
                  {editingId ? 'Actualizar' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Historial de Jornadas */}
      {showHistorialModal && repartidorSeleccionado && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-dark-card border border-dark-border rounded-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-dark-border">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-white">
                    📊 Historial de Jornadas
                  </h2>
                  <p className="text-gray-400 mt-1">
                    {repartidorSeleccionado.nombre}
                  </p>
                </div>
                <button
                  onClick={() => setShowHistorialModal(false)}
                  className="text-gray-400 hover:text-white transition-colors text-2xl"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="p-6">
              {historialJornadas.length === 0 ? (
                <div className="text-center py-12">
                  <History className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                  <p className="text-gray-400">No hay jornadas registradas</p>
                  <p className="text-gray-500 text-sm mt-2">Las jornadas se guardan al cerrar el día en Despacho Rápido</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-dark-bg border-b border-dark-border">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Fecha</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase">Entregas</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase">Valor Pedidos</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase">Costos Envío</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase">Total Generado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-dark-border">
                      {historialJornadas.map((jornada) => {
                        const totalGenerado = jornada.total_pedidos_valor + jornada.total_costos_envio;
                        return (
                          <tr key={jornada.id} className="hover:bg-dark-bg transition-colors">
                            <td className="px-4 py-3 text-white">{jornada.fecha}</td>
                            <td className="px-4 py-3 text-right text-white font-semibold">{jornada.cantidad_entregas}</td>
                            <td className="px-4 py-3 text-right text-gray-300">${jornada.total_pedidos_valor.toLocaleString()}</td>
                            <td className="px-4 py-3 text-right text-warning">${jornada.total_costos_envio.toLocaleString()}</td>
                            <td className="px-4 py-3 text-right text-success font-bold">${totalGenerado.toLocaleString()}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot className="bg-dark-bg border-t-2 border-primary">
                      <tr>
                        <td className="px-4 py-3 text-white font-bold">TOTALES</td>
                        <td className="px-4 py-3 text-right text-white font-bold">
                          {historialJornadas.reduce((sum, j) => sum + j.cantidad_entregas, 0)}
                        </td>
                        <td className="px-4 py-3 text-right text-white font-bold">
                          ${historialJornadas.reduce((sum, j) => sum + j.total_pedidos_valor, 0).toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-right text-warning font-bold">
                          ${historialJornadas.reduce((sum, j) => sum + j.total_costos_envio, 0).toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-right text-success font-bold text-lg">
                          ${historialJornadas.reduce((sum, j) => sum + j.total_pedidos_valor + j.total_costos_envio, 0).toLocaleString()}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-dark-border">
              <button
                onClick={() => setShowHistorialModal(false)}
                className="w-full px-4 py-2 bg-dark-bg border border-dark-border text-white rounded-lg hover:bg-dark-border transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
