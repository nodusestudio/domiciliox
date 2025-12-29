import React, { useState } from 'react';
import { Upload, X, FileSpreadsheet, AlertCircle } from 'lucide-react';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';

const ImportModal = ({ isOpen, onClose, onImport, requiredColumns = ['Nombre', 'Dirección', 'Teléfono'] }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState([]);

  if (!isOpen) return null;

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      processFile(droppedFile);
    }
  };

  const handleFileSelect = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      processFile(selectedFile);
    }
  };

  const processFile = (selectedFile) => {
    const validExtensions = ['.xlsx', '.xls', '.csv'];
    const fileExtension = selectedFile.name.substring(selectedFile.name.lastIndexOf('.')).toLowerCase();
    
    if (!validExtensions.includes(fileExtension)) {
      toast.error('Formato de archivo no válido. Usa .xlsx, .xls o .csv');
      return;
    }

    setFile(selectedFile);
    
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet);

        // Validar columnas requeridas
        if (jsonData.length === 0) {
          toast.error('El archivo está vacío');
          return;
        }

        const firstRow = jsonData[0];
        const columns = Object.keys(firstRow);
        
        // Buscar columnas requeridas (con variaciones)
        const missingColumns = [];
        const columnMap = {};

        requiredColumns.forEach(required => {
          let found = null;
          
          // Buscar coincidencias exactas o parciales con variaciones
          if (required === 'Nombre') {
            found = columns.find(col => 
              col.toLowerCase().trim() === 'nombre' ||
              col.toLowerCase().includes('nombre')
            );
          } else if (required === 'Dirección') {
            found = columns.find(col => 
              col.toLowerCase().trim() === 'direccion' ||
              col.toLowerCase().trim() === 'dirección' ||
              col.toLowerCase().includes('direccion') ||
              col.toLowerCase().includes('dirección')
            );
          } else if (required === 'Teléfono') {
            found = columns.find(col => 
              col.toLowerCase().trim() === 'telefono' ||
              col.toLowerCase().trim() === 'teléfono' ||
              col.toLowerCase().trim() === 'whatsapp' ||
              col.toLowerCase().includes('telefono') ||
              col.toLowerCase().includes('teléfono') ||
              col.toLowerCase().includes('whatsapp')
            );
          } else {
            found = columns.find(col => 
              col.toLowerCase().trim() === required.toLowerCase().trim() ||
              col.toLowerCase().includes(required.toLowerCase())
            );
          }
          
          if (found) {
            columnMap[required] = found;
          } else {
            missingColumns.push(required);
          }
        });

        if (missingColumns.length > 0) {
          toast.error(`Faltan columnas requeridas: ${missingColumns.join(', ')}`);
          setPreview([]);
          return;
        }

        // Normalizar datos
        const normalizedData = jsonData.map(row => {
          const normalized = {};
          requiredColumns.forEach(required => {
            const actualColumn = columnMap[required];
            normalized[required.toLowerCase().replace('ó', 'o')] = row[actualColumn] || '';
          });
          return normalized;
        });

        setPreview(normalizedData.slice(0, 5)); // Mostrar primeros 5 registros
        toast.success(`${jsonData.length} registros detectados`);
      } catch (error) {
        toast.error('Error al procesar el archivo. Verifica el formato.');
      }
    };

    reader.readAsArrayBuffer(selectedFile);
  };

  const handleImport = () => {
    if (preview.length === 0) {
      toast.error('No hay datos para importar');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet);

        const firstRow = jsonData[0];
        const columns = Object.keys(firstRow);
        const columnMap = {};

        requiredColumns.forEach(required => {
          let found = null;
          
          // Buscar coincidencias exactas o parciales con variaciones
          if (required === 'Nombre') {
            found = columns.find(col => 
              col.toLowerCase().trim() === 'nombre' ||
              col.toLowerCase().includes('nombre')
            );
          } else if (required === 'Dirección') {
            found = columns.find(col => 
              col.toLowerCase().trim() === 'direccion' ||
              col.toLowerCase().trim() === 'dirección' ||
              col.toLowerCase().includes('direccion') ||
              col.toLowerCase().includes('dirección')
            );
          } else if (required === 'Teléfono') {
            found = columns.find(col => 
              col.toLowerCase().trim() === 'telefono' ||
              col.toLowerCase().trim() === 'teléfono' ||
              col.toLowerCase().trim() === 'whatsapp' ||
              col.toLowerCase().includes('telefono') ||
              col.toLowerCase().includes('teléfono') ||
              col.toLowerCase().includes('whatsapp')
            );
          } else {
            found = columns.find(col => 
              col.toLowerCase().trim() === required.toLowerCase().trim() ||
              col.toLowerCase().includes(required.toLowerCase())
            );
          }
          
          if (found) {
            columnMap[required] = found;
          }
        });

        const normalizedData = jsonData.map(row => {
          const normalized = {};
          requiredColumns.forEach(required => {
            const actualColumn = columnMap[required];
            normalized[required.toLowerCase().replace('ó', 'o')] = row[actualColumn] || '';
          });
          return normalized;
        });

        onImport(normalizedData);
        handleClose();
      } catch (error) {
        toast.error('Error al importar datos. Verifica el archivo.');
      }
    };

    reader.readAsArrayBuffer(file);
  };

  const handleClose = () => {
    setFile(null);
    setPreview([]);
    setIsDragging(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-[#1f2937] border border-dark-border rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-dark-border">
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            <FileSpreadsheet className="w-6 h-6 text-primary" />
            Importar desde Excel
          </h3>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Drop Zone */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              isDragging
                ? 'border-primary bg-primary/10'
                : 'border-dark-border hover:border-primary/50'
            }`}
          >
            <Upload className={`w-12 h-12 mx-auto mb-4 ${isDragging ? 'text-primary' : 'text-gray-400'}`} />
            <p className="text-white font-medium mb-2">
              Arrastra tu archivo aquí o haz clic para seleccionar
            </p>
            <p className="text-sm text-gray-400 mb-4">
              Formatos soportados: .xlsx, .xls, .csv
            </p>
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileSelect}
              className="hidden"
              id="file-input"
            />
            <label
              htmlFor="file-input"
              className="inline-block px-6 py-3 bg-primary text-white rounded-lg hover:bg-blue-700 transition-colors cursor-pointer"
            >
              Seleccionar Archivo
            </label>
          </div>

          {/* Columnas Requeridas */}
          <div className="bg-dark-bg border border-dark-border rounded-lg p-4">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-white font-medium mb-2">Columnas Requeridas:</p>
                <div className="flex flex-wrap gap-2">
                  {requiredColumns.map((col, index) => (
                    <span
                      key={index}
                      className="px-3 py-1 bg-primary/20 text-primary rounded-full text-sm"
                    >
                      {col}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Preview */}
          {preview.length > 0 && (
            <div className="bg-dark-bg border border-dark-border rounded-lg p-4">
              <h4 className="text-white font-medium mb-3">Vista Previa (primeros 5 registros)</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-[#111827]">
                    <tr>
                      {requiredColumns.map((col, index) => (
                        <th key={index} className="px-3 py-2 text-left text-white">
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-dark-border">
                    {preview.map((row, index) => (
                      <tr key={index}>
                        {requiredColumns.map((col, colIndex) => (
                          <td key={colIndex} className="px-3 py-2 text-gray-300">
                            {row[col.toLowerCase().replace('ó', 'o')] || '-'}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-dark-border">
          <button
            onClick={handleClose}
            className="px-6 py-3 bg-dark-border text-white rounded-lg hover:bg-[#4B5563] transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleImport}
            disabled={preview.length === 0}
            className="px-6 py-3 bg-primary text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Importar {preview.length > 0 && `(${preview.length}+)`}
          </button>
        </div>
      </div>
    </div>
  );
};

// Optimización: Evitar re-renders cuando las props no cambian
export default React.memo(ImportModal);
