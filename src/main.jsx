import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// Registrar Service Worker sin cache para habilitar notificaciones en segundo plano.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch((error) => {
      console.warn('⚠️ No se pudo registrar el service worker:', error);
    });
  });
}

if (typeof window !== 'undefined') {
  window.__DOMICILIOX_BOOTED__ = true;
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
