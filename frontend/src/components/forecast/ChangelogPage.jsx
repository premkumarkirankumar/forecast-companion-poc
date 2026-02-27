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
          <div className="text-2xl font-semibold">Change Log</div>
          <div className="text-sm text-gray-500">
            Manual entries + Auto log entries recorded from changes in the app.
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

      {/* Manual Entry Form */}
      <div className="rounded-2xl border bg-white p-5 mb-6">
        <div className="text-sm font-semibold mb-3">Manual Entry</div>

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

      {/* Manual Entries */}
      <div className="rounded-2xl border bg-white overflow-hidden">
        <div className="px-5 py-3 border-b bg-gray-50 text-sm font-semibold">
          Manual Entries ({entries.length})
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

      {/* Auto Log Entries */}
      <div className="rounded-2xl border bg-white overflow-hidden mt-6">
        <div className="px-5 py-3 border-b bg-gray-50 text-sm font-semibold">
          Auto Log Entries ({autoEntries.length})
        </div>

        {autoEntries.length === 0 ? (
          <div className="p-6 text-gray-500">No auto log entries yet.</div>
        ) : (
          <div className="divide-y">
            {autoEntries.map((e) => (
              <div key={e.id} className="p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs px-2 py-1 rounded-full border bg-white">
                    {e.program || "unknown"}
                  </span>
                  <span className="text-xs px-2 py-1 rounded-full border bg-white">
                    {e.area || "General"}
                  </span>
                  <span className="text-xs text-gray-500">{fmtTs(e.ts)}</span>
                </div>
                <div className="mt-2 text-sm font-semibold">{e.action || "Change"}</div>
                {e.details ? <div className="mt-1 text-sm text-gray-700">{e.details}</div> : null}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}