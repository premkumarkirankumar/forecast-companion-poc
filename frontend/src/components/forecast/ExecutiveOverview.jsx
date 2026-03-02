import { useEffect, useMemo, useState } from "react";
import { loadLocalProgramState, loadProgramState } from "../../data/firestorePrograms";
import { MONTHS } from "../../data/hub";

const PORTFOLIO_INSIGHTS_URL =
  "https://us-central1-forecast-poc-488523.cloudfunctions.net/portfolioInsights";

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

function renderEmphasizedText(text) {
  const valuePattern = /(\$[\d,]+(?:\.\d+)?|\b\d+(?:\.\d+)?\s?:\s?1\b|\b\d+(?:\.\d+)?%)/g;
  const parts = String(text || "").split(valuePattern);
  return parts.map((part, index) => {
    if (!part) return null;
    if (valuePattern.test(part)) {
      valuePattern.lastIndex = 0;
      return (
        <span key={`${part}-${index}`} className="text-[1.08em] font-extrabold tracking-tight text-gray-950">
          {part}
        </span>
      );
    }
    valuePattern.lastIndex = 0;
    return <span key={`${part}-${index}`}>{part}</span>;
  });
}

function parseInsightPreview(text) {
  const raw = String(text || "").trim();
  if (!raw) return { headline: "", sections: [] };

  const lines = raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const knownTitles = ["Current posture", "Delivery view", "Leadership focus"];
  const headline = lines[0] || "";
  const sections = [];
  let current = null;

  for (let i = 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (knownTitles.includes(line)) {
      if (current) sections.push(current);
      current = { title: line, body: "" };
      continue;
    }

    if (!current) {
      current = { title: "Current posture", body: line };
    } else {
      current.body = current.body ? `${current.body} ${line}` : line;
    }
  }

  if (current) sections.push(current);
  return { headline, sections };
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

function buildLocalFallbackInsight(portfolio, summaries) {
  const topProgram = portfolio?.topProgram;
  const externalLeader = portfolio?.externalLeader?.program;
  const riskLevel =
    (portfolio?.externalLeader?.ratio ?? 0) >= 0.75
      ? "At Risk"
      : (portfolio?.externalLeader?.ratio ?? 0) >= 0.6
        ? "Watch"
        : "Healthy";

  const headline = `${riskLevel} portfolio signal`;
  const overview = topProgram
    ? `${topProgram.label} currently carries the largest tracked spend at ${fmtCurrency(
        topProgram.summary.totalForecast
      )}, while total tracked spend across the portfolio stands at ${fmtCurrency(
        portfolio.totalForecast
      )}.`
    : "No saved forecast data is available yet.";

  const deliveryView = externalLeader
    ? `${externalLeader.label} is currently the most externally weighted program, which keeps delivery posture watchful while external spend remains at ${fmtCurrency(
        portfolio.externalTotal
      )}.`
    : `External spend stands at ${fmtCurrency(
        portfolio.externalTotal
      )}, and delivery posture can be reviewed against current staffing mix.`;

  const recommendedFocus = portfolio?.toolsTotal
    ? `Leaders should review recurring tool investment at ${fmtCurrency(
        portfolio.toolsTotal
      )} alongside ${portfolio?.internalCount || 0} named internal FTE entries to confirm the current spend mix still supports delivery priorities.`
    : `Leaders should review the current external and staffing mix to confirm delivery priorities remain covered.`;

  return {
    insight: {
      headline,
      overview,
      deliveryView,
      recommendedFocus,
    },
  };
}

export default function ExecutiveOverview({
  entryMode = "google",
  selectedProgram,
  onSelectProgram,
  onContinue,
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statesByProgram, setStatesByProgram] = useState({});
  const [lastRefreshedAt, setLastRefreshedAt] = useState(null);
  const [insightLoading, setInsightLoading] = useState(false);
  const [insightError, setInsightError] = useState("");
  const [generatedInsight, setGeneratedInsight] = useState(null);
  const [typedInsight, setTypedInsight] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        setLoading(true);
        setError("");

        const entries = await Promise.all(
          PROGRAMS.map(async ({ id }) => {
            try {
              const state =
                entryMode === "local"
                  ? loadLocalProgramState(id)
                  : await loadProgramState(id);
              return [id, state || {}];
            } catch (e) {
              console.error(`Failed to load executive summary for ${id}:`, e);
              return [id, {}];
            }
          })
        );

        if (!cancelled) {
          setStatesByProgram(Object.fromEntries(entries));
          setLastRefreshedAt(new Date());
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
  }, [entryMode]);

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

  const insightBody = useMemo(() => {
    if (!generatedInsight?.insight) return "";

    const lines = [];
    if (generatedInsight.insight.headline) {
      lines.push(generatedInsight.insight.headline);
    }
    if (generatedInsight.insight.overview) {
      lines.push(`Current posture\n${generatedInsight.insight.overview}`);
    }
    if (generatedInsight.insight.deliveryView) {
      lines.push(`Delivery view\n${generatedInsight.insight.deliveryView}`);
    }
    if (generatedInsight.insight.recommendedFocus) {
      lines.push(`Leadership focus\n${generatedInsight.insight.recommendedFocus}`);
    }

    return lines.join("\n\n");
  }, [generatedInsight]);

  const parsedInsight = useMemo(() => parseInsightPreview(typedInsight), [typedInsight]);

  const leadershipWatchouts = useMemo(() => {
    const watchouts = [];
    if ((portfolio.externalLeader?.ratio ?? 0) >= 0.7) {
      watchouts.push(
        `${portfolio.externalLeader?.program?.label || "A program"} remains externally weighted and should be reviewed for delivery resilience.`
      );
    }
    if (portfolio.toolsTotal >= portfolio.externalTotal && portfolio.toolsTotal > 0) {
      watchouts.push(
        `Recurring tool investment at ${fmtCurrency(portfolio.toolsTotal)} is the largest controllable spend line in the current portfolio mix.`
      );
    }
    if (portfolio.internalCount > 0) {
      watchouts.push(
        `${portfolio.internalCount} named internal FTE entries should be reviewed against current delivery priorities before shifting spend.`
      );
    }
    return watchouts.slice(0, 2);
  }, [portfolio]);

  const assumptionSummary = useMemo(() => {
    const externalShare =
      portfolio.totalForecast > 0
        ? Math.round((portfolio.externalTotal / portfolio.totalForecast) * 100)
        : 0;
    const toolsShare =
      portfolio.totalForecast > 0
        ? Math.round((portfolio.toolsTotal / portfolio.totalForecast) * 100)
        : 0;

    return [
      {
        label: "Delivery Mix",
        value: `${externalShare}% external`,
        sub: "Current tracked spend weighted toward external delivery",
      },
      {
        label: "Internal Assumption",
        value: `${portfolio.avgRunPct}% run / ${portfolio.avgGrowPct}% grow`,
        sub: "Current staffing posture across named FTE entries",
      },
      {
        label: "Recurring Spend",
        value: `${toolsShare}% tools`,
        sub: "Share of tracked spend in recurring tools and services",
      },
      {
        label: "Programs in Scope",
        value: `${PROGRAMS.length}`,
        sub: "Connected, TRE, and CSC are included in this portfolio view",
      },
    ];
  }, [portfolio]);

  const refreshedLabel = lastRefreshedAt
    ? lastRefreshedAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
    : "";

  useEffect(() => {
    if (!insightBody) {
      setTypedInsight("");
      return;
    }

    let index = 0;
    setTypedInsight("");

    const timer = window.setInterval(() => {
      index += 14;
      setTypedInsight(insightBody.slice(0, index));
      if (index >= insightBody.length) {
        window.clearInterval(timer);
      }
    }, 20);

    return () => window.clearInterval(timer);
  }, [insightBody]);

  async function handleGenerateInsights() {
    if (entryMode === "local") {
      setInsightError("Generate Insights uses the latest saved cloud data and is available in signed-in mode.");
      return;
    }

    setInsightLoading(true);
    setInsightError("");

    try {
      const response = await fetch(PORTFOLIO_INSIGHTS_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });

      const payload = await response.json();
      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error || "Unable to generate insights.");
      }

      setGeneratedInsight(payload);
    } catch (e) {
      console.error("Generate Insights failed:", e);
      setGeneratedInsight(buildLocalFallbackInsight(portfolio, summaries));
      setInsightError("");
    } finally {
      setInsightLoading(false);
    }
  }

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

          {insightError ? (
            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              {insightError}
            </div>
          ) : null}

          <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MetricTile
              label="Tracked Spend Forecast"
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

          <div className="mt-6 rounded-3xl border border-slate-200 bg-white/90 p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500">
                  Assumption Summary
                </div>
                <div className="mt-1 text-sm font-semibold text-gray-900">
                  Key assumptions currently shaping the saved forecast posture
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">
                  {entryMode === "local" ? "Local mode data" : "Latest saved cloud data"}
                </div>
                <div className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-gray-700 ring-1 ring-gray-200">
                  {loading ? "Refreshing..." : `Data as of ${refreshedLabel}`}
                </div>
              </div>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {assumptionSummary.map((item) => (
                <div
                  key={item.label}
                  className="rounded-2xl border border-slate-100 bg-slate-50/70 px-4 py-3"
                >
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500">
                    {item.label}
                  </div>
                  <div className="mt-1 text-lg font-black tracking-tight text-gray-950">
                    {item.value}
                  </div>
                  <div className="mt-1 text-xs font-medium text-gray-600">{item.sub}</div>
                </div>
              ))}
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

          <div className="mt-8 rounded-3xl border border-slate-200 bg-slate-50/85 p-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Portfolio Focus Summary
                </div>
                <div className="mt-2 text-lg font-bold text-gray-900">
                  Generated from the latest saved portfolio metrics
                </div>
              </div>
              <button
                type="button"
                onClick={handleGenerateInsights}
                disabled={insightLoading || entryMode === "local"}
                className={[
                  "rounded-2xl px-5 py-3 text-sm font-semibold transition",
                  entryMode === "local"
                    ? "cursor-not-allowed border border-gray-200 bg-gray-100 text-gray-500"
                    : "bg-slate-900 text-white hover:bg-slate-800",
                  insightLoading ? "opacity-70" : "",
                ].join(" ")}
              >
                {insightLoading ? "Generating…" : "Generate Insights"}
              </button>
            </div>

            <div className="mt-5 rounded-2xl border border-white bg-white px-5 py-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                  Insight Output
                </div>
                <div className="text-xs font-semibold text-gray-500">
                  {entryMode === "local"
                    ? "Local deterministic summary"
                    : "Generated from the latest saved cloud data for Connected, TRE, and CSC"}
                </div>
              </div>
              {insightLoading ? (
                <div className="mt-4 min-h-[180px] text-base leading-7 text-gray-700">
                  Generating insights...
                  <span className="ml-1 inline-block h-5 w-0.5 animate-pulse bg-gray-500 align-middle" />
                </div>
              ) : parsedInsight.headline ? (
                <div className="mt-4 min-h-[180px]">
                  <div className="text-[2rem] font-black tracking-tight text-gray-950">
                    {parsedInsight.headline}
                  </div>
                  <div className="mt-4 space-y-4">
                    {parsedInsight.sections.map((section) => (
                      <div
                        key={section.title}
                        className="rounded-2xl border border-slate-100 bg-slate-50/70 px-4 py-3"
                      >
                        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500">
                          {section.title}
                        </div>
                        <div className="mt-1.5 text-[1.03rem] leading-7 text-gray-700">
                          {renderEmphasizedText(section.body)}
                        </div>
                      </div>
                    ))}
                  </div>
                  {leadershipWatchouts.length ? (
                    <div className="mt-4 rounded-2xl border border-blue-100 bg-blue-50/70 px-4 py-3">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-700">
                        What leaders should watch
                      </div>
                      <div className="mt-2 space-y-2 text-sm leading-6 text-slate-700">
                        {leadershipWatchouts.map((item) => (
                          <div key={item}>{renderEmphasizedText(item)}</div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="mt-4 min-h-[180px] text-base leading-7 text-gray-700">
                  Click Generate Insights to build a concise portfolio summary from the latest saved data.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
