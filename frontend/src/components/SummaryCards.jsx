import { useMemo, useState, useEffect } from "react";
import { MONTHS } from "../data/hub";

/* =========================================================
   LocalStorage hook (simple, reliable)
========================================================= */
function useLocalStorageState(key, initialValue) {
  const [state, setState] = useState(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : initialValue;
    } catch {
      return initialValue;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(state));
    } catch {
      // ignore
    }
  }, [key, state]);

  return [state, setState];
}

/* =========================================================
   Helpers
========================================================= */
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

function makeChange({
  actor = "Neo",
  program,
  action,
  entityType,
  entityId,
  entityName,
  field,
  from,
  to,
  meta,
}) {
  return {
    id: crypto.randomUUID(),
    ts: new Date().toISOString(),
    actor,
    program,
    action,
    entityType,
    entityId,
    entityName,
    field,
    from,
    to,
    meta: meta ?? {},
  };
}

/* =========================================================
   Section Header
========================================================= */
function SectionHeader({ title, subtitle, accent, isOpen, onToggle }) {
  const accentMap = {
    blue: "border-blue-200 bg-blue-50 text-blue-900",
    purple: "border-purple-200 bg-purple-50 text-purple-900",
    green: "border-green-200 bg-green-50 text-green-900",
    gray: "border-gray-200 bg-gray-50 text-gray-900",
  };

  return (
    <button
      onClick={onToggle}
      className={[
        "w-full rounded-2xl border p-4 text-left transition",
        "hover:shadow-sm",
        accentMap[accent] ?? accentMap.gray,
      ].join(" ")}
    >
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="text-sm font-semibold">{title}</div>
          {subtitle ? <div className="mt-1 text-xs opacity-80">{subtitle}</div> : null}
        </div>

        <div className="flex items-center gap-2">
          <span className="rounded-full bg-white/70 px-2 py-1 text-[11px] font-medium">
            {isOpen ? "Hide" : "Show"}
          </span>
          <span className="text-lg">{isOpen ? "▾" : "▸"}</span>
        </div>
      </div>
    </button>
  );
}

