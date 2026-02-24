export default function ChangeLogPanel({ programKey, changeLog, actor }) {
  const items = Array.isArray(changeLog) ? changeLog : [];

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-lg font-bold text-gray-900">Change Log</div>
          <div className="mt-1 text-sm text-gray-600">
            Program: <span className="font-semibold">{programKey}</span>
          </div>
        </div>

        <div className="text-xs font-semibold text-gray-500">
          Showing latest {Math.min(items.length, 300)}
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {items.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-gray-600">
            No changes logged yet.
          </div>
        ) : null}

        {items.map((e) => {
          const who = e?.actor || actor || "Unknown";
          const ts = e?.ts ? new Date(e.ts).toLocaleString() : "";

          return (
            <div key={e.id} className="rounded-xl border border-gray-200 bg-white p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm font-bold text-gray-900">
                  {e?.area ? `${e.area} — ` : ""}
                  {e?.action || "CHANGE"}
                </div>
                <div className="text-xs font-semibold text-gray-500">{ts}</div>
              </div>

              <div className="mt-1 text-sm text-gray-700">{e?.detail || ""}</div>

              <div className="mt-2 text-xs text-gray-500">
                By <span className="font-semibold text-gray-700">{who}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}