// frontend/src/data/firestorePrograms.js
import { db } from "../firebase";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { MONTHS } from "./hub";

const safeArray = (v) => (Array.isArray(v) ? v : []);
const safeBudgetMap = (v) => {
  const fallback = Object.fromEntries(MONTHS.map((m) => [m, 0]));
  if (!v || typeof v !== "object") return fallback;

  const out = { ...fallback };
  for (const m of MONTHS) out[m] = Number(v?.[m] ?? 0);
  return out;
};

function getLocalStateKey(programId) {
  return `pfc.${programId}.state.local`;
}

function normalizeLocalState(state) {
  const safeState = state && typeof state === "object" ? state : {};
  return {
    internalLaborItems: safeArray(safeState.internalLaborItems),
    contractors: safeArray(safeState.contractors),
    sows: safeArray(safeState.sows),
    externalChangeLog: safeArray(safeState.externalChangeLog),
    tnsItems: safeArray(safeState.tnsItems),
    tnsChangeLog: safeArray(safeState.tnsChangeLog),
    budgetByMonth: safeBudgetMap(safeState.budgetByMonth),
  };
}

// TrendsPage reads these localStorage keys today.
// We mirror Firestore program state into these keys to keep Trends working unchanged.
function mirrorToLocalStorage(programId, state) {
  if (!programId || !state) return;

  const mappings = [
    [`pfc.${programId}.internal.labor.items`, safeArray(state.internalLaborItems)],
    [`pfc.${programId}.external.contractors`, safeArray(state.contractors)],
    [`pfc.${programId}.external.sow`, safeArray(state.sows)],
    [`pfc.${programId}.tns.items`, safeArray(state.tnsItems)],
    [`pfc.${programId}.budget.byMonth`, safeBudgetMap(state.budgetByMonth)],
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

export function loadLocalProgramState(programId) {
  try {
    const raw = localStorage.getItem(getLocalStateKey(programId));
    if (!raw) return null;
    return normalizeLocalState(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function saveLocalProgramState(programId, state) {
  const existing = loadLocalProgramState(programId) || {};
  const mergedState = normalizeLocalState({ ...existing, ...(state || {}) });

  try {
    localStorage.setItem(getLocalStateKey(programId), JSON.stringify(mergedState));
    window.dispatchEvent(
      new CustomEvent("pfc:storage", { detail: { key: getLocalStateKey(programId) } })
    );
  } catch {
    // ignore localStorage failures (quota, privacy mode, etc.)
  }

  mirrorToLocalStorage(programId, mergedState);
  return mergedState;
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
  const existingSnap = await getDoc(ref);
  const existingState = existingSnap.exists() ? existingSnap.data()?.state ?? {} : {};
  const mergedState = { ...existingState, ...(state || {}) };

  await setDoc(
    ref,
    {
      updatedAt: serverTimestamp(),
      state: mergedState,
    },
    { merge: true }
  );

  // ✅ Mirror after save too (helps Trends update immediately)
  mirrorToLocalStorage(programId, mergedState);
}
