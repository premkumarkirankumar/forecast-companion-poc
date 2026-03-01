// frontend/src/components/forecast/TrendsPage.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { loadProgramState } from "../../data/firestorePrograms";
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

function loadBudgetMap(key) {
  const fallback = Object.fromEntries(MONTHS.map((m) => [m, 0]));
  const v = safeJsonParse(localStorage.getItem(key), fallback);
  if (!v || typeof v !== "object") return fallback;

  const out = { ...fallback };
  for (const m of MONTHS) out[m] = Number(v?.[m] ?? 0);
  return out;
}

function emptyBudgetMap() {
  return Object.fromEntries(MONTHS.map((m) => [m, 0]));
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
      {sub ? (
        <div className="mt-1 text-xs font-semibold text-gray-500">{sub}</div>
      ) : null}
    </div>
  );
}

function InsightCard({ title, sub, items, whyDetails }) {
  const [showWhy, setShowWhy] = useState(false);

  return (
    <div className="rounded-2xl border bg-white p-4 shadow-sm">
      {/* Header row (title/sub + button) */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-extrabold text-gray-900">{title}</div>
          {sub ? (
            <div className="mt-0.5 text-xs font-semibold text-gray-500">
              {sub}
            </div>
          ) : null}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            className="rounded-xl border bg-white px-3 py-1.5 text-xs font-semibold text-gray-900 hover:bg-gray-100"
            onClick={() => setShowWhy((v) => !v)}
          >
            {showWhy ? "Hide details" : "Why?"}
          </button>
        </div>
      </div>

      {/* Body (unchanged) */}
      <div className="mt-2 space-y-2">
        {(items || []).length ? (
          items.map((t, idx) => (
            <div key={idx} className="rounded-xl bg-gray-50 px-3 py-2 text-sm">
              <span className="font-semibold text-gray-900">{t}</span>
            </div>
          ))
        ) : (
          <div className="text-sm font-semibold text-gray-500">
            No significant month-over-month change detected.
          </div>
        )}

        {/* Why details (toggle) */}
        {showWhy && (whyDetails || []).length ? (
          <div className="mt-3 rounded-xl border bg-white p-3">
            <div className="text-xs font-extrabold text-gray-900">Details</div>
            <div className="mt-2 space-y-1">
              {whyDetails.map((t, idx) => (
                <div key={idx} className="text-xs font-semibold text-gray-700">
                  • {t}
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

/* -----------------------------
   SVG Charts (no deps)
------------------------------ */

function StackedBars({
  months,
  series, // [{ key, label, valuesByMonth, className, swatchClassName }]
  height = 220,
}) {
  const containerRef = useRef(null);

  const totals = months.map((m) =>
    series.reduce((acc, s) => acc + Number(s.valuesByMonth?.[m] ?? 0), 0)
  );
  const maxY = Math.max(1, ...totals);

  // basic sizing
  const width = 900;
  const padL = 72; // more left padding to prevent overlap
  const padR = 16;
  const padT = 18; // headroom for totals
  const padB = 34;

  const plotW = width - padL - padR;
  const plotH = height - padT - padB;

  const barGap = 8;
  const barW = Math.max(
    10,
    (plotW - barGap * (months.length - 1)) / months.length
  );

  function yScale(v) {
    return padT + plotH - (Number(v) / maxY) * plotH;
  }

  // UI-only tooltip
  const [hover, setHover] = useState(null);
  // hover = { month, x, y, total, parts: [{label,value}] }

  function clearHover() {
    setHover(null);
  }

  function updateHoverPosition(e, month) {
    const el = containerRef.current;
    if (!el) return;

    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const parts = series.map((s) => ({
      key: s.key,
      label: s.label,
      value: Number(s.valuesByMonth?.[month] ?? 0),
      swatchClassName: s.swatchClassName,
    }));

    const total = parts.reduce((a, p) => a + Number(p.value ?? 0), 0);

    setHover({ month, x, y, total, parts });
  }

  return (
    <div className="rounded-2xl border bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm font-extrabold text-gray-900">
            Monthly total spend (stacked)
          </div>
          <div className="mt-0.5 text-xs font-semibold text-gray-500">
            External Contractors + External SOW + Tools & Services
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs font-semibold">
          {series.map((s) => (
            <div key={s.key} className="flex items-center gap-2">
              <span
                className={[
                  "inline-block h-3 w-3 rounded",
                  s.swatchClassName || "bg-gray-300",
                ].join(" ")}
              />
              <span className="text-gray-700">{s.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div
        ref={containerRef}
        className="relative mt-3 overflow-x-auto"
        onMouseLeave={clearHover}
      >
        {hover ? (
          <div
            className="pointer-events-none absolute z-10 w-64 rounded-xl border bg-white p-3 text-xs shadow-lg"
            style={{
              left: Math.min(
                Math.max(8, hover.x + 12),
                (containerRef.current?.clientWidth || 0) - 268
              ),
              top: Math.max(8, hover.y + 12),
            }}
          >
            <div className="flex items-center justify-between">
              <div className="font-extrabold text-gray-900">{hover.month}</div>
              <div className="font-extrabold text-gray-900">
                {fmt(hover.total)}
              </div>
            </div>
            <div className="mt-2 space-y-1">
              {hover.parts.map((p) => (
                <div key={p.key} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className={[
                        "inline-block h-2.5 w-2.5 rounded",
                        p.swatchClassName || "bg-gray-300",
                      ].join(" ")}
                    />
                    <span className="font-semibold text-gray-700">
                      {p.label}
                    </span>
                  </div>
                  <span className="font-extrabold text-gray-900">
                    {fmt(p.value)}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-2 border-t pt-2 text-[11px] font-semibold text-gray-500">
              Hover over bars to see breakdown
            </div>
          </div>
        ) : null}

        <svg
          width={width}
          height={height}
          className="min-w-[900px]"
          onMouseLeave={clearHover}
        >
          {[0, 0.5, 1].map((t) => {
            const v = maxY * t;
            const y = yScale(v);
            return (
              <g key={t}>
                <line
                  x1={padL}
                  x2={width - padR}
                  y1={y}
                  y2={y}
                  stroke="#EEF2F7"
                />
                <text x={8} y={y + 4} fontSize="10" fill="#6B7280">
                  {fmt(v)}
                </text>
              </g>
            );
          })}

          {months.map((m, i) => {
            const x = padL + i * (barW + barGap);
            let acc = 0;
            const total = totals[i];
            const yTop = yScale(total);

            return (
              <g
                key={m}
                onMouseEnter={(e) => updateHoverPosition(e, m)}
                onMouseMove={(e) => updateHoverPosition(e, m)}
              >
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
                      style={{ cursor: "pointer" }}
                    />
                  );
                })}

                {total > 0 ? (
                  <text
                    x={x + barW / 2}
                    y={Math.max(12, yTop - 8)}
                    textAnchor="middle"
                    fontSize="10"
                    fill="#111827"
                    fontWeight="700"
                  >
                    {fmt(total)}
                  </text>
                ) : null}

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
  const padL = 72; // more left padding to prevent overlap
  const padR = 16;
  const padT = 12;
  const padB = 34;

  const plotW = width - padL - padR;
  const plotH = height - padT - padB;

  const maxY = Math.max(
    1,
    ...months.map((m) =>
      Math.max(
        Number(msByMonth?.[m] ?? 0),
        Number(nfByMonth?.[m] ?? 0)
      )
    )
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
          <div className="text-sm font-extrabold text-gray-900">
            MS vs NF over time
          </div>
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
          {[0, 0.5, 1].map((t) => {
            const v = maxY * t;
            const y = yFor(v);
            return (
              <g key={t}>
                <line
                  x1={padL}
                  x2={width - padR}
                  y1={y}
                  y2={y}
                  stroke="#EEF2F7"
                />
                <text x={8} y={y + 4} fontSize="10" fill="#6B7280">
                  {fmt(v)}
                </text>
              </g>
            );
          })}

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

          {months.map((m, i) => {
            const x = xFor(i);
            const yMS = yFor(Number(msByMonth?.[m] ?? 0));
            const yNF = yFor(Number(nfByMonth?.[m] ?? 0));
            return (
              <g key={m}>
                <circle cx={x} cy={yMS} r="3.2" fill="#111827" />
                <circle cx={x} cy={yNF} r="3.2" fill="#9CA3AF" />
                <text
                  x={x}
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

function SpendMomentumChart({
  months,
  dTotalByMonth,
  dMsByMonth,
  dNfByMonth,
  height = 220,
}) {
  const width = 900;
  const padL = 72;
  const padR = 16;
  const padT = 12;
  const padB = 34;

  const plotW = width - padL - padR;
  const plotH = height - padT - padB;

  const values = months.flatMap((m) => [
    Number(dTotalByMonth?.[m] ?? 0),
    Number(dMsByMonth?.[m] ?? 0),
    Number(dNfByMonth?.[m] ?? 0),
  ]);

  const maxAbs = Math.max(1, ...values.map((v) => Math.abs(v)));
  const midY = padT + plotH / 2;

  function xFor(i) {
    if (months.length <= 1) return padL;
    return padL + (i * plotW) / (months.length - 1);
  }

  function yFor(v) {
    // center at midY; scale by maxAbs
    const t = Number(v) / maxAbs; // [-1..1]
    return midY - t * (plotH / 2);
  }

  function pointsFor(map) {
    return months
      .map((m, i) => `${xFor(i)},${yFor(Number(map?.[m] ?? 0))}`)
      .join(" ");
  }

  // UI-only tooltip (similar style to StackedBars, but simpler)
  const [hover, setHover] = useState(null);
  // hover = { month, x, y, dTotal, dMs, dNf }
  const containerRef = useRef(null);

  function clearHover() {
    setHover(null);
  }

  function updateHover(e, m) {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setHover({
      month: m,
      x,
      y,
      dTotal: Number(dTotalByMonth?.[m] ?? 0),
      dMs: Number(dMsByMonth?.[m] ?? 0),
      dNf: Number(dNfByMonth?.[m] ?? 0),
    });
  }

  function signedFmt(v) {
    const n = Number(v ?? 0);
    const abs = Math.abs(n);
    const base = fmt(abs);
    if (n > 0) return `+${base}`;
    if (n < 0) return `-${base}`;
    return fmt(0);
  }

  return (
    <div className="rounded-2xl border bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm font-extrabold text-gray-900">
            Spend acceleration (Δ MoM)
          </div>
          <div className="mt-0.5 text-xs font-semibold text-gray-500">
            Month-over-month change in spend — highlights spikes and slowdowns
          </div>
        </div>

        <div className="flex items-center gap-4 text-xs font-semibold">
          <div className="flex items-center gap-2">
            <span className="inline-block h-3 w-3 rounded bg-gray-900" />
            <span className="text-gray-700">Δ Total</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-block h-3 w-3 rounded bg-gray-500" />
            <span className="text-gray-700">Δ MS</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-block h-3 w-3 rounded bg-gray-300" />
            <span className="text-gray-700">Δ NF</span>
          </div>
        </div>
      </div>

      <div
        ref={containerRef}
        className="relative mt-3 overflow-x-auto"
        onMouseLeave={clearHover}
      >
        {hover ? (
          <div
            className="pointer-events-none absolute z-10 w-64 rounded-xl border bg-white p-3 text-xs shadow-lg"
            style={{
              left: Math.min(
                Math.max(8, hover.x + 12),
                (containerRef.current?.clientWidth || 0) - 268
              ),
              top: Math.max(8, hover.y + 12),
            }}
          >
            <div className="flex items-center justify-between">
              <div className="font-extrabold text-gray-900">{hover.month}</div>
              <div className="font-extrabold text-gray-900">
                {signedFmt(hover.dTotal)}
              </div>
            </div>

            <div className="mt-2 space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-gray-700">Δ MS</span>
                <span className="font-extrabold text-gray-900">
                  {signedFmt(hover.dMs)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-semibold text-gray-700">Δ NF</span>
                <span className="font-extrabold text-gray-900">
                  {signedFmt(hover.dNf)}
                </span>
              </div>
            </div>

            <div className="mt-2 border-t pt-2 text-[11px] font-semibold text-gray-500">
              Hover points to see deltas
            </div>
          </div>
        ) : null}

        <svg width={width} height={height} className="min-w-[900px]">
          {/* grid lines: +maxAbs, 0, -maxAbs */}
          {[1, 0, -1].map((t) => {
            const v = maxAbs * t;
            const y = yFor(v);
            return (
              <g key={t}>
                <line
                  x1={padL}
                  x2={width - padR}
                  y1={y}
                  y2={y}
                  stroke="#EEF2F7"
                />
                <text x={8} y={y + 4} fontSize="10" fill="#6B7280">
                  {t === 0 ? "0" : signedFmt(v)}
                </text>
              </g>
            );
          })}

          {/* lines */}
          <polyline
            points={pointsFor(dTotalByMonth)}
            fill="none"
            stroke="#111827"
            strokeWidth="2.5"
          />
          <polyline
            points={pointsFor(dMsByMonth)}
            fill="none"
            stroke="#6B7280"
            strokeWidth="2.5"
          />
          <polyline
            points={pointsFor(dNfByMonth)}
            fill="none"
            stroke="#D1D5DB"
            strokeWidth="2.5"
          />

          {/* points + month labels + hover */}
          {months.map((m, i) => {
            const x = xFor(i);
            const yT = yFor(Number(dTotalByMonth?.[m] ?? 0));
            const yM = yFor(Number(dMsByMonth?.[m] ?? 0));
            const yN = yFor(Number(dNfByMonth?.[m] ?? 0));

            return (
              <g
                key={m}
                onMouseEnter={(e) => updateHover(e, m)}
                onMouseMove={(e) => updateHover(e, m)}
              >
                <circle cx={x} cy={yT} r="3.2" fill="#111827" />
                <circle cx={x} cy={yM} r="3.2" fill="#6B7280" />
                <circle cx={x} cy={yN} r="3.2" fill="#D1D5DB" />

                <text
                  x={x}
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

function SplitDriftChart({
  months,
  msPctByMonth,
  nfPctByMonth,
  height = 220,
}) {
  const width = 900;
  const padL = 72;
  const padR = 16;
  const padT = 12;
  const padB = 34;

  const plotW = width - padL - padR;
  const plotH = height - padT - padB;

  function xFor(i) {
    if (months.length <= 1) return padL;
    return padL + (i * plotW) / (months.length - 1);
  }

  // y: 0..1 mapped to chart
  function yFor(p) {
    const v = Number(p ?? 0);
    return padT + plotH - v * plotH;
  }

  function pointsFor(map) {
    return months.map((m, i) => `${xFor(i)},${yFor(map?.[m] ?? 0)}`).join(" ");
  }

  // UI-only tooltip
  const [hover, setHover] = useState(null);
  const containerRef = useRef(null);

  function clearHover() {
    setHover(null);
  }

  function updateHover(e, m) {
    const el = containerRef.current;
    if (!el) return;

    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const msP = Number(msPctByMonth?.[m] ?? 0);
    const nfP = Number(nfPctByMonth?.[m] ?? 0);

    setHover({ month: m, x, y, msP, nfP });
  }

  function fmtPct01(p) {
    const n = Number(p ?? 0);
    return `${Math.round(n * 100)}%`;
  }

  return (
    <div className="rounded-2xl border bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm font-extrabold text-gray-900">
            MS vs NF ratio drift over time
          </div>
          <div className="mt-0.5 text-xs font-semibold text-gray-500">
            Monthly split percentage — shows gradual drift, not just totals
          </div>
        </div>

        <div className="flex items-center gap-4 text-xs font-semibold">
          <div className="flex items-center gap-2">
            <span className="inline-block h-3 w-3 rounded bg-gray-900" />
            <span className="text-gray-700">MS %</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-block h-3 w-3 rounded bg-gray-400" />
            <span className="text-gray-700">NF %</span>
          </div>
        </div>
      </div>

      <div
        ref={containerRef}
        className="relative mt-3 overflow-x-auto"
        onMouseLeave={clearHover}
      >
        {hover ? (
          <div
            className="pointer-events-none absolute z-10 w-64 rounded-xl border bg-white p-3 text-xs shadow-lg"
            style={{
              left: Math.min(
                Math.max(8, hover.x + 12),
                (containerRef.current?.clientWidth || 0) - 268
              ),
              top: Math.max(8, hover.y + 12),
            }}
          >
            <div className="flex items-center justify-between">
              <div className="font-extrabold text-gray-900">{hover.month}</div>
              <div className="font-extrabold text-gray-900">
                {fmtPct01(hover.msP)} MS
              </div>
            </div>

            <div className="mt-2 space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-gray-700">MS %</span>
                <span className="font-extrabold text-gray-900">
                  {fmtPct01(hover.msP)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-semibold text-gray-700">NF %</span>
                <span className="font-extrabold text-gray-900">
                  {fmtPct01(hover.nfP)}
                </span>
              </div>
            </div>

            <div className="mt-2 border-t pt-2 text-[11px] font-semibold text-gray-500">
              Hover points to see split
            </div>
          </div>
        ) : null}

        <svg width={width} height={height} className="min-w-[900px]">
          {/* grid: 0%, 50%, 100% */}
          {[0, 0.5, 1].map((t) => {
            const y = yFor(t);
            return (
              <g key={t}>
                <line
                  x1={padL}
                  x2={width - padR}
                  y1={y}
                  y2={y}
                  stroke="#EEF2F7"
                />
                <text x={8} y={y + 4} fontSize="10" fill="#6B7280">
                  {Math.round(t * 100)}%
                </text>
              </g>
            );
          })}

          {/* lines */}
          <polyline
            points={pointsFor(msPctByMonth)}
            fill="none"
            stroke="#111827"
            strokeWidth="2.5"
          />
          <polyline
            points={pointsFor(nfPctByMonth)}
            fill="none"
            stroke="#9CA3AF"
            strokeWidth="2.5"
          />

          {/* points + labels + hover */}
          {months.map((m, i) => {
            const x = xFor(i);
            const yMS = yFor(Number(msPctByMonth?.[m] ?? 0));
            const yNF = yFor(Number(nfPctByMonth?.[m] ?? 0));

            return (
              <g
                key={m}
                onMouseEnter={(e) => updateHover(e, m)}
                onMouseMove={(e) => updateHover(e, m)}
              >
                <circle cx={x} cy={yMS} r="3.2" fill="#111827" />
                <circle cx={x} cy={yNF} r="3.2" fill="#9CA3AF" />

                <text
                  x={x}
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


function RunRateProjectionChart({
  monthsAll,          // MONTHS (Jan..Dec)
  visibleMonths,      // visibleMonths (range slider)
  actualCumByMonth,   // map month -> cumulative actual
  projCumByMonth,     // map month -> cumulative projected (filled for future months)
  lowCumByMonth,      // map month -> projected low band
  highCumByMonth,     // map month -> projected high band
  yearEnd,            // { projected, low, high }
  height = 240,
}) {
  const width = 900;
  const padL = 72;
  const padR = 16;
  const padT = 12;
  const padB = 34;

  const plotW = width - padL - padR;
  const plotH = height - padT - padB;

  const maxY = Math.max(
    1,
    ...monthsAll.map((m) =>
      Math.max(
        Number(actualCumByMonth?.[m] ?? 0),
        Number(projCumByMonth?.[m] ?? 0),
        Number(highCumByMonth?.[m] ?? 0)
      )
    )
  );

  function xFor(i) {
    if (monthsAll.length <= 1) return padL;
    return padL + (i * plotW) / (monthsAll.length - 1);
  }

  function yFor(v) {
    return padT + plotH - (Number(v) / maxY) * plotH;
  }

  function pointsFor(map) {
    return monthsAll
      .map((m, i) => `${xFor(i)},${yFor(Number(map?.[m] ?? 0))}`)
      .join(" ");
  }

  // Build band polygon (upper path + lower reversed)
  const bandPoints = useMemo(() => {
    const top = monthsAll
      .map((m, i) => `${xFor(i)},${yFor(Number(highCumByMonth?.[m] ?? 0))}`)
      .join(" ");
    const bot = monthsAll
      .slice()
      .reverse()
      .map((m, idx) => {
        const i = monthsAll.length - 1 - idx;
        return `${xFor(i)},${yFor(Number(lowCumByMonth?.[m] ?? 0))}`;
      })
      .join(" ");
    return `${top} ${bot}`;
  }, [monthsAll, highCumByMonth, lowCumByMonth]);

  // Tooltip
  const [hover, setHover] = useState(null);
  const containerRef = useRef(null);

  function clearHover() {
    setHover(null);
  }

  function updateHover(e, m) {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setHover({
      month: m,
      x,
      y,
      actual: Number(actualCumByMonth?.[m] ?? 0),
      proj: Number(projCumByMonth?.[m] ?? 0),
      low: Number(lowCumByMonth?.[m] ?? 0),
      high: Number(highCumByMonth?.[m] ?? 0),
    });
  }

  function isFutureMonth(m) {
    // months after the last visible month are treated as projection area
    const lastVisible = visibleMonths?.[visibleMonths.length - 1];
    const i = monthsAll.indexOf(m);
    const lv = monthsAll.indexOf(lastVisible);
    return i > lv;
  }

  return (
    <div className="rounded-2xl border bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-sm font-extrabold text-gray-900">
            Run rate forecast projection (year-end)
          </div>
          <div className="mt-0.5 text-xs font-semibold text-gray-500">
            Projection based on the last 3 months trend • Band ±5%
          </div>
        </div>

        <div className="text-right">
          <div className="text-xs font-semibold text-gray-600">
            Projected year-end
          </div>
          <div className="text-lg font-extrabold text-gray-900">
            {fmt(yearEnd?.projected ?? 0)}
          </div>
          <div className="text-xs font-semibold text-gray-500">
            {fmt(yearEnd?.low ?? 0)} – {fmt(yearEnd?.high ?? 0)}
          </div>
        </div>
      </div>

      <div
        ref={containerRef}
        className="relative mt-3 overflow-x-auto"
        onMouseLeave={clearHover}
      >
        {hover ? (
          <div
            className="pointer-events-none absolute z-10 w-72 rounded-xl border bg-white p-3 text-xs shadow-lg"
            style={{
              left: Math.min(
                Math.max(8, hover.x + 12),
                (containerRef.current?.clientWidth || 0) - 296
              ),
              top: Math.max(8, hover.y + 12),
            }}
          >
            <div className="flex items-center justify-between">
              <div className="font-extrabold text-gray-900">{hover.month}</div>
              <div className="font-extrabold text-gray-900">
                {fmt(hover.actual)}
              </div>
            </div>

            <div className="mt-2 space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-gray-700">Cumulative actual</span>
                <span className="font-extrabold text-gray-900">{fmt(hover.actual)}</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="font-semibold text-gray-700">Cumulative projected</span>
                <span className="font-extrabold text-gray-900">{fmt(hover.proj)}</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="font-semibold text-gray-700">Band (±5%)</span>
                <span className="font-extrabold text-gray-900">
                  {fmt(hover.low)} – {fmt(hover.high)}
                </span>
              </div>
            </div>

            <div className="mt-2 border-t pt-2 text-[11px] font-semibold text-gray-500">
              Hover points to inspect cumulative values
            </div>
          </div>
        ) : null}

        <svg width={width} height={height} className="min-w-[900px]">
          {[0, 0.5, 1].map((t) => {
            const v = maxY * t;
            const y = yFor(v);
            return (
              <g key={t}>
                <line
                  x1={padL}
                  x2={width - padR}
                  y1={y}
                  y2={y}
                  stroke="#EEF2F7"
                />
                <text x={8} y={y + 4} fontSize="10" fill="#6B7280">
                  {fmt(v)}
                </text>
              </g>
            );
          })}

          {/* band */}
          <polygon points={bandPoints} fill="#111827" opacity="0.06" />

          {/* projected cumulative */}
          <polyline
            points={pointsFor(projCumByMonth)}
            fill="none"
            stroke="#6B7280"
            strokeWidth="2.5"
            strokeDasharray="6 6"
          />

          {/* actual cumulative */}
          <polyline
            points={pointsFor(actualCumByMonth)}
            fill="none"
            stroke="#111827"
            strokeWidth="2.75"
          />

          {/* points */}
          {monthsAll.map((m, i) => {
            const x = xFor(i);
            const yA = yFor(Number(actualCumByMonth?.[m] ?? 0));
            const yP = yFor(Number(projCumByMonth?.[m] ?? 0));

            return (
              <g
                key={m}
                onMouseEnter={(e) => updateHover(e, m)}
                onMouseMove={(e) => updateHover(e, m)}
              >
                <circle cx={x} cy={yA} r="3.2" fill="#111827" />
                {isFutureMonth(m) ? (
                  <circle cx={x} cy={yP} r="3.2" fill="#6B7280" />
                ) : null}

                <text
                  x={x}
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

      <div className="mt-3 flex flex-wrap items-center gap-4 text-xs font-semibold text-gray-600">
        <div className="flex items-center gap-2">
          <span className="inline-block h-3 w-3 rounded bg-gray-900" />
          <span>Actual cumulative</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-block h-3 w-3 rounded bg-gray-500" />
          <span>Projected cumulative</span>
        </div>
        <div className="text-gray-500">Band shown around projection (±5%)</div>
      </div>
    </div>
  );
}


function BudgetVarianceChart({
  months,
  actualByMonth,
  budgetByMonth,
  diffByMonth,
  cumDiffByMonth,
  selected,
  height = 260,
}) {
  const width = 900;
  const padL = 72;
  const padR = 16;
  const padT = 12;
  const padB = 34;

  const plotW = width - padL - padR;
  const plotH = height - padT - padB;

  const maxY = Math.max(
    1,
    ...months.map((m) =>
      Math.max(
        Number(actualByMonth?.[m] ?? 0),
        Number(budgetByMonth?.[m] ?? 0)
      )
    )
  );

  const maxAbsDiff = Math.max(
    1,
    ...months.map((m) => Math.abs(Number(diffByMonth?.[m] ?? 0)))
  );

  function yFor(v) {
    return padT + plotH - (Number(v) / maxY) * plotH;
  }

  const diffMidY = padT + plotH / 2;
  function yDiff(v) {
    const t = Number(v) / maxAbsDiff;
    return diffMidY - t * (plotH / 2);
  }

  const barGap = 10;
  const groupW = Math.max(
    20,
    (plotW - barGap * (months.length - 1)) / months.length
  );
  const innerGap = 6;
  const barW = Math.max(8, (groupW - innerGap) / 2);

  const [hover, setHover] = useState(null);
  const containerRef = useRef(null);

  function clearHover() {
    setHover(null);
  }

  function updateHover(e, m) {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const a = Number(actualByMonth?.[m] ?? 0);
    const b = Number(budgetByMonth?.[m] ?? 0);
    const d = Number(diffByMonth?.[m] ?? 0);
    const cp = Number(cumDiffByMonth?.[m] ?? 0);
    const dp = b > 0 ? d / b : 0;

    setHover({ month: m, x, y, a, b, d, dp, cp });
  }

  function signedFmt(v) {
    const n = Number(v ?? 0);
    const abs = Math.abs(n);
    const base = fmt(abs);
    if (n > 0) return `+${base}`;
    if (n < 0) return `-${base}`;
    return fmt(0);
  }

  function pct01(p) {
    const n = Number(p ?? 0);
    const sign = n > 0 ? "+" : n < 0 ? "-" : "";
    return `${sign}${Math.round(Math.abs(n) * 100)}%`;
  }

  const cumMaxAbs = Math.max(
    1,
    ...months.map((m) => Math.abs(Number(cumDiffByMonth?.[m] ?? 0)))
  );

  function xAt(i) {
    if (months.length <= 1) return padL;
    return padL + (i * plotW) / (months.length - 1);
  }

  function yCum(v) {
    const mid = padT + plotH / 2;
    const t = Number(v) / cumMaxAbs;
    return mid - t * (plotH / 2);
  }

  const cumPoints = months
    .map((m, i) => `${xAt(i)},${yCum(Number(cumDiffByMonth?.[m] ?? 0))}`)
    .join(" ");

  return (
    <div className="rounded-2xl border bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-sm font-extrabold text-gray-900">
            Variance vs Budget (Actual vs Target)
          </div>
          <div className="mt-0.5 text-xs font-semibold text-gray-500">
            Bars show Actual vs Budget • Variance & cumulative drift for CIO view
          </div>
        </div>

        <div className="text-right">
          <div className="text-xs font-semibold text-gray-600">
            Selected months
          </div>
          <div className="text-sm font-extrabold text-gray-900">
            {fmt(selected?.actual ?? 0)} actual • {fmt(selected?.budget ?? 0)}{" "}
            budget
          </div>
          <div className="text-xs font-semibold text-gray-500">
            Variance {signedFmt(selected?.diff ?? 0)} ({pct01(selected?.diffPct ?? 0)})
          </div>
        </div>
      </div>

      <div
        ref={containerRef}
        className="relative mt-3 overflow-x-auto"
        onMouseLeave={clearHover}
      >
        {hover ? (
          <div
            className="pointer-events-none absolute z-10 w-80 rounded-xl border bg-white p-3 text-xs shadow-lg"
            style={{
              left: Math.min(
                Math.max(8, hover.x + 12),
                (containerRef.current?.clientWidth || 0) - 328
              ),
              top: Math.max(8, hover.y + 12),
            }}
          >
            <div className="flex items-center justify-between">
              <div className="font-extrabold text-gray-900">{hover.month}</div>
              <div className="font-extrabold text-gray-900">{fmt(hover.a)}</div>
            </div>

            <div className="mt-2 space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-gray-700">Budget</span>
                <span className="font-extrabold text-gray-900">{fmt(hover.b)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-semibold text-gray-700">Variance</span>
                <span className="font-extrabold text-gray-900">
                  {signedFmt(hover.d)} ({pct01(hover.dp)})
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-semibold text-gray-700">
                  Cumulative variance
                </span>
                <span className="font-extrabold text-gray-900">
                  {signedFmt(hover.cp)}
                </span>
              </div>
            </div>

            <div className="mt-2 border-t pt-2 text-[11px] font-semibold text-gray-500">
              Hover month to inspect variance
            </div>
          </div>
        ) : null}

        <svg width={width} height={height} className="min-w-[900px]">
          {[0, 0.5, 1].map((t) => {
            const v = maxY * t;
            const y = yFor(v);
            return (
              <g key={t}>
                <line
                  x1={padL}
                  x2={width - padR}
                  y1={y}
                  y2={y}
                  stroke="#EEF2F7"
                />
                <text x={8} y={y + 4} fontSize="10" fill="#6B7280">
                  {fmt(v)}
                </text>
              </g>
            );
          })}

          <line
            x1={padL}
            x2={width - padR}
            y1={diffMidY}
            y2={diffMidY}
            stroke="#E5E7EB"
          />

          {months.map((m, i) => {
            const x0 = padL + i * (groupW + barGap);

            const a = Number(actualByMonth?.[m] ?? 0);
            const b = Number(budgetByMonth?.[m] ?? 0);
            const d = Number(diffByMonth?.[m] ?? 0);

            const yA = yFor(a);
            const hA = Math.max(0, padT + plotH - yA);

            const yB = yFor(b);
            const hB = Math.max(0, padT + plotH - yB);

            const yD = yDiff(d);
            const hD = Math.abs(yD - diffMidY);
            const yTop = Math.min(yD, diffMidY);

            return (
              <g
                key={m}
                onMouseEnter={(e) => updateHover(e, m)}
                onMouseMove={(e) => updateHover(e, m)}
              >
                <rect
                  x={x0}
                  y={yB}
                  width={barW}
                  height={hB}
                  rx="6"
                  className="fill-gray-200"
                  style={{ cursor: "pointer" }}
                />
                <rect
                  x={x0 + barW + innerGap}
                  y={yA}
                  width={barW}
                  height={hA}
                  rx="6"
                  className="fill-gray-900"
                  style={{ cursor: "pointer" }}
                />

                <rect
                  x={x0 + groupW - 10}
                  y={yTop}
                  width={8}
                  height={Math.max(1, hD)}
                  rx="4"
                  className={d >= 0 ? "fill-emerald-600" : "fill-rose-500"}
                  opacity="0.85"
                />

                <text
                  x={x0 + groupW / 2}
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

          <polyline
            points={cumPoints}
            fill="none"
            stroke="#6B7280"
            strokeWidth="2.25"
          />
        </svg>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-4 text-xs font-semibold text-gray-600">
        <div className="flex items-center gap-2">
          <span className="inline-block h-3 w-3 rounded bg-gray-900" />
          <span>Actual</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-block h-3 w-3 rounded bg-gray-200 border" />
          <span>Budget</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-block h-3 w-3 rounded bg-emerald-600" />
          <span>Positive variance</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-block h-3 w-3 rounded bg-rose-500" />
          <span>Negative variance</span>
        </div>
        <div className="text-gray-500">Line = cumulative variance</div>
      </div>
    </div>
  );
}

function CumulativeBurnCurve({
  monthsAll,
  visibleMonths,
  actualCumByMonth,
  budgetCumByMonth,
  height = 240,
}) {
  const width = 900;
  const padL = 72;
  const padR = 16;
  const padT = 12;
  const padB = 34;

  const plotW = width - padL - padR;
  const plotH = height - padT - padB;

  const hasBudget = monthsAll.some((m) => Number(budgetCumByMonth?.[m] ?? 0) > 0);

  const maxY = Math.max(
    1,
    ...monthsAll.map((m) =>
      Math.max(
        Number(actualCumByMonth?.[m] ?? 0),
        Number(budgetCumByMonth?.[m] ?? 0)
      )
    )
  );

  function xFor(i) {
    if (monthsAll.length <= 1) return padL;
    return padL + (i * plotW) / (monthsAll.length - 1);
  }

  function yFor(v) {
    return padT + plotH - (Number(v) / maxY) * plotH;
  }

  function pointsFor(map) {
    return monthsAll
      .map((m, i) => `${xFor(i)},${yFor(Number(map?.[m] ?? 0))}`)
      .join(" ");
  }

  const [hover, setHover] = useState(null);
  const containerRef = useRef(null);

  function clearHover() {
    setHover(null);
  }

  function updateHover(e, m) {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const a = Number(actualCumByMonth?.[m] ?? 0);
    const b = Number(budgetCumByMonth?.[m] ?? 0);
    const v = b > 0 ? a - b : 0;

    setHover({ month: m, x, y, a, b, v });
  }

  // last visible month marker
  const lastVisible = visibleMonths?.[visibleMonths.length - 1];
  const lastIdx = monthsAll.indexOf(lastVisible);

  return (
    <div className="rounded-2xl border bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-sm font-extrabold text-gray-900">
            Cumulative burn curve
          </div>
          <div className="mt-0.5 text-xs font-semibold text-gray-500">
            Cumulative spend over time — shows pacing, acceleration, and stability
          </div>
        </div>

        <div className="text-right">
          <div className="text-xs font-semibold text-gray-600">As of {lastVisible}</div>
          <div className="text-lg font-extrabold text-gray-900">
            {fmt(Number(actualCumByMonth?.[lastVisible] ?? 0))}
          </div>
          {hasBudget ? (
            <div className="text-xs font-semibold text-gray-500">
              Budget {fmt(Number(budgetCumByMonth?.[lastVisible] ?? 0))} •
              Variance {fmt(Number(actualCumByMonth?.[lastVisible] ?? 0) - Number(budgetCumByMonth?.[lastVisible] ?? 0))}
            </div>
          ) : (
            <div className="text-xs font-semibold text-gray-500">
              Budget not set (optional)
            </div>
          )}
        </div>
      </div>

      <div
        ref={containerRef}
        className="relative mt-3 overflow-x-auto"
        onMouseLeave={clearHover}
      >
        {hover ? (
          <div
            className="pointer-events-none absolute z-10 w-80 rounded-xl border bg-white p-3 text-xs shadow-lg"
            style={{
              left: Math.min(
                Math.max(8, hover.x + 12),
                (containerRef.current?.clientWidth || 0) - 328
              ),
              top: Math.max(8, hover.y + 12),
            }}
          >
            <div className="flex items-center justify-between">
              <div className="font-extrabold text-gray-900">{hover.month}</div>
              <div className="font-extrabold text-gray-900">{fmt(hover.a)}</div>
            </div>

            <div className="mt-2 space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-gray-700">Cumulative actual</span>
                <span className="font-extrabold text-gray-900">{fmt(hover.a)}</span>
              </div>

              {hasBudget ? (
                <>
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-gray-700">Cumulative budget</span>
                    <span className="font-extrabold text-gray-900">{fmt(hover.b)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-gray-700">Variance</span>
                    <span className="font-extrabold text-gray-900">
                      {fmt(hover.v)}
                    </span>
                  </div>
                </>
              ) : null}
            </div>

            <div className="mt-2 border-t pt-2 text-[11px] font-semibold text-gray-500">
              Hover points to inspect cumulative burn
            </div>
          </div>
        ) : null}

        <svg width={width} height={height} className="min-w-[900px]">
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

          {/* actual cumulative */}
          <polyline
            points={pointsFor(actualCumByMonth)}
            fill="none"
            stroke="#111827"
            strokeWidth="2.75"
          />

          {/* budget cumulative (optional) */}
          {hasBudget ? (
            <polyline
              points={pointsFor(budgetCumByMonth)}
              fill="none"
              stroke="#9CA3AF"
              strokeWidth="2.5"
              strokeDasharray="6 6"
            />
          ) : null}

          {/* last visible marker */}
          {lastIdx >= 0 ? (
            <line
              x1={xFor(lastIdx)}
              x2={xFor(lastIdx)}
              y1={padT}
              y2={padT + plotH}
              stroke="#E5E7EB"
            />
          ) : null}

          {monthsAll.map((m, i) => {
            const x = xFor(i);
            const yA = yFor(Number(actualCumByMonth?.[m] ?? 0));
            const yB = yFor(Number(budgetCumByMonth?.[m] ?? 0));
            return (
              <g
                key={m}
                onMouseEnter={(e) => updateHover(e, m)}
                onMouseMove={(e) => updateHover(e, m)}
              >
                <circle cx={x} cy={yA} r="3.2" fill="#111827" />
                {hasBudget ? <circle cx={x} cy={yB} r="3.2" fill="#9CA3AF" /> : null}

                <text
                  x={x}
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

      <div className="mt-3 flex flex-wrap items-center gap-4 text-xs font-semibold text-gray-600">
        <div className="flex items-center gap-2">
          <span className="inline-block h-3 w-3 rounded bg-gray-900" />
          <span>Cumulative actual</span>
        </div>
        {hasBudget ? (
          <div className="flex items-center gap-2">
            <span className="inline-block h-3 w-3 rounded bg-gray-400" />
            <span>Cumulative budget</span>
          </div>
        ) : null}
        <div className="text-gray-500">Vertical line = last selected month</div>
      </div>
    </div>
  );
}

/* -----------------------------
   Main Page
------------------------------ */

const PROGRAM_OPTIONS = [
  { value: "connected", label: "Connected" },
  { value: "tre", label: "TRE" },
  { value: "csc", label: "CSC" },
];

export default function TrendsPage({
  selectedProgram,
  onProgramChange,
  onBack,
  entryMode = "google",
}) {
  const programKey = selectedProgram || "connected";

  // Keys (same model as SummaryCards)
  const internalItemsKey = `pfc.${programKey}.internal.labor.items`;
  const contractorsKey = `pfc.${programKey}.external.contractors`;
  const sowKey = `pfc.${programKey}.external.sow`;
  const tnsItemsKey = `pfc.${programKey}.tns.items`;
  const budgetKey = `pfc.${programKey}.budget.byMonth`;

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
    internal: entryMode === "local" ? [] : loadArray(internalItemsKey),
    contractors: entryMode === "local" ? [] : loadArray(contractorsKey),
    sows: entryMode === "local" ? [] : loadArray(sowKey),
    tns: entryMode === "local" ? [] : loadArray(tnsItemsKey),
    budgetByMonth: entryMode === "local" ? emptyBudgetMap() : loadBudgetMap(budgetKey),
  }));

  useEffect(() => {
    let cancelled = false;

    function applySnapshot() {
      if (entryMode === "local") {
        setSnapshot({
          internal: [],
          contractors: [],
          sows: [],
          tns: [],
          budgetByMonth: emptyBudgetMap(),
        });
        return;
      }

      setSnapshot({
        internal: loadArray(internalItemsKey),
        contractors: loadArray(contractorsKey),
        sows: loadArray(sowKey),
        tns: loadArray(tnsItemsKey),
        budgetByMonth: loadBudgetMap(budgetKey),
      });
    }

    if (entryMode === "local") {
      applySnapshot();
      return undefined;
    }

    async function refresh() {
      try {
        await loadProgramState(programKey);
      } catch (e) {
        console.error("Failed to refresh Trends data:", e);
      } finally {
        if (!cancelled) applySnapshot();
      }
    }

    refresh();

    window.addEventListener("pfc:storage", applySnapshot);
    window.addEventListener("pfc:autolog", applySnapshot);
    window.addEventListener("storage", applySnapshot);

    return () => {
      cancelled = true;
      window.removeEventListener("pfc:storage", applySnapshot);
      window.removeEventListener("pfc:autolog", applySnapshot);
      window.removeEventListener("storage", applySnapshot);
    };
  }, [
    budgetKey,
    contractorsKey,
    entryMode,
    internalItemsKey,
    programKey,
    sowKey,
    tnsItemsKey,
  ]);

  // Build monthly totals
  const contractorsRoll = useMemo(
    () => sumByMonth(snapshot.contractors),
    [snapshot.contractors]
  );
  const sowRoll = useMemo(() => sumByMonth(snapshot.sows), [snapshot.sows]);
  const tnsRoll = useMemo(() => sumByMonth(snapshot.tns), [snapshot.tns]);

  const byMonth = useMemo(() => {
    const out = Object.fromEntries(
      MONTHS.map((m) => [m, { ms: 0, nf: 0, total: 0 }])
    );

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
    return Array.isArray(snapshot.internal) ? snapshot.internal.length : 0;
  }, [snapshot.internal]);


 // Budget input (optional)
  const [budgetDraft, setBudgetDraft] = useState(() => snapshot.budgetByMonth);

  useEffect(() => {
    // keep draft in sync when program changes / storage changes
    setBudgetDraft(snapshot.budgetByMonth);
  }, [snapshot.budgetByMonth]);

  function saveBudget(nextMap) {
    localStorage.setItem(budgetKey, JSON.stringify(nextMap));
    window.dispatchEvent(new Event("pfc:storage"));
  }

  function setBudgetForMonth(m, value) {
    const next = { ...budgetDraft, [m]: Number(value ?? 0) };
    setBudgetDraft(next);
  }

  function applyBudgetDraft() {
    saveBudget(budgetDraft);
  }

  function setAnnualBudgetEvenly(annual) {
    const n = Number(annual ?? 0);
    const perMonth = n / 12;
    const next = Object.fromEntries(MONTHS.map((m) => [m, perMonth]));
    setBudgetDraft(next);
    saveBudget(next);
  }


  // Chart series (stacked by category)
  const stackedSeries = useMemo(() => {
    const contractorsTotalByMonth = Object.fromEntries(
      MONTHS.map((m) => [
        m,
        Number(contractorsRoll.ms[m] ?? 0) + Number(contractorsRoll.nf[m] ?? 0),
      ])
    );
    const sowTotalByMonth = Object.fromEntries(
      MONTHS.map((m) => [
        m,
        Number(sowRoll.ms[m] ?? 0) + Number(sowRoll.nf[m] ?? 0),
      ])
    );
    const tnsTotalByMonth = Object.fromEntries(
      MONTHS.map((m) => [
        m,
        Number(tnsRoll.ms[m] ?? 0) + Number(tnsRoll.nf[m] ?? 0),
      ])
    );

    return [
      {
        key: "tns",
        label: "Tools & Services",
        valuesByMonth: tnsTotalByMonth,
        className: "fill-purple-400",
        swatchClassName: "bg-purple-400",
      },
      {
        key: "contractors",
        label: "External Contractors",
        valuesByMonth: contractorsTotalByMonth,
        className: "fill-green-400",
        swatchClassName: "bg-green-400",
      },
      {
        key: "sow",
        label: "External SOW",
        valuesByMonth: sowTotalByMonth,
        className: "fill-emerald-600",
        swatchClassName: "bg-emerald-600",
      },
    ];
  }, [contractorsRoll, sowRoll, tnsRoll]);

  
  
  // What changed this month? (auto insight)
  const whatChanged = useMemo(() => {
    // helper: safe delta within visibleMonths
    function deltaFor(map, prevM, curM) {
      return Number(map?.[curM] ?? 0) - Number(map?.[prevM] ?? 0);
    }

    const months = Array.isArray(visibleMonths) ? visibleMonths : [];
    if (months.length < 2) return { focusMonth: null, insights: [] };

    // Build per-month totals for each contributor bucket we can attribute:
    // - Tools & Services: MS / NF
    // - External Contractors: MS / NF
    // - External SOW: MS / NF
    const buckets = [
      {
        key: "tns_nf",
        label: "Tools & Services (NF)",
        map: Object.fromEntries(MONTHS.map((m) => [m, Number(tnsRoll.nf?.[m] ?? 0)])),
      },
      {
        key: "tns_ms",
        label: "Tools & Services (MS)",
        map: Object.fromEntries(MONTHS.map((m) => [m, Number(tnsRoll.ms?.[m] ?? 0)])),
      },
      {
        key: "contractors_nf",
        label: "External Contractors (NF)",
        map: Object.fromEntries(MONTHS.map((m) => [m, Number(contractorsRoll.nf?.[m] ?? 0)])),
      },
      {
        key: "contractors_ms",
        label: "External Contractors (MS)",
        map: Object.fromEntries(MONTHS.map((m) => [m, Number(contractorsRoll.ms?.[m] ?? 0)])),
      },
      {
        key: "sow_nf",
        label: "External SOW (NF)",
        map: Object.fromEntries(MONTHS.map((m) => [m, Number(sowRoll.nf?.[m] ?? 0)])),
      },
      {
        key: "sow_ms",
        label: "External SOW (MS)",
        map: Object.fromEntries(MONTHS.map((m) => [m, Number(sowRoll.ms?.[m] ?? 0)])),
      },
    ];

    // Compute overall month-to-month delta to find "focus month"
    // We'll pick the month with the largest absolute delta in total spend (within visible range).
    let best = null; // { month, prev, delta }
    for (let i = 1; i < months.length; i++) {
      const prevM = months[i - 1];
      const curM = months[i];
      const d = Number(byMonth?.[curM]?.total ?? 0) - Number(byMonth?.[prevM]?.total ?? 0);

      if (!best || Math.abs(d) > Math.abs(best.delta)) {
        best = { month: curM, prev: prevM, delta: d };
      }
    }

    if (!best) return { focusMonth: null, insights: [] };

    const { month: focusMonth, prev: prevMonth, delta: totalDelta } = best;

    // Rank contributing bucket deltas for the focus month
    const ranked = buckets
      .map((b) => ({
        label: b.label,
        delta: deltaFor(b.map, prevMonth, focusMonth),
      }))
      .filter((r) => r.delta !== 0)
      .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));

    // If total delta is tiny, don't show noise.
    // Threshold = 3% of current month total OR $1k, whichever is higher.
    const curTotal = Number(byMonth?.[focusMonth]?.total ?? 0);
    const minAbs = Math.max(1000, curTotal * 0.03);

    if (Math.abs(totalDelta) < minAbs) {
      return { focusMonth, insights: [] };
    }

    // Build top 1–2 insights
    const top = ranked.slice(0, 2);

    function signedMoney(v) {
      const n = Number(v ?? 0);
      if (n > 0) return `+${fmt(n)}`;
      if (n < 0) return `-${fmt(Math.abs(n))}`;
      return fmt(0);
    }

    const verb = totalDelta >= 0 ? "spike" : "drop";
    const headline = `${focusMonth} ${verb} driven by ${signedMoney(top[0]?.delta)} change in ${top[0]?.label}.`;

    const extra =
      top.length > 1
        ? `Secondary driver: ${signedMoney(top[1]?.delta)} change in ${top[1]?.label}.`
        : null;

    return {
        focusMonth,
        prevMonth,
        totalDelta,
        insights: extra ? [headline, extra] : [headline],
        whyDetails: [
            `Selected range: ${months[0]}–${months[months.length - 1]}`,
            `Focus month = largest absolute MoM change within selected range.`,
            `Δ Total (${prevMonth} → ${focusMonth}): ${signedMoney(totalDelta)}`,
            `Top driver: ${top[0]?.label} (${signedMoney(top[0]?.delta)})`,
            ...(top.length > 1
            ? [`Secondary driver: ${top[1]?.label} (${signedMoney(top[1]?.delta)})`]
            : []),
            `Noise filter: max($1,000, 3% of ${focusMonth} total).`,
        ],
    };
  }, [visibleMonths, byMonth, contractorsRoll, sowRoll, tnsRoll]);
  

  // Line chart (MS vs NF)
  const msByMonth = useMemo(
    () => Object.fromEntries(MONTHS.map((m) => [m, byMonth[m].ms])),
    [byMonth]
  );
  const nfByMonth = useMemo(
    () => Object.fromEntries(MONTHS.map((m) => [m, byMonth[m].nf])),
    [byMonth]
  );

    // Variance vs Budget (actual vs target)
  const variance = useMemo(() => {
    const actual = Object.fromEntries(
      MONTHS.map((m) => [m, Number(byMonth?.[m]?.total ?? 0)])
    );

    const budget = Object.fromEntries(
      MONTHS.map((m) => [m, Number(snapshot.budgetByMonth?.[m] ?? 0)])
    );

    const diff = Object.fromEntries(MONTHS.map((m) => [m, 0])); // actual - budget
    const diffPct = Object.fromEntries(MONTHS.map((m) => [m, 0])); // diff / budget
    const cumDiff = Object.fromEntries(MONTHS.map((m) => [m, 0])); // cumulative variance $

    let c = 0;
    for (const m of MONTHS) {
      const a = Number(actual[m] ?? 0);
      const b = Number(budget[m] ?? 0);
      const d = a - b;

      diff[m] = d;
      diffPct[m] = b > 0 ? d / b : 0;

      c += d;
      cumDiff[m] = c;
    }

    const vis = Array.isArray(visibleMonths) ? visibleMonths : [];
    const sumMap = (map) =>
      vis.reduce((acc, m) => acc + Number(map?.[m] ?? 0), 0);

    const actualSel = sumMap(actual);
    const budgetSel = sumMap(budget);
    const diffSel = actualSel - budgetSel;
    const diffPctSel = budgetSel > 0 ? diffSel / budgetSel : 0;

    return {
      actual,
      budget,
      diff,
      diffPct,
      cumDiff,
      selected: {
        actual: actualSel,
        budget: budgetSel,
        diff: diffSel,
        diffPct: diffPctSel,
      },
    };
  }, [byMonth, snapshot.budgetByMonth, visibleMonths]);

  // Cumulative burn curve (actual + optional budget)
  const burnCurve = useMemo(() => {
    const actualCum = Object.fromEntries(MONTHS.map((m) => [m, 0]));
    const budgetCum = Object.fromEntries(MONTHS.map((m) => [m, 0]));

    let a = 0;
    let b = 0;

    for (const m of MONTHS) {
      a += Number(byMonth?.[m]?.total ?? 0);
      actualCum[m] = a;

      // budget is optional; if not set, it stays 0
      b += Number(snapshot.budgetByMonth?.[m] ?? 0);
      budgetCum[m] = b;
    }

    return { actualCum, budgetCum };
  }, [byMonth, snapshot.budgetByMonth]);
  
  
  // Spend momentum (Δ month-over-month)
  // IMPORTANT: compute across ALL MONTHS so the first visible month can still compare to its real previous month.
  const spendDelta = useMemo(() => {
    const dTotal = Object.fromEntries(MONTHS.map((m) => [m, 0]));
    const dMs = Object.fromEntries(MONTHS.map((m) => [m, 0]));
    const dNf = Object.fromEntries(MONTHS.map((m) => [m, 0]));

    for (let i = 0; i < MONTHS.length; i++) {
      const m = MONTHS[i];
      const prev = i > 0 ? MONTHS[i - 1] : null;

      const curTotal = Number(byMonth?.[m]?.total ?? 0);
      const curMs = Number(byMonth?.[m]?.ms ?? 0);
      const curNf = Number(byMonth?.[m]?.nf ?? 0);

      const prevTotal = prev ? Number(byMonth?.[prev]?.total ?? 0) : curTotal;
      const prevMs = prev ? Number(byMonth?.[prev]?.ms ?? 0) : curMs;
      const prevNf = prev ? Number(byMonth?.[prev]?.nf ?? 0) : curNf;

      dTotal[m] = curTotal - prevTotal;
      dMs[m] = curMs - prevMs;
      dNf[m] = curNf - prevNf;
    }

    return { dTotal, dMs, dNf };
  }, [byMonth]);


    // MS vs NF ratio drift (% by month)
  const splitPct = useMemo(() => {
    const msPct = Object.fromEntries(MONTHS.map((m) => [m, 0]));
    const nfPct = Object.fromEntries(MONTHS.map((m) => [m, 0]));

    for (const m of MONTHS) {
      const ms = Number(byMonth?.[m]?.ms ?? 0);
      const nf = Number(byMonth?.[m]?.nf ?? 0);
      const total = ms + nf;

      if (total <= 0) {
        msPct[m] = 0;
        nfPct[m] = 0;
      } else {
        msPct[m] = ms / total;
        nfPct[m] = nf / total;
      }
    }

    return { msPct, nfPct };
  }, [byMonth]);


  // Run rate projection based on last 3 months trend (visible range)
  const runRateProjection = useMemo(() => {
    // monthly run rate = total for that month (not cumulative)
    const run = Object.fromEntries(MONTHS.map((m) => [m, Number(byMonth?.[m]?.total ?? 0)]));

    // pick last 3 months from the *visibleMonths* that have any value (or at least exist)
    const vis = Array.isArray(visibleMonths) ? visibleMonths : [];
    const last3 = vis.slice(-3);

    // If visible range is shorter than 3, use what we have (still works)
    const m1 = last3[0];
    const m2 = last3[1];
    const m3 = last3[2];

    const r1 = Number(run?.[m1] ?? 0);
    const r2 = Number(run?.[m2] ?? 0);
    const r3 = Number(run?.[m3] ?? 0);

    // average slope between last 3 points (simple momentum)
    // if fewer than 3 months selected, slope becomes 0 (flat projection)
    let avgSlope = 0;
    if (last3.length === 3) {
      const s1 = r2 - r1;
      const s2 = r3 - r2;
      avgSlope = (s1 + s2) / 2;
    }

    // Project monthly run rates from month after last visible to Dec
    const lastVisible = vis[vis.length - 1] ?? "Dec";
    const lastIdx = MONTHS.indexOf(lastVisible);

    const projRun = { ...run };
    for (let i = lastIdx + 1; i < MONTHS.length; i++) {
      const prevM = MONTHS[i - 1];
      const curM = MONTHS[i];
      const prevVal = Number(projRun?.[prevM] ?? 0);
      // next = prev + avgSlope, clamped to >= 0
      projRun[curM] = Math.max(0, prevVal + avgSlope);
    }

    // Build cumulative curves (actual uses 'run', projection uses 'projRun' after lastVisible)
    const actualCum = Object.fromEntries(MONTHS.map((m) => [m, 0]));
    const projCum = Object.fromEntries(MONTHS.map((m) => [m, 0]));
    const lowCum = Object.fromEntries(MONTHS.map((m) => [m, 0]));
    const highCum = Object.fromEntries(MONTHS.map((m) => [m, 0]));

    let a = 0;
    let p = 0;

    for (let i = 0; i < MONTHS.length; i++) {
      const m = MONTHS[i];

      a += Number(run?.[m] ?? 0);
      actualCum[m] = a;

      // projection: for months up to lastVisible, keep actual cumulative;
      // for future months, add projected run
      if (i <= lastIdx) {
        p = a;
      } else {
        p += Number(projRun?.[m] ?? 0);
      }
      projCum[m] = p;

      // band (±5%) around projected cumulative
      lowCum[m] = p * 0.95;
      highCum[m] = p * 1.05;
    }

    const yearEndProjected = Number(projCum["Dec"] ?? 0);
    const yearEndLow = Number(lowCum["Dec"] ?? 0);
    const yearEndHigh = Number(highCum["Dec"] ?? 0);

    return {
      run,
      projRun,
      actualCum,
      projCum,
      lowCum,
      highCum,
      yearEnd: { projected: yearEndProjected, low: yearEndLow, high: yearEndHigh },
      avgSlope,
      last3,
    };
  }, [byMonth, visibleMonths]);


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

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="px-6 py-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-2xl font-extrabold text-gray-900">Trends</div>

            {/* ✅ Program dropdown restored (UI-only) */}
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <div className="text-sm font-semibold text-gray-600">Program</div>
              <select
                value={programKey}
                onChange={(e) => onProgramChange?.(e.target.value)}
                className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-extrabold text-gray-900 shadow-sm"
              >
                {PROGRAM_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
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
              <div className="text-sm font-extrabold text-gray-900">
                Month range
              </div>
              <div className="mt-1 text-xs font-semibold text-gray-500">
                {viewLabel}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-3">
                <div className="text-xs font-semibold text-gray-600">Start</div>
                <div className="text-xs font-extrabold text-gray-900">
                  {MONTHS[normalized.s]}
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

              <div className="flex items-center gap-3">
                <div className="text-xs font-semibold text-gray-600">End</div>
                <div className="text-xs font-extrabold text-gray-900">
                  {MONTHS[normalized.e]}
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
                Selected months:{" "}
                <span className="font-extrabold text-gray-900">
                  {visibleMonths.length}
                </span>
              </div>
            </div>
          </div>
        </div>


        {/* KPI cards */}
        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard
            title="Total spend (selected months)"
            value={fmt(sums.grandTotal)}
            sub={`${visibleMonths.length} months • Run rate ${fmt(
              sums.runRate
            )}/mo`}
          />
          <StatCard
            title="MS vs NF split"
            value={`${pct(msShare)} MS • ${pct(nfShare)} NF`}
            sub={`${fmt(sums.msTotal)} MS • ${fmt(sums.nfTotal)} NF`}
          />
          {/* External vs Tools & Services card removed per request */}
          <StatCard
            title="Internal (FTE entries)"
            value={`${internalFteCount}`}
            sub="Live count from Internal Labor items"
          />
        </div>

        {/* What changed this month? */}
        <div className="mt-6">
          <InsightCard
            title="Biggest spike/drop in selected range"
            sub={viewLabel}   // this already changes with your slider
            items={whatChanged.insights}
            whyDetails={whatChanged.whyDetails}
          />
        </div>

        {/* Run rate forecast projection (year-end) */}
        <div className="mt-6">
          <RunRateProjectionChart
            monthsAll={MONTHS}
            visibleMonths={visibleMonths}
            actualCumByMonth={runRateProjection.actualCum}
            projCumByMonth={runRateProjection.projCum}
            lowCumByMonth={runRateProjection.lowCum}
            highCumByMonth={runRateProjection.highCum}
            yearEnd={runRateProjection.yearEnd}
          />
        </div>

        {/* Spend acceleration (Δ MoM) */}
        <div className="mt-6">
          <SpendMomentumChart
            months={visibleMonths}
            dTotalByMonth={spendDelta.dTotal}
            dMsByMonth={spendDelta.dMs}
            dNfByMonth={spendDelta.dNf}
          />
        </div>

        {/* Variance vs Budget */}
        <div className="mt-6">
          <BudgetVarianceChart
            months={visibleMonths}
            actualByMonth={variance.actual}
            budgetByMonth={variance.budget}
            diffByMonth={variance.diff}
            cumDiffByMonth={variance.cumDiff}
            selected={variance.selected}
          />
        </div>

         {/* Budget (optional) */}
        <div className="mt-5 rounded-2xl border bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="text-sm font-extrabold text-gray-900">
                Budget (optional)
              </div>
              <div className="mt-1 text-xs font-semibold text-gray-500">
                Enter an annual budget (even split), or adjust months below.
                Stored in localStorage per program.
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => setAnnualBudgetEvenly(prompt("Enter annual budget") || 0)}
                className="rounded-xl border bg-white px-4 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-100"
              >
                Set annual (even split)
              </button>
              <button
                type="button"
                onClick={applyBudgetDraft}
                className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800"
              >
                Save budget
              </button>
            </div>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="min-w-[760px] w-full text-left">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="px-4 py-3 text-xs font-extrabold text-gray-700">
                    Month
                  </th>
                  <th className="px-4 py-3 text-xs font-extrabold text-gray-700">
                    Budget
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {MONTHS.map((m) => (
                  <tr key={m}>
                    <td className="px-4 py-3 text-sm font-semibold text-gray-900">
                      {m}
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        value={Number(budgetDraft?.[m] ?? 0)}
                        onChange={(e) => setBudgetForMonth(m, e.target.value)}
                        className="w-48 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-extrabold text-gray-900"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        
        {/* Cumulative burn curve (bottom) */}
        <div className="mt-6">
          <CumulativeBurnCurve
            monthsAll={MONTHS}
            visibleMonths={visibleMonths}
            actualCumByMonth={burnCurve.actualCum}
            budgetCumByMonth={burnCurve.budgetCum}
          />
        </div>

        {/* MS vs NF ratio drift (% over time) */}
        <div className="mt-6">
          <SplitDriftChart
            months={visibleMonths}
            msPctByMonth={splitPct.msPct}
            nfPctByMonth={splitPct.nfPct}
          />
        </div>

        {/* Stacked monthly spend */}
        <div className="mt-6">
          <StackedBars months={visibleMonths} series={stackedSeries} />
        </div>

        {/* MS vs NF line */}
        <div className="mt-6">
          <TwoLineChart
            months={visibleMonths}
            msByMonth={msByMonth}
            nfByMonth={nfByMonth}
          />
        </div>

        {/* Top contributors table */}
        <div className="mt-6 rounded-2xl border bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-sm font-extrabold text-gray-900">
                Top contributors
              </div>
              <div className="mt-0.5 text-xs font-semibold text-gray-500">
                Totals across selected months
              </div>
            </div>
          </div>

          <div className="mt-3 overflow-x-auto">
            <table className="min-w-[760px] w-full text-left">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="px-4 py-3 text-xs font-extrabold text-gray-700">
                    Category
                  </th>
                  <th className="px-4 py-3 text-xs font-extrabold text-gray-700">
                    Total
                  </th>
                  <th className="px-4 py-3 text-xs font-extrabold text-gray-700">
                    Avg / Month
                  </th>
                  <th className="px-4 py-3 text-xs font-extrabold text-gray-700">
                    % of Total
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {contributors.map((r) => (
                  <tr key={r.label}>
                    <td className="px-4 py-3 text-sm font-semibold text-gray-900">
                      {r.label}
                    </td>
                    <td className="px-4 py-3 text-sm font-extrabold text-gray-900">
                      {fmt(r.total)}
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold text-gray-900">
                      {fmt(r.avgPerMonth)}
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold text-gray-700">
                      {pct(r.pctOfTotal)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t bg-gray-50">
                  <td className="px-4 py-3 text-sm font-extrabold text-gray-900">
                    Grand Total
                  </td>
                  <td className="px-4 py-3 text-sm font-extrabold text-gray-900">
                    {fmt(sums.grandTotal)}
                  </td>
                  <td className="px-4 py-3 text-sm font-extrabold text-gray-900">
                    {fmt(sums.runRate)}
                  </td>
                  <td className="px-4 py-3 text-sm font-extrabold text-gray-900">
                    100%
                  </td>
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
