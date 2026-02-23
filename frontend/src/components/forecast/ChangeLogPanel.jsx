export default function ChangeLogPanel({
  programKey,
  actor,
  setActor,
  changeLog,
  setChangeLog,
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm font-semibold text-gray-900">Change Log</div>

        <div className="flex items-center gap-2">
          <input
            className="w-44 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gray-200"
            value={actor}
            onChange={(e) => setActor(e.target.value)}
            placeholder="Your name"
          />
          <button
            onClick={() => {
              if (confirm(`Clear change log for ${programKey}?`)) setChangeLog([]);
            }}
            className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold hover:bg-gray-50"
          >
            Clear Log
          </button>
        </div>
      </div>

      <div className="mt-3 max-h-64 overflow-auto rounded-xl border border-gray-100">
        {changeLog.length === 0 ? (
          <div className="p-3 text-sm text-gray-600">No changes recorded yet.</div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {changeLog.slice(0, 60).map((c) => (
              <li key={c.id} className="p-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <div className="font-medium text-gray-900">
                    {c.actor} • {c.action}
                  </div>
                  <div className="text-xs text-gray-500">
                    {new Date(c.ts).toLocaleString()}
                  </div>
                </div>
                <div className="mt-1 text-xs text-gray-600">
                  {c.entityType}:{c.entityName || c.entityId}
                  {c.field ? ` • ${c.field}` : ""}
                  {c.from !== undefined || c.to !== undefined
                    ? ` • ${String(c.from)} → ${String(c.to)}`
                    : ""}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}