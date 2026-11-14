import { initializeApp } from "firebase/app";
import {
  collection,
  deleteDoc,
  doc,
  getFirestore,
  onSnapshot,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const firebaseConfigured = Object.values(config).every(Boolean);
const db = firebaseConfigured ? getFirestore(initializeApp(config)) : null;

const marksCollection = (eventId) => collection(db, "events", eventId, "marks");

export function subscribeToMarks(eventId, onMarks, onError) {
  if (!db) return () => {};
  return onSnapshot(
    marksCollection(eventId),
    (snapshot) => onMarks(new Set(snapshot.docs.map((mark) => mark.id))),
    onError,
  );
}

export function setTileMarked(eventId, tileId, marked) {
  if (!db) throw new Error("Firebase is not configured");
  const mark = doc(db, "events", eventId, "marks", tileId);
  return marked
    ? setDoc(mark, { marked: true, updatedAt: serverTimestamp() })
    : deleteDoc(mark);
}
