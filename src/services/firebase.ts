import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getAuth, 
  signInAnonymously, 
  onAuthStateChanged, 
  User,
  GoogleAuthProvider,
  signInWithPopup,
  signOut 
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  getDocs, 
  onSnapshot, 
  query, 
  where,
  addDoc,
  deleteDoc,
  orderBy,
  serverTimestamp
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

// Inicialização do Firebase App
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Autenticação e Firestore com suporte a banco de dados nomeado do applet
const auth = getAuth(app);
const db = firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== '(default)'
  ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
  : getFirestore(app);

const googleProvider = new GoogleAuthProvider();

// Garantia de Login Anônimo Automático ou Persistido
export async function ensureAuthUser(): Promise<User> {
  return new Promise((resolve, reject) => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        unsubscribe();
        resolve(user);
      } else {
        try {
          const cred = await signInAnonymously(auth);
          unsubscribe();
          resolve(cred.user);
        } catch (err) {
          unsubscribe();
          reject(err);
        }
      }
    });
  });
}

// Serviços do Firestore para Panoramas 360°
export async function saveBackgroundToFirestore(bg: {
  id: string;
  title: string;
  category: string;
  dataUrl: string;
  isUserUploaded?: boolean;
  lightingType?: string;
  tags?: string[];
  description?: string;
}) {
  const user = await ensureAuthUser();
  const bgRef = doc(db, 'backgrounds360', bg.id);
  await setDoc(bgRef, {
    ...bg,
    userId: user.uid,
    createdAt: new Date().toISOString()
  }, { merge: true });
}

export async function fetchUserBackgrounds(): Promise<any[]> {
  try {
    const querySnapshot = await getDocs(collection(db, 'backgrounds360'));
    const results: any[] = [];
    querySnapshot.forEach((docSnap) => {
      results.push({ id: docSnap.id, ...docSnap.data() });
    });
    return results;
  } catch (err) {
    console.warn('Erro ao carregar cenários do Firestore:', err);
    return [];
  }
}

// Serviços do Firestore para Capturas
export async function saveCaptureSnapshot(dataUrl: string, backgroundId: string) {
  const user = await ensureAuthUser();
  const capturesRef = collection(db, 'captures');
  return await addDoc(capturesRef, {
    userId: user.uid,
    dataUrl,
    backgroundId,
    createdAt: new Date().toISOString()
  });
}

// Presets do Usuário
export async function saveUserPreset(presetData: Record<string, any>) {
  const user = await ensureAuthUser();
  const presetRef = doc(db, 'userPresets', user.uid);
  await setDoc(presetRef, {
    userId: user.uid,
    ...presetData,
    updatedAt: new Date().toISOString()
  }, { merge: true });
}

export { app, auth, db, googleProvider, signInWithPopup, signOut };
