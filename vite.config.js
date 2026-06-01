import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return;

          if (id.includes('firebase')) return 'firebase';
          if (id.includes('react') || id.includes('scheduler')) return 'react-vendor';
          if (id.includes('recharts')) return 'charts';
        }
      }
    }
  },
  server: {
    port: 3000
  }
});
