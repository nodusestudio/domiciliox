import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth, signInAnonymously } from "firebase/auth";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// Verificación de seguridad para evitar que el panel se rompa en Vercel
if (!firebaseConfig.apiKey) {
  console.error("Error: Las variables de entorno no están cargadas en Vercel.");
}

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Inicializar autenticación
export const auth = getAuth(app);

// Autenticación anónima automática
signInAnonymously(auth)
  .then(() => {
    console.log("✓ Usuario autenticado anónimamente");
  })
  .catch((error) => {
    console.error("Error en autenticación anónima:", error);
  });

// Verificar que estamos conectados al proyecto correcto
console.log("Conectado a:", firebaseConfig.projectId);
console.log("Variables de entorno cargadas:", {
  apiKey: firebaseConfig.apiKey ? "✓ Cargada" : "✗ NO cargada",
  authDomain: firebaseConfig.authDomain ? "✓ Cargada" : "✗ NO cargada",
  projectId: firebaseConfig.projectId ? "✓ Cargada" : "✗ NO cargada"
});

export const db = getFirestore(app);
