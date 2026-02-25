// frontend/src/components/forecast/TrendsPage.jsx
import { useEffect, useMemo, useState } from "react";
import { MONTHS } from "../../data/hub";
import { fmt } from "../../lib/forecast/format";

/* -----------------------------
   Storage + data helpers
------------------------------ */

function safeJsonParse(raw, fallback) {
  try {
    const v = raw ? JSON.parse(raw) : fallback;
    return v ?? fallback;
  } catch {
    return fallback;
  }
}

function loadArray(key) {
  const v = safeJsonParse(localStorage.getItem(key), []);
  return Array.isArray(v) ? v : [];
}

function sumByMonth(items) {
  const ms = Object.fromEntries(MONTHS.map((m) => [m, 0]));
  const nf = Object.fromEntries(MONTHS.map((m) => [m, 0]));

  for (const it of items || []) {
    for (const m of MONTHS) {
      ms[m] += Number(it?.msByMonth?.[m] ?? 0);
      nf[m] += Number(it?.nfByMonth?.[m] ?? 0);
    }
  }
  return { ms, nf };
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function pct(n) {
  if (!Number.isFinite(n)) return "0%";
  return `${Math.round(n * 100)}%`;
}

/* -----------------------------
   Small UI pieces
------------------------------ */

function StatCard({ title, value, sub }) {
  return (
    <div className="rounded-2xl border bg-white p-4 shadow-sm">
      <div className="text-xs font-semibold text-gray-600">{title}</div>
      <div className="mt-1 text-2xl font-extrabold text-gray-900">{value}</div>
      {sub ? <div className="mt-1 text-xs font-semibold text-gray-500">{sub}</div> : null}
    </div>
  );
}

/* -----------------------------
   SVG Charts (no deps)
------------------------------ */

function StackedBars({
  months,
  series, // [{ key, label, valuesByMonth, className }]
  height = 220,
}) {
  const totals = months.map((m) =>
    series.reduce((acc, s) => acc + Number(s.valuesByMonth?.[m] ?? 0), 0)
  );
  const maxY = Math.max(1, ...totals);

  // basic sizing
  const width = 900;
  const padL = 40;
  const padR = 16;
  const padT = 12;
  const padB = 34;

  const plotW = width - padL - padR;
  const plotH = height - padT - padB;

  const barGap = 8;
  const barW = Math.max(10, (plotW - barGap * (months.length - 1)) / months.length);

  function yScale(v) {
    return padT + plotH - (Number(v) / maxY) * plotH;
  }

  return (
    <div className="rounded-2xl border bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm font-extrabold text-gray-900">Monthly total spend (stacked)</div>
          <div className="mt-0.5 text-xs font-semibold text-gray-500">
            External Contractors + External SOW + Tools & Services
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs font-semibold">
          {series.map((s) => (
            <div key={s.key} className="flex items-center gap-2">
              <span className={["inline-block h-3 w-3 rounded", s.className].join(" ")} />
              <span className="text-gray-700">{s.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-3 overflow-x-auto">
        <svg width={width} height={height} className="min-w-[900px]">
          {/* y axis labels (0, 50%, 100%) */}
          {[0, 0.5, 1].map((t) => {
            const v = maxY * t;
            const y = yScale(v);
            return (
              <g key={t}>
                <line x1={padL} x2={width - padR} y1={y} y2={y} stroke="#EEF2F7" />
                <text x={8} y={y + 4} fontSize="10" fill="#6B7280">
                  {fmt(v)}
                </text>
              </g>
            );
          })}

          {/* bars */}
          {months.map((m, i) => {
            const x = padL + i * (barW + barGap);
            let acc = 0;

            return (
              <g key={m}>
                {series.map((s) => {
                  const v = Number(s.valuesByMonth?.[m] ?? 0);
                  const y1 = yScale(acc + v);
                  const y2 = yScale(acc);
                  const h = Math.max(0, y2 - y1);
                  acc += v;

                  return (
                    <rect
                      key={s.key}
                      x={x}
                      y={y1}
                      width={barW}
                      height={h}
                      className={s.className}
                      rx="6"
                    />
                  );
                })}

                <text
                  x={x + barW / 2}
                  y={height - 12}
                  textAnchor="middle"
                  fontSize="10"
                  fill="#6B7280"
                >
                  {m}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

function TwoLineChart({ months, msByMonth, nfByMonth, height = 220 }) {
  const width = 900;
  const padL = 40;
  const padR = 16;
  const padT = 12;
  const padB = 34;

  const plotW = width - padL - padR;
  const plotH = height - padT - padB;

  const maxY = Math.max(
    1,
    ...months.map((m) => Math.max(Number(msByMonth?.[m] ?? 0), Number(nfByMonth?.[m] ?? 0)))
  );

  function xFor(i) {
    if (months.length <= 1) return padL;
    return padL + (i * plotW) / (months.length - 1);
  }

  function yFor(v) {
    return padT + plotH - (Number(v) / maxY) * plotH;
  }

  function pointsFor(map) {
    return months
      .map((m, i) => `${xFor(i)},${yFor(Number(map?.[m] ?? 0))}`)
      .join(" ");
  }

  return (
    <div className="rounded-2xl border bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm font-extrabold text-gray-900">MS vs NF over time</div>
          <div className="mt-0.5 text-xs font-semibold text-gray-500">
            Total MS and total NF by month
          </div>
        </div>

        <div className="flex items-center gap-4 text-xs font-semibold">
          <div className="flex items-center gap-2">
            <span className="inline-block h-3 w-3 rounded bg-gray-900" />
            <span className="text-gray-700">MS</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-block h-3 w-3 rounded bg-gray-400" />
            <span className="text-gray-700">NF</span>
          </div>
        </div>
      </div>

      <div className="mt-3 overflow-x-auto">
        <svg width={width} height={height} className="min-w-[900px]">
          {/* grid */}
          {[0, 0.5, 1].map((t) => {
            const v = maxY * t;
            const y = yFor(v);
            return (
              <g key={t}>
                <line x1={padL} x2={width - padR} y1={y} y2={y} stroke="#EEF2F7" />
                <text x={8} y={y + 4} fontSize="10" fill="#6B7280">
                  {fmt(v)}
                </text>
              </g>
            );
          })}

          {/* lines */}
          <polyline
            points={pointsFor(msByMonth)}
            fill="none"
            stroke="#111827"
            strokeWidth="2.5"
          />
          <polyline
            points={pointsFor(nfByMonth)}
            fill="none"
            stroke="#9CA3AF"
            strokeWidth="2.5"
          />

          {/* dots + month labels */}
          {months.map((m, i) => {
            const x = xFor(i);
            const yMS = yFor(Number(msByMonth?.[m] ?? 0));
            const yNF = yFor(Number(nfByMonth?.[m] ?? 0));
            return (
              <g key={m}>
                <circle cx={x} cy={yMS} r="3.2" fill="#111827" />
                <circle cx={x} cy={yNF} r="3.2" fill="#9CA3AF" />
                <text x={x} y={height - 12} textAnchor="middle" fontSize="10" fill="#6B7280">
                  {m}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

/* -----------------------------
   Main Page
------------------------------ */

export default function TrendsPage({ selectedProgram, onBack }) {
  const programKey = selectedProgram || "connected";

  // Keys (same model as SummaryCards)
  const internalItemsKey = `pfc.${programKey}.internal.labor.items`;
  const contractorsKey = `pfc.${programKey}.external.contractors`;
  const sowKey = `pfc.${programKey}.external.sow`;
  const tnsItemsKey = `pfc.${programKey}.tns.items`;

  // Month range (local to this page)
  const [startIdx, setStartIdx] = useState(0);
  const [endIdx, setEndIdx] = useState(MONTHS.length - 1);

  const normalized = useMemo(() => {
    const s = clamp(Number(startIdx), 0, MONTHS.length - 1);
    const e = clamp(Number(endIdx), 0, MONTHS.length - 1);
    return s <= e ? { s, e } : { s: e, e: s };
  }, [startIdx, endIdx]);

  const visibleMonths = useMemo(
    () => MONTHS.slice(normalized.s, normalized.e + 1),
    [normalized]
  );

  const viewLabel = useMemo(() => {
    if (visibleMonths.length === MONTHS.length) return "Jan–Dec view";
    return `${visibleMonths[0]}–${visibleMonths[visibleMonths.length - 1]} view`;
  }, [visibleMonths]);

  // Pull data live from localStorage (and refresh on app writes)
  const [snapshot, setSnapshot] = useState(() => ({
    internal: loadArray(internalItemsKey),
    contractors: loadArray(contractorsKey),
    sows: loadArray(sowKey),
    tns: loadArray(tnsItemsKey),
  }));

  useEffect(() => {
    function refresh() {
      setSnapshot({
        internal: loadArray(internalItemsKey),
        contractors: loadArray(contractorsKey),
        sows: loadArray(sowKey),
        tns: loadArray(tnsItemsKey),
      });
    }

    // refresh immediately on program change
    refresh();

    window.addEventListener("pfc:storage", refresh);
    window.addEventListener("pfc:autolog", refresh);
    window.addEventListener("storage", refresh); // cross-tab

    return () => {
      window.removeEventListener("pfc:storage", refresh);
      window.removeEventListener("pfc:autolog", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, [internalItemsKey, contractorsKey, sowKey, tnsItemsKey]);

  // Build monthly totals
  const contractorsRoll = useMemo(() => sumByMonth(snapshot.contractors), [snapshot.contractors]);
  const sowRoll = useMemo(() => sumByMonth(snapshot.sows), [snapshot.sows]);
  const tnsRoll = useMemo(() => sumByMonth(snapshot.tns), [snapshot.tns]);

  const byMonth = useMemo(() => {
    const out = Object.fromEntries(MONTHS.map((m) => [m, { ms: 0, nf: 0, total: 0 }]));

    for (const m of MONTHS) {
      const ms =
        Number(contractorsRoll.ms[m] ?? 0) +
        Number(sowRoll.ms[m] ?? 0) +
        Number(tnsRoll.ms[m] ?? 0);
      const nf =
        Number(contractorsRoll.nf[m] ?? 0) +
        Number(sowRoll.nf[m] ?? 0) +
        Number(tnsRoll.nf[m] ?? 0);

      out[m] = { ms, nf, total: ms + nf };
    }
    return out;
  }, [contractorsRoll, sowRoll, tnsRoll]);

  // Selected-month sums
  const sums = useMemo(() => {
    function sumMap(map, months) {
      return months.reduce((acc, m) => acc + Number(map?.[m] ?? 0), 0);
    }

    const months = visibleMonths;

    const contractorsMs = sumMap(contractorsRoll.ms, months);
    const contractorsNf = sumMap(contractorsRoll.nf, months);
    const sowMs = sumMap(sowRoll.ms, months);
    const sowNf = sumMap(sowRoll.nf, months);
    const tnsMs = sumMap(tnsRoll.ms, months);
    const tnsNf = sumMap(tnsRoll.nf, months);

    const extTotal = contractorsMs + contractorsNf + sowMs + sowNf;
    const tnsTotal = tnsMs + tnsNf;
    const msTotal = contractorsMs + sowMs + tnsMs;
    const nfTotal = contractorsNf + sowNf + tnsNf;
    const grandTotal = extTotal + tnsTotal;

    const monthCount = Math.max(1, months.length);
    const runRate = grandTotal / monthCount;

    return {
      contractorsMs,
      contractorsNf,
      sowMs,
      sowNf,
      tnsMs,
      tnsNf,
      extTotal,
      tnsTotal,
      msTotal,
      nfTotal,
      grandTotal,
      runRate,
      monthCount,
    };
  }, [visibleMonths, contractorsRoll, sowRoll, tnsRoll]);

  const internalFteCount = useMemo(() => {
    // keep simple: count entries (your internal logic may differ, but this gives a live number)
    return Array.isArray(snapshot.internal) ? snapshot.internal.length : 0;
  }, [snapshot.internal]);

  // Chart series (stacked by category)
  const stackedSeries = useMemo(() => {
    const contractorsTotalByMonth = Object.fromEntries(
      MONTHS.map((m) => [m, Number(contractorsRoll.ms[m] ?? 0) + Number(contractorsRoll.nf[m] ?? 0)])
    );
    const sowTotalByMonth = Object.fromEntries(
      MONTHS.map((m) => [m, Number(sowRoll.ms[m] ?? 0) + Number(sowRoll.nf[m] ?? 0)])
    );
    const tnsTotalByMonth = Object.fromEntries(
      MONTHS.map((m) => [m, Number(tnsRoll.ms[m] ?? 0) + Number(tnsRoll.nf[m] ?? 0)])
    );

    return [
      { key: "tns", label: "Tools & Services", valuesByMonth: tnsTotalByMonth, className: "fill-purple-400" },
      { key: "contractors", label: "External Contractors", valuesByMonth: contractorsTotalByMonth, className: "fill-green-400" },
      { key: "sow", label: "External SOW", valuesByMonth: sowTotalByMonth, className: "fill-emerald-600" },
    ];
  }, [contractorsRoll, sowRoll, tnsRoll]);

  // Line chart (MS vs NF)
  const msByMonth = useMemo(() => Object.fromEntries(MONTHS.map((m) => [m, byMonth[m].ms])), [byMonth]);
  const nfByMonth = useMemo(() => Object.fromEntries(MONTHS.map((m) => [m, byMonth[m].nf])), [byMonth]);

  // Contributors table
  const contributors = useMemo(() => {
    const rows = [
      { label: "Tools & Services (MS)", total: sums.tnsMs },
      { label: "Tools & Services (NF)", total: sums.tnsNf },
      { label: "External Contractors (MS)", total: sums.contractorsMs },
      { label: "External Contractors (NF)", total: sums.contractorsNf },
      { label: "External SOW (MS)", total: sums.sowMs },
      { label: "External SOW (NF)", total: sums.sowNf },
    ]
      .map((r) => ({
        ...r,
        avgPerMonth: r.total / Math.max(1, sums.monthCount),
        pctOfTotal: sums.grandTotal > 0 ? r.total / sums.grandTotal : 0,
      }))
      .sort((a, b) => b.total - a.total);

    return rows;
  }, [sums]);

  const msShare = sums.grandTotal > 0 ? sums.msTotal / sums.grandTotal : 0;
  const nfShare = sums.grandTotal > 0 ? sums.nfTotal / sums.grandTotal : 0;
  const extShare = sums.grandTotal > 0 ? sums.extTotal / sums.grandTotal : 0;
  const tnsShare = sums.grandTotal > 0 ? sums.tnsTotal / sums.grandTotal : 0;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="px-6 py-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-2xl font-extrabold text-gray-900">Trends</div>
            <div className="mt-1 text-sm font-semibold text-gray-600">
              Program: <span className="font-extrabold text-gray-900">{programKey}</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onBack}
              className="rounded-xl border bg-white px-4 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-100"
            >
              Back
            </button>
          </div>
        </div>

        {/* Month Range */}
        <div className="mt-5 rounded-2xl border bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="text-sm font-extrabold text-gray-900">Month range</div>
              <div className="mt-1 text-xs font-semibold text-gray-500">{viewLabel}</div>
            </div>

            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-3">
                <div className="text-xs font-semibold text-gray-600">Start</div>
                <div className="text-xs font-extrabold text-gray-900">{MONTHS[normalized.s]}</div>
                <input
                  type="range"
                  min={0}
                  max={MONTHS.length - 1}
                  value={normalized.s}
                  onChange={(e) => setStartIdx(Number(e.target.value))}
                  className="w-44"
                />
              </div>

              <div className="flex items-center gap-3">
                <div className="text-xs font-semibold text-gray-600">End</div>
                <div className="text-xs font-extrabold text-gray-900">{MONTHS[normalized.e]}</div>
                <input
                  type="range"
                  min={0}
                  max={MONTHS.length - 1}
                  value={normalized.e}
                  onChange={(e) => setEndIdx(Number(e.target.value))}
                  className="w-44"
                />
              </div>

              <button
                type="button"
                onClick={() => {
                  setStartIdx(0);
                  setEndIdx(MONTHS.length - 1);
                }}
                className="rounded-xl border bg-white px-3 py-2 text-xs font-semibold text-gray-900 hover:bg-gray-100"
              >
                Reset
              </button>

              <div className="text-xs font-semibold text-gray-600">
                Selected months: <span className="font-extrabold text-gray-900">{visibleMonths.length}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Widget 1: KPI cards */}
        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard
            title="Total spend (selected months)"
            value={fmt(sums.grandTotal)}
            sub={`${visibleMonths.length} months • Run rate ${fmt(sums.runRate)}/mo`}
          />
          <StatCard
            title="MS vs NF split"
            value={`${pct(msShare)} MS`}
            sub={`${fmt(sums.msTotal)} MS • ${fmt(sums.nfTotal)} NF`}
          />
          <StatCard
            title="External vs Tools & Services"
            value={`${pct(extShare)} External`}
            sub={`${fmt(sums.extTotal)} External • ${fmt(sums.tnsTotal)} T&S`}
          />
          <StatCard
            title="Internal (FTE entries)"
            value={`${internalFteCount}`}
            sub="Live count from Internal Labor items"
          />
        </div>

        {/* Widget 2: Stacked monthly spend */}
        <div className="mt-6">
          <StackedBars months={visibleMonths} series={stackedSeries} />
        </div>

        {/* Widget 3: MS vs NF line */}
        <div className="mt-6">
          <TwoLineChart months={visibleMonths} msByMonth={msByMonth} nfByMonth={nfByMonth} />
        </div>

        {/* Widget 4: Top contributors table */}
        <div className="mt-6 rounded-2xl border bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-sm font-extrabold text-gray-900">Top contributors</div>
              <div className="mt-0.5 text-xs font-semibold text-gray-500">
                Totals across selected months
              </div>
            </div>
          </div>

          <div className="mt-3 overflow-x-auto">
            <table className="min-w-[760px] w-full text-left">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="px-4 py-3 text-xs font-extrabold text-gray-700">Category</th>
                  <th className="px-4 py-3 text-xs font-extrabold text-gray-700">Total</th>
                  <th className="px-4 py-3 text-xs font-extrabold text-gray-700">Avg / Month</th>
                  <th className="px-4 py-3 text-xs font-extrabold text-gray-700">% of Total</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {contributors.map((r) => (
                  <tr key={r.label}>
                    <td className="px-4 py-3 text-sm font-semibold text-gray-900">{r.label}</td>
                    <td className="px-4 py-3 text-sm font-extrabold text-gray-900">{fmt(r.total)}</td>
                    <td className="px-4 py-3 text-sm font-semibold text-gray-900">{fmt(r.avgPerMonth)}</td>
                    <td className="px-4 py-3 text-sm font-semibold text-gray-700">{pct(r.pctOfTotal)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t bg-gray-50">
                  <td className="px-4 py-3 text-sm font-extrabold text-gray-900">Grand Total</td>
                  <td className="px-4 py-3 text-sm font-extrabold text-gray-900">{fmt(sums.grandTotal)}</td>
                  <td className="px-4 py-3 text-sm font-extrabold text-gray-900">{fmt(sums.runRate)}</td>
                  <td className="px-4 py-3 text-sm font-extrabold text-gray-900">100%</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        <div className="h-10" />
      </div>
    </div>
  );
}