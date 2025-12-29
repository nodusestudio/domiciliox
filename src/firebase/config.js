import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

/**
 * Configuración de Firebase para DomicilioX
 * Credenciales del proyecto en Firebase Console
 */
const firebaseConfig = {
  apiKey: 'AIzaSyAy4FqXc9sKgjo2f9VEAGuQ6WqJHxVaS3g',
  authDomain: 'domiciliox-85488.firebaseapp.com',
  projectId: 'domiciliox-85488',
  storageBucket: 'domiciliox-85488.firebasestorage.app',
  messagingSenderId: '1066780088586',
  appId: '1:1066780088586:web:168ec042714a03529e42f3'
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);

// Inicializar Firestore
const db = getFirestore(app);

export { db };
