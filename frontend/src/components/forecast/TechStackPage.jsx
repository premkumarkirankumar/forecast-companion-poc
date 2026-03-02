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

const STRATEGIC_MODULES = [
  {
    id: "tool-investments",
    label: "Tool Investment Map",
    title: "Tool investment map",
    description: "Portfolio-wide view of tool spend, concentration, and program ownership.",
    accent: "border-slate-200 bg-slate-50/80",
  },
  {
    id: "workforce-mix",
    label: "Workforce Mix",
    title: "Workforce mix",
    description:
      "Complete workforce detail across programs, including role coverage, developer-to-QA mix, and named staffing signals.",
    accent: "border-blue-100 bg-blue-50/70",
  },
  {
    id: "delivery-composition",
    label: "Delivery Composition",
    title: "Delivery composition",
    description:
      "Execution balance across programs, including build-vs-run posture, role pyramid, and delivery risk signals.",
    accent: "border-emerald-100 bg-emerald-50/70",
  },
];

function fmtCurrency(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function formatRatio(left, right) {
  const a = Number(left || 0);
  const b = Number(right || 0);
  if (a <= 0 && b <= 0) return "0 : 0";
  if (b <= 0) return `${a} : 0`;
  return `${(a / b).toFixed(1)} : 1`;
}

function getRatioSummary(left, right) {
  const developers = Number(left || 0);
  const qa = Number(right || 0);

  if (developers <= 0 && qa <= 0) {
    return {
      ratioLabel: "0 : 0",
      roundedRatio: 0,
      benchmarkStatus: "No delivery signal",
    };
  }

  if (qa <= 0) {
    return {
      ratioLabel: `${developers} : 0`,
      roundedRatio: null,
      benchmarkStatus: "Needs QA coverage",
    };
  }

  const roundedRatio = Number((developers / qa).toFixed(1));

  return {
    ratioLabel: `${roundedRatio.toFixed(1)} : 1`,
    roundedRatio,
    benchmarkStatus:
      roundedRatio > 3.0
        ? "Above 3 : 1 benchmark"
        : roundedRatio < 2.0
          ? "QA-heavy mix"
          : "Meeting benchmark",
  };
}

function clampPctDisplay(value) {
  return Math.max(0, Math.min(100, Math.round(Number(value || 0))));
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

function getActiveProgramIds(programFilter) {
  return programFilter === "all" ? ["connected", "tre", "csc"] : [programFilter];
}

function classifyRoleTier(role) {
  const value = String(role || "").trim().toLowerCase();
  if (!value) return "Other Specialized";
  if (
    value.includes("lead") ||
    value.includes("manager") ||
    value.includes("architect") ||
    value.includes("principal") ||
    value.includes("director") ||
    value.includes("head")
  ) {
    return "Leadership / Architecture";
  }
  if (value.includes("senior") || value.includes("staff")) {
    return "Senior Delivery";
  }
  if (value.includes("qa") || value.includes("test") || value.includes("quality")) {
    return "QA / Validation";
  }
  if (value.includes("developer") || value.includes("engineer")) {
    return "Core Builders";
  }
  return "Other Specialized";
}

function aggregateWorkforce(statesByProgram, programFilter) {
  return getActiveProgramIds(programFilter).map((programId) => {
    const state = statesByProgram?.[programId] || {};
    const internalItems = Array.isArray(state?.internalLaborItems) ? state.internalLaborItems : [];
    const contractorItems = Array.isArray(state?.contractors) ? state.contractors : [];
    const sowItems = Array.isArray(state?.sows) ? state.sows : [];

    const internalPeople = internalItems
      .map((item) => ({
        id: `fte-${item?.id || item?.name || crypto.randomUUID()}`,
        name: String(item?.name ?? "").trim(),
        meta: item?.role ? String(item.role).trim() : "",
        type: "FTE",
      }))
      .filter((person) => person.name);

    const contractorPeople = contractorItems
      .map((item) => ({
        id: `contractor-${item?.id || item?.name || crypto.randomUUID()}`,
        name: String(item?.name ?? "").trim(),
        meta: item?.role ? String(item.role).trim() : "",
        type: "Contractor",
      }))
      .filter((person) => person.name);

    const matchesRole = (value, needle) =>
      String(value || "")
        .toLowerCase()
        .includes(needle);

    const internalDeveloperCount = internalPeople.filter((person) =>
      matchesRole(person.meta, "developer")
    ).length;
    const internalQaCount = internalPeople.filter((person) => matchesRole(person.meta, "qa")).length;
    const contractorDeveloperCount = contractorPeople.filter((person) =>
      matchesRole(person.meta, "developer")
    ).length;
    const contractorQaCount = contractorPeople.filter((person) =>
      matchesRole(person.meta, "qa")
    ).length;

    const roleCounter = new Map();
    for (const person of [...internalPeople, ...contractorPeople]) {
      const role = String(person.meta || "").trim();
      if (!role) continue;
      roleCounter.set(role, (roleCounter.get(role) || 0) + 1);
    }

    const roleCounts = Array.from(roleCounter.entries())
      .map(([role, count]) => ({ role, count }))
      .sort((a, b) => {
        if (b.count !== a.count) return b.count - a.count;
        return a.role.localeCompare(b.role);
      });

    const sowDeveloperCount = sowItems.reduce(
      (sum, item) => sum + Math.max(0, Number(item?.totalDevelopers ?? 0)),
      0
    );
    const sowQaCount = sowItems.reduce(
      (sum, item) => sum + Math.max(0, Number(item?.totalQa ?? 0)),
      0
    );

    return {
      programId,
      label:
        PROGRAMS.find((program) => program.id === programId)?.label || programId.toUpperCase(),
      internalPeople,
      contractorPeople,
      internalDeveloperCount,
      internalQaCount,
      contractorDeveloperCount,
      contractorQaCount,
      roleCounts,
      sowDeveloperCount,
      sowQaCount,
      totalNamedPeople: internalPeople.length + contractorPeople.length,
      totalSignals:
        internalPeople.length + contractorPeople.length + sowDeveloperCount + sowQaCount,
      totalDevelopers:
        internalDeveloperCount + contractorDeveloperCount + sowDeveloperCount,
      totalQa: internalQaCount + contractorQaCount + sowQaCount,
    };
  });
}

function aggregateDeliveryComposition(statesByProgram, programFilter) {
  const activePrograms = getActiveProgramIds(programFilter);
  const tierCounter = new Map([
    ["Leadership / Architecture", 0],
    ["Senior Delivery", 0],
    ["Core Builders", 0],
    ["QA / Validation", 0],
    ["Other Specialized", 0],
  ]);
  const tierDetailCounter = new Map([
    ["Leadership / Architecture", new Map()],
    ["Senior Delivery", new Map()],
    ["Core Builders", new Map()],
    ["QA / Validation", new Map()],
    ["Other Specialized", new Map()],
  ]);

  const programBreakdown = activePrograms.map((programId) => {
    const state = statesByProgram?.[programId] || {};
    const internalItems = Array.isArray(state?.internalLaborItems) ? state.internalLaborItems : [];
    const contractorItems = Array.isArray(state?.contractors) ? state.contractors : [];
    const sowItems = Array.isArray(state?.sows) ? state.sows : [];

    let runSignal = 0;
    let buildSignal = 0;
    let internalCount = 0;
    let contractorCount = 0;
    let externalWeightedCount = 0;
    let developerCount = 0;
    let qaCount = 0;

    for (const item of internalItems) {
      const role = String(item?.role || "").trim();
      runSignal += Number(item?.runPct ?? 0);
      buildSignal += Number(item?.growthPct ?? 0);
      internalCount += 1;

      if (role) {
        const tier = classifyRoleTier(role);
        tierCounter.set(tier, (tierCounter.get(tier) || 0) + 1);
        const tierDetails = tierDetailCounter.get(tier);
        tierDetails.set(role, (tierDetails.get(role) || 0) + 1);
        const lower = role.toLowerCase();
        if (lower.includes("developer")) developerCount += 1;
        if (lower.includes("qa")) qaCount += 1;
      }
    }

    for (const item of contractorItems) {
      const role = String(item?.role || "").trim();
      runSignal += Number(item?.msPct ?? 0);
      buildSignal += Number(item?.nfPct ?? 0);
      contractorCount += 1;
      externalWeightedCount += 1;

      if (role) {
        const tier = classifyRoleTier(role);
        tierCounter.set(tier, (tierCounter.get(tier) || 0) + 1);
        const tierDetails = tierDetailCounter.get(tier);
        tierDetails.set(role, (tierDetails.get(role) || 0) + 1);
        const lower = role.toLowerCase();
        if (lower.includes("developer")) developerCount += 1;
        if (lower.includes("qa")) qaCount += 1;
      }
    }

    for (const item of sowItems) {
      runSignal += Number(item?.msPct ?? 0);
      buildSignal += Number(item?.nfPct ?? 0);
      const sowDevelopers = Math.max(0, Number(item?.totalDevelopers ?? 0));
      const sowQa = Math.max(0, Number(item?.totalQa ?? 0));
      developerCount += sowDevelopers;
      qaCount += sowQa;
      externalWeightedCount += sowDevelopers + sowQa;
      if (sowDevelopers > 0) {
        tierCounter.set(
          "Core Builders",
          (tierCounter.get("Core Builders") || 0) + sowDevelopers
        );
      }
      if (sowQa > 0) {
        tierCounter.set(
          "QA / Validation",
          (tierCounter.get("QA / Validation") || 0) + sowQa
        );
      }
    }

    const totalSignal = runSignal + buildSignal;
    const buildPct = totalSignal > 0 ? (buildSignal / totalSignal) * 100 : 0;
    const runPct = totalSignal > 0 ? (runSignal / totalSignal) * 100 : 0;
    const ratioSummary = getRatioSummary(developerCount, qaCount);
    const ratioValue = ratioSummary.ratioLabel;
    const benchmarkDelta = qaCount <= 0 ? null : developerCount / qaCount - 3;
    const externalReliancePct =
      internalCount + externalWeightedCount > 0
        ? (externalWeightedCount / (internalCount + externalWeightedCount)) * 100
        : 0;

    const riskSignals = [];
    if (qaCount === 0 && developerCount > 0) {
      riskSignals.push("No QA coverage detected in the selected delivery mix.");
    } else if (qaCount > 0 && developerCount / qaCount > 4) {
      riskSignals.push("Developer-to-QA mix is above the 3 : 1 benchmark.");
    }
    if (buildPct < 25 && totalSignal > 0) {
      riskSignals.push("Build capacity is light relative to current run commitments.");
    }
    if (externalReliancePct > 60) {
      riskSignals.push("Delivery capacity is heavily weighted toward external execution.");
    }

    return {
      programId,
      label:
        PROGRAMS.find((program) => program.id === programId)?.label || programId.toUpperCase(),
      runPct,
      buildPct,
      ratioValue,
      benchmarkDelta,
      developerCount,
      qaCount,
      externalReliancePct,
      riskSignals,
    };
  });

  const totals = programBreakdown.reduce(
    (acc, program) => {
      acc.buildWeighted += program.buildPct;
      acc.runWeighted += program.runPct;
      acc.developers += program.developerCount;
      acc.qa += program.qaCount;
      acc.externalReliance += program.externalReliancePct;
      acc.riskSignals.push(...program.riskSignals);
      return acc;
    },
    {
      buildWeighted: 0,
      runWeighted: 0,
      developers: 0,
      qa: 0,
      externalReliance: 0,
      riskSignals: [],
    }
  );

  const divisor = Math.max(1, programBreakdown.length);
  const uniqueRisks = Array.from(new Set(totals.riskSignals));
  const buildPct = totals.buildWeighted / divisor;
  const runPct = totals.runWeighted / divisor;
  const totalsRatioSummary = getRatioSummary(totals.developers, totals.qa);
  const ratio = totalsRatioSummary.ratioLabel;
  const benchmarkStatus = totalsRatioSummary.benchmarkStatus;
  const topRoleTier =
    Array.from(tierCounter.entries())
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count)[0] || null;
  const attentionProgram =
    programBreakdown
      .slice()
      .sort((a, b) => {
        if (b.riskSignals.length !== a.riskSignals.length) {
          return b.riskSignals.length - a.riskSignals.length;
        }
        return b.externalReliancePct - a.externalReliancePct;
      })[0] || null;

  return {
    buildPct,
    runPct,
    ratio,
    benchmarkStatus,
    averageExternalReliance: totals.externalReliance / divisor,
    roleTiers: Array.from(tierCounter.entries())
      .map(([label, count]) => ({
        label,
        count,
        details: Array.from((tierDetailCounter.get(label) || new Map()).entries())
          .map(([role, roleCount]) => ({ role, count: roleCount }))
          .sort((a, b) => {
            if (b.count !== a.count) return b.count - a.count;
            return a.role.localeCompare(b.role);
          }),
      }))
      .filter((item) => item.count > 0),
    topRoleTier,
    attentionProgram,
    programBreakdown,
    riskSignals: uniqueRisks.length
      ? uniqueRisks
      : ["Delivery composition looks balanced across the selected view."],
  };
}

function InsightTile({ label, value, sub, accent = "default" }) {
  const accentClass =
    accent === "slate"
      ? "border-slate-200 bg-slate-50"
      : accent === "blue"
        ? "border-sky-100 bg-sky-50/80"
        : accent === "violet"
          ? "border-purple-100 bg-purple-50/80"
          : accent === "emerald"
            ? "border-emerald-100 bg-emerald-50/80"
            : accent === "amber"
              ? "border-amber-100 bg-amber-50/80"
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
  const [strategicSection, setStrategicSection] = useState("tool-investments");
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
  const workforce = useMemo(
    () => aggregateWorkforce(statesByProgram, programFilter),
    [programFilter, statesByProgram]
  );
  const deliveryComposition = useMemo(
    () => aggregateDeliveryComposition(statesByProgram, programFilter),
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

  const activeModule =
    STRATEGIC_MODULES.find((module) => module.id === strategicSection) || STRATEGIC_MODULES[0];
  const workforceSummary = useMemo(() => {
    const base = {
      internalCount: 0,
      contractorCount: 0,
      totalDeveloperCount: 0,
      totalQaCount: 0,
      totalSignals: 0,
      programCount: workforce.length,
      uniqueRoleCount: 0,
    };
    const roleCounter = new Map();

    for (const program of workforce) {
      base.internalCount += program.internalPeople.length;
      base.contractorCount += program.contractorPeople.length;
      base.totalDeveloperCount += program.totalDevelopers;
      base.totalQaCount += program.totalQa;
      base.totalSignals += program.totalSignals;
      for (const roleItem of program.roleCounts) {
        roleCounter.set(roleItem.role, (roleCounter.get(roleItem.role) || 0) + roleItem.count);
      }
    }

    base.uniqueRoleCount = roleCounter.size;

    return base;
  }, [workforce]);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_20%_20%,_#eff6ff_0%,_#f8fafc_35%,_#eef2ff_68%,_#ecfeff_100%)]">
      <div className="mx-auto w-full max-w-[1500px] px-6 py-8">
        <div className="rounded-[2rem] border border-white/80 bg-white/75 p-6 shadow-2xl shadow-slate-200/70 backdrop-blur-xl">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.24em] text-gray-500">
                Strategic View
              </div>
              <div className="mt-2 text-4xl font-black tracking-tight text-gray-950">
                Strategic planning workspace
              </div>
              <div className="mt-2 max-w-3xl text-sm leading-7 text-gray-600 sm:text-base">
                Use this page for portfolio-level planning views. Start with tool investments today,
                then extend into workforce mix, role coverage, and delivery composition over time.
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

          <div className="mt-6 grid gap-4 lg:grid-cols-3">
            {STRATEGIC_MODULES.map((module) => {
              const active = module.id === strategicSection;
              return (
                <button
                  key={module.id}
                  type="button"
                  onClick={() => setStrategicSection(module.id)}
                  className={[
                    "rounded-3xl border p-5 text-left shadow-sm transition",
                    active
                      ? "border-gray-300 bg-white shadow-md ring-1 ring-gray-200"
                      : module.accent,
                  ].join(" ")}
                >
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500">
                    {active ? "Active Module" : "Strategic Module"}
                  </div>
                  <div className="mt-2 text-xl font-black tracking-tight text-gray-950">
                    {module.label}
                  </div>
                  <div className="mt-2 text-sm text-gray-600">{module.description}</div>
                </button>
              );
            })}
          </div>

          {(
            strategicSection === "tool-investments" ||
            strategicSection === "workforce-mix" ||
            strategicSection === "delivery-composition"
          ) ? (
            <>
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

          {strategicSection === "tool-investments" ? (
          <div className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_340px]">
            <div className="rounded-[2rem] border border-gray-200 bg-white/90 p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-bold text-gray-900">{activeModule.title}</div>
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
          ) : strategicSection === "workforce-mix" ? (
          <div className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1.7fr)_300px]">
            <div className="space-y-5">
              <div className="rounded-[2rem] border border-gray-200 bg-white/90 p-5 shadow-sm">
                <div className="text-sm font-bold text-gray-900">{activeModule.title}</div>
                <div className="mt-1 text-xs font-semibold text-gray-500">
                  Names are grouped by program. Internal team members are marked as (FTE) and
                  external workers as (Contractor). SOW developer and QA counts show pooled
                  capacity signals.
                </div>
              </div>

              <div
                className={[
                  "grid gap-5",
                  "grid-cols-1",
                ].join(" ")}
              >
                {workforce.map((program) => {
                  const styleMeta = PROGRAM_STYLES[program.programId] || PROGRAM_STYLES.mixed;

                  return (
                    <div
                      key={program.programId}
                      className={[
                        "rounded-[2rem] border bg-white/90 p-5 shadow-sm",
                        styleMeta.ring,
                      ].join(" ")}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500">
                            Program
                          </div>
                          <div className="mt-1 text-2xl font-black tracking-tight text-gray-950">
                            {program.label}
                          </div>
                        </div>
                        <div
                          className={[
                            "rounded-full px-3 py-1 text-xs font-semibold",
                            styleMeta.bg,
                            styleMeta.text,
                          ].join(" ")}
                        >
                          {program.totalSignals} workforce signals
                        </div>
                      </div>

                      <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_220px]">
                        <div className="rounded-2xl border border-gray-200 bg-gray-50/80 p-4">
                          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500">
                            Internal Team
                          </div>
                          <div className="mt-3 max-h-72 overflow-y-auto pr-1">
                            <div className="space-y-2">
                            {program.internalPeople.length ? (
                              program.internalPeople.map((person) => (
                                <div
                                  key={person.id}
                                  className="rounded-2xl bg-white px-3 py-2 ring-1 ring-gray-200"
                                  title={person.meta || person.name}
                                >
                                  <div className="text-xs font-semibold leading-5 text-gray-800">
                                    {person.name} (FTE)
                                  </div>
                                  <div className="mt-0.5 text-[11px] font-medium text-gray-500">
                                    Role: {person.meta || "Not set"}
                                  </div>
                                </div>
                              ))
                            ) : (
                              <div className="text-sm text-gray-500">No internal names saved</div>
                            )}
                            </div>
                          </div>
                        </div>

                        <div className="rounded-2xl border border-gray-200 bg-gray-50/80 p-4">
                          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500">
                            External Contractors
                          </div>
                          <div className="mt-3 max-h-72 overflow-y-auto pr-1">
                            <div className="space-y-2">
                            {program.contractorPeople.length ? (
                              program.contractorPeople.map((person) => (
                                <div
                                  key={person.id}
                                  className="rounded-2xl bg-white px-3 py-2 ring-1 ring-gray-200"
                                  title={person.meta || person.name}
                                >
                                  <div className="text-xs font-semibold leading-5 text-gray-800">
                                    {person.name} (Contractor)
                                  </div>
                                  <div className="mt-0.5 text-[11px] font-medium text-gray-500">
                                    Role: {person.meta || "Not set"}
                                  </div>
                                </div>
                              ))
                            ) : (
                              <div className="text-sm text-gray-500">No contractor names saved</div>
                            )}
                            </div>
                          </div>
                        </div>

                        <div className="rounded-2xl border border-gray-200 bg-gray-50/80 p-4">
                          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500">
                            SOW Capacity
                          </div>
                          <div className="mt-3 grid gap-3">
                            <div className="rounded-2xl bg-white px-4 py-3 ring-1 ring-gray-200">
                              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500">
                                Developers
                              </div>
                              <div className="mt-1 text-2xl font-black tracking-tight text-gray-950">
                                {program.sowDeveloperCount}
                              </div>
                            </div>
                            <div className="rounded-2xl bg-white px-4 py-3 ring-1 ring-gray-200">
                              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500">
                                QA
                              </div>
                              <div className="mt-1 text-2xl font-black tracking-tight text-gray-950">
                                {program.sowQaCount}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 rounded-2xl border border-gray-200 bg-gradient-to-r from-white to-slate-50/70 p-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500">
                              Role Coverage
                            </div>
                            <div className="mt-1 text-xs font-medium text-gray-500">
                              Internal FTE and external contractor roles grouped by title
                            </div>
                          </div>
                          <div
                            className={[
                              "rounded-full px-3 py-1 text-xs font-semibold",
                              styleMeta.bg,
                              styleMeta.text,
                            ].join(" ")}
                          >
                            {program.roleCounts.length} unique roles
                          </div>
                        </div>

                        <div className="mt-3 flex max-h-44 flex-wrap gap-2 overflow-y-auto pr-1">
                          {program.roleCounts.length ? (
                            program.roleCounts.map((roleItem) => (
                              <div
                                key={`${program.programId}-${roleItem.role}`}
                                className="flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-2 shadow-sm"
                                title={`${roleItem.role}: ${roleItem.count}`}
                              >
                                <span className="text-xs font-semibold text-gray-700">
                                  {roleItem.role}
                                </span>
                                <span
                                  className={[
                                    "rounded-full px-2 py-0.5 text-[11px] font-bold",
                                    styleMeta.bg,
                                    styleMeta.text,
                                  ].join(" ")}
                                >
                                  {roleItem.count}
                                </span>
                              </div>
                            ))
                          ) : (
                            <div className="text-sm text-gray-500">No role metadata saved</div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="space-y-4">
              <InsightTile
                label="Programs in View"
                value={loading ? "..." : `${workforceSummary.programCount}`}
                sub="Programs represented in the current selection"
                accent="slate"
              />
              <InsightTile
                label="Dev-to-QA Ratio"
                value={
                  loading
                    ? "..."
                    : formatRatio(
                        workforceSummary.totalDeveloperCount,
                        workforceSummary.totalQaCount
                      )
                }
                sub="Current developer-to-QA mix across the selected view"
                accent="violet"
              />
              <InsightTile
                label="Internal FTE Names"
                value={loading ? "..." : `${workforceSummary.internalCount}`}
                sub="Named internal team entries"
                accent="blue"
              />
              <InsightTile
                label="Contractor Names"
                value={loading ? "..." : `${workforceSummary.contractorCount}`}
                sub="Named external contractor entries"
                accent="amber"
              />
              <InsightTile
                label="Unique Roles"
                value={loading ? "..." : `${workforceSummary.uniqueRoleCount}`}
                sub="Distinct role titles across internal FTEs and external contractors"
                accent="emerald"
              />
              <InsightTile
                label="Total Developers"
                value={loading ? "..." : `${workforceSummary.totalDeveloperCount}`}
                sub="Total developer capacity including internal, external contractors, and SOW capacity"
                accent="blue"
              />
              <InsightTile
                label="Total QA"
                value={loading ? "..." : `${workforceSummary.totalQaCount}`}
                sub="Total QA capacity including internal, external contractors, and SOW capacity"
                accent="violet"
              />
              <InsightTile
                label="Total Workforce Signals"
                value={loading ? "..." : `${workforceSummary.totalSignals}`}
                sub="Combined names and SOW capacity markers across the selected view"
                accent="slate"
              />
            </div>
          </div>
          ) : (
          <div className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1.65fr)_320px]">
            <div className="space-y-5">
              <div className="rounded-[2rem] border border-gray-200 bg-white/90 p-5 shadow-sm">
                <div className="text-sm font-bold text-gray-900">{activeModule.title}</div>
                <div className="mt-1 text-xs font-semibold text-gray-500">
                  Delivery composition highlights execution balance only: build vs run posture,
                  role-tier distribution, and benchmark-based risk signals across the selected view.
                </div>
              </div>

              <div className="grid gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
                <div className="rounded-[2rem] border border-gray-200 bg-white/90 p-5 shadow-sm">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500">
                        Delivery Intelligence
                      </div>
                      <div className="mt-1 text-sm font-semibold text-gray-900">
                        Focused signals for delivery balance, concentration, and immediate attention
                      </div>
                    </div>
                    <div className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-100">
                      {deliveryComposition.benchmarkStatus}
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl border border-emerald-100 bg-emerald-50/80 p-4">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">
                        Benchmark
                      </div>
                      <div className="mt-1 text-2xl font-black tracking-tight text-gray-950">
                        {deliveryComposition.ratio}
                      </div>
                      <div className="mt-1 text-xs font-medium text-gray-600">
                        Current developer-to-QA ratio
                      </div>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-600">
                        Primary Role Layer
                      </div>
                      <div className="mt-1 text-2xl font-black tracking-tight text-gray-950">
                        {deliveryComposition.topRoleTier?.label || "Not enough role data"}
                      </div>
                      <div className="mt-1 text-xs font-medium text-gray-600">
                        {deliveryComposition.topRoleTier
                          ? `${deliveryComposition.topRoleTier.count} roles in the dominant layer`
                          : "Role metadata is still building"}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-amber-100 bg-amber-50/80 p-4">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-700">
                        Attention Program
                      </div>
                      <div className="mt-1 text-2xl font-black tracking-tight text-gray-950">
                        {deliveryComposition.attentionProgram?.label || "None"}
                      </div>
                      <div className="mt-1 text-xs font-medium text-gray-600">
                        Highest risk concentration in the selected view
                      </div>
                    </div>
                    <div className="rounded-2xl border border-sky-100 bg-sky-50/80 p-4">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-700">
                        External Reliance
                      </div>
                      <div className="mt-1 text-2xl font-black tracking-tight text-gray-950">
                        {clampPctDisplay(deliveryComposition.averageExternalReliance)}%
                      </div>
                      <div className="mt-1 text-xs font-medium text-gray-600">
                        Average external delivery share across the selected programs
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-[2rem] border border-gray-200 bg-white/90 p-5 shadow-sm">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500">
                    Role Pyramid
                  </div>
                  <div className="mt-1 text-sm font-semibold text-gray-900">
                    Role layers across internal and contractor delivery teams
                  </div>

                  <div className="mt-4 space-y-3">
                    {deliveryComposition.roleTiers.map((tier, index) => {
                      const maxCount = Math.max(1, ...deliveryComposition.roleTiers.map((item) => item.count));
                      const width = 44 + (tier.count / maxCount) * 56;
                      const tint =
                        index % 3 === 0
                          ? "bg-violet-100 text-violet-800"
                          : index % 3 === 1
                            ? "bg-sky-100 text-sky-800"
                            : "bg-amber-100 text-amber-800";
                      return (
                        <div key={tier.label} className="group relative flex items-center gap-3">
                          <div className="w-40 text-xs font-semibold text-gray-600">{tier.label}</div>
                          <div
                            className={["rounded-2xl px-4 py-3 text-sm font-bold shadow-sm", tint].join(" ")}
                            style={{ width: `${width}%` }}
                          >
                            {tier.count}
                          </div>
                          <div className="pointer-events-none absolute left-40 top-full z-20 mt-2 hidden w-72 rounded-2xl border border-gray-200 bg-white p-3 shadow-xl group-hover:block">
                            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500">
                              {tier.label}
                            </div>
                            <div className="mt-2 space-y-2">
                              {tier.details.length ? (
                                tier.details.map((detail) => (
                                  <div
                                    key={`${tier.label}-${detail.role}`}
                                    className="flex items-center justify-between rounded-xl bg-gray-50 px-3 py-2"
                                  >
                                    <span className="text-xs font-semibold text-gray-700">
                                      {detail.role}
                                    </span>
                                    <span className="text-xs font-bold text-gray-900">
                                      {detail.count}
                                    </span>
                                  </div>
                                ))
                              ) : (
                                <div className="text-xs font-medium text-gray-500">
                                  SOW capacity contributes to this layer without named role titles.
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="rounded-[2rem] border border-gray-200 bg-white/90 p-5 shadow-sm">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500">
                  Program Delivery Signals
                </div>
                <div className="mt-1 text-sm font-semibold text-gray-900">
                  Program-level execution balance and benchmark position
                </div>

                <div className="mt-4 grid gap-4 lg:grid-cols-3">
                  {deliveryComposition.programBreakdown.map((program) => {
                    const styleMeta = PROGRAM_STYLES[program.programId] || PROGRAM_STYLES.mixed;
                    return (
                      <div
                        key={program.programId}
                        className="rounded-3xl border border-gray-200 bg-gray-50/80 p-4"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-lg font-black tracking-tight text-gray-950">
                            {program.label}
                          </div>
                          <div
                            className={[
                              "rounded-full px-3 py-1 text-xs font-semibold",
                              styleMeta.bg,
                              styleMeta.text,
                            ].join(" ")}
                          >
                            {program.ratioValue}
                          </div>
                        </div>

                        <div className="mt-3 grid gap-3 sm:grid-cols-2">
                          <div className="rounded-2xl bg-white px-4 py-3 ring-1 ring-gray-200">
                            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500">
                              Build vs Run
                            </div>
                            <div className="mt-1 text-xl font-black tracking-tight text-gray-950">
                              {clampPctDisplay(program.buildPct)}% / {clampPctDisplay(program.runPct)}%
                            </div>
                          </div>
                          <div className="rounded-2xl bg-white px-4 py-3 ring-1 ring-gray-200">
                            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500">
                              External Reliance
                            </div>
                            <div className="mt-1 text-xl font-black tracking-tight text-gray-950">
                              {clampPctDisplay(program.externalReliancePct)}%
                            </div>
                          </div>
                        </div>

                        <div className="mt-3 text-xs font-medium text-gray-600">
                          {program.riskSignals[0] || "Composition is balanced for the selected scope."}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <InsightTile
                label="Benchmark Status"
                value={loading ? "..." : deliveryComposition.benchmarkStatus}
                sub="Current developer-to-QA benchmark position"
                accent="emerald"
              />
              <InsightTile
                label="Dev-to-QA Ratio"
                value={loading ? "..." : deliveryComposition.ratio}
                sub="Current developer-to-QA mix across the selected view"
                accent="violet"
              />
              <InsightTile
                label="Primary Role Layer"
                value={loading ? "..." : deliveryComposition.topRoleTier?.label || "None"}
                sub={
                  loading
                    ? "Reviewing role layers"
                    : deliveryComposition.topRoleTier
                      ? `${deliveryComposition.topRoleTier.count} roles in the leading layer`
                      : "No role metadata saved"
                }
                accent="blue"
              />
              <InsightTile
                label="Attention Program"
                value={loading ? "..." : deliveryComposition.attentionProgram?.label || "None"}
                sub="Program with the highest concentration of current delivery watchouts"
                accent="amber"
              />
              <InsightTile
                label="Average External Reliance"
                value={
                  loading
                    ? "..."
                    : `${clampPctDisplay(deliveryComposition.averageExternalReliance)}%`
                }
                sub="Average external-weighted delivery share across the selected programs"
                accent="amber"
              />

              <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500">
                  Delivery Risk Signals
                </div>
                <div className="mt-3 space-y-2">
                  {deliveryComposition.riskSignals.map((signal, index) => (
                    <div
                      key={`${signal}-${index}`}
                      className="rounded-2xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-medium text-gray-700"
                    >
                      {signal}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
          )}
            </>
          ) : (
            <div className="mt-8 rounded-[2rem] border border-dashed border-gray-300 bg-white/80 p-10 text-center shadow-sm">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500">
                Coming Next
              </div>
              <div className="mt-3 text-3xl font-black tracking-tight text-gray-950">
                {activeModule.title}
              </div>
              <div className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-gray-600 sm:text-base">
                This section is reserved for the next strategic planning layer. The current update
                establishes the broader workspace, and you can keep adding new portfolio views here
                without changing the navigation again.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
