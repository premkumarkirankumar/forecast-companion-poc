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
  {
    id: "savings-levers",
    label: "Savings Levers",
    title: "Savings levers",
    description:
      "Lightweight cost-save scenarios based on tool spend, external reliance, and low-disruption planning levers.",
    accent: "border-amber-100 bg-amber-50/70",
  },
];

const SAVINGS_MODES = [
  {
    id: "low",
    label: "Low Target",
    description: "Conservative, low-disruption levers first",
  },
  {
    id: "medium",
    label: "Medium Target",
    description: "Balanced savings mix across tools and external spend",
  },
  {
    id: "aggressive",
    label: "Aggressive Target",
    description: "Higher savings reach with stronger cost actions",
  },
  {
    id: "risk-cover",
    label: "Risk-cover Ranking",
    description: "Order options by lower disruption and delivery safety",
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

function sumTrackedMonths(item) {
  return MONTHS.reduce((sum, month) => {
    return (
      sum +
      Number(item?.msByMonth?.[month] ?? 0) +
      Number(item?.nfByMonth?.[month] ?? 0)
    );
  }, 0);
}

function parseWholeNumberInput(value) {
  const digits = String(value ?? "").replace(/[^\d]/g, "");
  return digits ? Number(digits) : 0;
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

function normalizeRoleText(role) {
  const value = String(role || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return value ? ` ${value} ` : "";
}

function hasRoleKeyword(normalizedRole, keywords) {
  return keywords.some((keyword) => normalizedRole.includes(` ${keyword} `));
}

function getRoleProfile(role) {
  const normalizedRole = normalizeRoleText(role);
  if (!normalizedRole) {
    return {
      isDeveloper: false,
      isQa: false,
      tier: "Other Specialized",
    };
  }

  const isLeadership = hasRoleKeyword(normalizedRole, [
    "lead",
    "manager",
    "architect",
    "principal",
    "director",
    "head",
  ]);
  const isSenior = hasRoleKeyword(normalizedRole, ["senior", "sr", "staff"]);
  const isQa = hasRoleKeyword(normalizedRole, [
    "qa",
    "qe",
    "quality",
    "test",
    "tester",
    "testing",
    "sdet",
    "validation",
    "verification",
  ]);
  const isDeveloper = hasRoleKeyword(normalizedRole, [
    "developer",
    "dev",
    "engineer",
    "eng",
    "sde",
    "frontend",
    "backend",
    "fullstack",
    "devops",
  ]);

  const tier = isLeadership
    ? "Leadership / Architecture"
    : isSenior
      ? "Senior Delivery"
      : isQa
        ? "QA / Validation"
        : isDeveloper
          ? "Core Builders"
          : "Other Specialized";

  return {
    isDeveloper,
    isQa,
    tier,
  };
}

function classifyRoleTier(role) {
  return getRoleProfile(role).tier;
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
        roleProfile: getRoleProfile(item?.role),
        type: "FTE",
      }))
      .filter((person) => person.name);

    const contractorPeople = contractorItems
      .map((item) => ({
        id: `contractor-${item?.id || item?.name || crypto.randomUUID()}`,
        name: String(item?.name ?? "").trim(),
        meta: item?.role ? String(item.role).trim() : "",
        roleProfile: getRoleProfile(item?.role),
        type: "Contractor",
      }))
      .filter((person) => person.name);

    const internalDeveloperCount = internalPeople.filter((person) => person.roleProfile.isDeveloper).length;
    const internalQaCount = internalPeople.filter((person) => person.roleProfile.isQa).length;
    const contractorDeveloperCount = contractorPeople.filter(
      (person) => person.roleProfile.isDeveloper
    ).length;
    const contractorQaCount = contractorPeople.filter((person) => person.roleProfile.isQa).length;

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
    const toolItems = Array.isArray(state?.tnsItems) ? state.tnsItems : [];

    let runSignal = 0;
    let buildSignal = 0;
    let internalCount = 0;
    let contractorCount = 0;
    let externalWeightedCount = 0;
    let developerCount = 0;
    let qaCount = 0;

    for (const item of internalItems) {
      const role = String(item?.role || "").trim();
      const roleProfile = getRoleProfile(role);
      runSignal += Number(item?.runPct ?? 0);
      buildSignal += Number(item?.growthPct ?? 0);
      internalCount += 1;

      if (role) {
        const tier = roleProfile.tier;
        tierCounter.set(tier, (tierCounter.get(tier) || 0) + 1);
        const tierDetails = tierDetailCounter.get(tier);
        tierDetails.set(role, (tierDetails.get(role) || 0) + 1);
        if (roleProfile.isDeveloper) developerCount += 1;
        if (roleProfile.isQa) qaCount += 1;
      }
    }

    for (const item of contractorItems) {
      const role = String(item?.role || "").trim();
      const roleProfile = getRoleProfile(role);
      runSignal += Number(item?.msPct ?? 0);
      buildSignal += Number(item?.nfPct ?? 0);
      contractorCount += 1;
      externalWeightedCount += 1;

      if (role) {
        const tier = roleProfile.tier;
        tierCounter.set(tier, (tierCounter.get(tier) || 0) + 1);
        const tierDetails = tierDetailCounter.get(tier);
        tierDetails.set(role, (tierDetails.get(role) || 0) + 1);
        if (roleProfile.isDeveloper) developerCount += 1;
        if (roleProfile.isQa) qaCount += 1;
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

    const topTool =
      toolItems
        .map((item) => ({
          name: String(item?.name || "").trim(),
          total: sumTool(item),
        }))
        .filter((item) => item.name)
        .sort((a, b) => b.total - a.total)[0] || null;

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
      topTool,
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
  const totalTierCount = Array.from(tierCounter.values()).reduce((sum, count) => sum + count, 0);
  const dominantRoleShare =
    topRoleTier && totalTierCount > 0 ? (topRoleTier.count / totalTierCount) * 100 : 0;
  const attentionProgram =
    programBreakdown
      .slice()
      .sort((a, b) => {
        if (b.riskSignals.length !== a.riskSignals.length) {
          return b.riskSignals.length - a.riskSignals.length;
        }
        return b.externalReliancePct - a.externalReliancePct;
      })[0] || null;
  const signalCards = [];

  if (benchmarkStatus === "Needs QA coverage") {
    signalCards.push({
      title: "QA coverage gap",
      detail: "Developers are present, but no QA capacity is currently represented in this view.",
      tone: "critical",
    });
  } else if (benchmarkStatus === "Above 3 : 1 benchmark") {
    signalCards.push({
      title: "Developer-heavy mix",
      detail: `The current ${ratio} ratio is above the 3 : 1 benchmark and may need stronger QA support.`,
      tone: "warning",
    });
  } else if (benchmarkStatus === "QA-heavy mix") {
    signalCards.push({
      title: "QA-weighted coverage",
      detail: `The current ${ratio} ratio is below 2 : 1, indicating heavier QA coverage than the benchmark range.`,
      tone: "watch",
    });
  } else if (benchmarkStatus === "Meeting benchmark") {
    signalCards.push({
      title: "Benchmark range is healthy",
      detail: `The current ${ratio} ratio is inside the 2 : 1 to 3 : 1 target range.`,
      tone: "positive",
    });
  }

  if (buildPct < 25) {
    signalCards.push({
      title: "Build capacity is light",
      detail: `Only ${clampPctDisplay(buildPct)}% of weighted delivery capacity is pointed at build work.`,
      tone: "warning",
    });
  }

  if (totals.externalReliance / divisor > 60) {
    signalCards.push({
      title: "External reliance is elevated",
      detail: `${clampPctDisplay(
        totals.externalReliance / divisor
      )}% of delivery capacity is externally weighted across the selected view.`,
      tone: "warning",
    });
  }

  if (dominantRoleShare >= 45 && topRoleTier) {
    signalCards.push({
      title: "Role mix is concentrated",
      detail: `${topRoleTier.label} accounts for ${clampPctDisplay(
        dominantRoleShare
      )}% of the mapped role pyramid.`,
      tone: "watch",
    });
  }

  if (!signalCards.length) {
    signalCards.push({
      title: "Delivery mix is steady",
      detail: "Current delivery composition is balanced across benchmark, sourcing, and role coverage signals.",
      tone: "positive",
    });
  }

  const signalToneRank = { positive: 0, watch: 1, warning: 2, critical: 3 };
  const highestTone = signalCards.reduce(
    (best, signal) =>
      signalToneRank[signal.tone] > signalToneRank[best] ? signal.tone : best,
    "positive"
  );
  const overallStatusLabel =
    highestTone === "critical"
      ? "At Risk"
      : highestTone === "warning" || highestTone === "watch"
        ? "Watch"
        : "Healthy";
  const overallStatusTone =
    highestTone === "critical"
      ? "critical"
      : highestTone === "warning" || highestTone === "watch"
        ? "watch"
        : "positive";
  const overallStatusDetail =
    overallStatusLabel === "At Risk"
      ? "Immediate delivery watchouts are present in the selected view and should be reviewed before additional cost actions."
      : overallStatusLabel === "Watch"
        ? "The delivery posture is workable, but one or more benchmark or sourcing indicators need attention."
        : "The current delivery posture is balanced across benchmark, sourcing, and role coverage indicators.";
  const topRiskDriver =
    signalCards
      .slice()
      .sort((a, b) => signalToneRank[b.tone] - signalToneRank[a.tone])[0]?.title ||
    "No active delivery watchouts";

  return {
    buildPct,
    runPct,
    ratio,
    benchmarkStatus,
    overallStatusLabel,
    overallStatusTone,
    overallStatusDetail,
    topRiskDriver,
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
    signalCards,
    riskSignals: uniqueRisks.length
      ? uniqueRisks
      : ["Delivery composition looks balanced across the selected view."],
  };
}

function aggregateSavingsLevers(
  statesByProgram,
  programFilter,
  targetAmount,
  deliveryComposition,
  mode
) {
  const activePrograms = getActiveProgramIds(programFilter);
  const guardedPrograms = new Set(
    (deliveryComposition?.programBreakdown || [])
      .filter((program) => Array.isArray(program.riskSignals) && program.riskSignals.length > 0)
      .map((program) => program.programId)
  );
  const toolCounter = new Map();
  const externalByProgram = [];
  let totalExternal = 0;

  for (const programId of activePrograms) {
    const state = statesByProgram?.[programId] || {};
    const toolItems = Array.isArray(state?.tnsItems) ? state.tnsItems : [];
    const contractorItems = Array.isArray(state?.contractors) ? state.contractors : [];
    const sowItems = Array.isArray(state?.sows) ? state.sows : [];

    for (const item of toolItems) {
      const name = String(item?.name || "").trim();
      if (!name) continue;
      toolCounter.set(name, (toolCounter.get(name) || 0) + sumTool(item));
    }

    const externalTotal =
      contractorItems.reduce((sum, item) => sum + sumTrackedMonths(item), 0) +
      sowItems.reduce((sum, item) => sum + sumTrackedMonths(item), 0);
    totalExternal += externalTotal;
    externalByProgram.push({
      programId,
      label: PROGRAMS.find((program) => program.id === programId)?.label || programId.toUpperCase(),
      total: externalTotal,
      guarded: guardedPrograms.has(programId),
    });
  }

  const topTools = Array.from(toolCounter.entries())
    .map(([name, total]) => ({ name, total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 3);
  const eligibleExternalPrograms = externalByProgram.filter((program) => !program.guarded);
  const highestExternalProgram =
    eligibleExternalPrograms.slice().sort((a, b) => b.total - a.total)[0] || null;
  const highestGuardedExternalProgram =
    externalByProgram
      .filter((program) => program.guarded)
      .sort((a, b) => b.total - a.total)[0] || null;
  const totalToolSpend = Array.from(toolCounter.values()).reduce((sum, value) => sum + value, 0);
  const topToolSpend = topTools.reduce((sum, tool) => sum + tool.total, 0);
  const remainingToolSpend = Math.max(0, totalToolSpend - topToolSpend);
  const totalEligibleExternal = eligibleExternalPrograms.reduce(
    (sum, program) => sum + program.total,
    0
  );
  const highestExternalTotal = highestExternalProgram?.total || 0;
  const remainingExternalSpend = Math.max(0, totalEligibleExternal - highestExternalTotal);

  const suggestions = [];
  const target = Math.max(0, Number(targetAmount || 0));
  const config =
    mode === "low"
      ? {
          toolPct: 0.03,
          externalPct: 0.02,
          internalShiftPct: 0.015,
          expandThreshold: false,
          riskOrder: false,
        }
      : mode === "aggressive"
        ? {
            toolPct: 0.07,
            externalPct: 0.05,
            internalShiftPct: 0.03,
            expandThreshold: true,
            riskOrder: false,
          }
        : mode === "risk-cover"
          ? {
              toolPct: 0.03,
              externalPct: 0.02,
              internalShiftPct: 0.01,
              expandThreshold: true,
              riskOrder: true,
            }
          : {
              toolPct: 0.05,
              externalPct: 0.03,
              internalShiftPct: 0.02,
              expandThreshold: true,
              riskOrder: false,
            };

  for (const tool of topTools) {
    suggestions.push({
      title: `Renegotiate ${tool.name}`,
      savings: Math.round(tool.total * config.toolPct),
      detail: `A ${Math.round(
        config.toolPct * 100
      )}% optimization on this recurring tool line yields low-disruption savings.`,
      lane: "Tools",
      risk: "Low",
      rank: 1,
    });
  }

  if (highestExternalProgram && highestExternalProgram.total > 0) {
    suggestions.push({
      title: `Right-size external demand in ${highestExternalProgram.label}`,
      savings: Math.round(highestExternalProgram.total * config.externalPct),
      detail: `A ${Math.round(
        config.externalPct * 100
      )}% trim on the heaviest external program can free savings without materially shifting delivery scope.`,
      lane: "External",
      risk: mode === "aggressive" ? "Medium" : "Low",
      rank: mode === "risk-cover" ? 2 : 3,
    });
  }

  if (!highestExternalProgram && highestGuardedExternalProgram) {
    suggestions.push({
      title: `Protect delivery in ${highestGuardedExternalProgram.label}`,
      savings: 0,
      detail:
        "The highest external-spend program is already flagged by Delivery Composition, so this view avoids recommending a direct cut there.",
      lane: "Guardrail",
      risk: "Low",
      rank: 0,
    });
  }

  if (deliveryComposition.averageExternalReliance > 60 && totalEligibleExternal > 0) {
    suggestions.push({
      title: "Shift a small share to internal capacity",
      savings: Math.round(remainingExternalSpend * config.internalShiftPct),
      detail:
        "Reducing external reliance slightly across non-guarded programs is the cleanest structural lever when contractor and SOW mix is elevated.",
      lane: "Mix",
      risk: mode === "aggressive" ? "Medium" : "Low",
      rank: mode === "risk-cover" ? 1 : 2,
    });
  }

  let totalPotential = suggestions.reduce((sum, item) => sum + item.savings, 0);

  if (config.expandThreshold && target > totalPotential && remainingToolSpend > 0) {
    suggestions.push({
      title: "Tighten broader tool governance",
      savings: Math.round(remainingToolSpend * (mode === "aggressive" ? 0.04 : 0.02)),
      detail:
        "A control on the remaining tools portfolio can capture additional savings beyond the largest line items already targeted above.",
      lane: "Tools",
      risk: "Medium",
      rank: 4,
    });
    totalPotential = suggestions.reduce((sum, item) => sum + item.savings, 0);
  }

  if (
    config.expandThreshold &&
      target > totalPotential &&
      highestExternalProgram &&
      highestExternalProgram.total > 0
    ) {
    const incrementalExternalPct = Math.max(
      0,
      (mode === "aggressive" ? 0.07 : 0.05) - config.externalPct
    );
    suggestions.push({
      title: `Phase external scope in ${highestExternalProgram.label}`,
      savings: Math.round(highestExternalProgram.total * incrementalExternalPct),
      detail:
        "A second-pass phasing option on the largest external program adds incremental savings beyond the first external trim.",
      lane: "External",
      risk: "High",
      rank: 5,
    });
    totalPotential = suggestions.reduce((sum, item) => sum + item.savings, 0);
  }

  if (config.expandThreshold && target > totalPotential && remainingExternalSpend > 0) {
    suggestions.push({
      title: "Pause lower-priority external increments",
      savings: Math.round(remainingExternalSpend * (mode === "aggressive" ? 0.03 : 0.015)),
      detail:
        "A targeted hold on non-critical external expansion creates extra headroom after the primary external levers are already applied.",
      lane: "Mix",
      risk: "High",
      rank: 6,
    });
    totalPotential = suggestions.reduce((sum, item) => sum + item.savings, 0);
  }

  const orderedSuggestions = config.riskOrder
    ? suggestions
        .slice()
        .sort((a, b) => {
          const riskScore = { Low: 0, Medium: 1, High: 2 };
          if (riskScore[a.risk] !== riskScore[b.risk]) {
            return riskScore[a.risk] - riskScore[b.risk];
          }
          return (a.rank || 99) - (b.rank || 99);
        })
    : suggestions;

  totalPotential = orderedSuggestions.reduce((sum, item) => sum + item.savings, 0);

  return {
    suggestions: orderedSuggestions,
    totalPotential,
    target,
    coveragePct: target > 0 ? Math.min(100, Math.round((totalPotential / target) * 100)) : 0,
    remainingGap: Math.max(0, target - totalPotential),
    modeLabel: SAVINGS_MODES.find((item) => item.id === mode)?.label || "Medium Target",
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
  const [lastRefreshedAt, setLastRefreshedAt] = useState(null);
  const [hoveredId, setHoveredId] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [savingsTargetInput, setSavingsTargetInput] = useState("200000");
  const [savingsMode, setSavingsMode] = useState("medium");

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
          setLastRefreshedAt(new Date());
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
  const savingsTargetValue = useMemo(
    () => parseWholeNumberInput(savingsTargetInput),
    [savingsTargetInput]
  );
  const savingsLevers = useMemo(
    () =>
      aggregateSavingsLevers(
        statesByProgram,
        programFilter,
        savingsTargetValue,
        deliveryComposition,
        savingsMode
      ),
    [deliveryComposition, programFilter, savingsMode, savingsTargetValue, statesByProgram]
  );
  const noRegretSuggestions = useMemo(
    () =>
      savingsLevers.suggestions
        .filter((item) => item.risk === "Low" && item.savings > 0 && item.lane !== "Guardrail")
        .slice(0, 3),
    [savingsLevers]
  );
  const scenarioComparisons = useMemo(
    () =>
      SAVINGS_MODES.map((mode) => ({
        mode,
        result: aggregateSavingsLevers(
          statesByProgram,
          programFilter,
          savingsTargetValue,
          deliveryComposition,
          mode.id
        ),
      })),
    [deliveryComposition, programFilter, savingsTargetValue, statesByProgram]
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
  const refreshedLabel = lastRefreshedAt
    ? lastRefreshedAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
    : "";

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
            </div>

            <button
              type="button"
              onClick={onBack}
              className="rounded-2xl border border-gray-200 bg-white px-5 py-3 text-sm font-semibold text-gray-900 hover:bg-gray-50"
            >
              Back to Dashboard
            </button>
          </div>

          <div className="mt-5 rounded-[2rem] border border-gray-200 bg-white/90 px-5 py-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500">
                  Strategic Summary
                </div>
                <div className="mt-1 text-sm font-semibold text-gray-900">
                  Current portfolio planning signals across tools, workforce, delivery, and savings scenarios.
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">
                  {entryMode === "local" ? "Local mode data" : "Latest saved state"}
                </div>
                <div className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-gray-700 ring-1 ring-gray-200">
                  {loading ? "Refreshing..." : `Refreshed ${refreshedLabel}`}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
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
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-lg font-black tracking-tight text-gray-950">
                      {module.label}
                    </div>
                    <div className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-gray-600">
                      {active ? "Active" : "Module"}
                    </div>
                  </div>
                  <div className="mt-2 text-sm text-gray-600">{module.description}</div>
                </button>
              );
            })}
          </div>

          {(
            strategicSection === "tool-investments" ||
            strategicSection === "workforce-mix" ||
            strategicSection === "delivery-composition" ||
            strategicSection === "savings-levers"
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
          ) : strategicSection === "delivery-composition" ? (
          <div className="mt-8">
            <div className="space-y-5">
              <div className="rounded-[2rem] border border-gray-200 bg-white/90 p-5 shadow-sm">
                <div className="text-sm font-bold text-gray-900">{activeModule.title}</div>
                <div className="mt-1 text-xs font-semibold text-gray-500">
                  Delivery composition highlights execution balance only: build vs run posture,
                  role-tier distribution, and benchmark-based risk signals across the selected view.
                </div>
              </div>

              <div
                className={[
                  "rounded-[2rem] border p-5 shadow-sm",
                  deliveryComposition.overallStatusTone === "critical"
                    ? "border-rose-200 bg-rose-50/90"
                    : deliveryComposition.overallStatusTone === "watch"
                      ? "border-amber-200 bg-amber-50/90"
                      : "border-emerald-200 bg-emerald-50/90",
                ].join(" ")}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500">
                      Strategic Summary
                    </div>
                    <div className="mt-1 text-2xl font-black tracking-tight text-gray-950">
                      {deliveryComposition.overallStatusLabel}
                    </div>
                  </div>
                  <div
                    className={[
                      "rounded-full px-3 py-1 text-xs font-semibold ring-1",
                      deliveryComposition.overallStatusTone === "critical"
                        ? "bg-rose-100 text-rose-700 ring-rose-200"
                        : deliveryComposition.overallStatusTone === "watch"
                          ? "bg-amber-100 text-amber-700 ring-amber-200"
                          : "bg-emerald-100 text-emerald-700 ring-emerald-200",
                    ].join(" ")}
                  >
                    {deliveryComposition.benchmarkStatus}
                  </div>
                </div>
                <div className="mt-2 text-sm font-medium text-gray-700">
                  {deliveryComposition.overallStatusDetail}
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
                  <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-600">
                      Top Risk Driver
                    </div>
                    <div className="mt-1 text-base font-black tracking-tight text-gray-950">
                      {deliveryComposition.topRiskDriver}
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
                      const tints = [
                        "bg-rose-100 text-rose-800",
                        "bg-sky-100 text-sky-800",
                        "bg-amber-100 text-amber-800",
                        "bg-violet-100 text-violet-800",
                        "bg-emerald-100 text-emerald-800",
                      ];
                      const tint = tints[index % tints.length];
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

                        <div className="mt-3 rounded-2xl bg-white px-4 py-3 ring-1 ring-gray-200">
                          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500">
                            Top Tool Cost
                          </div>
                          <div className="mt-1 text-sm font-bold text-gray-950">
                            {program.topTool?.name || "No tool data"}
                          </div>
                          <div className="mt-1 text-sm font-semibold text-gray-600">
                            {program.topTool ? fmtCurrency(program.topTool.total) : "No tracked spend"}
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

              <div className="rounded-[2rem] border border-gray-200 bg-white/90 p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500">
                      Delivery Signals
                    </div>
                    <div className="mt-1 text-sm font-semibold text-gray-900">
                      Leadership callouts generated from benchmark, sourcing, and role concentration
                    </div>
                  </div>
                  <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">
                    {deliveryComposition.signalCards.length} active signals
                  </div>
                </div>

                <div className="mt-4 space-y-3">
                  {deliveryComposition.signalCards.map((signal, index) => {
                    const toneClass =
                      signal.tone === "critical"
                        ? "border-rose-200 bg-rose-50/90"
                        : signal.tone === "warning"
                          ? "border-amber-200 bg-amber-50/90"
                          : signal.tone === "watch"
                            ? "border-violet-200 bg-violet-50/90"
                            : "border-emerald-200 bg-emerald-50/90";
                    const markerClass =
                      signal.tone === "critical"
                        ? "bg-rose-500"
                        : signal.tone === "warning"
                          ? "bg-amber-500"
                          : signal.tone === "watch"
                            ? "bg-violet-500"
                            : "bg-emerald-500";

                    return (
                      <div
                        key={`${signal.title}-${index}`}
                        className={["rounded-2xl border p-4 shadow-sm", toneClass].join(" ")}
                      >
                        <div className="flex items-start gap-3">
                          <div className={["mt-1 h-2.5 w-2.5 shrink-0 rounded-full", markerClass].join(" ")} />
                          <div className="min-w-0">
                            <div className="text-sm font-black tracking-tight text-gray-950">
                              {signal.title}
                            </div>
                            <div className="mt-1 text-sm text-gray-700">{signal.detail}</div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-4 rounded-2xl border border-gray-200 bg-slate-50 px-4 py-3 text-sm font-medium text-gray-600">
                  Use these signals as the quick-read summary here, then drill deeper in AI Advisor if you need narrative follow-up.
                </div>
              </div>
            </div>
          </div>
          ) : (
          <div className="mt-8">
            <div className="space-y-5">
              <div className="rounded-[2rem] border border-gray-200 bg-white/90 p-5 shadow-sm">
                <div className="text-sm font-bold text-gray-900">{activeModule.title}</div>
                <div className="mt-1 text-xs font-semibold text-gray-500">
                  Use these planning levers to identify modest savings paths that preserve delivery posture.
                </div>
              </div>

              <div className="grid gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
                <div className="rounded-[2rem] border border-gray-200 bg-white/90 p-5 shadow-sm">
                  <div className="flex flex-wrap items-end justify-between gap-4">
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500">
                        Savings Target
                      </div>
                      <div className="mt-1 text-sm font-semibold text-gray-900">
                        Set the savings goal you want this view to test
                      </div>
                    </div>

                    <div className="w-full max-w-xs">
                      <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500">
                        Target Amount
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={savingsTargetInput}
                        onChange={(e) => setSavingsTargetInput(e.target.value)}
                        onBlur={() => setSavingsTargetInput(String(parseWholeNumberInput(savingsTargetInput)))}
                        className="mt-2 w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-lg font-bold text-gray-950 outline-none focus:ring-2 focus:ring-gray-200"
                      />
                    </div>
                  </div>

                  <div className="mt-5 flex flex-wrap gap-2">
                    {SAVINGS_MODES.map((mode) => {
                      const active = savingsMode === mode.id;
                      return (
                        <button
                          key={mode.id}
                          type="button"
                          onClick={() => setSavingsMode(mode.id)}
                          className={[
                            "rounded-full px-4 py-2 text-sm font-semibold transition",
                            active
                              ? "bg-slate-900 text-white"
                              : "border border-gray-200 bg-white text-gray-700 hover:bg-gray-50",
                          ].join(" ")}
                        >
                          {mode.label}
                        </button>
                      );
                    })}
                  </div>

                  <div className="mt-5 grid gap-3 sm:grid-cols-3">
                    <div className="rounded-2xl border border-emerald-100 bg-emerald-50/80 p-4">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">
                        Potential Savings
                      </div>
                      <div className="mt-1 text-2xl font-black tracking-tight text-gray-950">
                        {fmtCurrency(savingsLevers.totalPotential)}
                      </div>
                      <div className="mt-1 text-xs font-medium text-gray-600">
                        Sum of the recommended levers listed below
                      </div>
                    </div>
                    <div className="rounded-2xl border border-sky-100 bg-sky-50/80 p-4">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-700">
                        Target Coverage
                      </div>
                      <div className="mt-1 text-2xl font-black tracking-tight text-gray-950">
                        {savingsLevers.coveragePct}%
                      </div>
                    </div>
                    <div className="rounded-2xl border border-amber-100 bg-amber-50/80 p-4">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-700">
                        Remaining Gap
                      </div>
                      <div className="mt-1 text-2xl font-black tracking-tight text-gray-950">
                        {fmtCurrency(savingsLevers.remainingGap)}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-[2rem] border border-gray-200 bg-white/90 p-5 shadow-sm">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500">
                    Planning Note
                  </div>
                  <div className="mt-2 text-sm font-semibold text-gray-900">
                    {savingsLevers.modeLabel} uses a distinct logic profile for how aggressively this page proposes savings.
                  </div>
                  <div className="mt-3 rounded-2xl border border-gray-200 bg-slate-50 px-4 py-3 text-sm text-gray-600">
                    The first suggestions are low-disruption levers. If your target exceeds those, the view adds second-pass options with progressively higher savings reach.
                  </div>
                  <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50/90 px-4 py-3 text-sm font-medium text-amber-900">
                    High-risk programs are excluded from external savings recommendations in this view.
                  </div>
                </div>
              </div>

              <div className="rounded-[2rem] border border-gray-200 bg-white/90 p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500">
                      No-Regret Actions
                    </div>
                    <div className="mt-1 text-sm font-semibold text-gray-900">
                      Safe first-pass moves that protect delivery while opening immediate savings room
                    </div>
                  </div>
                  <div className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-100">
                    {noRegretSuggestions.length} low-risk actions
                  </div>
                </div>

                <div className="mt-4 grid gap-3 lg:grid-cols-3">
                  {noRegretSuggestions.length ? (
                    noRegretSuggestions.map((item, index) => (
                      <div
                        key={`no-regret-${item.title}-${index}`}
                        className="rounded-2xl border border-emerald-100 bg-emerald-50/80 p-4 shadow-sm"
                      >
                        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">
                          {item.lane}
                        </div>
                        <div className="mt-2 text-base font-black tracking-tight text-gray-950">
                          {item.title}
                        </div>
                        <div className="mt-2 text-xl font-black tracking-tight text-gray-950">
                          {fmtCurrency(item.savings)}
                        </div>
                        <div className="mt-2 text-sm text-gray-700">{item.detail}</div>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-2xl border border-gray-200 bg-slate-50 px-4 py-3 text-sm text-gray-600 lg:col-span-3">
                      No low-risk savings actions are currently available for the selected view.
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-[2rem] border border-gray-200 bg-white/90 p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500">
                      Scenario Compare
                    </div>
                    <div className="mt-1 text-sm font-semibold text-gray-900">
                      Compare projected savings coverage across all planning modes for the current target
                    </div>
                  </div>
                  <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">
                    Target {fmtCurrency(savingsTargetValue)}
                  </div>
                </div>

                <div className="mt-4 grid gap-3 lg:grid-cols-4">
                  {scenarioComparisons.map(({ mode, result }) => {
                    const isActive = savingsMode === mode.id;
                    return (
                      <div
                        key={`scenario-${mode.id}`}
                        className={[
                          "rounded-2xl border p-4 shadow-sm",
                          isActive
                            ? "border-slate-300 bg-slate-50 ring-1 ring-slate-200"
                            : "border-gray-200 bg-white",
                        ].join(" ")}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500">
                            {mode.label}
                          </div>
                          <div className="text-[11px] font-semibold text-gray-500">
                            {isActive ? "Active" : "Mode"}
                          </div>
                        </div>
                        <div className="mt-2 text-xl font-black tracking-tight text-gray-950">
                          {fmtCurrency(result.totalPotential)}
                        </div>
                        <div className="mt-1 text-sm font-semibold text-gray-700">
                          {result.coveragePct}% coverage
                        </div>
                        <div className="mt-1 text-xs font-medium text-gray-500">
                          Gap {fmtCurrency(result.remainingGap)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-[2rem] border border-gray-200 bg-white/90 p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500">
                      Recommended Savings Levers
                    </div>
                    <div className="mt-1 text-sm font-semibold text-gray-900">
                      Logic-based cost reduction ideas that aim to preserve delivery continuity
                    </div>
                  </div>
                  <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">
                    {savingsLevers.suggestions.length} suggestions
                  </div>
                </div>

                <div className="mt-4 grid gap-4 lg:grid-cols-3">
                  {savingsLevers.suggestions.map((item, index) => {
                    const tint =
                      item.lane === "Tools"
                        ? "border-sky-100 bg-sky-50/80"
                        : item.lane === "External"
                          ? "border-amber-100 bg-amber-50/80"
                          : item.lane === "Guardrail"
                            ? "border-slate-200 bg-slate-50/90"
                          : "border-emerald-100 bg-emerald-50/80";
                    return (
                      <div
                        key={`${item.title}-${index}`}
                        className={["rounded-3xl border p-4 shadow-sm", tint].join(" ")}
                      >
                        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500">
                          {item.lane}
                        </div>
                        <div className="mt-2 text-lg font-black tracking-tight text-gray-950">
                          {item.title}
                        </div>
                        <div className="mt-2 text-2xl font-black tracking-tight text-gray-950">
                          {fmtCurrency(item.savings)}
                        </div>
                        <div className="mt-2 inline-flex rounded-full bg-white/80 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-600 ring-1 ring-gray-200">
                          {item.risk} disruption
                        </div>
                        <div className="mt-2 text-sm text-gray-700">{item.detail}</div>
                      </div>
                    );
                  })}
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
