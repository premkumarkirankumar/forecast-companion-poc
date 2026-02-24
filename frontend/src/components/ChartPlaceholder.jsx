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

  // ✅ MUST match where contractors are saved in forecast/SummaryCards.jsx
  const storageKey = `pfc.${programKey}.external.contractors`;

  const [contractors, setContractors] = useState([]);
  const [viewMode, setViewMode] = useState("total"); // total | ms | nf | stacked

  // Load from localStorage + listen for both:
  // - "storage" (other tabs)
  // - "pfc:storage" (same tab writes; we'll dispatch this from SummaryCards)
  useEffect(() => {
    const load = () => {
      const raw = localStorage.getItem(storageKey);
      const data = safeParse(raw || "[]", []);
      setContractors(Array.isArray(data) ? data : []);
    };

    load();

    const onStorage = (e) => {
      if (e.key === storageKey) load();
    };

    const onPfcStorage = (e) => {
      if (e?.detail?.key === storageKey) load();
    };

    window.addEventListener("storage", onStorage);
    window.addEventListener("pfc:storage", onPfcStorage);

    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("pfc:storage", onPfcStorage);
    };
  }, [storageKey]);

  const rollup = useMemo(() => computeRollup(contractors), [contractors]);

  const maxY = useMemo(() => {
    const values =
      viewMode === "ms"
        ? MONTHS.map((m) => rollup.ms[m] || 0)
        : viewMode === "nf"
        ? MONTHS.map((m) => rollup.nf[m] || 0)
        : MONTHS.map((m) => rollup.total[m] || 0);

    return Math.max(1, ...values);
  }, [rollup, viewMode]);

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
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-lg font-bold text-gray-900">
            External Contractors Trend
          </div>
          <div className="mt-1 text-sm text-gray-600">
            Reads from saved data:{" "}
            <span className="font-mono text-xs">{storageKey}</span>
          </div>
          <div className="mt-2 text-sm font-semibold text-gray-900">
            Year Total: {fmtCompact(yearTotal)}{" "}
            <span className="font-normal text-gray-600">
              (MS {fmtCompact(yearMS)} / NF {fmtCompact(yearNF)})
            </span>
          </div>
        </div>

        {/* ✅ Dropdown */}
        <div className="flex flex-col items-end gap-2">
          <label className="text-xs font-semibold text-gray-700">
            View
          </label>
          <select
            value={viewMode}
            onChange={(e) => setViewMode(e.target.value)}
            className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-900"
          >
            <option value="total">Total (MS + NF)</option>
            <option value="ms">MS only</option>
            <option value="nf">NF only</option>
            <option value="stacked">Stacked (MS + NF)</option>
          </select>
        </div>
      </div>

      {/* Chart */}
      <div className="mt-5 grid grid-cols-12 gap-2">
        {/* Y-axis guides */}
        <div className="col-span-12 relative h-48 rounded-2xl border border-gray-100 bg-gray-50/50 p-3">
          {/* grid lines + labels */}
          {[1, 0.75, 0.5, 0.25, 0].map((t) => (
            <div
              key={t}
              className="absolute left-3 right-3 flex items-center justify-between"
              style={{ top: `${(1 - t) * 100}%` }}
            >
              <div className="text-[10px] font-semibold text-gray-500">
                {fmtCompact(maxY * t)}
              </div>
              <div className="h-px flex-1 bg-gray-200/60 ml-2" />
            </div>
          ))}

          {/* bars */}
          <div className="absolute inset-3 flex items-end justify-between gap-2">
            {MONTHS.map((m) => {
              const ms = rollup.ms[m] || 0;
              const nf = rollup.nf[m] || 0;
              const total = ms + nf;

              const isQuarter = m === "Apr" || m === "Jul" || m === "Oct";

              // bar heights based on view
              const totalPct = Math.max(0, Math.min(100, (total / maxY) * 100));
              const msPct = Math.max(0, Math.min(100, (ms / maxY) * 100));
              const nfPct = Math.max(0, Math.min(100, (nf / maxY) * 100));

              return (
                <div key={m} className="flex-1 flex flex-col items-center">
                  <div
                    className={[
                      "w-full rounded-xl border",
                      isQuarter ? "border-gray-300" : "border-gray-200",
                      "bg-white",
                      "overflow-hidden",
                      "relative",
                      "h-40",
                    ].join(" ")}
                  >
                    {viewMode === "stacked" ? (
                      <>
                        <div
                          className="absolute bottom-0 left-0 right-0 bg-blue-600/70"
                          style={{
                            height: `${total === 0 ? 0 : (ms / total) * totalPct}%`,
                          }}
                          title={`MS ${fmtCompact(ms)}`}
                        />
                        <div
                          className="absolute bottom-0 left-0 right-0 bg-emerald-600/70"
                          style={{
                            height: `${total === 0 ? 0 : (nf / total) * totalPct}%`,
                            transform: `translateY(-${
                              total === 0 ? 0 : (ms / total) * totalPct
                            }%)`,
                          }}
                          title={`NF ${fmtCompact(nf)}`}
                        />
                      </>
                    ) : (
                      <div
                        className="absolute bottom-0 left-0 right-0 bg-gray-900/70"
                        style={{
                          height:
                            viewMode === "ms"
                              ? `${msPct}%`
                              : viewMode === "nf"
                              ? `${nfPct}%`
                              : `${totalPct}%`,
                        }}
                        title={
                          viewMode === "ms"
                            ? `MS ${fmtCompact(ms)}`
                            : viewMode === "nf"
                            ? `NF ${fmtCompact(nf)}`
                            : `Total ${fmtCompact(total)}`
                        }
                      />
                    )}

                    {/* top label */}
                    <div className="absolute top-1 left-0 right-0 text-center text-[10px] font-bold text-gray-700">
                      {total > 0 ? fmtCompact(total) : ""}
                    </div>
                  </div>

                  <div className="mt-2 text-xs font-semibold text-gray-700">
                    {m}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="mt-4 text-xs text-gray-600">
        <div className="font-semibold text-gray-800">Legend</div>
        <div>
          <span className="font-semibold">MS</span> = MarketSource,{" "}
          <span className="font-semibold">NF</span> = Non-Fusion
        </div>
      </div>
    </div>
  );
}