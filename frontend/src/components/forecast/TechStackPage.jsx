import { useEffect, useMemo, useState } from "react";
import { loadLocalProgramState, loadProgramState } from "../../data/firestorePrograms";
import { MONTHS } from "../../data/hub";

const PROGRAMS = [
  { id: "all", label: "All Programs", tint: "bg-slate-900 text-white" },
  { id: "connected", label: "Connected", tint: "bg-orange-100 text-orange-900" },
  { id: "tre", label: "TRE", tint: "bg-purple-100 text-purple-900" },
  { id: "csc", label: "CSC", tint: "bg-sky-100 text-sky-900" },
];

const PROGRAM_STYLES = {
  connected: {
    ring: "ring-orange-200",
    bg: "bg-orange-100/90",
    text: "text-orange-900",
  },
  tre: {
    ring: "ring-purple-200",
    bg: "bg-purple-100/90",
    text: "text-purple-900",
  },
  csc: {
    ring: "ring-sky-200",
    bg: "bg-sky-100/90",
    text: "text-sky-900",
  },
  mixed: {
    ring: "ring-slate-200",
    bg: "bg-white/90",
    text: "text-slate-900",
  },
};

function fmtCurrency(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function sumTool(item) {
  return MONTHS.reduce((sum, month) => {
    return (
      sum +
      Number(item?.msByMonth?.[month] ?? 0) +
      Number(item?.nfByMonth?.[month] ?? 0)
    );
  }, 0);
}

function aggregateTools(statesByProgram, programFilter) {
  const activePrograms =
    programFilter === "all"
      ? ["connected", "tre", "csc"]
      : [programFilter];

  const byTool = new Map();

  for (const programId of activePrograms) {
    const state = statesByProgram?.[programId] || {};
    const items = Array.isArray(state?.tnsItems) ? state.tnsItems : [];

    for (const item of items) {
      const rawName = String(item?.name ?? "").trim();
      if (!rawName) continue;

      const key = rawName.toLowerCase();
      const total = sumTool(item);
      const current = byTool.get(key) || {
        id: key,
        name: rawName,
        total: 0,
        programs: {
          connected: 0,
          tre: 0,
          csc: 0,
        },
      };

      current.total += total;
      current.programs[programId] += total;
      byTool.set(key, current);
    }
  }

  const list = Array.from(byTool.values()).sort((a, b) => b.total - a.total);
  const maxTotal = Math.max(1, ...list.map((item) => item.total));
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));

  return list.map((tool, index) => {
    const size = 72 + (tool.total / maxTotal) * 92;
    let x = 50;
    let y = 50;

    if (list.length > 1) {
      const ratio = list.length === 1 ? 0 : index / Math.max(1, list.length - 1);
      const radius = 6 + Math.sqrt(ratio) * 38;
      const angle = index * goldenAngle;
      x = 50 + Math.cos(angle) * radius;
      y = 50 + Math.sin(angle) * radius;
    }

    let dominantProgram = "mixed";
    let dominantValue = 0;
    for (const programId of ["connected", "tre", "csc"]) {
      const value = Number(tool.programs?.[programId] ?? 0);
      if (value > dominantValue) {
        dominantValue = value;
        dominantProgram = programId;
      }
    }

    const activeProgramsForTool = ["connected", "tre", "csc"].filter(
      (programId) => Number(tool.programs?.[programId] ?? 0) > 0
    );
    if (activeProgramsForTool.length > 1) dominantProgram = "mixed";

    return {
      ...tool,
      x,
      y,
      size,
      dominantProgram,
      activeProgramsForTool,
    };
  });
}

function InsightTile({ label, value, sub, accent = "default" }) {
  const accentClass =
    accent === "dark"
      ? "border-slate-200 bg-slate-50"
      : accent === "soft"
        ? "border-gray-200 bg-white"
        : "border-gray-200 bg-white";

  return (
    <div className={["rounded-3xl border p-5 shadow-sm", accentClass].join(" ")}>
      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500">
        {label}
      </div>
      <div className="mt-2 text-2xl font-black tracking-tight text-gray-950">{value}</div>
      {sub ? <div className="mt-1 text-sm text-gray-600">{sub}</div> : null}
    </div>
  );
}

