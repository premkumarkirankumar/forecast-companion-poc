// frontend/src/components/forecast/SummaryCards.jsx

import { useEffect, useMemo, useState } from "react";
import { MONTHS } from "../../data/hub";

import MonthTable from "./MonthTable";
import InternalLabor from "./InternalLabor";

import ExternalContractorsDetails from "./ExternalContractorsDetails";
import ExternalSowDetails from "./ExternalSowDetails";
import ToolsServicesDetails from "./ToolsServicesDetails";

/* =========================================================
   LocalStorage hook
   (unchanged behavior – only aesthetics changes requested)
========================================================= */
function useLocalStorageState(key, initialValue) {
  const [state, setState] = useState(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : initialValue;
    } catch {
      return initialValue;
    }
  });

  // ✅ re-hydrate when key changes (program switch)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      setState(raw ? JSON.parse(raw) : initialValue);
    } catch {
      setState(initialValue);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(state));
      window.dispatchEvent(new CustomEvent("pfc:storage", { detail: { key } }));
    } catch {
      // ignore
    }
  }, [key, state]);

  return [state, setState];
}

/* =========================================================
   Helpers
========================================================= */
function computeRollup(items) {
  const msByMonth = Object.fromEntries(MONTHS.map((m) => [m, 0]));
  const nfByMonth = Object.fromEntries(MONTHS.map((m) => [m, 0]));

  for (const it of items || []) {
    for (const m of MONTHS) {
      msByMonth[m] += Number(it?.msByMonth?.[m] ?? 0);
      nfByMonth[m] += Number(it?.nfByMonth?.[m] ?? 0);
    }
  }

  return { msByMonth, nfByMonth };
}

/** Wrap wide content so the PAGE doesn't horizontally scroll.
 *  The scrollbar stays inside the card/panel. */
function ScrollFrame({ children, minWidthClass = "min-w-[1100px]" }) {
  return (
    <div className="w-full overflow-x-auto">
      <div className={minWidthClass}>{children}</div>
    </div>
  );
}

const PROGRAM_OPTIONS = [
  { value: "connected", label: "Connected" },
  { value: "tre", label: "TRE" },
  { value: "csc", label: "CSC" },
];

