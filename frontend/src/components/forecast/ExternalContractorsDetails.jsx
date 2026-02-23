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
 * External Contractors Details editor
 * - Add contractor (rate/hr, hours/wk, weeks/yr, split)
 * - Editable contractor name
 * - Editable year target
 * - Editable MS/NF per month with lock + auto-rebalance remaining months
 * - Regenerate: resets year target based on rate*hours*weeks and clears locks
 * - Remove contractor
 */
export default function ExternalContractorsDetails({
  contractors,
  setContractors,
  onLog,
}) {
  const [draft, setDraft] = useState({
    name: "",
    ratePerHour: "",
    hoursPerWeek: "",
    weeksPerYear: "",
    msPct: "",
    nfPct: "",
  });

  function upd(k, v) {
    setDraft((d) => ({ ...d, [k]: v }));
  }

  const canAdd =
    hasValue(draft.name) &&
    hasValue(draft.ratePerHour) &&
    hasValue(draft.hoursPerWeek) &&
    hasValue(draft.weeksPerYear) &&
    (hasValue(draft.msPct) || hasValue(draft.nfPct)) &&
    (num(draft.msPct) + num(draft.nfPct) > 0);

  function updateContractor(id, patchFn) {
    setContractors((arr) => arr.map((c) => (c.id === id ? patchFn(c) : c)));
  }

  function recomputeFromYearTarget(c) {
    const msYear = c.yearTargetTotal * (c.msPct / 100);
    const nfYear = c.yearTargetTotal * (c.nfPct / 100);

    return {
      ...c,
      msByMonth: distributeEvenly(msYear, c.msLocked || {}),
      nfByMonth: distributeEvenly(nfYear, c.nfLocked || {}),
    };
  }

  function addContractor() {
    if (!canAdd) return;

    const baseYear =
      num(draft.ratePerHour) * num(draft.hoursPerWeek) * num(draft.weeksPerYear);

    const split = normalizeSplit(draft.msPct, draft.nfPct);

    const yearTargetTotal = baseYear; // editable later
    const msYear = yearTargetTotal * (split.msPct / 100);
    const nfYear = yearTargetTotal * (split.nfPct / 100);

    const newItem = {
      id: crypto.randomUUID(),
      name: String(draft.name).trim(),

      ratePerHour: num(draft.ratePerHour),
      hoursPerWeek: num(draft.hoursPerWeek),
      weeksPerYear: num(draft.weeksPerYear),

      msPct: split.msPct,
      nfPct: split.nfPct,

      yearTargetTotal,

      msByMonth: distributeEvenly(msYear, {}),
      nfByMonth: distributeEvenly(nfYear, {}),

      msLocked: {},
      nfLocked: {},
    };

    setContractors((arr) => [newItem, ...arr]);

    onLog?.({
      action: "ADD_CONTRACTOR",
      entityType: "contractor",
      entityId: newItem.id,
      entityName: newItem.name,
      meta: {
        ratePerHour: newItem.ratePerHour,
        hoursPerWeek: newItem.hoursPerWeek,
        weeksPerYear: newItem.weeksPerYear,
        msPct: newItem.msPct,
        nfPct: newItem.nfPct,
        yearTargetTotal: newItem.yearTargetTotal,
      },
    });

    setDraft({
      name: "",
      ratePerHour: "",
      hoursPerWeek: "",
      weeksPerYear: "",
      msPct: "",
      nfPct: "",
    });
  }

  function removeContractor(id) {
    const existing = contractors.find((c) => c.id === id);
    onLog?.({
      action: "REMOVE_CONTRACTOR",
      entityType: "contractor",
      entityId: id,
      entityName: existing?.name,
    });
    setContractors((arr) => arr.filter((c) => c.id !== id));
  }

  function updateName(id, name) {
    const existing = contractors.find((c) => c.id === id);
    updateContractor(id, (c) => ({ ...c, name }));
    onLog?.({
      action: "UPDATE_CONTRACTOR_NAME",
      entityType: "contractor",
      entityId: id,
      entityName: existing?.name,
      field: "name",
      from: existing?.name,
      to: name,
    });
  }

  function updateSplit(id, msPct, nfPct) {
    const existing = contractors.find((c) => c.id === id);

    updateContractor(id, (c) => {
      const split = normalizeSplit(msPct, nfPct);
      const next = { ...c, ...split };
      return recomputeFromYearTarget(next);
    });

    onLog?.({
      action: "UPDATE_SPLIT",
      entityType: "contractor",
      entityId: id,
      entityName: existing?.name,
      field: "split",
      meta: { msPct, nfPct },
    });
  }

  function setYearTarget(id, value) {
    const v = Number(value);
    const val = Number.isFinite(v) ? v : 0;

    const existing = contractors.find((c) => c.id === id);
    onLog?.({
      action: "UPDATE_YEAR_TARGET",
      entityType: "contractor",
      entityId: id,
      entityName: existing?.name,
      field: "yearTargetTotal",
      from: existing?.yearTargetTotal,
      to: val,
    });

    updateContractor(id, (c) =>
      recomputeFromYearTarget({ ...c, yearTargetTotal: val })
    );
  }

  /**
   * Month edit: locks that month value and rebalances remaining months.
   * NOTE: Current behavior locks permanently. (We can add "clear to unlock" later.)
   */
  function setMonthValue(id, kind, month, value) {
    const v = Number(value);
    const val = Number.isFinite(v) ? v : 0;

    const existing = contractors.find((c) => c.id === id);
    const from =
      kind === "ms" ? existing?.msLocked?.[month] : existing?.nfLocked?.[month];

    onLog?.({
      action: kind === "ms" ? "EDIT_MS_MONTH" : "EDIT_NF_MONTH",
      entityType: "contractor",
      entityId: id,
      entityName: existing?.name,
      field: `${kind}.${month}`,
      from,
      to: val,
    });

    updateContractor(id, (c) => {
      const lockedKey = kind === "ms" ? "msLocked" : "nfLocked";
      const next = {
        ...c,
        [lockedKey]: { ...(c[lockedKey] || {}), [month]: val },
      };
      return recomputeFromYearTarget(next);
    });
  }

  function regenerateFromRateHoursWeeks(id) {
    const existing = contractors.find((c) => c.id === id);
    onLog?.({
      action: "REGENERATE",
      entityType: "contractor",
      entityId: id,
      entityName: existing?.name,
    });

    updateContractor(id, (c) => {
      const baseYear = (c.ratePerHour || 0) * (c.hoursPerWeek || 0) * (c.weeksPerYear || 0);
      const reset = { ...c, yearTargetTotal: baseYear, msLocked: {}, nfLocked: {} };
      return recomputeFromYearTarget(reset);
    });
  }

  const tip = useMemo(
    () => "Add contractors → set yearly target → edit MS/NF by month (auto rebalances remaining months).",
    []
  );

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-sm font-semibold text-gray-900">
            External Details — Contractors
          </div>
          <div className="mt-1 text-xs text-gray-600">{tip}</div>
        </div>

        <div className="hidden sm:flex items-center gap-2 rounded-xl bg-gray-50 px-3 py-2 text-xs text-gray-600 ring-1 ring-gray-100">
          Quarter separators at Apr / Jul / Oct
        </div>
      </div>

      {/* Add contractor form */}
      <div className="mt-5 grid gap-3 rounded-2xl bg-gray-50 p-4 ring-1 ring-gray-100 lg:grid-cols-12">
        <div className="lg:col-span-3">
          <label className="text-xs font-medium text-gray-600">Contractor Name</label>
          <input
            className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gray-200"
            value={draft.name}
            onChange={(e) => upd("name", e.target.value)}
            placeholder="e.g., Contractor A"
          />
        </div>

        <div className="lg:col-span-2">
          <label className="text-xs font-medium text-gray-600">Rate / hour</label>
          <input
            type="number"
            className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gray-200 tabular-nums"
            value={draft.ratePerHour}
            onChange={(e) => upd("ratePerHour", e.target.value)}
            placeholder="$/hr"
          />
        </div>

        <div className="lg:col-span-2">
          <label className="text-xs font-medium text-gray-600">Hours / week</label>
          <input
            type="number"
            className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gray-200 tabular-nums"
            value={draft.hoursPerWeek}
            onChange={(e) => upd("hoursPerWeek", e.target.value)}
            placeholder="hrs/wk"
          />
        </div>

        <div className="lg:col-span-2">
          <label className="text-xs font-medium text-gray-600">Weeks / year</label>
          <input
            type="number"
            className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gray-200 tabular-nums"
            value={draft.weeksPerYear}
            onChange={(e) => upd("weeksPerYear", e.target.value)}
            placeholder="weeks"
          />
        </div>

        <div className="lg:col-span-1">
          <label className="text-xs font-medium text-gray-600">MS %</label>
          <input
            type="number"
            className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gray-200 tabular-nums"
            value={draft.msPct}
            onChange={(e) => upd("msPct", e.target.value)}
            placeholder="MS %"
          />
        </div>

        <div className="lg:col-span-1">
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
            onClick={addContractor}
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

      {/* Contractor cards */}
      <div className="mt-5 space-y-4">
        {contractors.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-200 p-4 text-sm text-gray-600">
            No contractors added yet.
          </div>
        ) : (
          contractors.map((c) => {
            const msYear = MONTHS.reduce((a, m) => a + (c.msByMonth?.[m] ?? 0), 0);
            const nfYear = MONTHS.reduce((a, m) => a + (c.nfByMonth?.[m] ?? 0), 0);
            const totalYear = msYear + nfYear;

            return (
              <div key={c.id} className="rounded-2xl border border-gray-200 bg-white shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-gray-100 px-5 py-4">
                  <div className="w-full sm:w-auto">
                    <div className="text-xs font-medium text-gray-600">Contractor Name (editable)</div>
                    <input
                      className="mt-1 w-full sm:w-[360px] rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-900 outline-none focus:ring-2 focus:ring-gray-200"
                      value={c.name}
                      onChange={(e) => updateName(c.id, e.target.value)}
                    />
                    <div className="mt-2 text-xs text-gray-600">
                      Year Total: <span className="font-semibold">{fmt(totalYear)}</span> • Split{" "}
                      <span className="font-semibold text-blue-700">MS {c.msPct}%</span> /{" "}
                      <span className="font-semibold text-purple-700">NF {c.nfPct}%</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => regenerateFromRateHoursWeeks(c.id)}
                      className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-900 hover:bg-gray-50"
                    >
                      Regenerate
                    </button>
                    <button
                      onClick={() => removeContractor(c.id)}
                      className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-900 hover:bg-gray-50"
                    >
                      Remove
                    </button>
                  </div>
                </div>

                {/* Inputs row */}
                <div className="grid gap-3 px-5 py-4 md:grid-cols-7">
                  <SmallField
                    label="Rate/hr"
                    value={c.ratePerHour}
                    onChange={(v) => updateContractor(c.id, (x) => ({ ...x, ratePerHour: v }))}
                  />
                  <SmallField
                    label="Hours/week"
                    value={c.hoursPerWeek}
                    onChange={(v) => updateContractor(c.id, (x) => ({ ...x, hoursPerWeek: v }))}
                  />
                  <SmallField
                    label="Weeks/year"
                    value={c.weeksPerYear}
                    onChange={(v) => updateContractor(c.id, (x) => ({ ...x, weeksPerYear: v }))}
                  />
                  <SmallField
                    label="MS %"
                    value={c.msPct}
                    onChange={(v) => updateSplit(c.id, v, c.nfPct)}
                  />
                  <SmallField
                    label="NF %"
                    value={c.nfPct}
                    onChange={(v) => updateSplit(c.id, c.msPct, v)}
                  />

                  <div>
                    <label className="text-xs font-medium text-gray-600">Year Target (editable)</label>
                    <input
                      type="number"
                      className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gray-200 tabular-nums"
                      value={Math.round(c.yearTargetTotal)}
                      onChange={(e) => setYearTarget(c.id, e.target.value)}
                    />
                  </div>

                  <div className="rounded-xl bg-gray-50 p-3 ring-1 ring-gray-100">
                    <div className="text-xs font-medium text-gray-600">Year (calc)</div>
                    <div className="mt-1 text-sm font-semibold text-gray-900 tabular-nums">
                      {fmt((c.ratePerHour || 0) * (c.hoursPerWeek || 0) * (c.weeksPerYear || 0))}
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
                              value={Math.round(c.msByMonth?.[m] ?? 0)}
                              onChange={(e) => setMonthValue(c.id, "ms", m, e.target.value)}
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
                              value={Math.round(c.nfByMonth?.[m] ?? 0)}
                              onChange={(e) => setMonthValue(c.id, "nf", m, e.target.value)}
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
                            {fmt((c.msByMonth?.[m] ?? 0) + (c.nfByMonth?.[m] ?? 0))}
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