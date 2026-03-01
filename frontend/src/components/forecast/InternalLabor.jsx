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
    role: "",
    runPct: "",
    growthPct: "",
  });
  const [openId, setOpenId] = useState(null);
  const [showSavedItems, setShowSavedItems] = useState(false);

  function upd(k, v) {
    setDraft((d) => ({ ...d, [k]: v }));
  }

  const canAdd = hasValue(draft.name);

  function addItem() {
    if (!canAdd) return;

    const newItem = {
      id: crypto.randomUUID(),
      name: String(draft.name).trim(),
      role: String(draft.role ?? "").trim(),
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

    setDraft({ name: "", role: "", runPct: "", growthPct: "" });
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
          <div className="flex items-start gap-4">
            <div>
              <div className="text-lg font-bold text-gray-900">Internal Labor (FTE)</div>
              <div className="mt-1 text-sm text-gray-600">
                This section tracks FTE counts and high-level utilization assumptions (not cost).
              </div>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div className="text-xs font-semibold text-gray-700">Total Internal FTE</div>
                <div className="rounded-full bg-gray-900 px-2.5 py-1 text-[11px] font-semibold text-white">
                  TEAM
                </div>
              </div>
              <div className="h-1 w-16 rounded-full bg-gray-900" />
              <div className="mt-1 text-2xl font-extrabold text-gray-900">
                {stats.count}
              </div>
              <div className="mt-2 text-xs text-gray-500">Active staffing assumptions tracked</div>
            </div>

            <div className="rounded-2xl border border-blue-100 bg-blue-50/60 p-4">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div className="text-xs font-semibold text-gray-700">Average Run %</div>
                <div className="rounded-full bg-blue-100 px-2.5 py-1 text-[11px] font-semibold text-blue-700">
                  OPERATE
                </div>
              </div>
              <div className="h-1.5 w-full rounded-full bg-blue-100">
                <div
                  className="h-1.5 rounded-full bg-blue-500"
                  style={{ width: `${clampPct(stats.avgRun)}%` }}
                />
              </div>
              <div className="mt-1 text-2xl font-extrabold text-gray-900">
                {fmtPct(stats.avgRun)}
              </div>
              <div className="mt-1 text-xs text-gray-500">Across all internal labor entries</div>
            </div>

            <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div className="text-xs font-semibold text-gray-700">Average Growth %</div>
                <div className="rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                  GROWTH
                </div>
              </div>
              <div className="h-1.5 w-full rounded-full bg-emerald-100">
                <div
                  className="h-1.5 rounded-full bg-emerald-500"
                  style={{ width: `${clampPct(stats.avgGrowth)}%` }}
                />
              </div>
              <div className="mt-1 text-2xl font-extrabold text-gray-900">
                {fmtPct(stats.avgGrowth)}
              </div>
              <div className="mt-1 text-xs text-gray-500">Across all internal labor entries</div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5 text-sm text-gray-600">
          Summary updates automatically as internal staffing assumptions change.
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

        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-6">
          <div className="md:col-span-2">
            <div className="text-xs font-semibold text-gray-700">FTE Name</div>
            <input
              value={draft.name}
              onChange={(e) => upd("name", e.target.value)}
              placeholder="e.g., Platform Engineer (Internal)"
              className="mt-1 w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-900"
            />
          </div>

          <div className="md:col-span-2">
            <div className="text-xs font-semibold text-gray-700">Role</div>
            <input
              value={draft.role}
              onChange={(e) => upd("role", e.target.value)}
              placeholder="e.g., Platform Engineer"
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

          <div className="flex items-end md:col-span-6 md:justify-end">
            <button
              onClick={addItem}
              disabled={!canAdd}
              className={[
                "w-full rounded-2xl px-4 py-3 text-sm font-semibold transition md:w-auto md:min-w-[180px]",
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
        <div className="rounded-2xl border border-gray-200 bg-white p-3 shadow-sm">
          <button
            type="button"
            onClick={() => setShowSavedItems((prev) => !prev)}
            aria-expanded={showSavedItems}
            className="flex w-full items-center justify-between gap-3 rounded-2xl px-3 py-3 text-left transition hover:bg-gray-50"
          >
            <div className="min-w-0">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                Saved FTE Entries
              </div>
              <div className="mt-1 text-base font-bold text-gray-900">
                {(items || []).length} {(items || []).length === 1 ? "entry" : "entries"}
              </div>
              <div className="mt-1 text-sm text-gray-600">
                Click to {showSavedItems ? "hide" : "view"} saved internal labor details
              </div>
            </div>

            <div className="flex items-center gap-2 rounded-full bg-gray-50 px-3 py-1.5 text-xs font-semibold text-gray-600 ring-1 ring-gray-200">
              <span>{showSavedItems ? "Hide list" : "Show list"}</span>
              <span
                className={[
                  "text-sm transition-transform duration-200",
                  showSavedItems ? "rotate-180" : "",
                ].join(" ")}
              >
                ▾
              </span>
            </div>
          </button>

          <div
            className={[
              "overflow-hidden transition-all duration-200 ease-out",
              showSavedItems ? "mt-3 max-h-[200rem] opacity-100" : "max-h-0 opacity-0",
            ].join(" ")}
          >
            <div className="space-y-3 border-t border-gray-100 pt-3">
              {(items || []).map((x) => (
                <div
                  key={x.id}
                  className={[
                    "rounded-2xl border bg-white px-4 py-4 shadow-sm transition",
                    openId === x.id
                      ? "border-gray-300 shadow-md"
                      : "border-gray-200 hover:border-gray-300",
                  ].join(" ")}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => setOpenId((prev) => (prev === x.id ? null : x.id))}
                      aria-expanded={openId === x.id}
                      className="flex min-w-0 flex-1 items-center justify-between gap-3 rounded-xl px-2 py-2 text-left transition hover:bg-gray-50"
                    >
                      <div className="min-w-0">
                        <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                          FTE Name
                        </div>
                        <div className="mt-1 truncate text-lg font-bold text-gray-900">
                          {x.name || "Untitled"}
                        </div>
                        <div className="mt-1 text-sm font-medium text-gray-600">
                          Run <span className="font-semibold">{fmtPct(x.runPct)}</span> • Growth{" "}
                          <span className="font-semibold">{fmtPct(x.growthPct)}</span> • Role:{" "}
                          <span className="font-semibold">{x.role || "Not set"}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 rounded-full bg-gray-50 px-3 py-1.5 text-xs font-semibold text-gray-600 ring-1 ring-gray-200">
                        <span>{openId === x.id ? "Hide details" : "Edit details"}</span>
                        <span
                          className={[
                            "text-sm transition-transform duration-200",
                            openId === x.id ? "rotate-180" : "",
                          ].join(" ")}
                        >
                          ▾
                        </span>
                      </div>
                    </button>

                    <button
                      onClick={() => removeItem(x.id)}
                      className="rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                    >
                      Remove
                    </button>
                  </div>

                  <div
                    className={[
                      "overflow-hidden transition-all duration-200 ease-out",
                      openId === x.id ? "mt-3 max-h-96 opacity-100" : "max-h-0 opacity-0",
                    ].join(" ")}
                  >
                    <div className="grid grid-cols-1 gap-3 rounded-2xl border border-gray-100 bg-gray-50 p-4 md:grid-cols-4">
                      <div>
                        <div className="text-xs font-semibold text-gray-700">FTE Name</div>
                        <input
                          value={x.name}
                          onChange={(e) => updateItem(x.id, { name: e.target.value })}
                          className="mt-1 w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-900"
                        />
                      </div>

                      <div>
                        <div className="text-xs font-semibold text-gray-700">Role</div>
                        <input
                          value={x.role || ""}
                          onChange={(e) => updateItem(x.id, { role: e.target.value })}
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
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
