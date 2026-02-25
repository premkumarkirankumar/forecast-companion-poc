import { useEffect, useMemo, useState } from "react";
import { MONTHS } from "../../data/hub";

/* =========================
   Helpers
========================= */
function fmt(value) {
  if (value === null || value === undefined) return "$—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function clampPct(n) {
  const x = Number(n);
  if (Number.isNaN(x)) return 0;
  return Math.max(0, Math.min(100, x));
}

function monthDividerClass(m) {
  const isQuarterStart = m === "Apr" || m === "Jul" || m === "Oct";
  const base = m === "Jan" ? "" : "border-l border-gray-100";
  const quarter = isQuarterStart ? " border-l-2 border-gray-200" : "";
  return (base + quarter).trim();
}

function headCellClass(m) {
  return [
    "px-3 py-3 text-right font-medium whitespace-nowrap",
    monthDividerClass(m),
  ].join(" ");
}

function bodyCellClass(m) {
  return ["px-2 py-3 align-top", monthDividerClass(m)].join(" ");
}

function distributeEvenly(total, lockedByMonth) {
  const lockedSum = MONTHS.reduce((a, m) => a + (lockedByMonth[m] ?? 0), 0);
  const remaining = Math.max(0, total - lockedSum);

  const unlockedMonths = MONTHS.filter((m) => lockedByMonth[m] === undefined);
  const per = unlockedMonths.length ? remaining / unlockedMonths.length : 0;

  const out = {};
  for (const m of MONTHS) {
    out[m] = lockedByMonth[m] === undefined ? per : lockedByMonth[m];
  }
  return out;
}

function normalizeSplit(msPct, nfPct) {
  const ms = clampPct(msPct);
  const nf = clampPct(nfPct);
  const s = ms + nf;
  if (s === 0) return { msPct: 0, nfPct: 0 };
  const msN = Math.round((ms / s) * 100);
  return { msPct: msN, nfPct: 100 - msN };
}

