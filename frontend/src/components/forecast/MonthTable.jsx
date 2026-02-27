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

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

export default function MonthTable({ title, rows, showMonthFilter = false }) {
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

  function sumForMonths(map, months) {
    return months.reduce((acc, m) => acc + Number(map?.[m] ?? 0), 0);
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-4">
        <div className="text-base font-bold text-gray-900">{title}</div>

        <div className="flex flex-wrap items-center justify-end gap-4">
          {/* ✅ Month Filter (optional) */}
          {showMonthFilter ? (
            <div className="flex flex-col gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2">
              <div className="flex items-center justify-between gap-4">
                <div className="text-xs font-semibold text-gray-700">Month range</div>
                <div className="text-xs font-bold text-gray-900">{viewLabel}</div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* Start */}
                <div>
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
                    className="w-44"
                  />
                </div>

                {/* End */}
                <div>
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
                    className="w-44"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setStartIdx(0);
                    setEndIdx(MONTHS.length - 1);
                  }}
                  className="text-xs font-semibold text-gray-700 hover:text-gray-900"
                >
                  Reset
                </button>

                <div className="text-[11px] font-semibold text-gray-500">
                  Selected months:{" "}
                  <span className="font-bold text-gray-800">{visibleMonths.length}</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-sm font-semibold text-gray-500">{viewLabel}</div>
          )}
        </div>
      </div>

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

              <th className="px-4 py-3 text-right font-semibold border-l border-gray-200">
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

                    <td className="px-4 py-2 text-right text-sm font-semibold border-l border-gray-200">
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

                    <td className="px-4 py-2 text-right text-sm font-semibold border-l border-gray-200">
                      {fmt(nfSelected)}
                    </td>
                  </tr>

                  {/* Total Row */}
                  <tr className="border-t border-gray-200">
                    <td className={typeCellClass(true)}>Total</td>

                    {visibleMonths.map((m) => {
                      const ms = r.msByMonth?.[m];
                      const nf = r.nfByMonth?.[m];
                      const total =
                        ms === undefined && nf === undefined
                          ? undefined
                          : Number(ms ?? 0) + Number(nf ?? 0);

                      return (
                        <td key={`total-${r.label}-${m}`} className={cellClass(m, true)}>
                          {total === undefined ? "$—" : fmt(total)}
                        </td>
                      );
                    })}

                    <td className="px-4 py-2 text-right text-sm font-bold border-l border-gray-200">
                      {fmt(totalSelected)}
                    </td>
                  </tr>
                </>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}