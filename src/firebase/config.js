import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

/**
 * Configuración de Firebase para DomicilioX
 * Lee todas las credenciales desde variables de entorno
 */
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// Prevenir inicialización duplicada: solo crea app si no existe
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Inicializar Firestore con la app existente o nueva
const db = getFirestore(app);

export { db };