export default function TechStackPage({ onBack, entryMode = "google" }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [programFilter, setProgramFilter] = useState("all");
  const [statesByProgram, setStatesByProgram] = useState({});
  const [hoveredId, setHoveredId] = useState(null);
  const [selectedId, setSelectedId] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        setLoading(true);
        setError("");

        const entries = await Promise.all(
          ["connected", "tre", "csc"].map(async (programId) => {
            try {
              const state =
                entryMode === "local"
                  ? loadLocalProgramState(programId)
                  : await loadProgramState(programId);
              return [programId, state || {}];
            } catch (e) {
              console.error(`Failed to load tech stack for ${programId}:`, e);
              return [programId, {}];
            }
          })
        );

        if (!cancelled) {
          setStatesByProgram(Object.fromEntries(entries));
        }
      } catch (e) {
        console.error("Failed to load tech stack view:", e);
        if (!cancelled) {
          setError("Unable to load the latest tools portfolio. You can try again from the dashboard.");
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

  const tools = useMemo(
    () => aggregateTools(statesByProgram, programFilter),
    [programFilter, statesByProgram]
  );

  const activeTool = useMemo(() => {
    if (!tools.length) return null;
    return (
      tools.find((tool) => tool.id === selectedId) ||
      tools.find((tool) => tool.id === hoveredId) ||
      tools[0]
    );
  }, [hoveredId, selectedId, tools]);

  useEffect(() => {
    if (!tools.length) {
      setSelectedId(null);
      setHoveredId(null);
      return;
    }

    if (selectedId && !tools.some((tool) => tool.id === selectedId)) {
      setSelectedId(null);
    }

    if (hoveredId && !tools.some((tool) => tool.id === hoveredId)) {
      setHoveredId(null);
    }
  }, [hoveredId, selectedId, tools]);

  const summary = useMemo(() => {
    const totalInvestment = tools.reduce((sum, tool) => sum + tool.total, 0);
    const topTool = tools[0] || null;
    const concentration = totalInvestment > 0 && tools.length
      ? tools
          .slice(0, Math.min(5, tools.length))
          .reduce((sum, tool) => sum + tool.total, 0) / totalInvestment
      : 0;

    const programTotals = {
      connected: 0,
      tre: 0,
      csc: 0,
    };

    for (const tool of tools) {
      for (const programId of ["connected", "tre", "csc"]) {
        programTotals[programId] += Number(tool.programs?.[programId] ?? 0);
      }
    }

    const leadingProgram = Object.entries(programTotals).reduce(
      (best, [programId, total]) => (total > best.total ? { programId, total } : best),
      { programId: "connected", total: 0 }
    );

    return {
      totalInvestment,
      topTool,
      concentration,
      leadingProgram,
    };
  }, [tools]);

  const leadingProgramLabel =
    PROGRAMS.find((program) => program.id === summary.leadingProgram.programId)?.label || "Connected";

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_20%_20%,_#eff6ff_0%,_#f8fafc_35%,_#eef2ff_68%,_#ecfeff_100%)]">
      <div className="mx-auto w-full max-w-[1500px] px-6 py-8">
        <div className="rounded-[2rem] border border-white/80 bg-white/75 p-6 shadow-2xl shadow-slate-200/70 backdrop-blur-xl">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.24em] text-gray-500">
                Tool Investments
              </div>
              <div className="mt-2 text-4xl font-black tracking-tight text-gray-950">
                Tool investment map
              </div>
              <div className="mt-2 max-w-3xl text-sm leading-7 text-gray-600 sm:text-base">
                Review tools and platform investments across Connected, TRE, and CSC in one visual view.
                Bubble size reflects tracked spend and hover shows program cost concentration.
              </div>
            </div>

            <button
              type="button"
              onClick={onBack}
              className="rounded-2xl border border-gray-200 bg-white px-5 py-3 text-sm font-semibold text-gray-900 hover:bg-gray-50"
            >
              Back to Dashboard
            </button>
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            {PROGRAMS.map((program) => {
              const active = programFilter === program.id;
              return (
                <button
                  key={program.id}
                  type="button"
                  onClick={() => setProgramFilter(program.id)}
                  className={[
                    "rounded-full px-4 py-2 text-sm font-semibold transition",
                    active
                      ? program.tint
                      : "border border-gray-200 bg-white text-gray-700 hover:bg-gray-50",
                  ].join(" ")}
                >
                  {program.label}
                </button>
              );
            })}
          </div>

          {error ? (
            <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              {error}
            </div>
          ) : null}

          <div className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1.3fr)_360px]">
            <div className="rounded-[2rem] border border-gray-200 bg-white/90 p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-bold text-gray-900">Investment Constellation</div>
                  <div className="mt-1 text-xs font-semibold text-gray-500">
                    Hover a tool to inspect tracked spend and program contribution.
                  </div>
                </div>

                <div className="rounded-full bg-slate-50 px-3 py-1 text-xs font-semibold text-gray-600 ring-1 ring-gray-200">
                  {loading ? "Loading..." : `${tools.length} tools`}
                </div>
              </div>

              <div className="mt-5 flex items-center justify-center">
                <div className="relative aspect-square w-full max-w-[920px] rounded-full border border-slate-200 bg-[radial-gradient(circle_at_center,_rgba(255,255,255,0.98)_0%,_rgba(241,245,249,0.92)_58%,_rgba(226,232,240,0.95)_100%)] shadow-inner">
                  <div className="absolute inset-[6%] rounded-full border border-white/80" />
                  <div className="absolute inset-[16%] rounded-full border border-white/70" />
                  <div className="absolute inset-[28%] rounded-full border border-white/60" />

                  {!loading && tools.length === 0 ? (
                    <div className="absolute inset-0 flex items-center justify-center px-8 text-center text-sm font-semibold text-gray-500">
                      No Tools & Services investments are saved for the selected view yet.
                    </div>
                  ) : null}

                  {tools.map((tool) => {
                    const styleMeta = PROGRAM_STYLES[tool.dominantProgram] || PROGRAM_STYLES.mixed;
                    const isSelected = selectedId === tool.id;
                    const isHovered = hoveredId === tool.id;
                    const isActive = activeTool?.id === tool.id;

                    return (
                      <button
                        key={tool.id}
                        type="button"
                        onMouseEnter={() => setHoveredId(tool.id)}
                        onMouseLeave={() => setHoveredId((current) => (current === tool.id ? null : current))}
                        onFocus={() => setHoveredId(tool.id)}
                        onBlur={() => setHoveredId((current) => (current === tool.id ? null : current))}
                        onClick={() =>
                          setSelectedId((current) => (current === tool.id ? null : tool.id))
                        }
                        aria-pressed={isSelected}
                        className={[
                          "absolute z-10 -translate-x-1/2 -translate-y-1/2 rounded-full p-3 text-center shadow-lg ring-1 transition duration-200",
                          styleMeta.bg,
                          styleMeta.text,
                          styleMeta.ring,
                          isSelected
                            ? "z-30 scale-[1.22] shadow-2xl ring-2"
                            : isHovered
                              ? "z-20 scale-110 shadow-xl"
                              : "hover:scale-105",
                          selectedId && !isActive ? "opacity-70" : "opacity-100",
                        ].join(" ")}
                        style={{
                          left: `${tool.x}%`,
                          top: `${tool.y}%`,
                          width: `${tool.size}px`,
                          height: `${tool.size}px`,
                        }}
                        title={`${tool.name}: ${fmtCurrency(tool.total)}`}
                      >
                        <div className="overflow-hidden text-[11px] font-bold leading-tight">
                          {tool.name}
                        </div>
                        {tool.size >= 110 || isActive ? (
                          <div className="mt-1 text-[10px] font-semibold opacity-80">
                            {fmtCurrency(tool.total)}
                          </div>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <InsightTile
                label="Total Tools Investment"
                value={loading ? "Loading..." : fmtCurrency(summary.totalInvestment)}
                sub="Aggregated Tools & Services tracked spend"
                accent="dark"
              />
              <InsightTile
                label="Active Tools"
                value={loading ? "..." : `${tools.length}`}
                sub="Distinct named tools in the selected view"
              />
              <InsightTile
                label="Top Cost Tool"
                value={loading ? "..." : summary.topTool?.name || "None"}
                sub={
                  loading || !summary.topTool
                    ? "Reviewing saved tool entries"
                    : `${fmtCurrency(summary.topTool.total)} tracked across the selected view`
                }
              />
              <InsightTile
                label="Leading Program"
                value={loading ? "..." : leadingProgramLabel}
                sub={
                  loading
                    ? "Calculating program concentration"
                    : `${fmtCurrency(summary.leadingProgram.total)} in tool investment`
                }
              />
              <InsightTile
                label="Top 5 Concentration"
                value={loading ? "..." : `${Math.round(summary.concentration * 100)}%`}
                sub="Share of tracked spend concentrated in the top five tools"
              />

              <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500">
                  {selectedId ? "Selected Tool" : "Hover Detail"}
                </div>
                {activeTool ? (
                  <div className="mt-3">
                    <div className="text-2xl font-black tracking-tight text-gray-950">
                      {activeTool.name}
                    </div>
                    <div className="mt-1 text-sm font-semibold text-gray-500">
                      {fmtCurrency(activeTool.total)} tracked spend
                    </div>

                    <div className="mt-4 space-y-2">
                      {["connected", "tre", "csc"].map((programId) => {
                        const amount = Number(activeTool.programs?.[programId] ?? 0);
                        const label =
                          PROGRAMS.find((program) => program.id === programId)?.label || programId;

                        return (
                          <div
                            key={programId}
                            className="flex items-center justify-between rounded-2xl bg-gray-50 px-3 py-2"
                          >
                            <span className="text-sm font-semibold text-gray-700">{label}</span>
                            <span className="text-sm font-bold text-gray-900">
                              {fmtCurrency(amount)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 text-sm text-gray-500">
                    Hover over a tool node to preview it, or click one to lock it in focus.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