/* =========================================================
   MonthTable (stacked MS/NF/Total per month) - placeholder blocks
========================================================= */
function MonthTable({ title, rows }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3">
        <div className="text-sm font-semibold text-gray-900">{title}</div>
        <div className="text-xs text-gray-500">Jan–Dec view</div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-[1400px] w-full border-collapse">
          <thead>
            <tr className="text-xs text-gray-600">
              <th className="sticky left-0 z-10 bg-white px-5 py-3 text-left font-medium">
                Category
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
            {rows.map((r) => {
              const msYear = MONTHS.reduce((acc, m) => acc + (r.msByMonth?.[m] ?? 0), 0);
              const nfYear = MONTHS.reduce((acc, m) => acc + (r.nfByMonth?.[m] ?? 0), 0);
              const totalYear = msYear + nfYear;

              return (
                <tr key={r.label} className="border-t border-gray-100">
                  <td className="sticky left-0 z-10 bg-white px-5 py-4 align-top">
                    <div className="text-sm font-semibold text-gray-900">{r.label}</div>
                    <div className="mt-3 space-y-1">
                      <div className="text-xs font-medium text-gray-600">MS</div>
                      <div className="text-xs font-medium text-gray-600">NF</div>
                      <div className="text-xs font-medium text-gray-600">Total</div>
                    </div>
                  </td>

                  {MONTHS.map((m) => {
                    const ms = r.msByMonth?.[m];
                    const nf = r.nfByMonth?.[m];
                    const total = (ms ?? 0) + (nf ?? 0);

                    return (
                      <td key={m} className={["text-right", bodyCellClass(m)].join(" ")}>
                        <div className="space-y-1">
                          <div className="text-sm font-semibold text-gray-900 tabular-nums">
                            {fmt(ms)}
                          </div>
                          <div className="text-sm font-semibold text-gray-900 tabular-nums">
                            {fmt(nf)}
                          </div>
                          <div className="text-sm font-semibold text-gray-900 tabular-nums">
                            {ms === undefined && nf === undefined ? "$—" : fmt(total)}
                          </div>
                        </div>
                      </td>
                    );
                  })}

                  <td className="px-5 py-4 align-top text-right">
                    <div className="space-y-1">
                      <div className="text-sm font-semibold tabular-nums">{fmt(msYear)}</div>
                      <div className="text-sm font-semibold tabular-nums">{fmt(nfYear)}</div>
                      <div className="text-sm font-semibold tabular-nums">{fmt(totalYear)}</div>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* =========================================================
   External Total Rollup Table (Contractors MS / NF / Total)
========================================================= */
function RollupTable({ title, msByMonth, nfByMonth }) {
  const totalByMonth = Object.fromEntries(
    MONTHS.map((m) => [m, (msByMonth?.[m] ?? 0) + (nfByMonth?.[m] ?? 0)])
  );

  const msYear = MONTHS.reduce((a, m) => a + (msByMonth?.[m] ?? 0), 0);
  const nfYear = MONTHS.reduce((a, m) => a + (nfByMonth?.[m] ?? 0), 0);
  const totalYear = msYear + nfYear;

  function Row({ label, map, year, tone }) {
    const toneCls =
      tone === "ms"
        ? "bg-blue-50/60"
        : tone === "nf"
        ? "bg-purple-50/60"
        : "bg-gray-50/60";

    return (
      <tr className={["border-t border-gray-100", toneCls].join(" ")}>
        <td className="sticky left-0 bg-white px-5 py-3 text-sm font-semibold text-gray-900">
          {label}
        </td>
        {MONTHS.map((m) => (
          <td
            key={m}
            className={[
              "px-2 py-3 text-right text-sm font-semibold tabular-nums whitespace-nowrap",
              monthDividerClass(m),
            ].join(" ")}
          >
            {fmt(map?.[m] ?? 0)}
          </td>
        ))}
        <td className="px-5 py-3 text-right text-sm font-semibold tabular-nums">
          {fmt(year)}
        </td>
      </tr>
    );
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3">
        <div className="text-sm font-semibold text-gray-900">{title}</div>
        <div className="text-xs text-gray-500">Jan–Dec view</div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-[1400px] w-full border-collapse">
          <thead>
            <tr className="text-xs text-gray-600">
              <th className="sticky left-0 bg-white px-5 py-3 text-left font-medium">
                Category
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
            <Row label="Contractors — MS" map={msByMonth} year={msYear} tone="ms" />
            <Row label="Contractors — NF" map={nfByMonth} year={nfYear} tone="nf" />
            <Row label="Contractors — Total" map={totalByMonth} year={totalYear} tone="total" />
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* =========================================================
   External Contractors Details (rich UI + edits + rebalance)
========================================================= */
function ExternalContractorsDetails({
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

  function num(v) {
    const x = Number(v);
    return Number.isFinite(x) ? x : 0;
  }

  function hasValue(v) {
    return String(v ?? "").trim().length > 0;
  }

  function normalizeSplit(msPct, nfPct) {
    const ms = clampPct(msPct);
    const nf = clampPct(nfPct);
    const s = ms + nf;
    if (s === 0) return { msPct: 0, nfPct: 0 };
    const msN = Math.round((ms / s) * 100);
    return { msPct: msN, nfPct: 100 - msN };
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

    updateContractor(id, (c) => recomputeFromYearTarget({ ...c, yearTargetTotal: val }));
  }

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
      const next = { ...c, [lockedKey]: { ...c[lockedKey], [month]: val } };
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
      const baseYear = c.ratePerHour * c.hoursPerWeek * c.weeksPerYear;
      const reset = { ...c, yearTargetTotal: baseYear, msLocked: {}, nfLocked: {} };
      return recomputeFromYearTarget(reset);
    });
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-sm font-semibold text-gray-900">
            External Details — Contractors
          </div>
          <div className="mt-1 text-xs text-gray-600">
            Add contractors → set yearly target → edit MS/NF by month (auto rebalances remaining months).
          </div>
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
                      {fmt(c.ratePerHour * c.hoursPerWeek * c.weeksPerYear)}
                    </div>
                  </div>
                </div>

                {/* Monthly grid */}
                <div className="overflow-x-auto border-t border-gray-100">
                  <table className="min-w-[1550px] w-full border-collapse">
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
                                "w-full min-w-[140px]", // bigger to avoid cut numbers
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
                                "w-full min-w-[140px]",
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

function SmallField({ label, value, onChange }) {
  return (
    <div>
      <label className="text-xs font-medium text-gray-600">{label}</label>
      <input
        type="number"
        className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gray-200 tabular-nums"
        value={value}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
      />
    </div>
  );
}

/* =========================================================
   Placeholder month maps for Internal / Tools / SOW
========================================================= */
function useEmptyMonthMaps(selectedProgram) {
  return useMemo(() => {
    const empty = Object.fromEntries(MONTHS.map((m) => [m, undefined]));
    return {
      internal: [{ label: "Internal", msByMonth: empty, nfByMonth: empty }],
      tools: [{ label: "Tools & Services", msByMonth: empty, nfByMonth: empty }],
      sow: [{ label: "SOW", msByMonth: empty, nfByMonth: empty }],
    };
  }, [selectedProgram]);
}

function computeContractorRollup(contractors) {
  const msByMonth = Object.fromEntries(MONTHS.map((m) => [m, 0]));
  const nfByMonth = Object.fromEntries(MONTHS.map((m) => [m, 0]));

  for (const c of contractors) {
    for (const m of MONTHS) {
      msByMonth[m] += c.msByMonth?.[m] ?? 0;
      nfByMonth[m] += c.nfByMonth?.[m] ?? 0;
    }
  }

  return { msByMonth, nfByMonth };
}

/* =========================================================
   MAIN EXPORT
========================================================= */
export default function SummaryCards({ selectedProgram }) {
  const programKey = selectedProgram || "default";

  // Persist per program:
  const contractorsKey = `pfc.${programKey}.contractors`;
  const changelogKey = `pfc.${programKey}.changelog`;

  const [actor, setActor] = useLocalStorageState("pfc.actor", "Neo");
  const [contractors, setContractors] = useLocalStorageState(contractorsKey, []);
  const [changeLog, setChangeLog] = useLocalStorageState(changelogKey, []);

  const [open, setOpen] = useState({
    internal: true,
    tools: false,
    external: true,
  });

  const [externalTab, setExternalTab] = useState("total"); // "total" | "details"

  const base = useEmptyMonthMaps(selectedProgram);

  const contractorsRollup = useMemo(
    () => computeContractorRollup(contractors),
    [contractors]
  );

  function logChange(payload) {
    const entry = makeChange({
      actor,
      program: programKey,
      ...payload,
    });

    setChangeLog((prev) => [entry, ...prev].slice(0, 300));
  }

  return (
    <div className="mx-auto mt-6 w-full max-w-[1700px] space-y-4 px-2 sm:px-4">
      {/* INTERNAL */}
      <SectionHeader
        title="Internal"
        subtitle="FTE forecast split by MS and NF"
        accent="blue"
        isOpen={open.internal}
        onToggle={() => setOpen((s) => ({ ...s, internal: !s.internal }))}
      />
      {open.internal ? (
        <MonthTable title="Internal (MS / NF / Total)" rows={base.internal} />
      ) : null}

      {/* TOOLS */}
      <SectionHeader
        title="Tools & Services"
        subtitle="Tools & services forecast split by MS and NF"
        accent="purple"
        isOpen={open.tools}
        onToggle={() => setOpen((s) => ({ ...s, tools: !s.tools }))}
      />
      {open.tools ? (
        <MonthTable title="Tools & Services (MS / NF / Total)" rows={base.tools} />
      ) : null}

      {/* EXTERNAL */}
      <SectionHeader
        title="External"
        subtitle="Contractors + SOW (tabs: Total vs Details)"
        accent="green"
        isOpen={open.external}
        onToggle={() => setOpen((s) => ({ ...s, external: !s.external }))}
      />

      {open.external ? (
        <div className="space-y-4">
          {/* Tabs */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setExternalTab("total")}
              className={[
                "rounded-xl px-3 py-2 text-sm font-semibold ring-1 transition",
                externalTab === "total"
                  ? "bg-gray-900 text-white ring-gray-900"
                  : "bg-white text-gray-900 ring-gray-200 hover:bg-gray-50",
              ].join(" ")}
            >
              External Total
            </button>

            <button
              onClick={() => setExternalTab("details")}
              className={[
                "rounded-xl px-3 py-2 text-sm font-semibold ring-1 transition",
                externalTab === "details"
                  ? "bg-gray-900 text-white ring-gray-900"
                  : "bg-white text-gray-900 ring-gray-200 hover:bg-gray-50",
              ].join(" ")}
            >
              External Details
            </button>

            {/* Reset data (contractors only) */}
            <button
              onClick={() => {
                if (confirm(`Clear saved contractors for ${programKey}?`)) {
                  setContractors([]);
                }
              }}
              className="ml-auto rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-50"
            >
              Reset Contractors
            </button>
          </div>

          {/* TOTAL TAB */}
          {externalTab === "total" ? (
            <div className="space-y-4">
              <RollupTable
                title="External — Contractors (roll-up from details)"
                msByMonth={contractorsRollup.msByMonth}
                nfByMonth={contractorsRollup.nfByMonth}
              />

              <MonthTable
                title="External — SOW (placeholder for now)"
                rows={base.sow}
              />
            </div>
          ) : (
            /* DETAILS TAB */
            <div className="space-y-4">
              <ExternalContractorsDetails
                contractors={contractors}
                setContractors={setContractors}
                onLog={logChange}
              />

              {/* Change Log ONLY here (Details tab) */}
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
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}