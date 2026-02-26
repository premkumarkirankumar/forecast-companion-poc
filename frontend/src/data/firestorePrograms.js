// frontend/src/data/firestorePrograms.js
import { db } from "../firebase";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";

// TrendsPage reads these localStorage keys today.
// We mirror Firestore program state into these keys to keep Trends working unchanged.
function mirrorToLocalStorage(programId, state) {
  if (!programId || !state) return;

  const safeArray = (v) => (Array.isArray(v) ? v : []);

  const mappings = [
    [`pfc.${programId}.internal.labor.items`, safeArray(state.internalLaborItems)],
    [`pfc.${programId}.external.contractors`, safeArray(state.contractors)],
    [`pfc.${programId}.external.sow`, safeArray(state.sows)],
    [`pfc.${programId}.tns.items`, safeArray(state.tnsItems)],
  ];

  for (const [key, value] of mappings) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      window.dispatchEvent(new CustomEvent("pfc:storage", { detail: { key } }));
    } catch {
      // ignore localStorage failures (quota, privacy mode, etc.)
    }
  }
}

/**
 * Load state for a program from Firestore.
 * @param {string} programId - "connected" | "tre" | "csc"
 * @returns {Promise<object|null>} state object or null if not found
 */
export async function loadProgramState(programId) {
  const ref = doc(db, "programs", programId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;

  const data = snap.data();
  const state = data?.state ?? null;

  // ✅ Mirror so TrendsPage (localStorage-based) stays accurate
  if (state) mirrorToLocalStorage(programId, state);

  return state;
}

/**
 * Save state for a program into Firestore (shared doc).
 * @param {string} programId - "connected" | "tre" | "csc"
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

  // ✅ Mirror after save too (helps Trends update immediately)
  mirrorToLocalStorage(programId, state);
}