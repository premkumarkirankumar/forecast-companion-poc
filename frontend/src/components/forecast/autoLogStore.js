// frontend/src/components/forecast/autoLogStore.js

const KEY = "pfc.autolog.v1";

export function loadAutoLog() {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function addAutoLogEntry(entry) {
  const current = loadAutoLog();
  const next = [
    {
      id: crypto.randomUUID(),
      ts: new Date().toISOString(),
      ...entry, // { program, area, action, details }
    },
    ...current,
  ].slice(0, 1500);

  try {
    localStorage.setItem(KEY, JSON.stringify(next));
    // notify pages listening
    window.dispatchEvent(new CustomEvent("pfc:autolog"));
  } catch {
    // ignore
  }

  return next;
}

export function clearAutoLog() {
  try {
    localStorage.setItem(KEY, JSON.stringify([]));
    window.dispatchEvent(new CustomEvent("pfc:autolog"));
  } catch {
    // ignore
  }
  return [];
}