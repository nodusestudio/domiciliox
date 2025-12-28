/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Colores principales según manual InventarioX
        primary: '#206DDA',        // Azul primario - Botones principales, links activos
        secondary: '#4CAF50',      // Verde - Estados de éxito, confirmaciones
        
        // Modo oscuro (usado por defecto)
        'dark-bg': '#111827',      // Fondo principal modo oscuro
        'dark-card': '#1f2937',    // Tarjetas y contenedores
        'dark-border': '#374151',  // Bordes y separadores
        
        // Estados
        success: '#10B981',        // Mensajes de éxito
        warning: '#F59E0B',        // Advertencias
        error: '#EF4444',          // Errores y alertas
        danger: '#DC3545',         // Acciones destructivas
      },
    },
  },
  plugins: [],
}
