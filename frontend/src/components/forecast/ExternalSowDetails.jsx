import { useMemo, useState } from "react";
import { MONTHS } from "../../data/hub";
import SmallField from "../shared/SmallField";
import { fmt } from "../../lib/forecast/format";
import { distributeEvenly, normalizeSplit } from "../../lib/forecast/contractors";
import { bodyCellClass, headCellClass, monthDividerClass } from "../../lib/forecast/format";

function num(v) {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

function hasValue(v) {
  return String(v ?? "").trim().length > 0;
}

/**
 * External SOW Details editor
 * - Add SOW: name, year target total, split
 * - Editable name
 * - Editable year target
 * - Editable MS/NF per month with lock + auto-rebalance remaining months
 * - Remove SOW
 */
export default function ExternalSowDetails({ sows, setSows, onLog }) {
  const [draft, setDraft] = useState({
    name: "",
    yearTargetTotal: "",
    msPct: "",
    nfPct: "",
  });

  function upd(k, v) {
    setDraft((d) => ({ ...d, [k]: v }));
  }

  const canAdd =
    hasValue(draft.name) &&
    hasValue(draft.yearTargetTotal) &&
    (hasValue(draft.msPct) || hasValue(draft.nfPct)) &&
    num(draft.yearTargetTotal) > 0 &&
    (num(draft.msPct) + num(draft.nfPct) > 0);

  function updateSow(id, patchFn) {
    setSows((arr) => arr.map((s) => (s.id === id ? patchFn(s) : s)));
  }

  function recomputeFromYearTarget(s) {
    const msYear = s.yearTargetTotal * (s.msPct / 100);
    const nfYear = s.yearTargetTotal * (s.nfPct / 100);

    return {
      ...s,
      msByMonth: distributeEvenly(msYear, s.msLocked || {}),
      nfByMonth: distributeEvenly(nfYear, s.nfLocked || {}),
    };
  }

  function addSow() {
    if (!canAdd) return;

    const split = normalizeSplit(draft.msPct, draft.nfPct);
    const yearTargetTotal = num(draft.yearTargetTotal);

    const msYear = yearTargetTotal * (split.msPct / 100);
    const nfYear = yearTargetTotal * (split.nfPct / 100);

    const newItem = {
      id: crypto.randomUUID(),
      name: String(draft.name).trim(),

      msPct: split.msPct,
      nfPct: split.nfPct,

      yearTargetTotal,

      msByMonth: distributeEvenly(msYear, {}),
      nfByMonth: distributeEvenly(nfYear, {}),

      msLocked: {},
      nfLocked: {},
    };

    setSows((arr) => [newItem, ...arr]);

    onLog?.({
      action: "ADD_SOW",
      entityType: "sow",
      entityId: newItem.id,
      entityName: newItem.name,
      meta: {
        msPct: newItem.msPct,
        nfPct: newItem.nfPct,
        yearTargetTotal: newItem.yearTargetTotal,
      },
    });

    setDraft({
      name: "",
      yearTargetTotal: "",
      msPct: "",
      nfPct: "",
    });
  }

  function removeSow(id) {
    const existing = sows.find((s) => s.id === id);
    onLog?.({
      action: "REMOVE_SOW",
      entityType: "sow",
      entityId: id,
      entityName: existing?.name,
    });
    setSows((arr) => arr.filter((s) => s.id !== id));
  }

  function updateName(id, name) {
    const existing = sows.find((s) => s.id === id);
    updateSow(id, (s) => ({ ...s, name }));
    onLog?.({
      action: "UPDATE_SOW_NAME",
      entityType: "sow",
      entityId: id,
      entityName: existing?.name,
      field: "name",
      from: existing?.name,
      to: name,
    });
  }

  function updateSplit(id, msPct, nfPct) {
    const existing = sows.find((s) => s.id === id);

    updateSow(id, (s) => {
      const split = normalizeSplit(msPct, nfPct);
      const next = { ...s, ...split };
      return recomputeFromYearTarget(next);
    });

    onLog?.({
      action: "UPDATE_SOW_SPLIT",
      entityType: "sow",
      entityId: id,
      entityName: existing?.name,
      field: "split",
      meta: { msPct, nfPct },
    });
  }

  function setYearTarget(id, value) {
    const v = Number(value);
    const val = Number.isFinite(v) ? v : 0;

    const existing = sows.find((s) => s.id === id);
    onLog?.({
      action: "UPDATE_SOW_YEAR_TARGET",
      entityType: "sow",
      entityId: id,
      entityName: existing?.name,
      field: "yearTargetTotal",
      from: existing?.yearTargetTotal,
      to: val,
    });

    updateSow(id, (s) => recomputeFromYearTarget({ ...s, yearTargetTotal: val }));
  }

  function setMonthValue(id, kind, month, value) {
    const v = Number(value);
    const val = Number.isFinite(v) ? v : 0;

    const existing = sows.find((s) => s.id === id);
    const from = kind === "ms" ? existing?.msLocked?.[month] : existing?.nfLocked?.[month];

    onLog?.({
      action: kind === "ms" ? "EDIT_SOW_MS_MONTH" : "EDIT_SOW_NF_MONTH",
      entityType: "sow",
      entityId: id,
      entityName: existing?.name,
      field: `${kind}.${month}`,
      from,
      to: val,
    });

    updateSow(id, (s) => {
      const lockedKey = kind === "ms" ? "msLocked" : "nfLocked";
      const next = {
        ...s,
        [lockedKey]: { ...(s[lockedKey] || {}), [month]: val },
      };
      return recomputeFromYearTarget(next);
    });
  }

  const tip = useMemo(
    () => "Add SOW → set yearly target → edit MS/NF by month (auto rebalances remaining months).",
    []
  );

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-sm font-semibold text-gray-900">External Details — SOW</div>
          <div className="mt-1 text-xs text-gray-600">{tip}</div>
        </div>

        <div className="hidden sm:flex items-center gap-2 rounded-xl bg-gray-50 px-3 py-2 text-xs text-gray-600 ring-1 ring-gray-100">
          Quarter separators at Apr / Jul / Oct
        </div>
      </div>

      {/* Add SOW form */}
      <div className="mt-5 grid gap-3 rounded-2xl bg-gray-50 p-4 ring-1 ring-gray-100 lg:grid-cols-12">
        <div className="lg:col-span-4">
          <label className="text-xs font-medium text-gray-600">SOW Name</label>
          <input
            className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gray-200"
            value={draft.name}
            onChange={(e) => upd("name", e.target.value)}
            placeholder="e.g., SOW – Vendor X"
          />
        </div>

        <div className="lg:col-span-3">
          <label className="text-xs font-medium text-gray-600">SOW Total (year)</label>
          <input
            type="number"
            className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gray-200 tabular-nums"
            value={draft.yearTargetTotal}
            onChange={(e) => upd("yearTargetTotal", e.target.value)}
            placeholder="$ total"
          />
        </div>

        <div className="lg:col-span-2">
          <label className="text-xs font-medium text-gray-600">MS %</label>
          <input
            type="number"
            className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gray-200 tabular-nums"
            value={draft.msPct}
            onChange={(e) => upd("msPct", e.target.value)}
            placeholder="MS %"
          />
        </div>

        <div className="lg:col-span-2">
          <label className="text-xs font-medium text-gray-600">NF %</label>
          <input
            type="number"
            className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gray-200 tabular-nums"
            value={draft.nfPct}
            onChange={(e) => upd("nfPct", e.target.value)}
            placeholder="NF %"
          />
        </div>

        <div className="lg:col-span-1 flex items-end">
          <button
            onClick={addSow}
            disabled={!canAdd}
            className={[
              "w-full rounded-xl px-3 py-2 text-sm font-semibold transition",
              canAdd
                ? "bg-gray-900 text-white hover:bg-gray-800"
                : "bg-gray-200 text-gray-500 cursor-not-allowed",
            ].join(" ")}
          >
            Add
          </button>
        </div>
      </div>

      {/* SOW cards */}
      <div className="mt-5 space-y-4">
        {sows.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-200 p-4 text-sm text-gray-600">
            No SOW items added yet.
          </div>
        ) : (
          sows.map((s) => {
            const msYear = MONTHS.reduce((a, m) => a + (s.msByMonth?.[m] ?? 0), 0);
            const nfYear = MONTHS.reduce((a, m) => a + (s.nfByMonth?.[m] ?? 0), 0);
            const totalYear = msYear + nfYear;

            return (
              <div key={s.id} className="rounded-2xl border border-gray-200 bg-white shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-gray-100 px-5 py-4">
                  <div className="w-full sm:w-auto">
                    <div className="text-xs font-medium text-gray-600">SOW Name (editable)</div>
                    <input
                      className="mt-1 w-full sm:w-[520px] rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-900 outline-none focus:ring-2 focus:ring-gray-200"
                      value={s.name}
                      onChange={(e) => updateName(s.id, e.target.value)}
                    />
                    <div className="mt-2 text-xs text-gray-600">
                      Year Total: <span className="font-semibold">{fmt(totalYear)}</span> • Split{" "}
                      <span className="font-semibold text-blue-700">MS {s.msPct}%</span> /{" "}
                      <span className="font-semibold text-purple-700">NF {s.nfPct}%</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => removeSow(s.id)}
                      className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-900 hover:bg-gray-50"
                    >
                      Remove
                    </button>
                  </div>
                </div>

                {/* Inputs row */}
                <div className="grid gap-3 px-5 py-4 md:grid-cols-6">
                  <SmallField label="MS %" value={s.msPct} onChange={(v) => updateSplit(s.id, v, s.nfPct)} />
                  <SmallField label="NF %" value={s.nfPct} onChange={(v) => updateSplit(s.id, s.msPct, v)} />

                  <div className="md:col-span-2">
                    <label className="text-xs font-medium text-gray-600">Year Target (editable)</label>
                    <input
                      type="number"
                      className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gray-200 tabular-nums"
                      value={Math.round(s.yearTargetTotal)}
                      onChange={(e) => setYearTarget(s.id, e.target.value)}
                    />
                  </div>

                  <div className="rounded-xl bg-gray-50 p-3 ring-1 ring-gray-100">
                    <div className="text-xs font-medium text-gray-600">Year (calc)</div>
                    <div className="mt-1 text-sm font-semibold text-gray-900 tabular-nums">
                      {fmt(totalYear)}
                    </div>
                  </div>

                  <div className="rounded-xl bg-gray-50 p-3 ring-1 ring-gray-100">
                    <div className="text-xs font-medium text-gray-600">Target</div>
                    <div className="mt-1 text-sm font-semibold text-gray-900 tabular-nums">
                      {fmt(s.yearTargetTotal)}
                    </div>
                  </div>
                </div>

                {/* Monthly grid */}
                <div className="overflow-x-auto border-t border-gray-100">
                  <table className="min-w-[1700px] w-full border-collapse">
                    <thead>
                      <tr className="text-xs text-gray-600">
                        <th className="sticky left-0 bg-white px-5 py-3 text-left font-medium">
                          Month
                        </th>
                        {MONTHS.map((m) => (
                          <th key={m} className={headCellClass(m)}>
                            {m}
                          </th>
                        ))}
                        <th className="px-5 py-3 text-right font-medium">Year</th>
                      </tr>
                    </thead>

                    <tbody>
                      {/* MS */}
                      <tr className="border-t border-gray-100 bg-blue-50/50">
                        <td className="sticky left-0 bg-white px-5 py-4 text-sm font-semibold text-gray-900">
                          MS (editable)
                        </td>
                        {MONTHS.map((m) => (
                          <td key={m} className={bodyCellClass(m)}>
                            <input
                              type="number"
                              inputMode="numeric"
                              className={[
                                "w-full min-w-[180px]",
                                "rounded-xl border border-gray-200 bg-white",
                                "px-3 py-2 text-right text-sm font-semibold tabular-nums",
                                "outline-none focus:ring-2 focus:ring-gray-200",
                              ].join(" ")}
                              value={Math.round(s.msByMonth?.[m] ?? 0)}
                              onChange={(e) => setMonthValue(s.id, "ms", m, e.target.value)}
                            />
                          </td>
                        ))}
                        <td className="px-5 py-4 text-right text-sm font-semibold tabular-nums text-gray-900">
                          {fmt(msYear)}
                        </td>
                      </tr>

                      {/* NF */}
                      <tr className="border-t border-gray-100 bg-purple-50/50">
                        <td className="sticky left-0 bg-white px-5 py-4 text-sm font-semibold text-gray-900">
                          NF (editable)
                        </td>
                        {MONTHS.map((m) => (
                          <td key={m} className={bodyCellClass(m)}>
                            <input
                              type="number"
                              inputMode="numeric"
                              className={[
                                "w-full min-w-[180px]",
                                "rounded-xl border border-gray-200 bg-white",
                                "px-3 py-2 text-right text-sm font-semibold tabular-nums",
                                "outline-none focus:ring-2 focus:ring-gray-200",
                              ].join(" ")}
                              value={Math.round(s.nfByMonth?.[m] ?? 0)}
                              onChange={(e) => setMonthValue(s.id, "nf", m, e.target.value)}
                            />
                          </td>
                        ))}
                        <td className="px-5 py-4 text-right text-sm font-semibold tabular-nums text-gray-900">
                          {fmt(nfYear)}
                        </td>
                      </tr>

                      {/* Total calc */}
                      <tr className="border-t border-gray-100 bg-gray-50/60">
                        <td className="sticky left-0 bg-white px-5 py-4 text-sm font-semibold text-gray-900">
                          Total (calc)
                        </td>
                        {MONTHS.map((m) => (
                          <td
                            key={m}
                            className={[
                              "px-3 py-4 text-right text-sm font-semibold tabular-nums text-gray-900 whitespace-nowrap",
                              monthDividerClass(m),
                            ].join(" ")}
                          >
                            {fmt((s.msByMonth?.[m] ?? 0) + (s.nfByMonth?.[m] ?? 0))}
                          </td>
                        ))}
                        <td className="px-5 py-4 text-right text-sm font-semibold tabular-nums text-gray-900">
                          {fmt(totalYear)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}