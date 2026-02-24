// frontend/src/components/forecast/SummaryCards.jsx

import { useEffect, useMemo, useState } from "react";
import { MONTHS } from "../../data/hub";

import SectionHeader from "./SectionHeader";
import MonthTable from "./MonthTable";

import InternalLabor from "./InternalLabor";

import ExternalContractorsDetails from "./ExternalContractorsDetails";
import ExternalSowDetails from "./ExternalSowDetails";
import ToolsServicesDetails from "./ToolsServicesDetails";

/* =========================================================
   LocalStorage hook
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

/* =========================================================
   Main
========================================================= */
export default function SummaryCards({ selectedProgram }) {
  const programKey = selectedProgram || "connected";

  // Global keys
  const actorKey = `pfc.actor`;

  // UI keys
  const openKey = `pfc.${programKey}.ui.openSections`;

  // Internal keys
  const internalTabKey = `pfc.${programKey}.ui.internalTab`; // total|details
  const internalItemsKey = `pfc.${programKey}.internal.labor.items`;

  // External keys
  const externalTabKey = `pfc.${programKey}.ui.externalTab`; // total|details
  const contractorsKey = `pfc.${programKey}.external.contractors`;
  const sowKey = `pfc.${programKey}.external.sow`;
  const externalChangelogKey = `pfc.${programKey}.external.changelog`;

  // T&S keys
  const tnsTabKey = `pfc.${programKey}.ui.tnsTab`; // total|details
  const tnsItemsKey = `pfc.${programKey}.tns.items`;
  const tnsChangelogKey = `pfc.${programKey}.tns.changelog`;

  const [actor, setActor] = useLocalStorageState(actorKey, "Neo");

  // Open sections
  const [open, setOpen] = useLocalStorageState(openKey, {
    internal: true,
    tools: true,
    external: true,
  });

  // Tabs
  const [internalTab, setInternalTab] = useLocalStorageState(internalTabKey, "total");
  const [externalTab, setExternalTab] = useLocalStorageState(externalTabKey, "total");
  const [tnsTab, setTnsTab] = useLocalStorageState(tnsTabKey, "total");

  // Internal state
  const [internalLaborItems, setInternalLaborItems] = useLocalStorageState(
    internalItemsKey,
    []
  );

  // External state
  const [contractors, setContractors] = useLocalStorageState(contractorsKey, []);
  const [sows, setSows] = useLocalStorageState(sowKey, []);
  const [externalChangeLog, setExternalChangeLog] = useLocalStorageState(
    externalChangelogKey,
    []
  );

  // T&S state
  const [tnsItems, setTnsItems] = useLocalStorageState(tnsItemsKey, []);
  const [tnsChangeLog, setTnsChangeLog] = useLocalStorageState(tnsChangelogKey, []);

  // External rollups -> monthly rows
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

  // T&S rollup -> single monthly row
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="text-lg font-bold text-gray-900">Forecast Companion</div>
        <div className="mt-1 text-sm text-gray-600">Program: {programKey}</div>

        <div className="mt-4 flex items-center gap-3">
          <div className="text-sm font-semibold text-gray-700">Actor</div>
          <input
            value={actor}
            onChange={(e) => setActor(e.target.value)}
            className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-900"
            placeholder="Your name"
          />
        </div>
      </div>

      {/* INTERNAL */}
      <div className="space-y-3">
        <SectionHeader
          title="Internal"
          subtitle="Internal labor (FTE) totals and assumptions"
          accent="purple"
          isOpen={open.internal}
          onToggle={() => setOpen((s) => ({ ...s, internal: !s.internal }))}
        />

        {open.internal ? (
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              {/* Internal Tabs */}
              <div className="flex items-center gap-2">
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

              {/* Internal Actions */}
              <div className="flex items-center gap-2">
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
      </div>

      {/* TOOLS & SERVICES (T&S) */}
      <div className="space-y-3">
        <SectionHeader
          title="Tools & Services"
          subtitle="Forecast tracking for tools and shared services"
          accent="purple"
          isOpen={open.tools}
          onToggle={() => setOpen((s) => ({ ...s, tools: !s.tools }))}
        />

        {open.tools ? (
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              {/* T&S Tabs */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setTnsTab("total")}
                  className={[
                    "rounded-xl px-3 py-2 text-sm font-semibold ring-1 transition",
                    tnsTab === "total"
                      ? "bg-gray-900 text-white ring-gray-900"
                      : "bg-white text-gray-900 ring-gray-200 hover:bg-gray-50",
                  ].join(" ")}
                >
                  T&S Total
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
                  T&S Details
                </button>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    if (confirm(`Clear saved Tools & Services for ${programKey}?`)) {
                      setTnsItems([]);
                    }
                  }}
                  className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-50"
                >
                  Reset T&S
                </button>

                <button
                  onClick={() => {
                    if (confirm(`Clear T&S change log for ${programKey}?`)) {
                      setTnsChangeLog([]);
                    }
                  }}
                  className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-50"
                >
                  Reset T&S Log
                </button>
              </div>
            </div>

            <div className="mt-5">
              {tnsTab === "total" ? (
                // Slider only on Total tabs
                <MonthTable title="Tools & Services" rows={tnsMonthlyRows} showMonthFilter={true} />
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
      </div>

      {/* EXTERNAL */}
      <div className="space-y-3">
        <SectionHeader
          title="External"
          subtitle="External contractors and SOW tracking"
          accent="green"
          isOpen={open.external}
          onToggle={() => setOpen((s) => ({ ...s, external: !s.external }))}
        />

        {open.external ? (
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              {/* Tabs */}
              <div className="flex items-center gap-2">
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

              {/* Actions */}
              <div className="flex items-center gap-2">
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
                // Slider only on Total tabs
                <MonthTable title="External" rows={externalMonthlyRows} showMonthFilter={true} />
              ) : (
                <div className="space-y-5">
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
          </div>
        ) : null}
      </div>

      {/* Keep changelog arrays alive for the separate Change Log page */}
      <div className="hidden">
        {externalChangeLog.length}
        {tnsChangeLog.length}
      </div>
    </div>
  );
}