function num(v) {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

function hasValue(v) {
  return String(v ?? "").trim().length > 0;
}

/* =========================
   Small Field (local)
========================= */
function SmallField({ label, value, onChange, placeholder }) {
  return (
    <div>
      <label className="text-xs font-medium text-gray-600">{label}</label>
      <input
        type="number"
        className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gray-200 tabular-nums"
        value={value}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        placeholder={placeholder}
      />
    </div>
  );
}

/* =========================
   Main Component
========================= */
export default function ExternalContractorsDetails({
  programKey,
  contractors,
  setContractors,
  onLog,
}) {
  // ✅ Persist expanded cards per program (contractors)
  const expandedKey = `pfc.${programKey}.ui.contractors.expandedIds`;
  const [expandedIds, setExpandedIds] = useState(() => {
    try {
      const raw = localStorage.getItem(expandedKey);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(expandedKey, JSON.stringify(expandedIds));
    } catch {
      // ignore
    }
  }, [expandedKey, expandedIds]);

  function isExpanded(id) {
    return expandedIds.includes(id);
  }

  function toggleExpanded(id) {
    setExpandedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

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
    clampPct(draft.msPct) + clampPct(draft.nfPct) > 0;

  function updateContractor(id, patchFn) {
    setContractors((arr) => arr.map((c) => (c.id === id ? patchFn(c) : c)));
  }

  function recomputeFromYearTarget(c) {
    const msYear = c.yearTargetTotal * (c.msPct / 100);
    const nfYear = c.yearTargetTotal * (c.nfPct / 100);

    return {
      ...c,
      msByMonth: distributeEvenly(msYear, c.msLocked),
      nfByMonth: distributeEvenly(nfYear, c.nfLocked),
    };
  }

  function addContractor() {
    if (!canAdd) return;

    const baseYear =
      num(draft.ratePerHour) * num(draft.hoursPerWeek) * num(draft.weeksPerYear);

    const split = normalizeSplit(draft.msPct, draft.nfPct);

    const yearTarget = baseYear; // editable later
    const msYear = yearTarget * (split.msPct / 100);
    const nfYear = yearTarget * (split.nfPct / 100);

    const newItem = {
      id: crypto.randomUUID(),
      name: String(draft.name).trim(),

      ratePerHour: num(draft.ratePerHour),
      hoursPerWeek: num(draft.hoursPerWeek),
      weeksPerYear: num(draft.weeksPerYear),

      msPct: split.msPct,
      nfPct: split.nfPct,

      yearTargetTotal: yearTarget,

      msByMonth: distributeEvenly(msYear, {}),
      nfByMonth: distributeEvenly(nfYear, {}),

      msLocked: {},
      nfLocked: {},
    };

    setContractors((arr) => [newItem, ...arr]);

    // default collapsed; do NOT auto-expand
    onLog?.({
      action: "ADD_CONTRACTOR",
      entityType: "contractor",
      entityId: newItem.id,
      entityName: newItem.name,
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

    setExpandedIds((prev) => prev.filter((x) => x !== id));
    setContractors((arr) => arr.filter((c) => c.id !== id));
  }

  function updateName(id, name) {
    const existing = contractors.find((c) => c.id === id);
    const before = String(existing?.name ?? "");
    const after = String(name ?? "");

    // ✅ avoid noisy logs
    if (before === after) return;

    updateContractor(id, (c) => ({ ...c, name: after }));

    onLog?.({
      action: "UPDATE_CONTRACTOR_NAME",
      entityType: "contractor",
      entityId: id,
      entityName: existing?.name,
      field: "name",
      from: before,
      to: after,
    });
  }

  function updateSplit(id, msPct, nfPct) {
    const existing = contractors.find((c) => c.id === id);
    const nextSplit = normalizeSplit(msPct, nfPct);

    // ✅ log only if changed
    if (
      Number(existing?.msPct ?? 0) !== Number(nextSplit.msPct) ||
      Number(existing?.nfPct ?? 0) !== Number(nextSplit.nfPct)
    ) {
      onLog?.({
        action: "UPDATE_SPLIT",
        entityType: "contractor",
        entityId: id,
        entityName: existing?.name,
        field: "split",
        from: { msPct: existing?.msPct, nfPct: existing?.nfPct },
        to: { msPct: nextSplit.msPct, nfPct: nextSplit.nfPct },
      });
    }

    updateContractor(id, (c) => {
      const next = { ...c, ...nextSplit };
      return recomputeFromYearTarget(next);
    });
  }

  function setYearTarget(id, value) {
    const v = Number(value);
    const val = Number.isFinite(v) ? v : 0;

    const existing = contractors.find((c) => c.id === id);
    const before = num(existing?.yearTargetTotal ?? 0);

    // ✅ avoid noisy logs
    if (before === val) return;

    onLog?.({
      action: "UPDATE_YEAR_TARGET",
      entityType: "contractor",
      entityId: id,
      entityName: existing?.name,
      field: "yearTargetTotal",
      from: before,
      to: val,
    });

    updateContractor(id, (c) =>
      recomputeFromYearTarget({ ...c, yearTargetTotal: val })
    );
  }

  function setMonthValue(id, kind, month, value) {
    const v = Number(value);
    const val = Number.isFinite(v) ? v : 0;

    const existing = contractors.find((c) => c.id === id);

    // ✅ "before" should be what user sees in the grid, not locked (locked can be undefined)
    const before =
      kind === "ms"
        ? num(existing?.msByMonth?.[month] ?? 0)
        : num(existing?.nfByMonth?.[month] ?? 0);

    // ✅ avoid noisy logs
    if (before === val) return;

    onLog?.({
      action: kind === "ms" ? "EDIT_MS_MONTH" : "EDIT_NF_MONTH",
      entityType: "contractor",
      entityId: id,
      entityName: existing?.name,
      field: `${kind}.${month}`,
      from: before,
      to: val,
    });

    updateContractor(id, (c) => {
      const lockedKey = kind === "ms" ? "msLocked" : "nfLocked";
      const next = { ...c, [lockedKey]: { ...c[lockedKey], [month]: val } };
      return recomputeFromYearTarget(next);
    });
  }

  // ✅ NEW: Log only when these editable fields change (before → after)
  function setRatePerHour(id, value) {
    const val = num(value);
    const existing = contractors.find((c) => c.id === id);
    const before = num(existing?.ratePerHour ?? 0);

    if (before === val) return;

    onLog?.({
      action: "UPDATE_RATE_PER_HOUR",
      entityType: "contractor",
      entityId: id,
      entityName: existing?.name,
      field: "ratePerHour",
      from: before,
      to: val,
    });

    updateContractor(id, (c) => ({ ...c, ratePerHour: val }));
  }

  function setHoursPerWeek(id, value) {
    const val = num(value);
    const existing = contractors.find((c) => c.id === id);
    const before = num(existing?.hoursPerWeek ?? 0);

    if (before === val) return;

    onLog?.({
      action: "UPDATE_HOURS_PER_WEEK",
      entityType: "contractor",
      entityId: id,
      entityName: existing?.name,
      field: "hoursPerWeek",
      from: before,
      to: val,
    });

    updateContractor(id, (c) => ({ ...c, hoursPerWeek: val }));
  }

  function setWeeksPerYear(id, value) {
    const val = num(value);
    const existing = contractors.find((c) => c.id === id);
    const before = num(existing?.weeksPerYear ?? 0);

    if (before === val) return;

    onLog?.({
      action: "UPDATE_WEEKS_PER_YEAR",
      entityType: "contractor",
      entityId: id,
      entityName: existing?.name,
      field: "weeksPerYear",
      from: before,
      to: val,
    });

    updateContractor(id, (c) => ({ ...c, weeksPerYear: val }));
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
      const baseYear = c.ratePerHour * c.hoursPerWeek * c.weeksPerYear;
      const reset = { ...c, yearTargetTotal: baseYear, msLocked: {}, nfLocked: {} };
      return recomputeFromYearTarget(reset);
    });
  }

  const subtlePanel =
    "rounded-2xl border border-blue-200/60 bg-blue-50/30 p-5 shadow-sm";

  return (
    <div className={subtlePanel}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-sm font-semibold text-gray-900">
            External Details — Contractors
          </div>
          <div className="mt-1 text-xs text-gray-600">
            Add contractors → set yearly target → edit MS/NF by month (auto rebalances remaining months).
          </div>
        </div>

        <div className="hidden sm:flex items-center gap-2 rounded-xl bg-white/60 px-3 py-2 text-xs text-gray-600 ring-1 ring-gray-100">
          Quarter separators at Apr / Jul / Oct
        </div>
      </div>

      {/* Add contractor form */}
      <div className="mt-5 grid gap-3 rounded-2xl bg-white/70 p-4 ring-1 ring-gray-100 lg:grid-cols-12">
        <div className="lg:col-span-3">
          <label className="text-xs font-medium text-gray-600">Contractor Name</label>
          <input
            className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gray-200"
            value={draft.name}
            onChange={(e) => upd("name", e.target.value)}
            placeholder="e.g., Tony Stark"
          />
        </div>

        <div className="lg:col-span-2">
          <label className="text-xs font-medium text-gray-600">Rate / hour</label>
          <input
            type="number"
            className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gray-200 tabular-nums"
            value={draft.ratePerHour}
            onChange={(e) => upd("ratePerHour", e.target.value)}
            placeholder="$ / hr"
          />
        </div>

        <div className="lg:col-span-2">
          <label className="text-xs font-medium text-gray-600">Hours / week</label>
          <input
            type="number"
            className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gray-200 tabular-nums"
            value={draft.hoursPerWeek}
            onChange={(e) => upd("hoursPerWeek", e.target.value)}
            placeholder="hrs / wk"
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
            placeholder="%"
          />
        </div>

        <div className="lg:col-span-1">
          <label className="text-xs font-medium text-gray-600">NF %</label>
          <input
            type="number"
            className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gray-200 tabular-nums"
            value={draft.nfPct}
            onChange={(e) => upd("nfPct", e.target.value)}
            placeholder="%"
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

      {/* Contractor accordion cards */}
      <div className="mt-5 space-y-3">
        {contractors.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-200 bg-white/60 p-4 text-sm text-gray-600">
            No contractors added yet.
          </div>
        ) : (
          contractors.map((c) => {
            const msYear = MONTHS.reduce((a, m) => a + (c.msByMonth?.[m] ?? 0), 0);
            const nfYear = MONTHS.reduce((a, m) => a + (c.nfByMonth?.[m] ?? 0), 0);
            const totalYear = msYear + nfYear;

            const expanded = isExpanded(c.id);

            return (
              <div
                key={c.id}
                className="rounded-2xl border border-blue-200/50 bg-white shadow-sm"
              >
                {/* Header row (always visible) */}
                <button
                  type="button"
                  onClick={() => toggleExpanded(c.id)}
                  className="w-full px-5 py-4 text-left"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-[280px]">
                      <div className="text-xs font-medium text-gray-600">
                        Contractor Name
                      </div>
                      <div className="mt-1 text-sm font-semibold text-gray-900">
                        {c.name || "Untitled"}
                      </div>
                      <div className="mt-1 text-xs text-gray-600">
                        Year Target:{" "}
                        <span className="font-semibold">{fmt(c.yearTargetTotal)}</span>{" "}
                        • Split{" "}
                        <span className="font-semibold text-blue-700">
                          MS {c.msPct}%
                        </span>{" "}
                        /{" "}
                        <span className="font-semibold text-purple-700">
                          NF {c.nfPct}%
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="rounded-xl bg-blue-50 px-3 py-2 text-xs text-gray-700 ring-1 ring-blue-100">
                        Total (calc):{" "}
                        <span className="font-semibold">{fmt(totalYear)}</span>
                      </div>

                      <span className="rounded-full bg-gray-100 px-2 py-1 text-[11px] font-medium text-gray-700">
                        {expanded ? "Hide" : "Show"}
                      </span>
                      <span className="text-lg text-gray-600">{expanded ? "▾" : "▸"}</span>
                    </div>
                  </div>
                </button>

                {/* Expanded details */}
                {expanded ? (
                  <div className="border-t border-gray-100">
                    <div className="flex flex-wrap items-start justify-between gap-3 px-5 py-4">
                      <div className="w-full sm:w-auto">
                        <div className="text-xs font-medium text-gray-600">
                          Contractor Name (editable)
                        </div>
                        <input
                          className="mt-1 w-full sm:w-[360px] rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-900 outline-none focus:ring-2 focus:ring-gray-200"
                          value={c.name}
                          onChange={(e) => updateName(c.id, e.target.value)}
                        />
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
                    <div className="grid gap-3 px-5 pb-4 md:grid-cols-7">
                      <SmallField
                        label="Rate/hr"
                        value={c.ratePerHour}
                        onChange={(v) => setRatePerHour(c.id, v)}
                      />
                      <SmallField
                        label="Hours/week"
                        value={c.hoursPerWeek}
                        onChange={(v) => setHoursPerWeek(c.id, v)}
                      />
                      <SmallField
                        label="Weeks/year"
                        value={c.weeksPerYear}
                        onChange={(v) => setWeeksPerYear(c.id, v)}
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
                        <label className="text-xs font-medium text-gray-600">
                          Year Target (editable)
                        </label>
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
                          {fmt(c.ratePerHour * c.hoursPerWeek * c.weeksPerYear)}
                        </div>
                      </div>
                    </div>

                    {/* Monthly grid */}
                    <div className="overflow-x-auto border-t border-gray-100">
                      <table className="min-w-[1650px] w-full border-collapse">
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
                          {/* MS editable */}
                          <tr className="border-t border-gray-100 bg-blue-50/40">
                            <td className="sticky left-0 bg-white px-5 py-4 text-sm font-semibold text-gray-900">
                              MS (editable)
                            </td>
                            {MONTHS.map((m) => (
                              <td key={m} className={bodyCellClass(m)}>
                                <input
                                  type="number"
                                  inputMode="numeric"
                                  className={[
                                    "w-full min-w-[160px]",
                                    "rounded-xl border border-gray-200 bg-white",
                                    "px-3 py-2 text-right text-sm font-semibold tabular-nums",
                                    "outline-none focus:ring-2 focus:ring-gray-200",
                                  ].join(" ")}
                                  value={Math.round(c.msByMonth?.[m] ?? 0)}
                                  onChange={(e) =>
                                    setMonthValue(c.id, "ms", m, e.target.value)
                                  }
                                />
                              </td>
                            ))}
                            <td className="px-5 py-4 text-right text-sm font-semibold tabular-nums text-gray-900 whitespace-nowrap">
                              {fmt(msYear)}
                            </td>
                          </tr>

                          {/* NF editable */}
                          <tr className="border-t border-gray-100 bg-purple-50/40">
                            <td className="sticky left-0 bg-white px-5 py-4 text-sm font-semibold text-gray-900">
                              NF (editable)
                            </td>
                            {MONTHS.map((m) => (
                              <td key={m} className={bodyCellClass(m)}>
                                <input
                                  type="number"
                                  inputMode="numeric"
                                  className={[
                                    "w-full min-w-[160px]",
                                    "rounded-xl border border-gray-200 bg-white",
                                    "px-3 py-2 text-right text-sm font-semibold tabular-nums",
                                    "outline-none focus:ring-2 focus:ring-gray-200",
                                  ].join(" ")}
                                  value={Math.round(c.nfByMonth?.[m] ?? 0)}
                                  onChange={(e) =>
                                    setMonthValue(c.id, "nf", m, e.target.value)
                                  }
                                />
                              </td>
                            ))}
                            <td className="px-5 py-4 text-right text-sm font-semibold tabular-nums text-gray-900 whitespace-nowrap">
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
                            <td className="px-5 py-4 text-right text-sm font-semibold tabular-nums text-gray-900 whitespace-nowrap">
                              {fmt(totalYear)}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}