// frontend/src/components/forecast/SummaryCards.jsx

import { useEffect, useMemo, useState } from "react";
import { MONTHS } from "../../data/hub";

import MonthTable from "./MonthTable";
import InternalLabor from "./InternalLabor";
import ExternalContractorsDetails from "./ExternalContractorsDetails";
import ExternalSowDetails from "./ExternalSowDetails";
import ToolsServicesDetails from "./ToolsServicesDetails";

import { addAutoLogEntry } from "./autoLogStore";

// ✅ Firestore helpers (shared program docs)
import { loadProgramState, saveProgramState } from "../../data/firestorePrograms";

/* =========================================================
   LocalStorage hook (UI-only preferences)
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

  // re-hydrate when key changes
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

function formatBeforeAfter(before, after) {
  const b = before === undefined ? "" : String(before);
  const a = after === undefined ? "" : String(after);
  if (!b && !a) return "";
  return b === a ? `${a}` : `${b} → ${a}`;
}

/**
 * Convert component onLog() payloads into AutoLog entries.
 * IMPORTANT: Do NOT require payload.kind. Your components don't send it.
 */
function payloadToAutoDetails(payload) {
  if (!payload) return "";

  if (payload.details) return String(payload.details);
  if (payload.message) return String(payload.message);

  const name = payload.entityName || payload.label || payload.entityType || "";
  const field = payload.field ? ` ${payload.field}` : "";
  const change =
    payload.from !== undefined || payload.to !== undefined
      ? `: ${formatBeforeAfter(payload.from, payload.to)}`
      : "";

  const out = `${name}${field}${change}`.trim();
  return out || "";
}

const PROGRAM_OPTIONS = [
  { value: "connected", label: "Connected" },
  { value: "tre", label: "TRE" },
  { value: "csc", label: "CSC" },
];

/* =========================================================
   Main
   ========================================================= */
