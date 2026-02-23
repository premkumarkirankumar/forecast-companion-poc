import { MONTHS } from "../../data/hub";
import { bodyCellClass, fmt, headCellClass } from "../../lib/forecast/format";

export default function MonthTable({ title, rows }) {
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