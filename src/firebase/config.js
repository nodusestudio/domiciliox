import { signInAnonymously } from 'firebase/auth';
import { auth, db, hasFirebaseEnv } from '../config/firebase';

if (auth && hasFirebaseEnv) {
  signInAnonymously(auth)
    .then(() => {
      console.log('✓ Usuario autenticado anónimamente');
    })
    .catch((error) => {
      console.error('Error en autenticación anónima:', error);
    });
} else {
  console.warn('⚠️ Firebase no configurado. Config local activa para desarrollo.');
}

export { db, auth, hasFirebaseEnv };
