// frontend/src/components/forecast/SummaryCards.jsx
import { useEffect, useMemo, useState } from "react";
import { MONTHS } from "../../data/hub";

import SectionHeader from "./SectionHeader";
import MonthTable from "./MonthTable";

import ExternalContractorsDetails from "./ExternalContractorsDetails";
import ExternalSowDetails from "./ExternalSowDetails";

import ToolsServicesDetails from "./ToolsServicesDetails";
import ChangeLogPanel from "./ChangeLogPanel";

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
function emptyMonthMap() {
  return Object.fromEntries(MONTHS.map((m) => [m, undefined]));
}

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

  // External keys
  const contractorsKey = `pfc.${programKey}.external.contractors`;
  const sowKey = `pfc.${programKey}.external.sow`;
  const externalChangelogKey = `pfc.${programKey}.external.changelog`;

  // T&S keys
  const tnsItemsKey = `pfc.${programKey}.tns.items`;
  const tnsChangelogKey = `pfc.${programKey}.tns.changelog`;

  // Global keys
  const actorKey = `pfc.actor`;

  // UI keys
  const openKey = `pfc.${programKey}.ui.openSections`;
  const externalTabKey = `pfc.${programKey}.ui.externalTab`; // total|details
  const tnsTabKey = `pfc.${programKey}.ui.tnsTab`; // total|details

  const [actor, setActor] = useLocalStorageState(actorKey, "Neo");

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

  const [open, setOpen] = useLocalStorageState(openKey, {
    internal: true,
    tools: true,
    external: true,
  });

  const [externalTab, setExternalTab] = useLocalStorageState(externalTabKey, "total");
  const [tnsTab, setTnsTab] = useLocalStorageState(tnsTabKey, "total");

  // Internal placeholders (you can wire later)
  const internalRows = useMemo(
    () => [{ label: "Internal", msByMonth: emptyMonthMap(), nfByMonth: emptyMonthMap() }],
    [programKey]
  );

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
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-lg font-bold text-gray-900">Forecast Companion</div>
            <div className="mt-1 text-sm text-gray-600">
              Program: <span className="font-semibold">{programKey}</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-sm font-semibold text-gray-700">Actor</div>
            <input
              value={actor}
              onChange={(e) => setActor(e.target.value)}
              className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-900"
              placeholder="Your name"
            />
          </div>
        </div>
      </div>

      {/* INTERNAL */}
      <div className="space-y-3">
        <SectionHeader
          title="Internal"
          subtitle="Placeholder (wire internal data later)"
          accent="blue"
          isOpen={!!open.internal}
          onToggle={() => setOpen((s) => ({ ...s, internal: !s.internal }))}
        />
        {open.internal ? (
          <div className="space-y-4">
            <MonthTable title="Internal — Monthly View" rows={internalRows} />
          </div>
        ) : null}
      </div>

      {/* TOOLS & SERVICES (T&S) */}
      <div className="space-y-3">
        <SectionHeader
          title="Tools & Services"
          subtitle=""
          accent="purple"
          isOpen={!!open.tools}
          onToggle={() => setOpen((s) => ({ ...s, tools: !s.tools }))}
        />

        {open.tools ? (
          <div className="space-y-4">
            {/* T&S Tabs */}
            <div className="flex flex-wrap items-center justify-between gap-3">
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

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    if (confirm(`Clear saved Tools & Services for ${programKey}?`))
                      setTnsItems([]);
                  }}
                  className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-50"
                >
                  Reset T&amp;S
                </button>

                <button
                  onClick={() => {
                    if (confirm(`Clear T&S change log for ${programKey}?`)) setTnsChangeLog([]);
                  }}
                  className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-50"
                >
                  Reset T&amp;S Log
                </button>
              </div>
            </div>

            {tnsTab === "total" ? (
              <div className="space-y-4">
                <MonthTable title="T&S — Monthly View" rows={tnsMonthlyRows} showMonthFilter={true} />
              </div>
            ) : (
              <div className="space-y-4">
                <ToolsServicesDetails
                  programKey={programKey}
                  items={tnsItems}
                  setItems={setTnsItems}
                  onLog={logTns}
                />

                {/* ✅ pass actor into changelog panel */}
                <ChangeLogPanel
                  programKey={programKey}
                  changeLog={tnsChangeLog}
                  actor={actor}
                />
              </div>
            )}
          </div>
        ) : null}
      </div>

      {/* EXTERNAL */}
      <div className="space-y-3">
        <SectionHeader
          title="External"
          subtitle="Contractors + External SOW (saved per program)"
          accent="green"
          isOpen={!!open.external}
          onToggle={() => setOpen((s) => ({ ...s, external: !s.external }))}
        />

        {open.external ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
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

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    if (confirm(`Clear saved Contractors for ${programKey}?`)) setContractors([]);
                  }}
                  className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-50"
                >
                  Reset Contractors
                </button>

                <button
                  onClick={() => {
                    if (confirm(`Clear saved SOWs for ${programKey}?`)) setSows([]);
                  }}
                  className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-50"
                >
                  Reset SOWs
                </button>
              </div>
            </div>

            {externalTab === "total" ? (
              <div className="space-y-4">
                <MonthTable
                  title="External — Monthly View"
                  rows={externalMonthlyRows}
                  showMonthFilter={true}
                />
              </div>
            ) : (
              <div className="space-y-4">
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

                {/* ✅ pass actor into changelog panel */}
                <ChangeLogPanel
                  programKey={programKey}
                  changeLog={externalChangeLog}
                  actor={actor}
                />
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}