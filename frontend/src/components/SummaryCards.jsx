import { useMemo, useState } from "react";
import { MONTHS } from "../data/hub";

// ---------- formatting ----------
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

function monthCellBorder(i) {
  // Vertical divider between months
  // Keep it subtle, but visible.
  return i === 0 ? "" : "border-l border-gray-100";
}

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

// ---------- MonthTable: stacked MS/NF/Total per month (for internal/tools) ----------
function MonthTable({ title, rows }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50/70 px-4 py-3">
        <div className="text-sm font-semibold text-gray-900">{title}</div>
        <div className="text-xs text-gray-500">Jan–Dec view</div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-[1500px] w-full border-collapse">
          <thead>
            <tr className="text-xs text-gray-600">
              <th className="sticky left-0 z-10 bg-white px-4 py-3 text-left font-medium">
                Category
              </th>
              {MONTHS.map((m, i) => (
                <th
                  key={m}
                  className={[
                    "px-3 py-3 text-right font-medium",
                    monthCellBorder(i),
                  ].join(" ")}
                >
                  {m}
                </th>
              ))}
              <th className="px-4 py-3 text-right font-medium">Year</th>
            </tr>
          </thead>

          <tbody>
            {rows.map((r) => {
              const msYear = MONTHS.reduce((acc, m) => acc + (r.msByMonth?.[m] ?? 0), 0);
              const nfYear = MONTHS.reduce((acc, m) => acc + (r.nfByMonth?.[m] ?? 0), 0);
              const totalYear = msYear + nfYear;

              return (
                <tr key={r.label} className="border-t border-gray-100">
                  <td className="sticky left-0 z-10 bg-white px-4 py-3 align-top">
                    <div className="text-sm font-semibold text-gray-900">{r.label}</div>
                    <div className="mt-2 space-y-1">
                      <div className="text-xs font-medium text-gray-600">MS</div>
                      <div className="text-xs font-medium text-gray-600">NF</div>
                      <div className="text-xs font-medium text-gray-600">Total</div>
                    </div>
                  </td>

                  {MONTHS.map((m, i) => {
                    const ms = r.msByMonth?.[m];
                    const nf = r.nfByMonth?.[m];
                    const total = (ms ?? 0) + (nf ?? 0);

                    return (
                      <td
                        key={m}
                        className={[
                          "px-3 py-3 align-top text-right",
                          monthCellBorder(i),
                        ].join(" ")}
                      >
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

                  <td className="px-4 py-3 align-top text-right">
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

// ---------- helpers for contractors auto-rebalance ----------
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

// ---------- External Total contractors rollup table (aligned) ----------
function RollupTable({ title, msByMonth, nfByMonth }) {
  const totalByMonth = Object.fromEntries(
    MONTHS.map((m) => [m, (msByMonth?.[m] ?? 0) + (nfByMonth?.[m] ?? 0)])
  );

  const msYear = MONTHS.reduce((a, m) => a + (msByMonth?.[m] ?? 0), 0);
  const nfYear = MONTHS.reduce((a, m) => a + (nfByMonth?.[m] ?? 0), 0);
  const totalYear = msYear + nfYear;

  function Row({ label, map, year, tone }) {
    const toneMap = {
      ms: "text-blue-700",
      nf: "text-purple-700",
      total: "text-gray-900",
    };

    return (
      <tr className="border-t border-gray-100">
        <td className="sticky left-0 bg-white px-4 py-3 text-sm font-semibold text-gray-900">
          {label}
        </td>
        {MONTHS.map((m, i) => (
          <td
            key={m}
            className={[
              "px-2 py-3 text-right text-sm font-semibold tabular-nums",
              monthCellBorder(i),
              toneMap[tone] ?? "",
            ].join(" ")}
          >
            {fmt(map?.[m])}
          </td>
        ))}
        <td className={["px-4 py-3 text-right text-sm font-semibold tabular-nums", toneMap[tone] ?? ""].join(" ")}>
          {fmt(year)}
        </td>
      </tr>
    );
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50/70 px-4 py-3">
        <div className="text-sm font-semibold text-gray-900">{title}</div>
        <div className="text-xs text-gray-500">Jan–Dec view</div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-[1500px] w-full border-collapse">
          <thead>
            <tr className="text-xs text-gray-600">
              <th className="sticky left-0 bg-white px-4 py-3 text-left font-medium">Category</th>
              {MONTHS.map((m, i) => (
                <th key={m} className={["px-2 py-3 text-right font-medium", monthCellBorder(i)].join(" ")}>
                  {m}
                </th>
              ))}
              <th className="px-4 py-3 text-right font-medium">Year</th>
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

// ---------- Contractors Details component ----------
function ExternalContractorsDetails({ contractors, setContractors }) {
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

  function calcYearFromInputs() {
    return num(draft.ratePerHour) * num(draft.hoursPerWeek) * num(draft.weeksPerYear);
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

    const baseYear = calcYearFromInputs();
    const split = normalizeSplit(draft.msPct, draft.nfPct);

    const yearTarget = baseYear;
    const msYear = yearTarget * (split.msPct / 100);
    const nfYear = yearTarget * (split.nfPct / 100);

    const msByMonth = distributeEvenly(msYear, {});
    const nfByMonth = distributeEvenly(nfYear, {});

    const newItem = {
      id: crypto.randomUUID(),
      name: String(draft.name).trim(),

      ratePerHour: num(draft.ratePerHour),
      hoursPerWeek: num(draft.hoursPerWeek),
      weeksPerYear: num(draft.weeksPerYear),

      msPct: split.msPct,
      nfPct: split.nfPct,

      yearTargetTotal: yearTarget,

      msByMonth,
      nfByMonth,

      msLocked: {},
      nfLocked: {},
    };

    setContractors((arr) => [newItem, ...arr]);

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
    setContractors((arr) => arr.filter((c) => c.id !== id));
  }

  function updateSplit(id, msPct, nfPct) {
    updateContractor(id, (c) => {
      const split = normalizeSplit(msPct, nfPct);
      return recomputeFromYearTarget({ ...c, ...split });
    });
  }

  function setYearTarget(id, value) {
    const v = Number(value);
    const val = Number.isFinite(v) ? v : 0;
    updateContractor(id, (c) => recomputeFromYearTarget({ ...c, yearTargetTotal: val }));
  }

  function setMonthValue(id, kind, month, value) {
    const v = Number(value);
    const val = Number.isFinite(v) ? v : 0;

    updateContractor(id, (c) => {
      const lockedKey = kind === "ms" ? "msLocked" : "nfLocked";
      const next = { ...c, [lockedKey]: { ...c[lockedKey], [month]: val } };
      return recomputeFromYearTarget(next);
    });
  }

  function regenerateFromRateHoursWeeks(id) {
    updateContractor(id, (c) => {
      const baseYear = c.ratePerHour * c.hoursPerWeek * c.weeksPerYear;
      const resetLocks = { ...c, yearTargetTotal: baseYear, msLocked: {}, nfLocked: {} };
      return recomputeFromYearTarget(resetLocks);
    });
  }

  function updateName(id, name) {
    updateContractor(id, (c) => ({ ...c, name }));
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-gray-900">External Details — Contractors</div>
          <div className="mt-1 text-xs text-gray-600">
            Add contractors → set yearly target → edit MS/NF by month (auto-rebalances remaining months).
          </div>
        </div>
        <span className="rounded-full bg-gray-100 px-3 py-1 text-[11px] font-semibold text-gray-700">
          Detail View
        </span>
      </div>

      {/* Add contractor form */}
      <div className="mt-4 grid gap-3 rounded-2xl bg-gray-50 p-4 ring-1 ring-gray-100 lg:grid-cols-12">
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

      {/* Contractor list */}
      <div className="mt-4 space-y-4">
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
              <div key={c.id} className="rounded-2xl border border-gray-200 bg-white">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 bg-gray-50/50 px-4 py-3">
                  <div className="min-w-[260px]">
                    <label className="text-[11px] font-medium text-gray-500">Contractor Name</label>
                    <input
                      className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-900 outline-none focus:ring-2 focus:ring-gray-200"
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

                {/* Inputs + Year target */}
                <div className="grid gap-3 px-4 py-4 md:grid-cols-7">
                  <SmallField
                    label="Rate/hr"
                    value={c.ratePerHour}
                    onChange={(v) =>
                      updateContractor(c.id, (x) => ({ ...x, ratePerHour: v }))
                    }
                  />
                  <SmallField
                    label="Hours/week"
                    value={c.hoursPerWeek}
                    onChange={(v) =>
                      updateContractor(c.id, (x) => ({ ...x, hoursPerWeek: v }))
                    }
                  />
                  <SmallField
                    label="Weeks/year"
                    value={c.weeksPerYear}
                    onChange={(v) =>
                      updateContractor(c.id, (x) => ({ ...x, weeksPerYear: v }))
                    }
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

                {/* Editable monthly MS/NF; Total computed */}
                <div className="overflow-x-auto border-t border-gray-100">
                  <table className="min-w-[1500px] w-full border-collapse">
                    <thead>
                      <tr className="text-xs text-gray-600">
                        <th className="sticky left-0 bg-white px-4 py-3 text-left font-medium">
                          Month
                        </th>
                        {MONTHS.map((m, i) => (
                          <th
                            key={m}
                            className={[
                              "px-2 py-3 text-right font-medium",
                              monthCellBorder(i),
                            ].join(" ")}
                          >
                            {m}
                          </th>
                        ))}
                        <th className="px-4 py-3 text-right font-medium">Year</th>
                      </tr>
                    </thead>

                    <tbody>
                      <tr className="border-t border-gray-100">
                        <td className="sticky left-0 bg-white px-4 py-3 text-sm font-semibold text-blue-800">
                          MS (editable)
                        </td>
                        {MONTHS.map((m, i) => (
                          <td key={m} className={["px-2 py-3", monthCellBorder(i)].join(" ")}>
                            <BigMoneyInput
                              value={Math.round(c.msByMonth?.[m] ?? 0)}
                              onChange={(val) => setMonthValue(c.id, "ms", m, val)}
                            />
                          </td>
                        ))}
                        <td className="px-4 py-3 text-right text-sm font-semibold text-blue-800 tabular-nums">
                          {fmt(msYear)}
                        </td>
                      </tr>

                      <tr className="border-t border-gray-100">
                        <td className="sticky left-0 bg-white px-4 py-3 text-sm font-semibold text-purple-800">
                          NF (editable)
                        </td>
                        {MONTHS.map((m, i) => (
                          <td key={m} className={["px-2 py-3", monthCellBorder(i)].join(" ")}>
                            <BigMoneyInput
                              value={Math.round(c.nfByMonth?.[m] ?? 0)}
                              onChange={(val) => setMonthValue(c.id, "nf", m, val)}
                            />
                          </td>
                        ))}
                        <td className="px-4 py-3 text-right text-sm font-semibold text-purple-800 tabular-nums">
                          {fmt(nfYear)}
                        </td>
                      </tr>

                      <tr className="border-t border-gray-100 bg-gray-50/40 text-gray-900">
                        <td className="sticky left-0 bg-gray-50/40 px-4 py-3 text-sm font-semibold">
                          Total (calc)
                        </td>
                        {MONTHS.map((m, i) => (
                          <td
                            key={m}
                            className={[
                              "px-2 py-3 text-right text-sm font-semibold tabular-nums",
                              monthCellBorder(i),
                            ].join(" ")}
                          >
                            {fmt((c.msByMonth?.[m] ?? 0) + (c.nfByMonth?.[m] ?? 0))}
                          </td>
                        ))}
                        <td className="px-4 py-3 text-right text-sm font-semibold tabular-nums">
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

function BigMoneyInput({ value, onChange }) {
  return (
    <input
      type="number"
      className={[
        "w-full min-w-[92px]", // IMPORTANT: makes the boxes wide enough per month
        "rounded-xl border border-gray-200 bg-white px-3 py-2",
        "text-right text-sm font-semibold tabular-nums",
        "outline-none focus:ring-2 focus:ring-gray-200",
      ].join(" ")}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

// ---------- placeholder data for internal/tools ----------
function useEmptyMonthMaps(selectedProgram) {
  return useMemo(() => {
    const empty = Object.fromEntries(MONTHS.map((m) => [m, undefined]));
    return {
      internal: [{ label: "Internal", msByMonth: empty, nfByMonth: empty }],
      tools: [{ label: "Tools & Services", msByMonth: empty, nfByMonth: empty }],
    };
  }, [selectedProgram]);
}

// ---------- rollup from contractors (MS/NF are primary editable sources) ----------
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

export default function SummaryCards({ selectedProgram }) {
  const [open, setOpen] = useState({
    internal: true,
    tools: false,
    external: true,
  });

  const [externalTab, setExternalTab] = useState("total"); // "total" | "details"

  // POC: in-memory only (we can add localStorage + changelog next)
  const [contractors, setContractors] = useState([]);

  const base = useEmptyMonthMaps(selectedProgram);

  const contractorsRollup = useMemo(
    () => computeContractorRollup(contractors),
    [contractors]
  );

  // SOW placeholder
  const emptySow = useMemo(() => Object.fromEntries(MONTHS.map((m) => [m, undefined])), []);

  return (
    <div className="mt-6 space-y-4">
      {/* INTERNAL */}
      <SectionHeader
        title="Internal"
        subtitle="FTE forecast split by MS and NF"
        accent="blue"
        isOpen={open.internal}
        onToggle={() => setOpen((s) => ({ ...s, internal: !s.internal }))}
      />
      {open.internal ? <MonthTable title="Internal (MS / NF / Total)" rows={base.internal} /> : null}

      {/* TOOLS */}
      <SectionHeader
        title="Tools & Services"
        subtitle="Tools & services forecast split by MS and NF"
        accent="purple"
        isOpen={open.tools}
        onToggle={() => setOpen((s) => ({ ...s, tools: !s.tools }))}
      />
      {open.tools ? <MonthTable title="Tools & Services (MS / NF / Total)" rows={base.tools} /> : null}

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
          </div>

          {externalTab === "total" ? (
            <div className="space-y-4">
              <RollupTable
                title="External — Contractors (roll-up from details)"
                msByMonth={contractorsRollup.msByMonth}
                nfByMonth={contractorsRollup.nfByMonth}
              />

              <MonthTable
                title="External — SOW (placeholder for now)"
                rows={[{ label: "SOW", msByMonth: emptySow, nfByMonth: emptySow }]}
              />
            </div>
          ) : (
            <ExternalContractorsDetails
              contractors={contractors}
              setContractors={setContractors}
            />
          )}
        </div>
      ) : null}
    </div>
  );
}