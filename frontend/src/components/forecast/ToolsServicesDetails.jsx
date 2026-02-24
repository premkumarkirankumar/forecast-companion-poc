import { useMemo, useState } from "react";

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function fmtMoney(n) {
  const v = Number(n || 0);
  return v.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function sum(arr) {
  return (arr || []).reduce((a, b) => a + Number(b || 0), 0);
}

function clampMoneyInput(raw) {
  // allow empty while typing
  if (raw === "") return "";
  const cleaned = String(raw).replace(/[^\d]/g, "");
  return cleaned === "" ? "" : Number(cleaned);
}

/**
 * item shape expected:
 * {
 *   id: string,
 *   name: string,
 *   yearTarget: number,
 *   months: { ms: number[12], nf: number[12] }  // nf kept but forced to 0 in UI
 *   isExpanded?: boolean
 * }
 */
export default function ToolsServicesDetails({
  items,
  onUpdateItem,
  onRemoveItem,
}) {
  return (
    <div className="space-y-4">
      {items.map((item) => (
        <ToolsServiceCard
          key={item.id}
          item={item}
          onUpdateItem={onUpdateItem}
          onRemoveItem={onRemoveItem}
        />
      ))}
    </div>
  );
}

function ToolsServiceCard({ item, onUpdateItem, onRemoveItem }) {
  const [expanded, setExpanded] = useState(Boolean(item.isExpanded));

  const msMonths = item.months?.ms || Array(12).fill(0);
  const nfMonths = Array(12).fill(0); // forced 0

  const msYear = useMemo(() => sum(msMonths), [msMonths]);
  const nfYear = 0;
  const totalYear = msYear;

  const monthlyTotals = useMemo(() => {
    return MONTHS.map((_, i) => Number(msMonths[i] || 0) + 0);
  }, [msMonths]);

  function setName(v) {
    onUpdateItem({ ...item, name: v });
  }

  function setYearTarget(v) {
    onUpdateItem({ ...item, yearTarget: Number(v || 0) });
  }

  function setMsMonth(idx, v) {
    const next = [...msMonths];
    next[idx] = Number(v || 0);
    onUpdateItem({ ...item, months: { ms: next, nf: nfMonths } });
  }

  function autoFillFromYearTarget() {
    const y = Number(item.yearTarget || 0);
    const perMonth = Math.floor(y / 12);
    const remainder = y - perMonth * 12;

    const next = Array(12).fill(perMonth);
    for (let i = 0; i < remainder; i++) next[i] += 1;

    onUpdateItem({ ...item, months: { ms: next, nf: nfMonths } });
  }

  return (
    <div className="rounded-2xl border bg-white overflow-hidden">
      {/* Header (Hide mode summary) */}
      <div className="px-6 py-5 bg-emerald-50/40 border-b">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-sm text-gray-500">Tool / Service Name</div>
            <div className="text-2xl font-semibold">{item.name || "Untitled"}</div>
            <div className="text-sm text-gray-600 mt-1">
              Year Target: {fmtMoney(item.yearTarget || 0)} · Split <span className="font-semibold text-blue-600">MS 100%</span> / NF 0%
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="px-4 py-2 rounded-2xl border bg-emerald-50">
              <div className="text-sm text-gray-600">Total (calc)</div>
              <div className="text-xl font-semibold">{fmtMoney(totalYear)}</div>
            </div>

            <button
              onClick={() => setExpanded((v) => !v)}
              className="px-4 py-2 rounded-xl border bg-white hover:bg-gray-50"
            >
              {expanded ? "Hide" : "Show"}
            </button>

            <button
              onClick={() => onRemoveItem(item.id)}
              className="px-4 py-2 rounded-xl border bg-white hover:bg-gray-50"
            >
              Remove
            </button>
          </div>
        </div>
      </div>

      {/* Expanded */}
      {expanded && (
        <div className="p-6">
          {/* Top editable row like SOW expanded */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 items-end">
            <div className="lg:col-span-2">
              <div className="text-xs font-semibold text-gray-600 mb-1">
                Tool / Service Name (editable)
              </div>
              <input
                value={item.name || ""}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-3 rounded-2xl border"
              />
            </div>

            <div>
              <div className="text-xs font-semibold text-gray-600 mb-1">
                Year Target (editable)
              </div>
              <input
                value={String(item.yearTarget ?? 0)}
                onChange={(e) => setYearTarget(clampMoneyInput(e.target.value))}
                className="w-full px-4 py-3 rounded-2xl border"
              />
            </div>

            <div className="rounded-2xl border bg-gray-50 px-4 py-3">
              <div className="text-xs font-semibold text-gray-600">Total (calc)</div>
              <div className="text-2xl font-semibold">{fmtMoney(totalYear)}</div>
            </div>
          </div>

          <div className="mt-3">
            <button
              onClick={autoFillFromYearTarget}
              className="px-4 py-2 rounded-xl border bg-white hover:bg-gray-50"
            >
              Auto-fill months from Year Target
            </button>
          </div>

          {/* Month grid like SOW */}
          <div className="mt-6 overflow-x-auto">
            <table className="min-w-[1100px] w-full border-separate border-spacing-0">
              <thead>
                <tr className="text-left text-sm text-gray-600">
                  <th className="sticky left-0 bg-white z-10 px-3 py-3 border-b w-[160px]">Month</th>
                  {MONTHS.map((m) => (
                    <th key={m} className="px-3 py-3 border-b text-center">{m}</th>
                  ))}
                  <th className="px-3 py-3 border-b text-center">Year</th>
                </tr>
              </thead>

              <tbody>
                {/* MS editable */}
                <tr>
                  <td className="sticky left-0 bg-white z-10 px-3 py-4 border-b">
                    <div className="font-semibold">MS</div>
                    <div className="text-gray-500 text-sm">(editable)</div>
                  </td>
                  {MONTHS.map((_, idx) => (
                    <td key={idx} className="px-3 py-4 border-b">
                      <input
                        value={String(msMonths[idx] ?? 0)}
                        onChange={(e) => setMsMonth(idx, clampMoneyInput(e.target.value))}
                        className="w-full text-center px-3 py-2 rounded-2xl border"
                      />
                    </td>
                  ))}
                  <td className="px-3 py-4 border-b text-center font-semibold">
                    {fmtMoney(msYear)}
                  </td>
                </tr>

                {/* NF fixed */}
                <tr>
                  <td className="sticky left-0 bg-white z-10 px-3 py-4 border-b">
                    <div className="font-semibold">NF</div>
                    <div className="text-gray-500 text-sm">(fixed)</div>
                  </td>
                  {MONTHS.map((_, idx) => (
                    <td key={idx} className="px-3 py-4 border-b text-center text-gray-500 font-semibold">
                      {fmtMoney(0)}
                    </td>
                  ))}
                  <td className="px-3 py-4 border-b text-center font-semibold text-gray-500">
                    {fmtMoney(nfYear)}
                  </td>
                </tr>

                {/* Total calc */}
                <tr>
                  <td className="sticky left-0 bg-white z-10 px-3 py-4">
                    <div className="font-semibold">Total</div>
                    <div className="text-gray-500 text-sm">(calc)</div>
                  </td>
                  {monthlyTotals.map((t, idx) => (
                    <td key={idx} className="px-3 py-4 text-center font-semibold">
                      {fmtMoney(t)}
                    </td>
                  ))}
                  <td className="px-3 py-4 text-center font-semibold">
                    {fmtMoney(totalYear)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="mt-4 text-xs text-gray-500">
            Note: For Tools & Services, MS is treated as 100% and NF is always 0.
          </div>
        </div>
      )}
    </div>
  );
}