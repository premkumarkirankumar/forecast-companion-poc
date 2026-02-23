import { useEffect, useMemo, useState } from "react";
import { MONTHS } from "../data/hub";

function fmtCompact(n) {
  const v = Number(n) || 0;
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${Math.round(v / 1_000)}K`;
  return `$${Math.round(v)}`;
}

function getProgramKey(selectedProgram) {
  return selectedProgram || "default";
}

function safeParse(json, fallback) {
  try {
    const x = JSON.parse(json);
    return x ?? fallback;
  } catch {
    return fallback;
  }
}

function computeRollup(contractors) {
  const ms = Object.fromEntries(MONTHS.map((m) => [m, 0]));
  const nf = Object.fromEntries(MONTHS.map((m) => [m, 0]));

  for (const c of contractors || []) {
    for (const m of MONTHS) {
      ms[m] += Number(c?.msByMonth?.[m] ?? 0);
      nf[m] += Number(c?.nfByMonth?.[m] ?? 0);
    }
  }

  const total = Object.fromEntries(
    MONTHS.map((m) => [m, (ms[m] ?? 0) + (nf[m] ?? 0)])
  );

  return { ms, nf, total };
}

export default function ChartPlaceholder({ selectedProgram }) {
  const programKey = getProgramKey(selectedProgram);
  const storageKey = `pfc.${programKey}.contractors`;

  const [contractors, setContractors] = useState([]);

  // Load from localStorage (and update if localStorage changes)
  useEffect(() => {
    const load = () => {
      const raw = localStorage.getItem(storageKey);
      const data = safeParse(raw || "[]", []);
      setContractors(Array.isArray(data) ? data : []);
    };

    load();

    // Listen for storage changes (works if another tab changes it)
    const onStorage = (e) => {
      if (e.key === storageKey) load();
    };
    window.addEventListener("storage", onStorage);

    return () => window.removeEventListener("storage", onStorage);
  }, [storageKey]);

  const rollup = useMemo(() => computeRollup(contractors), [contractors]);

  const maxTotal = useMemo(() => {
    return Math.max(1, ...MONTHS.map((m) => rollup.total[m] || 0));
  }, [rollup]);

  const yearMS = useMemo(
    () => MONTHS.reduce((a, m) => a + (rollup.ms[m] || 0), 0),
    [rollup]
  );
  const yearNF = useMemo(
    () => MONTHS.reduce((a, m) => a + (rollup.nf[m] || 0), 0),
    [rollup]
  );
  const yearTotal = yearMS + yearNF;

  return (
    <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-gray-900">
            External Contractors Trend (MS + NF)
          </div>
          <div className="mt-1 text-xs text-gray-600">
            Reads from saved data: <span className="font-mono">{storageKey}</span>
          </div>
        </div>

        <div className="rounded-xl bg-gray-50 px-3 py-2 ring-1 ring-gray-100">
          <div className="text-xs text-gray-600">Year Total</div>
          <div className="text-sm font-semibold text-gray-900">
            {fmtCompact(yearTotal)}{" "}
            <span className="text-xs text-gray-500">
              (MS {fmtCompact(yearMS)} / NF {fmtCompact(yearNF)})
            </span>
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="mt-5 overflow-x-auto">
        <div className="min-w-[1200px]">
          {/* Y-axis guides */}
          <div className="relative h-[280px] rounded-2xl bg-gray-50 ring-1 ring-gray-100">
            {/* grid lines */}
            <div className="absolute inset-0 flex flex-col justify-between p-4">
              {[1, 0.75, 0.5, 0.25, 0].map((t) => (
                <div key={t} className="flex items-center gap-3">
                  <div className="w-16 text-xs text-gray-500 tabular-nums">
                    {fmtCompact(maxTotal * t)}
                  </div>
                  <div className="h-px flex-1 bg-gray-200" />
                </div>
              ))}
            </div>

            {/* bars */}
            <div className="absolute inset-0 flex items-end gap-2 px-6 pb-6 pt-10">
              {MONTHS.map((m) => {
                const ms = rollup.ms[m] || 0;
                const nf = rollup.nf[m] || 0;
                const total = ms + nf;

                const totalPct = Math.max(0, Math.min(100, (total / maxTotal) * 100));
                const msPctOfTotal = total === 0 ? 0 : (ms / total) * 100;
                const nfPctOfTotal = total === 0 ? 0 : (nf / total) * 100;

                const isQuarter = m === "Apr" || m === "Jul" || m === "Oct";

                return (
                  <div key={m} className="flex w-[78px] flex-col items-center">
                    <div
                      className={[
                        "relative w-full rounded-xl bg-white ring-1 ring-gray-200",
                        isQuarter ? "ring-2 ring-gray-300" : "",
                      ].join(" ")}
                      style={{ height: `${totalPct}%` }}
                      title={`${m}: MS ${Math.round(ms)} / NF ${Math.round(nf)} / Total ${Math.round(total)}`}
                    >
                      {/* stacked fill */}
                      <div
                        className="absolute bottom-0 left-0 right-0 rounded-b-xl bg-blue-500/40"
                        style={{ height: `${msPctOfTotal}%` }}
                      />
                      <div
                        className="absolute left-0 right-0 bg-purple-500/35"
                        style={{ bottom: `${msPctOfTotal}%`, height: `${nfPctOfTotal}%` }}
                      />

                      {/* total label */}
                      {total > 0 ? (
                        <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-[11px] font-semibold text-gray-700 tabular-nums">
                          {fmtCompact(total)}
                        </div>
                      ) : null}
                    </div>

                    <div className="mt-2 text-xs font-medium text-gray-700">{m}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* legend */}
          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-gray-600">
            <div className="flex items-center gap-2">
              <span className="inline-block h-3 w-3 rounded bg-blue-500/40 ring-1 ring-gray-200" />
              MS
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-block h-3 w-3 rounded bg-purple-500/35 ring-1 ring-gray-200" />
              NF
            </div>
            <div className="text-xs text-gray-500">
              Quarter markers: Apr / Jul / Oct highlighted border
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}