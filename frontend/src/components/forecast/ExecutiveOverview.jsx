import { useEffect, useMemo, useState } from "react";
import { loadProgramState } from "../../data/firestorePrograms";
import { MONTHS } from "../../data/hub";

const PROGRAMS = [
  { id: "connected", label: "Connected", accent: "border-orange-200 bg-orange-50/70" },
  { id: "tre", label: "TRE", accent: "border-purple-200 bg-purple-50/70" },
  { id: "csc", label: "CSC", accent: "border-sky-200 bg-sky-50/70" },
];

function fmtCurrency(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function sumItems(items) {
  return (items || []).reduce((sum, item) => {
    return (
      sum +
      MONTHS.reduce((monthSum, month) => {
        return (
          monthSum +
          Number(item?.msByMonth?.[month] ?? 0) +
          Number(item?.nfByMonth?.[month] ?? 0)
        );
      }, 0)
    );
  }, 0);
}

function summarizeProgram(state) {
  const internalItems = Array.isArray(state?.internalLaborItems) ? state.internalLaborItems : [];
  const internalCount = internalItems.length;
  const internalRunSum = internalItems.reduce(
    (sum, item) => sum + Number(item?.runPct ?? 0),
    0
  );
  const internalGrowthSum = internalItems.reduce(
    (sum, item) => sum + Number(item?.growthPct ?? 0),
    0
  );
  const toolsItems = Array.isArray(state?.tnsItems) ? state.tnsItems : [];
  const toolsCount = toolsItems.length;
  const toolsTotal = sumItems(toolsItems);
  const contractorTotal = sumItems(state?.contractors);
  const sowTotal = sumItems(state?.sows);
  const externalTotal = contractorTotal + sowTotal;
  const totalForecast = toolsTotal + externalTotal;

  return {
    internalCount,
    internalRunSum,
    internalGrowthSum,
    toolsCount,
    toolsTotal,
    contractorTotal,
    sowTotal,
    externalTotal,
    totalForecast,
  };
}

function MetricTile({ label, value, sub, footer, tone = "default" }) {
  const toneClass =
    tone === "primary"
      ? "border-slate-200 bg-slate-50"
      : tone === "success"
        ? "border-emerald-100 bg-emerald-50/70"
        : tone === "accent"
          ? "border-blue-100 bg-blue-50/70"
          : "border-gray-200 bg-white";

  return (
    <div className={["flex h-full flex-col rounded-2xl border px-4 py-3.5", toneClass].join(" ")}>
      <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
        {label}
      </div>
      <div className="mt-2 text-2xl font-black tracking-tight text-gray-950">{value}</div>
      {sub ? <div className="mt-1 text-sm text-gray-600">{sub}</div> : null}
      {footer ? <div className="mt-4 pt-3">{footer}</div> : null}
    </div>
  );
}

export default function ExecutiveOverview({
  selectedProgram,
  onSelectProgram,
  onContinue,
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statesByProgram, setStatesByProgram] = useState({});

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        setLoading(true);
        setError("");

        const entries = await Promise.all(
          PROGRAMS.map(async ({ id }) => {
            try {
              const state = await loadProgramState(id);
              return [id, state || {}];
            } catch (e) {
              console.error(`Failed to load executive summary for ${id}:`, e);
              return [id, {}];
            }
          })
        );

        if (!cancelled) {
          setStatesByProgram(Object.fromEntries(entries));
        }
      } catch (e) {
        console.error("Failed to load executive overview:", e);
        if (!cancelled) {
          setError("Unable to load the latest summary. You can still continue to the dashboard.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, []);

  const summaries = useMemo(() => {
    return PROGRAMS.map((program) => ({
      ...program,
      summary: summarizeProgram(statesByProgram[program.id]),
    }));
  }, [statesByProgram]);

  const portfolio = useMemo(() => {
    const base = {
      totalForecast: 0,
      toolsTotal: 0,
      toolsCount: 0,
      contractorTotal: 0,
      sowTotal: 0,
      externalTotal: 0,
      internalCount: 0,
      internalRunSum: 0,
      internalGrowthSum: 0,
    };

    for (const { summary } of summaries) {
      base.totalForecast += summary.totalForecast;
      base.toolsTotal += summary.toolsTotal;
      base.toolsCount += summary.toolsCount;
      base.contractorTotal += summary.contractorTotal;
      base.sowTotal += summary.sowTotal;
      base.externalTotal += summary.externalTotal;
      base.internalCount += summary.internalCount;
      base.internalRunSum += summary.internalRunSum;
      base.internalGrowthSum += summary.internalGrowthSum;
    }

    const topProgram =
      summaries.reduce((best, item) => {
        return item.summary.totalForecast > best.summary.totalForecast ? item : best;
      }, summaries[0] || { summary: { totalForecast: 0 }, label: "None" }) || null;

    const externalLeader =
      summaries.reduce((best, item) => {
        const denom = item.summary.totalForecast || 1;
        const ratio = item.summary.externalTotal / denom;
        return ratio > best.ratio ? { program: item, ratio } : best;
      }, { program: summaries[0] || null, ratio: 0 }) || null;

    return {
      ...base,
      avgRunPct: base.internalCount ? Math.round(base.internalRunSum / base.internalCount) : 0,
      avgGrowPct: base.internalCount ? Math.round(base.internalGrowthSum / base.internalCount) : 0,
      topProgram,
      externalLeader,
    };
  }, [summaries]);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_right,_#f8fafc,_#eef2ff_38%,_#dbeafe_68%,_#ecfccb_100%)]">
      <div className="mx-auto w-full max-w-7xl px-6 py-8">
        <div className="rounded-[2rem] border border-white/80 bg-white/75 p-8 shadow-2xl shadow-slate-200/80 backdrop-blur-xl">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.24em] text-gray-500">
                Executive Overview
              </div>
              <div className="mt-2 text-4xl font-black tracking-tight text-gray-950">
                Portfolio forecast summary
              </div>
              <div className="mt-3 max-w-3xl text-sm leading-7 text-gray-600 sm:text-base">
                Review the latest saved outlook across Connected, TRE, and CSC before entering the
                full planning workspace. This view is generated from the current saved program data.
              </div>
            </div>

            <button
              type="button"
              onClick={onContinue}
              className="rounded-2xl bg-gray-950 px-5 py-3 text-sm font-semibold text-white hover:bg-gray-800"
            >
              Open Dashboard
            </button>
          </div>

          {error ? (
            <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              {error}
            </div>
          ) : null}

          <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MetricTile
              label="Portfolio Forecast"
              value={loading ? "Loading..." : fmtCurrency(portfolio.totalForecast)}
              sub={
                <span className="block">
                  Total forecast
                </span>
              }
              footer={
                <div className="border-t border-slate-200 pt-3">
                  <div className="rounded-xl bg-white/70 px-3 py-2">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-gray-500">
                      Programs Tracked
                    </div>
                    <div className="mt-0.5 text-lg font-bold tracking-tight text-gray-900">
                      {PROGRAMS.length}
                    </div>
                  </div>
                </div>
              }
              tone="primary"
            />
            <div className="flex h-full flex-col rounded-2xl border border-blue-100 bg-blue-50/70 px-4 py-3.5">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                Internal FTE
              </div>
              <div className="mt-2 text-2xl font-black tracking-tight text-gray-950">
                {loading ? "..." : `${portfolio.internalCount}`}
              </div>
              <div className="mt-1 text-sm text-gray-600">Combined internal staffing entries</div>
              <div className="mt-4 grid gap-3 border-t border-blue-100 pt-3 sm:grid-cols-2">
                <div className="rounded-xl bg-white/55 px-3 py-2">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-gray-500">
                    Run %
                  </div>
                  <div className="mt-1 text-lg font-bold tracking-tight text-gray-900">
                    {loading ? "..." : `${portfolio.avgRunPct}%`}
                  </div>
                </div>
                <div className="rounded-xl bg-white/55 px-3 py-2">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-gray-500">
                    Grow %
                  </div>
                  <div className="mt-1 text-lg font-bold tracking-tight text-gray-900">
                    {loading ? "..." : `${portfolio.avgGrowPct}%`}
                  </div>
                </div>
              </div>
            </div>
            <div className="flex h-full flex-col rounded-2xl border border-gray-200 bg-white px-4 py-3.5">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                Tools & Services
              </div>
              <div className="mt-2 text-2xl font-black tracking-tight text-gray-950">
                {loading ? "..." : fmtCurrency(portfolio.toolsTotal)}
              </div>
              <div className="mt-1 text-sm text-gray-600">Current recurring tools forecast</div>
              <div className="mt-4 border-t border-gray-200 pt-3">
                <div className="rounded-xl bg-gray-50 px-3 py-2">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-gray-500">
                    Total Tools
                  </div>
                  <div className="mt-1 text-lg font-bold tracking-tight text-gray-900">
                    {loading ? "..." : portfolio.toolsCount}
                  </div>
                </div>
              </div>
            </div>
            <div className="flex h-full flex-col rounded-2xl border border-emerald-100 bg-emerald-50/70 px-4 py-3.5">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                External Forecast
              </div>
              <div className="mt-2 text-2xl font-black tracking-tight text-gray-950">
                {loading ? "..." : fmtCurrency(portfolio.externalTotal)}
              </div>
              <div className="mt-4 grid gap-3 border-t border-emerald-100 pt-3 sm:grid-cols-2">
                <div className="rounded-xl bg-white/55 px-3 py-2">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-gray-500">
                    Contractor Cost
                  </div>
                  <div className="mt-1 text-lg font-bold tracking-tight text-gray-900">
                    {loading ? "..." : fmtCurrency(portfolio.contractorTotal)}
                  </div>
                </div>
                <div className="rounded-xl bg-white/55 px-3 py-2">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-gray-500">
                    SOW Cost
                  </div>
                  <div className="mt-1 text-lg font-bold tracking-tight text-gray-900">
                    {loading ? "..." : fmtCurrency(portfolio.sowTotal)}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8 grid gap-4 lg:grid-cols-3">
            {summaries.map((program) => {
              const active = selectedProgram === program.id;
              const { summary } = program;

              return (
                <button
                  key={program.id}
                  type="button"
                  onClick={() => onSelectProgram?.(program.id)}
                  className={[
                    "rounded-3xl border p-5 text-left shadow-sm transition",
                    program.accent,
                    active ? "ring-2 ring-gray-900/10" : "hover:-translate-y-0.5 hover:shadow-md",
                  ].join(" ")}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-bold text-gray-900">{program.label}</div>
                    <div className="rounded-full bg-white/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                      {active ? "Current" : "Select"}
                    </div>
                  </div>

                  <div className="mt-4 text-3xl font-black tracking-tight text-gray-950">
                    {loading ? "..." : fmtCurrency(summary.totalForecast)}
                  </div>
                  <div className="mt-2 text-sm text-gray-600">
                    Total forecast from Tools & Services and External
                  </div>

                  <div className="mt-5 grid gap-3 sm:grid-cols-3">
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                        Internal
                      </div>
                      <div className="mt-1 text-lg font-bold text-gray-900">
                        {loading ? "..." : summary.internalCount}
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                        T&amp;S
                      </div>
                      <div className="mt-1 text-lg font-bold text-gray-900">
                        {loading ? "..." : fmtCurrency(summary.toolsTotal)}
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                        External
                      </div>
                      <div className="mt-1 text-lg font-bold text-gray-900">
                        {loading ? "..." : fmtCurrency(summary.externalTotal)}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="mt-8 grid gap-4 lg:grid-cols-2">
            <div className="rounded-3xl border border-gray-200 bg-gray-50/90 p-5">
              <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Top Forecast Driver
              </div>
              <div className="mt-3 text-2xl font-black tracking-tight text-gray-950">
                {loading
                  ? "Loading..."
                  : portfolio.topProgram
                    ? portfolio.topProgram.label
                    : "No program data"}
              </div>
              <div className="mt-2 text-sm text-gray-600">
                {loading
                  ? "Generating the latest summary..."
                  : portfolio.topProgram
                    ? `${portfolio.topProgram.label} currently carries the highest combined forecast at ${fmtCurrency(
                        portfolio.topProgram.summary.totalForecast
                      )}.`
                    : "No saved forecast data was found yet."}
              </div>
            </div>

            <div className="rounded-3xl border border-gray-200 bg-gray-50/90 p-5">
              <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                External Dependency
              </div>
              <div className="mt-3 text-2xl font-black tracking-tight text-gray-950">
                {loading
                  ? "Loading..."
                  : portfolio.externalLeader?.program
                    ? portfolio.externalLeader.program.label
                    : "No program data"}
              </div>
              <div className="mt-2 text-sm text-gray-600">
                {loading
                  ? "Reviewing contractor and SOW mix..."
                  : portfolio.externalLeader?.program
                    ? `${portfolio.externalLeader.program.label} shows the highest external-weighted forecast mix right now.`
                    : "No saved external data was found yet."}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
