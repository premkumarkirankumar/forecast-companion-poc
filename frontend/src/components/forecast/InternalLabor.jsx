// frontend/src/components/forecast/InternalLabor.jsx
import { useMemo, useState } from "react";

function clampPct(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, n));
}

function hasValue(v) {
  return String(v ?? "").trim().length > 0;
}

function fmtPct(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return "0%";
  return `${Math.round(x)}%`;
}

function computeStats(items) {
  const list = items || [];
  const count = list.length;

  if (!count) {
    return { count: 0, avgRun: 0, avgGrowth: 0 };
  }

  const sumRun = list.reduce((a, x) => a + clampPct(x.runPct), 0);
  const sumGrowth = list.reduce((a, x) => a + clampPct(x.growthPct), 0);

  return {
    count,
    avgRun: sumRun / count,
    avgGrowth: sumGrowth / count,
  };
}

export default function InternalLabor({ mode, items, setItems, onLog }) {
  const stats = useMemo(() => computeStats(items), [items]);

  // Add form draft
  const [draft, setDraft] = useState({
    name: "",
    runPct: "",
    growthPct: "",
  });
  const [openId, setOpenId] = useState(null);

  function upd(k, v) {
    setDraft((d) => ({ ...d, [k]: v }));
  }

  const canAdd = hasValue(draft.name);

  function addItem() {
    if (!canAdd) return;

    const newItem = {
      id: crypto.randomUUID(),
      name: String(draft.name).trim(),
      runPct: clampPct(draft.runPct === "" ? 0 : draft.runPct),
      growthPct: clampPct(draft.growthPct === "" ? 0 : draft.growthPct),
    };

    setItems((prev) => [newItem, ...(prev || [])]);

    // ✅ log add (editable action)
    onLog?.({
      action: "ADD_INTERNAL",
      entityType: "internal",
      entityId: newItem.id,
      entityName: newItem.name,
    });

    setDraft({ name: "", runPct: "", growthPct: "" });
  }

  function removeItem(id) {
    const existing = (items || []).find((x) => x.id === id);

    // ✅ log remove (editable action)
    onLog?.({
      action: "REMOVE_INTERNAL",
      entityType: "internal",
      entityId: id,
      entityName: existing?.name,
    });

    setItems((prev) => (prev || []).filter((x) => x.id !== id));
  }

  function updateItem(id, patch) {
    setItems((prev) => {
      const list = prev || [];
      const existing = list.find((x) => x.id === id);
      if (!existing) return prev;

      // ✅ log per-field changes with before/after (editable action)
      for (const field of Object.keys(patch || {})) {
        const before = existing?.[field];
        const after = patch?.[field];

        // avoid noisy logs
        if (String(before ?? "") === String(after ?? "")) continue;

        onLog?.({
          action: "UPDATE_INTERNAL",
          entityType: "internal",
          entityId: id,
          entityName: existing?.name,
          field,
          from: before,
          to: after,
        });
      }

      return list.map((x) => (x.id === id ? { ...x, ...patch } : x));
    });
  }

  // TOTAL VIEW
  if (mode === "total") {
    return (
      <div className="space-y-4">
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-lg font-bold text-gray-900">Internal Labor (FTE)</div>
              <div className="mt-1 text-sm text-gray-600">
                This section tracks FTE counts and high-level utilization assumptions (not cost).
              </div>
            </div>

            <div className="text-sm font-semibold text-gray-600">
              No monthly breakdown
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
              <div className="text-xs font-semibold text-gray-700">Total Internal FTE</div>
              <div className="mt-1 text-2xl font-extrabold text-gray-900">
                {stats.count}
              </div>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
              <div className="text-xs font-semibold text-gray-700">Average Run %</div>
              <div className="mt-1 text-2xl font-extrabold text-gray-900">
                {fmtPct(stats.avgRun)}
              </div>
              <div className="mt-1 text-xs text-gray-500">Across all internal labor entries</div>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
              <div className="text-xs font-semibold text-gray-700">Average Growth %</div>
              <div className="mt-1 text-2xl font-extrabold text-gray-900">
                {fmtPct(stats.avgGrowth)}
              </div>
              <div className="mt-1 text-xs text-gray-500">Across all internal labor entries</div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5 text-sm text-gray-600">
          Tip: Add FTE entries in <span className="font-semibold">Internal Details</span> to see totals update here.
        </div>
      </div>
    );
  }

  // DETAILS VIEW
  return (
    <div className="space-y-4">
      {/* Add form */}
      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="text-sm font-semibold text-gray-900">Internal Details — Add FTE</div>
        <div className="mt-1 text-xs text-gray-600">
          Add Internal FTE entries with run and growth assumptions.
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-5">
          <div className="md:col-span-2">
            <div className="text-xs font-semibold text-gray-700">FTE Name</div>
            <input
              value={draft.name}
              onChange={(e) => upd("name", e.target.value)}
              placeholder="e.g., Platform Engineer (Internal)"
              className="mt-1 w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-900"
            />
          </div>

          <div>
            <div className="text-xs font-semibold text-gray-700">Run %</div>
            <input
              value={draft.runPct}
              onChange={(e) => upd("runPct", e.target.value)}
              placeholder="0–100"
              className="mt-1 w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-900"
            />
          </div>

          <div>
            <div className="text-xs font-semibold text-gray-700">Growth %</div>
            <input
              value={draft.growthPct}
              onChange={(e) => upd("growthPct", e.target.value)}
              placeholder="0–100"
              className="mt-1 w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-900"
            />
          </div>

          <div className="flex items-end">
            <button
              onClick={addItem}
              disabled={!canAdd}
              className={[
                "w-full rounded-2xl px-4 py-3 text-sm font-semibold transition",
                canAdd
                  ? "bg-gray-900 text-white hover:bg-gray-800"
                  : "bg-gray-100 text-gray-400 cursor-not-allowed",
              ].join(" ")}
            >
              Add
            </button>
          </div>
        </div>
      </div>

      {/* List */}
      {(items || []).length === 0 ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-5 text-sm text-gray-600">
          No internal labor items added yet.
        </div>
      ) : (
        <div className="space-y-3">
          {(items || []).map((x) => (
            <div key={x.id} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setOpenId((prev) => (prev === x.id ? null : x.id))}
                  className="flex min-w-0 flex-1 items-start justify-between gap-3 text-left"
                >
                  <div>
                    <div className="text-xs font-semibold text-gray-600">FTE Name</div>
                    <div className="mt-1 text-lg font-bold text-gray-900">
                      {x.name || "Untitled"}
                    </div>
                    <div className="mt-1 text-sm text-gray-600">
                      Run <span className="font-semibold">{fmtPct(x.runPct)}</span> • Growth{" "}
                      <span className="font-semibold">{fmtPct(x.growthPct)}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-xs font-semibold text-gray-600">
                    <span>{openId === x.id ? "Hide details" : "Edit details"}</span>
                    <span
                      className={[
                        "text-sm transition-transform",
                        openId === x.id ? "rotate-180" : "",
                      ].join(" ")}
                    >
                      ▾
                    </span>
                  </div>
                </button>

                <button
                  onClick={() => removeItem(x.id)}
                  className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-900 hover:bg-gray-50"
                >
                  Remove
                </button>
              </div>

              {openId === x.id ? (
                <div className="mt-4 grid grid-cols-1 gap-3 border-t border-gray-100 pt-4 md:grid-cols-3">
                  <div className="md:col-span-1">
                    <div className="text-xs font-semibold text-gray-700">FTE Name</div>
                    <input
                      value={x.name}
                      onChange={(e) => updateItem(x.id, { name: e.target.value })}
                      className="mt-1 w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-900"
                    />
                  </div>

                  <div>
                    <div className="text-xs font-semibold text-gray-700">Run %</div>
                    <input
                      value={x.runPct}
                      onChange={(e) => updateItem(x.id, { runPct: clampPct(e.target.value) })}
                      className="mt-1 w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-900"
                    />
                  </div>

                  <div>
                    <div className="text-xs font-semibold text-gray-700">Growth %</div>
                    <input
                      value={x.growthPct}
                      onChange={(e) => updateItem(x.id, { growthPct: clampPct(e.target.value) })}
                      className="mt-1 w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-900"
                    />
                  </div>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}

      {/* Quick totals (nice touch in Details) */}
      <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div>
            <div className="text-xs font-semibold text-gray-700">Total Internal FTE</div>
            <div className="mt-1 text-lg font-extrabold text-gray-900">{stats.count}</div>
          </div>
          <div>
            <div className="text-xs font-semibold text-gray-700">Average Run %</div>
            <div className="mt-1 text-lg font-extrabold text-gray-900">{fmtPct(stats.avgRun)}</div>
          </div>
          <div>
            <div className="text-xs font-semibold text-gray-700">Average Growth %</div>
            <div className="mt-1 text-lg font-extrabold text-gray-900">{fmtPct(stats.avgGrowth)}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
