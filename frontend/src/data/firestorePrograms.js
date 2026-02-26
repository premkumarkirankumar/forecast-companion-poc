// frontend/src/data/firestorePrograms.js
import { db } from "../firebase";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";

/**
 * Load state for a program from Firestore.
 * @param {string} programId - "connected" | "teri" | "csc"
 * @returns {Promise<object|null>} state object or null if not found
 */
export async function loadProgramState(programId) {
  const ref = doc(db, "programs", programId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  const data = snap.data();
  return data?.state ?? null;
}

/**
 * Save state for a program into Firestore (shared doc).
 * @param {string} programId - "connected" | "teri" | "csc"
 * @param {object} state - entire app state
 */
export async function saveProgramState(programId, state) {
  const ref = doc(db, "programs", programId);
  await setDoc(
    ref,
    {
      updatedAt: serverTimestamp(),
      state,
    },
    { merge: true }
  );
}