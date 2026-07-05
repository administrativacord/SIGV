import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyDdzik_U-S1z0YyVSvvNi4AzIkBjrydK5I',
  authDomain: 'sigv-44772.firebaseapp.com',
  projectId: 'sigv-44772',
  storageBucket: 'sigv-44772.firebasestorage.app',
  messagingSenderId: '895465130053',
  appId: '1:895465130053:web:870c7a4c330b852d9dbb2c',
  measurementId: 'G-2TN9NHCG95',
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
