import { MONTHS } from "../../data/hub";
import { fmt, headCellClass, monthDividerClass } from "../../lib/forecast/format";

export default function RollupTable({ title, msByMonth, nfByMonth }) {
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