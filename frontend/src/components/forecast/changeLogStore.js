const STORAGE_KEY = "pfc.changelog.v1";

export function loadChangeLog() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveChangeLog(entries) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries || []));
}

export function addChangeLogEntry({ author, area, message, meta }) {
  const entries = loadChangeLog();
  const entry = {
    id: crypto?.randomUUID ? crypto.randomUUID() : String(Date.now()),
    ts: new Date().toISOString(),
    author: (author || "").trim(),
    area: area || "General",
    message: (message || "").trim(),
    meta: meta || {},
  };
  const updated = [entry, ...entries];
  saveChangeLog(updated);
  return updated;
}

export function clearChangeLog() {
  saveChangeLog([]);
  return [];
}