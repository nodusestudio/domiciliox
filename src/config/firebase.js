import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore, clearIndexedDbPersistence } from "firebase/firestore";
import { getAuth } from "firebase/auth";

// Variables de entorno esperadas por Firebase
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// Detectar si estamos en producción (incluye despliegues en Vercel)
const isProduction = import.meta.env.PROD || window.location.hostname.includes('vercel.app');

// Validar variables requeridas
const requiredVars = ['apiKey', 'authDomain', 'projectId', 'storageBucket', 'messagingSenderId', 'appId'];
const missingVars = requiredVars.filter(key => !firebaseConfig[key]);
export const hasFirebaseEnv = missingVars.length === 0;

if (!hasFirebaseEnv && isProduction) {
  const errorMsg = `❌ ERROR CRÍTICO: Variables de entorno faltantes: ${missingVars.join(', ')}`;
  console.error(errorMsg);
  alert(`ERROR: No se pueden cargar las variables de Firebase.\n\nVerifica que en Vercel estén configuradas:\n${missingVars.map(v => `VITE_FIREBASE_${v.toUpperCase()}`).join('\n')}`);
  throw new Error(errorMsg);
}

if (!hasFirebaseEnv && !isProduction) {
  console.warn('⚠️ Firebase no configurado en desarrollo. Se activará modo local (sin nube).');
}

// Validar que NO sean valores de demostración SOLO EN PRODUCCIÓN
if (isProduction && hasFirebaseEnv) {
  const apiKey = firebaseConfig.apiKey || '';
  if (firebaseConfig.projectId === 'domiciliox-demo' || 
      apiKey.includes('Dummy') || 
      apiKey.includes('Replace')) {
    const errorMsg = '❌ ERROR: Estás usando valores de DEMOSTRACIÓN en PRODUCCIÓN.';
    console.error(errorMsg);
    alert('ERROR: Las variables de Firebase son de DEMOSTRACIÓN.\n\nVe a Vercel > Settings > Environment Variables y configura los valores REALES de tu proyecto Firebase.');
    throw new Error(errorMsg);
  }
} else if (hasFirebaseEnv) {
  // En desarrollo, solo mostrar advertencia cuando sí hay variables.
  const apiKey = firebaseConfig.apiKey || '';
  if (firebaseConfig.projectId === 'domiciliox-demo' || apiKey.includes('Dummy')) {
    console.warn('⚠️ DESARROLLO: Usando valores de demostración. En producción debes configurar valores reales.');
  }
}

const app = hasFirebaseEnv
  ? (getApps().length > 0 ? getApp() : initializeApp(firebaseConfig))
  : null;

// Verificar conexión exitosa
if (app) {
  console.log("✅ Conectado a Firebase:");
  console.log("   Project ID:", firebaseConfig.projectId);
  console.log("   Auth Domain:", firebaseConfig.authDomain);
}

export const db = app ? getFirestore(app) : null;
export const auth = app ? getAuth(app) : null;

// Desactivar persistencia local de Firestore para evitar datos obsoletos.
if (db) {
  clearIndexedDbPersistence(db)
    .then(() => {
      console.log('🧹 Firestore IndexedDB persistence desactivada');
    })
    .catch((error) => {
      console.warn('⚠️ No se pudo limpiar IndexedDB persistence:', error?.message || error);
    });
}