export default function SummaryCards({ selectedProgram, onProgramChange }) {
  const programKey = selectedProgram || "connected";

  // Global keys
  const actorKey = `pfc.actor`;

  // UI keys
  const activeSectionKey = `pfc.${programKey}.ui.activeSection`; // internal|tools|external
  const internalTabKey = `pfc.${programKey}.ui.internalTab`; // total|details
  const externalTabKey = `pfc.${programKey}.ui.externalTab`; // total|details
  const tnsTabKey = `pfc.${programKey}.ui.tnsTab`; // total|details

  // Internal keys
  const internalItemsKey = `pfc.${programKey}.internal.labor.items`;

  // External keys
  const contractorsKey = `pfc.${programKey}.external.contractors`;
  const sowKey = `pfc.${programKey}.external.sow`;
  const externalChangelogKey = `pfc.${programKey}.external.changelog`;

  // T&S keys
  const tnsItemsKey = `pfc.${programKey}.tns.items`;
  const tnsChangelogKey = `pfc.${programKey}.tns.changelog`;

  // Actor (kept for changelog entries; no UI for it)
  const [actor] = useLocalStorageState(actorKey, "Neo");

  // Active section selection (now shown as top tabs instead of left sidebar)
  const [activeSection, setActiveSection] = useLocalStorageState(activeSectionKey, "internal");

  // Tabs
  const [internalTab, setInternalTab] = useLocalStorageState(internalTabKey, "total");
  const [externalTab, setExternalTab] = useLocalStorageState(externalTabKey, "total");
  const [tnsTab, setTnsTab] = useLocalStorageState(tnsTabKey, "total");

  // Internal state
  const [internalLaborItems, setInternalLaborItems] = useLocalStorageState(internalItemsKey, []);

  // External state
  const [contractors, setContractors] = useLocalStorageState(contractorsKey, []);
  const [sows, setSows] = useLocalStorageState(sowKey, []);
  const [externalChangeLog, setExternalChangeLog] = useLocalStorageState(externalChangelogKey, []);

  // T&S state
  const [tnsItems, setTnsItems] = useLocalStorageState(tnsItemsKey, []);
  const [tnsChangeLog, setTnsChangeLog] = useLocalStorageState(tnsChangelogKey, []);

  // Rollups
  const contractorsRollup = useMemo(() => computeRollup(contractors), [contractors]);
  const sowRollup = useMemo(() => computeRollup(sows), [sows]);

  const externalMonthlyRows = useMemo(() => {
    return [
      {
        label: "External Contractors",
        msByMonth: contractorsRollup.msByMonth,
        nfByMonth: contractorsRollup.nfByMonth,
      },
      {
        label: "External SOW",
        msByMonth: sowRollup.msByMonth,
        nfByMonth: sowRollup.nfByMonth,
      },
    ];
  }, [contractorsRollup, sowRollup]);

  const tnsRollup = useMemo(() => computeRollup(tnsItems), [tnsItems]);

  const tnsMonthlyRows = useMemo(() => {
    return [
      {
        label: "Tools & Services",
        msByMonth: tnsRollup.msByMonth,
        nfByMonth: tnsRollup.nfByMonth,
      },
    ];
  }, [tnsRollup]);

  function logExternal(payload) {
    const entry = {
      id: crypto.randomUUID(),
      ts: new Date().toISOString(),
      actor,
      program: programKey,
      ...payload,
    };
    setExternalChangeLog((prev) => [entry, ...prev].slice(0, 300));
  }

  function logTns(payload) {
    const entry = {
      id: crypto.randomUUID(),
      ts: new Date().toISOString(),
      actor,
      program: programKey,
      ...payload,
    };
    setTnsChangeLog((prev) => [entry, ...prev].slice(0, 300));
  }

  // --- Styling maps (subtle, consistent) ---
  const sectionMeta = {
    internal: {
      title: "Internal",
      subtitle: "Internal labor (FTE) totals and assumptions",
      pill: {
        active: "border-orange-300 bg-orange-100 text-orange-900",
        idle: "border-gray-200 bg-white text-gray-900 hover:bg-orange-50",
      },
      panel: "border-orange-200 bg-orange-50/60",
      header: "text-orange-900",
    },
    tools: {
      title: "Tools & Services",
      subtitle: "Forecast tracking for tools and shared services",
      pill: {
        active: "border-purple-300 bg-purple-100 text-purple-900",
        idle: "border-gray-200 bg-white text-gray-900 hover:bg-gray-50",
      },
      panel: "border-purple-200 bg-purple-50/60",
      header: "text-purple-950",
    },
    external: {
      title: "External",
      subtitle: "External contractors and SOW tracking",
      pill: {
        active: "border-green-300 bg-green-100 text-green-900",
        idle: "border-gray-200 bg-white text-gray-900 hover:bg-gray-50",
      },
      panel: "border-green-200 bg-green-50/60",
      header: "text-green-950",
    },
  };

  const activeMeta = sectionMeta[activeSection] || sectionMeta.internal;

  const TopPill = ({ id }) => {
    const meta = sectionMeta[id];
    const isActive = activeSection === id;
    return (
      <button
        type="button"
        onClick={() => setActiveSection(id)}
        className={[
          "flex items-start gap-3 rounded-2xl border px-4 py-3 text-left shadow-sm transition",
          "min-w-[240px] md:min-w-[260px]",
          isActive ? meta.pill.active : meta.pill.idle,
        ].join(" ")}
      >
        <div className="flex-1">
          <div className="text-sm font-extrabold">{meta.title}</div>
          <div className="mt-0.5 text-xs font-medium text-gray-600">{meta.subtitle}</div>
        </div>
        <div
          className={[
            "mt-0.5 rounded-full px-3 py-1 text-xs font-bold",
            isActive ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-800",
          ].join(" ")}
        >
          {isActive ? "Open" : "View"}
        </div>
      </button>
    );
  };

  return (
    <div className="space-y-4">
      {/* Forecast Companion + Program + top section tabs (SIDE BY SIDE) */}
      <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-[280px]">
            <div className="text-xl font-extrabold text-gray-900">Forecast Companion</div>

            {/* Program dropdown */}
            <div className="mt-2 flex items-center gap-2 text-sm font-semibold text-gray-700">
              <span className="text-gray-500">Program:</span>
              <select
                value={programKey}
                onChange={(e) => onProgramChange?.(e.target.value)}
                className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-900"
              >
                {PROGRAM_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Top tabs instead of left sidebar */}
          <div className="flex w-full flex-wrap gap-3 md:w-auto">
            <TopPill id="internal" />
            <TopPill id="tools" />
            <TopPill id="external" />
          </div>
        </div>
      </div>

      {/* Full-width content panel (left-aligned, more real estate) */}
      <div
        className={[
          "rounded-3xl border p-5 shadow-sm",
          activeMeta.panel,
        ].join(" ")}
      >
        {/* Section header */}
        <div className="mb-4">
          <div className={["text-lg font-extrabold", activeMeta.header].join(" ")}>
            {activeMeta.title}
          </div>
          <div className="mt-1 text-sm font-semibold text-gray-700">{activeMeta.subtitle}</div>
        </div>

        {/* INTERNAL */}
        {activeSection === "internal" ? (
          <div className="rounded-3xl border border-gray-200 bg-white p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex gap-2">
                <button
                  onClick={() => setInternalTab("total")}
                  className={[
                    "rounded-xl px-3 py-2 text-sm font-semibold ring-1 transition",
                    internalTab === "total"
                      ? "bg-gray-900 text-white ring-gray-900"
                      : "bg-white text-gray-900 ring-gray-200 hover:bg-gray-50",
                  ].join(" ")}
                >
                  Internal Total
                </button>

                <button
                  onClick={() => setInternalTab("details")}
                  className={[
                    "rounded-xl px-3 py-2 text-sm font-semibold ring-1 transition",
                    internalTab === "details"
                      ? "bg-gray-900 text-white ring-gray-900"
                      : "bg-white text-gray-900 ring-gray-200 hover:bg-gray-50",
                  ].join(" ")}
                >
                  Internal Details
                </button>
              </div>

              <button
                onClick={() => {
                  if (confirm(`Clear saved Internal labor items for ${programKey}?`)) {
                    setInternalLaborItems([]);
                  }
                }}
                className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-50"
              >
                Reset Internal
              </button>
            </div>

            <div className="mt-5">
              <InternalLabor
                mode={internalTab}
                items={internalLaborItems}
                setItems={setInternalLaborItems}
              />
            </div>
          </div>
        ) : null}

        {/* TOOLS & SERVICES */}
        {activeSection === "tools" ? (
          <div className="rounded-3xl border border-gray-200 bg-white p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex gap-2">
                <button
                  onClick={() => setTnsTab("total")}
                  className={[
                    "rounded-xl px-3 py-2 text-sm font-semibold ring-1 transition",
                    tnsTab === "total"
                      ? "bg-gray-900 text-white ring-gray-900"
                      : "bg-white text-gray-900 ring-gray-200 hover:bg-gray-50",
                  ].join(" ")}
                >
                  T&amp;S Total
                </button>

                <button
                  onClick={() => setTnsTab("details")}
                  className={[
                    "rounded-xl px-3 py-2 text-sm font-semibold ring-1 transition",
                    tnsTab === "details"
                      ? "bg-gray-900 text-white ring-gray-900"
                      : "bg-white text-gray-900 ring-gray-200 hover:bg-gray-50",
                  ].join(" ")}
                >
                  T&amp;S Details
                </button>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => {
                    if (confirm(`Clear saved Tools & Services for ${programKey}?`)) {
                      setTnsItems([]);
                    }
                  }}
                  className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-50"
                >
                  Reset T&amp;S
                </button>

                <button
                  onClick={() => {
                    if (confirm(`Clear T&S change log for ${programKey}?`)) {
                      setTnsChangeLog([]);
                    }
                  }}
                  className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-50"
                >
                  Reset T&amp;S Log
                </button>
              </div>
            </div>

            <div className="mt-5">
              {tnsTab === "total" ? (
                <ScrollFrame>
                  <MonthTable title="Tools & Services" rows={tnsMonthlyRows} showMonthFilter />
                </ScrollFrame>
              ) : (
                <ToolsServicesDetails
                  programKey={programKey}
                  items={tnsItems}
                  setItems={setTnsItems}
                  onLog={logTns}
                />
              )}
            </div>
          </div>
        ) : null}

        {/* EXTERNAL */}
        {activeSection === "external" ? (
          <div className="rounded-3xl border border-gray-200 bg-white p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex gap-2">
                <button
                  onClick={() => setExternalTab("total")}
                  className={[
                    "rounded-xl px-3 py-2 text-sm font-semibold ring-1 transition",
                    externalTab === "total"
                      ? "bg-gray-900 text-white ring-gray-900"
                      : "bg-white text-gray-900 ring-gray-200 hover:bg-gray-50",
                  ].join(" ")}
                >
                  External Total
                </button>

                <button
                  onClick={() => setExternalTab("details")}
                  className={[
                    "rounded-xl px-3 py-2 text-sm font-semibold ring-1 transition",
                    externalTab === "details"
                      ? "bg-gray-900 text-white ring-gray-900"
                      : "bg-white text-gray-900 ring-gray-200 hover:bg-gray-50",
                  ].join(" ")}
                >
                  External Details
                </button>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => {
                    if (confirm(`Clear saved Contractors for ${programKey}?`)) {
                      setContractors([]);
                    }
                  }}
                  className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-50"
                >
                  Reset Contractors
                </button>

                <button
                  onClick={() => {
                    if (confirm(`Clear saved SOWs for ${programKey}?`)) {
                      setSows([]);
                    }
                  }}
                  className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-50"
                >
                  Reset SOWs
                </button>
              </div>
            </div>

            <div className="mt-5">
              {externalTab === "total" ? (
                <ScrollFrame>
                  <MonthTable title="External" rows={externalMonthlyRows} showMonthFilter />
                </ScrollFrame>
              ) : (
                <div className="space-y-6">
                  <ExternalContractorsDetails
                    programKey={programKey}
                    contractors={contractors}
                    setContractors={setContractors}
                    onLog={logExternal}
                  />

                  <ExternalSowDetails
                    programKey={programKey}
                    sows={sows}
                    setSows={setSows}
                    onLog={logExternal}
                  />
                </div>
              )}
            </div>

            {/* Keep changelog arrays alive for the separate Change Log page */}
            <div className="sr-only">
              {externalChangeLog.length} {tnsChangeLog.length}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}