export default function SummaryCards({ selectedProgram, onProgramChange }) {
  const programKey = selectedProgram || "connected";

  // Global keys
  const actorKey = `pfc.actor`;

  // ✅ Active section is GLOBAL and should follow you across programs
  // Default only on first load is "internal"
  const activeSectionKey = `pfc.ui.activeSection`; // internal|tools|external

  // UI keys (tabs are per-program; kept for state compatibility)
  const internalTabKey = `pfc.${programKey}.ui.internalTab`;
  const externalTabKey = `pfc.${programKey}.ui.externalTab`;
  const tnsTabKey = `pfc.${programKey}.ui.tnsTab`;

  const [actor] = useLocalStorageState(actorKey, "Neo");

  // ✅ global active section
  const [activeSection, setActiveSection] = useLocalStorageState(
    activeSectionKey,
    "internal"
  );

  // Tabs (UI-only; content shows both)
  const [, setInternalTab] = useLocalStorageState(internalTabKey, "total");
  const [, setExternalTab] = useLocalStorageState(externalTabKey, "total");
  const [, setTnsTab] = useLocalStorageState(tnsTabKey, "total");

  /* =========================================================
     PROGRAM DATA STATE (Firestore-backed)
     ========================================================= */

  // Internal state
  const [internalLaborItems, setInternalLaborItems] = useState([]);

  // External state
  const [contractors, setContractors] = useState([]);
  const [sows, setSows] = useState([]);
  const [externalChangeLog, setExternalChangeLog] = useState([]);

  // T&S state
  const [tnsItems, setTnsItems] = useState([]);
  const [tnsChangeLog, setTnsChangeLog] = useState([]);

  // Hydration guard (don’t auto-save while loading remote state)
  const [isHydrating, setIsHydrating] = useState(false);

  // ✅ Step 6B: Load program data from Firestore when program changes
  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        setIsHydrating(true);

        const remoteState = await loadProgramState(programKey);

        if (cancelled) return;

        // If nothing exists yet, keep defaults (empty arrays)
        if (!remoteState) {
          setInternalLaborItems([]);
          setContractors([]);
          setSows([]);
          setExternalChangeLog([]);
          setTnsItems([]);
          setTnsChangeLog([]);
          return;
        }

        // Apply remote state safely (guard types)
        setInternalLaborItems(
          Array.isArray(remoteState.internalLaborItems)
            ? remoteState.internalLaborItems
            : []
        );

        setContractors(
          Array.isArray(remoteState.contractors) ? remoteState.contractors : []
        );

        setSows(Array.isArray(remoteState.sows) ? remoteState.sows : []);

        setExternalChangeLog(
          Array.isArray(remoteState.externalChangeLog)
            ? remoteState.externalChangeLog
            : []
        );

        setTnsItems(
          Array.isArray(remoteState.tnsItems) ? remoteState.tnsItems : []
        );

        setTnsChangeLog(
          Array.isArray(remoteState.tnsChangeLog)
            ? remoteState.tnsChangeLog
            : []
        );
      } catch (e) {
        console.error("Failed to load Firestore program state:", e);
        // Keep app usable even if Firestore fails
      } finally {
        if (!cancelled) setIsHydrating(false);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [programKey]);

  // ✅ Step 6C: Save program data to Firestore when data changes (debounced)
  useEffect(() => {
    if (isHydrating) return;

    const t = setTimeout(() => {
      const stateToSave = {
        internalLaborItems,
        contractors,
        sows,
        externalChangeLog,
        tnsItems,
        tnsChangeLog,
      };

      saveProgramState(programKey, stateToSave).catch((e) => {
        console.error("Failed to save Firestore program state:", e);
      });
    }, 900); // debounce (500–1000ms is good)

    return () => clearTimeout(t);
  }, [
    programKey,
    internalLaborItems,
    contractors,
    sows,
    externalChangeLog,
    tnsItems,
    tnsChangeLog,
    isHydrating,
  ]);

  // Rollups
  const contractorsRollup = useMemo(
    () => computeRollup(contractors),
    [contractors]
  );
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

  /* =========================================================
     Logging
     ========================================================= */

  function writeAutoLog(payload, fallbackArea) {
    if (!payload) return;

    const area =
      payload.area ||
      fallbackArea ||
      (payload.entityType === "internal"
        ? "Internal"
        : payload.entityType === "tns"
        ? "Tools & Services"
        : "External");

    addAutoLogEntry({
      program: programKey,
      area,
      action: payload.action || "Updated",
      details: payloadToAutoDetails(payload),
      meta: {
        entityType: payload.entityType,
        entityId: payload.entityId,
        entityName: payload.entityName,
        field: payload.field,
        from: payload.from,
        to: payload.to,
      },
    });
  }

  function logInternal(payload) {
    writeAutoLog(payload, "Internal");
  }

  function logExternal(payload) {
    const entry = {
      id: crypto.randomUUID(),
      ts: new Date().toISOString(),
      actor,
      program: programKey,
      ...payload,
    };

    setExternalChangeLog((prev) => [entry, ...(prev || [])].slice(0, 300));
    writeAutoLog(payload, "External");
  }

  function logTns(payload) {
    const entry = {
      id: crypto.randomUUID(),
      ts: new Date().toISOString(),
      actor,
      program: programKey,
      ...payload,
    };

    setTnsChangeLog((prev) => [entry, ...(prev || [])].slice(0, 300));
    writeAutoLog(payload, "Tools & Services");
  }

  // --- Styling maps ---
  const sectionMeta = {
    internal: {
      title: "Internal",
      subtitle: "Internal labor (FTE) totals and assumptions",
      panel: "border-orange-200 bg-orange-50/60",
      header: "text-orange-900",
      pill: {
        active: "border-orange-300 bg-orange-100 text-orange-900",
        idle: "border-gray-200 bg-white text-gray-900 hover:bg-orange-50",
      },
    },
    tools: {
      title: "Tools & Services",
      subtitle: "Forecast tracking for tools and shared services",
      panel: "border-purple-200 bg-purple-50/60",
      header: "text-purple-950",
      pill: {
        active: "border-purple-300 bg-purple-100 text-purple-900",
        idle: "border-gray-200 bg-white text-gray-900 hover:bg-purple-50",
      },
    },
    external: {
      title: "External",
      subtitle: "External contractors and SOW tracking",
      panel: "border-green-200 bg-green-50/60",
      header: "text-green-950",
      pill: {
        active: "border-green-300 bg-green-100 text-green-900",
        idle: "border-gray-200 bg-white text-gray-900 hover:bg-green-50",
      },
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
          <div className="mt-0.5 text-xs opacity-90">{meta.subtitle}</div>
        </div>
        <div className="text-xs font-semibold opacity-90">
          {isActive ? "Open" : "View"}
        </div>
      </button>
    );
  };

  return (
    <div className="w-full">
      {/* Header */}
      <div className="px-6 pt-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <div className="text-xl font-extrabold text-gray-900">Program</div>
            <select
              value={programKey}
              onChange={(e) => onProgramChange?.(e.target.value)}
              className="rounded-2xl border border-gray-200 bg-white px-5 py-3 text-base font-extrabold text-gray-900 shadow-sm"
            >
              {PROGRAM_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-wrap gap-3 lg:justify-end">
            <TopPill id="internal" />
            <TopPill id="tools" />
            <TopPill id="external" />
          </div>
        </div>
      </div>

      {/* Active section container */}
      <div className="px-6 pb-10">
        <div className={["mt-6 rounded-3xl border p-6", activeMeta.panel].join(" ")}>
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className={["text-xl font-extrabold", activeMeta.header].join(" ")}>
                {activeMeta.title}
              </div>
              <div className="mt-1 text-sm font-semibold text-gray-600">
                {activeMeta.subtitle}
              </div>
            </div>
          </div>

          {/* INTERNAL */}
          {activeSection === "internal" ? (
            <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-5">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setInternalTab("total")}
                  className="rounded-xl px-3 py-2 text-sm font-semibold ring-1 ring-gray-200 hover:bg-gray-50"
                >
                  Internal Total
                </button>
                <button
                  type="button"
                  onClick={() => setInternalTab("details")}
                  className="rounded-xl px-3 py-2 text-sm font-semibold ring-1 ring-gray-200 hover:bg-gray-50"
                >
                  Internal Details
                </button>

                <div className="flex-1" />

                <button
                  type="button"
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
                  mode="total"
                  items={internalLaborItems}
                  setItems={setInternalLaborItems}
                  onLog={logInternal}
                />
              </div>

              <div className="mt-6 border-t pt-6">
                <InternalLabor
                  mode="details"
                  items={internalLaborItems}
                  setItems={setInternalLaborItems}
                  onLog={logInternal}
                />
              </div>
            </div>
          ) : null}

          {/* TOOLS & SERVICES */}
          {activeSection === "tools" ? (
            <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-5">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setTnsTab("total")}
                  className="rounded-xl px-3 py-2 text-sm font-semibold ring-1 ring-gray-200 hover:bg-gray-50"
                >
                  T&amp;S Total
                </button>
                <button
                  type="button"
                  onClick={() => setTnsTab("details")}
                  className="rounded-xl px-3 py-2 text-sm font-semibold ring-1 ring-gray-200 hover:bg-gray-50"
                >
                  T&amp;S Details
                </button>

                <div className="flex-1" />

                <button
                  type="button"
                  onClick={() => {
                    if (confirm(`Clear saved Tools & Services for ${programKey}?`)) {
                      setTnsItems([]);
                    }
                  }}
                  className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-50"
                >
                  Reset T&amp;S
                </button>

                {/* ✅ Removed Reset T&S Log button */}
              </div>

              {/* ✅ Month filter restored for Tools & Services */}
              <div className="mt-5">
                <MonthTable
                  title="Tools & Services"
                  rows={tnsMonthlyRows}
                  showMonthFilter={true}
                />
              </div>

              <div className="mt-6 border-t pt-6">
                <ToolsServicesDetails
                  programKey={programKey}
                  items={tnsItems}
                  setItems={setTnsItems}
                  onLog={logTns}
                />
              </div>
            </div>
          ) : null}

          {/* EXTERNAL */}
          {activeSection === "external" ? (
            <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-5">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setExternalTab("total")}
                  className="rounded-xl px-3 py-2 text-sm font-semibold ring-1 ring-gray-200 hover:bg-gray-50"
                >
                  External Total
                </button>
                <button
                  type="button"
                  onClick={() => setExternalTab("details")}
                  className="rounded-xl px-3 py-2 text-sm font-semibold ring-1 ring-gray-200 hover:bg-gray-50"
                >
                  External Details
                </button>

                <div className="flex-1" />

                <button
                  type="button"
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
                  type="button"
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

              <div className="mt-5">
                <MonthTable
                  title="External"
                  rows={externalMonthlyRows}
                  showMonthFilter={true}
                />
              </div>

              <div className="mt-6 border-t pt-6 space-y-6">
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
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}