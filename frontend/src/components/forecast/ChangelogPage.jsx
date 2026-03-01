import { useEffect, useMemo, useState } from "react";
import { addChangeLogEntry, clearChangeLog, loadChangeLog } from "./changeLogStore";
import { clearAutoLog, loadAutoLog } from "./autoLogStore";

function fmtTs(iso) {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function fmtValue(value) {
  if (value === null || value === undefined || value === "") return "Not set";

  if (typeof value === "object") {
    if ("msPct" in value || "nfPct" in value) {
      const ms = Number(value?.msPct ?? 0);
      const nf = Number(value?.nfPct ?? 0);
      return `MS ${ms}% / NF ${nf}%`;
    }

    try {
      return Object.entries(value)
        .map(([k, v]) => `${k}: ${String(v)}`)
        .join(" • ");
    } catch {
      return "Updated";
    }
  }

  return String(value);
}

function prettyAction(action) {
  const raw = String(action || "CHANGE");
  return raw
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function prettyField(field) {
  if (!field) return "General";
  const raw = String(field);

  if (raw.includes(".")) {
    const [group, leaf] = raw.split(".");
    if (group === "ms") return `MS ${leaf}`;
    if (group === "nf") return `NF ${leaf}`;
  }

  return raw
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (s) => s.toUpperCase());
}

function AutoEntryCard({ entry }) {
  const meta = entry?.meta || {};
  const hasBeforeAfter = meta.from !== undefined || meta.to !== undefined;
  const entityName = meta.entityName || "Item";
  const fieldLabel = prettyField(meta.field);
  const fallbackDetails = entry?.details ? String(entry.details) : "Recorded system update.";

  return (
    <div className="rounded-3xl border border-gray-200 bg-white/90 p-5 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full border border-gray-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-gray-700">
          {entry.program || "unknown"}
        </span>
        <span className="rounded-full border border-gray-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-gray-700">
          {entry.area || "General"}
        </span>
        <span className="text-xs text-gray-500">{fmtTs(entry.ts)}</span>
      </div>

      <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold uppercase tracking-wide text-gray-500">
            {prettyAction(entry.action)}
          </div>
          <div className="mt-1 text-xl font-bold text-gray-950">{entityName}</div>
        </div>
      </div>

      {hasBeforeAfter ? (
        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <div className="rounded-2xl border border-gray-100 bg-gray-50 px-3 py-3">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
              Field
            </div>
            <div className="mt-1 text-sm font-semibold text-gray-900">{fieldLabel}</div>
          </div>

          <div className="rounded-2xl border border-gray-100 bg-gray-50 px-3 py-3 md:col-span-1">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
              Previous
            </div>
            <div className="mt-1 text-sm text-gray-900">{fmtValue(meta.from)}</div>
          </div>

          <div className="rounded-2xl border border-gray-100 bg-gray-50 px-3 py-3 md:col-span-2">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
              Updated
            </div>
            <div className="mt-1 text-sm text-gray-900">{fmtValue(meta.to)}</div>
          </div>
        </div>
      ) : (
        <div className="mt-3 text-sm text-gray-700">{fallbackDetails}</div>
      )}

      {fallbackDetails && hasBeforeAfter ? (
        <div className="mt-3 rounded-2xl border border-gray-100 bg-gray-50/70 px-3 py-2 text-sm text-gray-600">
          {fallbackDetails}
        </div>
      ) : null}
    </div>
  );
}

export default function ChangeLogPage({ onBack }) {
  // Manual entries (existing)
  const [entries, setEntries] = useState(() => loadChangeLog());

  // Auto entries (new)
  const [autoEntries, setAutoEntries] = useState(() => loadAutoLog());

  const [author, setAuthor] = useState("");
  const [area, setArea] = useState("General");
  const [message, setMessage] = useState("");

  const canAdd = useMemo(() => author.trim() && message.trim(), [author, message]);

  // Keep both sections live if other pages write logs while this is open
  useEffect(() => {
    function refresh() {
      setEntries(loadChangeLog());
      setAutoEntries(loadAutoLog());
    }
    window.addEventListener("pfc:autolog", refresh);
    window.addEventListener("pfc:storage", refresh); // you already dispatch this elsewhere
    window.addEventListener("storage", refresh); // cross-tab
    return () => {
      window.removeEventListener("pfc:autolog", refresh);
      window.removeEventListener("pfc:storage", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  function onAdd() {
    if (!canAdd) return;
    const updated = addChangeLogEntry({
      author,
      area,
      message,
      meta: {},
    });
    setEntries(updated);
    setMessage("");
  }

  function onClear() {
    const ok = confirm("Clear ALL logs (Manual + Auto)? This cannot be undone.");
    if (!ok) return;

    setEntries(clearChangeLog());
    setAutoEntries(clearAutoLog());
  }

  return (
    <div className="w-full max-w-6xl mx-auto px-6 py-6">
      <div className="flex items-center justify-between gap-4 mb-6">
        <div>
          <div className="text-3xl font-black tracking-tight text-gray-950">Change Log</div>
          <div className="text-sm text-gray-500">
            Executive notes and system-tracked updates recorded from changes in the app.
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button onClick={onClear} className="px-4 py-2 rounded-xl border bg-white hover:bg-gray-50">
            Clear Log
          </button>
          <button onClick={onBack} className="px-4 py-2 rounded-xl border bg-white hover:bg-gray-50">
            Back
          </button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 mb-6">
        <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
            Manual Change Log
          </div>
          <div className="mt-2 text-2xl font-black tracking-tight text-gray-950">{entries.length}</div>
          <div className="mt-1 text-sm text-gray-600">
            High-level executive notes, ownership, and intentional release updates.
          </div>
        </div>

        <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
            Auto Log Entries
          </div>
          <div className="mt-2 text-2xl font-black tracking-tight text-gray-950">{autoEntries.length}</div>
          <div className="mt-1 text-sm text-gray-600">
            Detailed field-level edits with program, section, timestamps, and before/after values.
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm mb-6">
        <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
          <div>
            <div className="text-sm font-semibold text-gray-900">Manual Change Log</div>
            <div className="mt-1 text-sm text-gray-500">
              Add high-level notes without changing the existing manual logging behavior.
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <div className="text-xs font-semibold text-gray-600 mb-1">Your name</div>
            <input
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              placeholder="Enter your name (required)"
              className="w-full px-3 py-2 rounded-xl border"
            />
          </div>

          <div>
            <div className="text-xs font-semibold text-gray-600 mb-1">Area</div>
            <select
              value={area}
              onChange={(e) => setArea(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border bg-white"
            >
              <option>General</option>
              <option>Internal</option>
              <option>External</option>
              <option>Tools & Services</option>
              <option>SOW</option>
              <option>Contractors</option>
            </select>
          </div>

          <div className="flex items-end">
            <button
              onClick={onAdd}
              disabled={!canAdd}
              className={`w-full px-4 py-2 rounded-xl border ${
                canAdd ? "bg-black text-white" : "bg-gray-100 text-gray-400"
              }`}
            >
              Add Entry
            </button>
          </div>
        </div>

        <div className="mt-4">
          <div className="text-xs font-semibold text-gray-600 mb-1">What changed</div>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Example: Updated Tools & Services expanded layout to match SOW structure"
            className="w-full px-3 py-2 rounded-xl border min-h-[90px]"
          />
        </div>
      </div>

      <div className="rounded-3xl border border-gray-200 bg-white overflow-hidden shadow-sm">
        <div className="px-5 py-4 border-b bg-gray-50/90">
          <div className="text-sm font-semibold text-gray-900">Manual Entries ({entries.length})</div>
          <div className="mt-1 text-xs text-gray-500">
            Named, authored updates intended for executive-facing context.
          </div>
        </div>

        {entries.length === 0 ? (
          <div className="p-6 text-gray-500">No manual entries yet.</div>
        ) : (
          <div className="divide-y">
            {entries.map((e) => (
              <div key={e.id} className="p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold">{e.author}</span>
                  <span className="text-xs px-2 py-1 rounded-full border bg-white">{e.area}</span>
                  <span className="text-xs text-gray-500">{fmtTs(e.ts)}</span>
                </div>
                <div className="mt-2 text-sm">{e.message}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-3xl border border-gray-200 bg-white overflow-hidden mt-6 shadow-sm">
        <div className="px-5 py-4 border-b bg-gray-50/90">
          <div className="text-sm font-semibold text-gray-900">Auto Log Entries ({autoEntries.length})</div>
          <div className="mt-1 text-xs text-gray-500">
            System-recorded updates from Internal, Tools & Services, Contractors, and SOW changes.
          </div>
        </div>

        {autoEntries.length === 0 ? (
          <div className="p-6 text-gray-500">No auto log entries yet.</div>
        ) : (
          <div className="space-y-4 p-4">
            {autoEntries.map((e) => (
              <AutoEntryCard key={e.id} entry={e} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
