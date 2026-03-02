import { useMemo, useState } from "react";
import { MONTHS } from "../../data/hub";
import { fmt, headCellClass, monthDividerClass } from "../../lib/forecast/format";

function categoryCellClass() {
  return "px-5 py-3 text-sm font-semibold text-gray-900 whitespace-nowrap align-middle";
}

function typeCellClass(isTotal = false) {
  return [
    "px-5 py-2 text-xs font-semibold whitespace-nowrap",
    isTotal ? "text-gray-900" : "text-gray-600",
  ].join(" ");
}

function cellClass(m, isTotal = false) {
  return [
    "px-3 py-2 text-right",
    isTotal ? "text-sm font-bold text-gray-900" : "text-sm font-semibold text-gray-900",
    monthDividerClass(m),
  ].join(" ");
}

function selectedTotalCellClass(isTotal = false) {
  return [
    "px-4 py-2 text-right border-l border-gray-200 bg-slate-50/70",
    isTotal ? "text-sm font-bold text-gray-900" : "text-sm font-semibold text-gray-900",
  ].join(" ");
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

export default function MonthTable({
  title,
  rows,
  showMonthFilter = false,
  executiveSummary = false,
  summaryMetricLabel = "",
  summaryMetricValue = null,
  summaryMetrics = null,
}) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  // Month range selection (0..11)
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
    if (!showMonthFilter) return "Jan–Dec view";
    if (visibleMonths.length === MONTHS.length) return "Jan–Dec view";
    return `${visibleMonths[0]}–${visibleMonths[visibleMonths.length - 1]} view`;
  }, [showMonthFilter, visibleMonths]);

  const summary = useMemo(() => {
    if (!executiveSummary || visibleMonths.length === 0) return null;

    const totalsByMonth = visibleMonths.map((m) => ({
      month: m,
      total: (rows || []).reduce(
        (acc, r) =>
          acc + Number(r.msByMonth?.[m] ?? 0) + Number(r.nfByMonth?.[m] ?? 0),
        0
      ),
    }));

    const selectedTotal = totalsByMonth.reduce((acc, x) => acc + x.total, 0);
    const monthlyAverage = selectedTotal / visibleMonths.length;
    const peakMonth = totalsByMonth.reduce(
      (best, x) => (x.total > best.total ? x : best),
      totalsByMonth[0]
    );
    const lowMonth = totalsByMonth.reduce(
      (best, x) => (x.total < best.total ? x : best),
      totalsByMonth[0]
    );

    return {
      selectedTotal,
      monthlyAverage,
      peakMonth,
      lowMonth,
    };
  }, [executiveSummary, rows, visibleMonths]);

  function sumForMonths(map, months) {
    return months.reduce((acc, m) => acc + Number(map?.[m] ?? 0), 0);
  }

  const normalizedSummaryMetrics = Array.isArray(summaryMetrics) && summaryMetrics.length
    ? summaryMetrics
    : summaryMetricLabel
      ? [{ label: summaryMetricLabel, value: summaryMetricValue ?? 0 }]
      : [];
  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={() => setDetailsOpen((open) => !open)}
        className="w-full border-b border-gray-100 px-5 py-4 text-left transition hover:bg-gray-50/70"
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="text-base font-bold text-gray-900">{title}</div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-700 ring-1 ring-slate-200">
                {viewLabel}
              </span>
              {summary ? (
                <>
                  <span className="rounded-full bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-700 ring-1 ring-gray-200">
                    Total {fmt(summary.selectedTotal)}
                  </span>
                  <span className="rounded-full bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-700 ring-1 ring-gray-200">
                    Avg {fmt(summary.monthlyAverage)}
                  </span>
                  <span className="rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-700 ring-1 ring-emerald-100">
                    Peak {summary.peakMonth.month}
                  </span>
                  <span className="rounded-full bg-amber-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-700 ring-1 ring-amber-100">
                    Low {summary.lowMonth.month}
                  </span>
                </>
              ) : null}
              {normalizedSummaryMetrics.map((metric) => (
                <span
                  key={metric.label}
                  className="rounded-full bg-sky-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-sky-700 ring-1 ring-sky-100"
                >
                  {metric.label} {metric.value ?? 0}
                </span>
              ))}
            </div>
          </div>

          <div className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 ring-1 ring-gray-200 shadow-sm">
            <span>{detailsOpen ? "Hide details" : "Expand view"}</span>
            <span
              className={[
                "transition-transform duration-200",
                detailsOpen ? "rotate-180" : "",
              ].join(" ")}
            >
              ▾
            </span>
          </div>
        </div>
      </button>

      {detailsOpen ? (
        <>
          <div className="px-5 py-3">
            {showMonthFilter ? (
              <div className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-3 py-2">
                <div className="grid grid-cols-1 gap-3 lg:grid-cols-[auto_minmax(180px,1fr)_minmax(180px,1fr)_auto] lg:items-center">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                      Month Range
                    </div>
                    <span className="text-sm font-bold text-gray-900">{viewLabel}</span>
                    <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-gray-600 ring-1 ring-gray-200">
                      {visibleMonths.length} mo
                    </span>
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center justify-between">
                      <div className="text-[11px] font-semibold text-gray-600">Start</div>
                      <div className="text-[11px] font-bold text-gray-900">
                        {MONTHS[normalized.s]}
                      </div>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={MONTHS.length - 1}
                      value={normalized.s}
                      onChange={(e) => setStartIdx(Number(e.target.value))}
                      className="mt-1 w-full"
                    />
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center justify-between">
                      <div className="text-[11px] font-semibold text-gray-600">End</div>
                      <div className="text-[11px] font-bold text-gray-900">
                        {MONTHS[normalized.e]}
                      </div>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={MONTHS.length - 1}
                      value={normalized.e}
                      onChange={(e) => setEndIdx(Number(e.target.value))}
                      className="mt-1 w-full"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setStartIdx(0);
                      setEndIdx(MONTHS.length - 1);
                    }}
                    className="justify-self-start text-xs font-semibold text-gray-700 hover:text-gray-900 lg:justify-self-end"
                  >
                    Reset
                  </button>
                </div>
              </div>
            ) : null}
          </div>

      {summary ? (
        <div
          className="grid gap-3 border-t border-gray-100 px-5 py-3"
          style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}
        >
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
              Selected Total
            </div>
            <div className="mt-1 text-lg font-extrabold text-gray-900">
              {fmt(summary.selectedTotal)}
            </div>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white px-4 py-3">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
              Monthly Average
            </div>
            <div className="mt-1 text-lg font-extrabold text-gray-900">
              {fmt(summary.monthlyAverage)}
            </div>
          </div>
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 px-4 py-3">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
              Peak Month
            </div>
            <div className="mt-1 text-sm font-semibold text-gray-900">
              {summary.peakMonth.month}
            </div>
            <div className="mt-1 text-base font-extrabold text-gray-900">
              {fmt(summary.peakMonth.total)}
            </div>
          </div>
          <div className="rounded-2xl border border-amber-100 bg-amber-50/60 px-4 py-3">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
              Lowest Month
            </div>
            <div className="mt-1 text-sm font-semibold text-gray-900">
              {summary.lowMonth.month}
            </div>
            <div className="mt-1 text-base font-extrabold text-gray-900">
              {fmt(summary.lowMonth.total)}
            </div>
          </div>
          {normalizedSummaryMetrics.map((metric) => (
            <div
              key={metric.label}
              className="rounded-2xl border border-sky-100 bg-sky-50/60 px-4 py-3"
            >
              <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                {metric.label}
              </div>
              <div className="mt-1 text-lg font-extrabold text-gray-900">
                {metric.value ?? 0}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      <div className="overflow-x-auto">
        <table className="min-w-[1180px] w-full border-t border-gray-200">
          <thead className="bg-white">
            <tr className="text-xs text-gray-600">
              <th className="px-5 py-3 text-left font-semibold">Category</th>
              <th className="px-5 py-3 text-left font-semibold">Type</th>

              {visibleMonths.map((m) => (
                <th key={m} className={headCellClass(m)}>
                  {m}
                </th>
              ))}

              <th className="px-4 py-3 text-right font-semibold border-l border-gray-200 bg-slate-50/70">
                {showMonthFilter ? "Selected Total" : "Year"}
              </th>
            </tr>
          </thead>

          <tbody>
            {rows.map((r) => {
              const msSelected = sumForMonths(r.msByMonth, visibleMonths);
              const nfSelected = sumForMonths(r.nfByMonth, visibleMonths);
              const totalSelected = msSelected + nfSelected;

              return (
                <>
                  {/* MS Row */}
                  <tr className="border-t border-gray-100">
                    <td className={categoryCellClass()} rowSpan={3}>
                      {r.label}
                    </td>
                    <td className={typeCellClass(false)}>MS</td>

                    {visibleMonths.map((m) => (
                      <td key={`ms-${r.label}-${m}`} className={cellClass(m, false)}>
                        {fmt(r.msByMonth?.[m])}
                      </td>
                    ))}

                    <td className={selectedTotalCellClass(false)}>
                      {fmt(msSelected)}
                    </td>
                  </tr>

                  {/* NF Row */}
                  <tr className="border-t border-gray-100 bg-gray-50/20">
                    <td className={typeCellClass(false)}>NF</td>

                    {visibleMonths.map((m) => (
                      <td key={`nf-${r.label}-${m}`} className={cellClass(m, false)}>
                        {fmt(r.nfByMonth?.[m])}
                      </td>
                    ))}

                    <td className={selectedTotalCellClass(false)}>
                      {fmt(nfSelected)}
                    </td>
                  </tr>

                  {/* Total Row */}
                  <tr className="border-t border-gray-200 bg-slate-50/40">
                    <td className={typeCellClass(true)}>Total</td>

                    {visibleMonths.map((m, idx) => {
                      const ms = r.msByMonth?.[m];
                      const nf = r.nfByMonth?.[m];
                      const total =
                        ms === undefined && nf === undefined
                          ? undefined
                          : Number(ms ?? 0) + Number(nf ?? 0);
                      const prevMonth = idx > 0 ? visibleMonths[idx - 1] : null;
                      const prevTotal =
                        prevMonth == null
                          ? undefined
                          : Number(r.msByMonth?.[prevMonth] ?? 0) +
                            Number(r.nfByMonth?.[prevMonth] ?? 0);
                      const trend =
                        idx === 0 || total === undefined || prevTotal === undefined
                          ? null
                          : total > prevTotal
                            ? "up"
                            : total < prevTotal
                              ? "down"
                              : "flat";

                      return (
                        <td key={`total-${r.label}-${m}`} className={cellClass(m, true)}>
                          {total === undefined ? (
                            "$—"
                          ) : (
                            <div className="flex items-center justify-end gap-1">
                              <span>{fmt(total)}</span>
                              {trend ? (
                                <span
                                  className={[
                                    "inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-bold",
                                    trend === "up"
                                      ? "bg-emerald-100 text-emerald-700"
                                      : trend === "down"
                                        ? "bg-rose-100 text-rose-700"
                                        : "bg-gray-100 text-gray-600",
                                  ].join(" ")}
                                >
                                  {trend === "up" ? "↑" : trend === "down" ? "↓" : "•"}
                                </span>
                              ) : null}
                            </div>
                          )}
                        </td>
                      );
                    })}

                    <td className={selectedTotalCellClass(true)}>
                      {fmt(totalSelected)}
                    </td>
                  </tr>
                </>
              );
            })}
          </tbody>
        </table>
      </div>
        </>
      ) : null}
    </div>
  );
}
