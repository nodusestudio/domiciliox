import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

// Validación estricta: NO permitir valores por defecto
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// VALIDACIÓN CRÍTICA: Detener ejecución si las variables no están configuradas
const requiredVars = ['apiKey', 'authDomain', 'projectId', 'storageBucket', 'messagingSenderId', 'appId'];
const missingVars = requiredVars.filter(key => !firebaseConfig[key]);

if (missingVars.length > 0) {
  const errorMsg = `❌ ERROR CRÍTICO: Variables de entorno faltantes: ${missingVars.join(', ')}`;
  console.error(errorMsg);
  alert(`ERROR: No se pueden cargar las variables de Firebase.\n\nVerifica que en Vercel estén configuradas:\n${missingVars.map(v => `VITE_FIREBASE_${v.toUpperCase()}`).join('\n')}`);
  throw new Error(errorMsg);
}

// Detectar si estamos en producción (Vercel)
const isProduction = import.meta.env.PROD || window.location.hostname.includes('vercel.app');

// Validar que NO sean valores de demostración SOLO EN PRODUCCIÓN
if (isProduction) {
  if (firebaseConfig.projectId === 'domiciliox-demo' || 
      firebaseConfig.apiKey.includes('Dummy') || 
      firebaseConfig.apiKey.includes('Replace')) {
    const errorMsg = '❌ ERROR: Estás usando valores de DEMOSTRACIÓN en PRODUCCIÓN.';
    console.error(errorMsg);
    alert('ERROR: Las variables de Firebase son de DEMOSTRACIÓN.\n\nVe a Vercel > Settings > Environment Variables y configura los valores REALES de tu proyecto Firebase.');
    throw new Error(errorMsg);
  }
} else {
  // En desarrollo, solo mostrar advertencia
  if (firebaseConfig.projectId === 'domiciliox-demo' || 
      firebaseConfig.apiKey.includes('Dummy')) {
    console.warn('⚠️ DESARROLLO: Usando valores de demostración. En producción debes configurar valores reales.');
  }
}

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Verificar conexión exitosa
console.log("✅ Conectado a Firebase:");
console.log("   Project ID:", firebaseConfig.projectId);
console.log("   Auth Domain:", firebaseConfig.authDomain);

export const db = getFirestore(app);
export const auth = getAuth(app);
