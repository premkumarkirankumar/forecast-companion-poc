import { useEffect, useMemo, useState } from "react";
import { MONTHS } from "../../data/hub";

import SectionHeader from "./SectionHeader";
import MonthTable from "./MonthTable";
import RollupTable from "./RollupTable";
import ExternalContractorsDetails from "./ExternalContractorsDetails";
import ExternalSowDetails from "./ExternalSowDetails";
import ChangeLogPanel from "./ChangeLogPanel";

/* =========================================================
   LocalStorage hook (per key)
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
  // keep values undefined so UI shows "$—"
  return Object.fromEntries(MONTHS.map((m) => [m, undefined]));
}

function computeRollup(items, kind) {
  // kind: "contractors" | "sow"  (both have msByMonth/nfByMonth)
  const msByMonth = Object.fromEntries(MONTHS.map((m) => [m, 0]));
  const nfByMonth = Object.fromEntries(MONTHS.map((m) => [m, 0]));

  for (const it of items || []) {
    for (const m of MONTHS) {
      msByMonth[m] += it.msByMonth?.[m] ?? 0;
      nfByMonth[m] += it.nfByMonth?.[m] ?? 0;
    }
  }

  return { msByMonth, nfByMonth };
}

/* =========================================================
   Main
========================================================= */
export default function SummaryCards({ selectedProgram }) {
  // IMPORTANT: isolate EVERYTHING per program
  const programKey = selectedProgram || "connected";

  const contractorsKey = `pfc.${programKey}.external.contractors`;
  const sowKey = `pfc.${programKey}.external.sow`;
  const changelogKey = `pfc.${programKey}.changelog`;
  const actorKey = `pfc.actor`; // global name is fine

  // UI state (per program)
  const openKey = `pfc.${programKey}.ui.openSections`;
  const externalTabKey = `pfc.${programKey}.ui.externalTab`; // total|details

  const [actor, setActor] = useLocalStorageState(actorKey, "Neo");

  const [contractors, setContractors] = useLocalStorageState(contractorsKey, []);
  const [sows, setSows] = useLocalStorageState(sowKey, []);
  const [changeLog, setChangeLog] = useLocalStorageState(changelogKey, []);

  const [open, setOpen] = useLocalStorageState(openKey, {
    internal: true,
    tools: false,
    external: true,
  });

  const [externalTab, setExternalTab] = useLocalStorageState(externalTabKey, "total");

  // placeholders (until you wire internal/tools to real data)
  const internalRows = useMemo(
    () => [{ label: "Internal", msByMonth: emptyMonthMap(), nfByMonth: emptyMonthMap() }],
    [programKey]
  );
  const toolsRows = useMemo(
    () => [{ label: "Tools & Services", msByMonth: emptyMonthMap(), nfByMonth: emptyMonthMap() }],
    [programKey]
  );

  const contractorsRollup = useMemo(
    () => computeRollup(contractors, "contractors"),
    [contractors]
  );
  const sowRollup = useMemo(() => computeRollup(sows, "sow"), [sows]);

  function logChange(payload) {
    const entry = {
      id: crypto.randomUUID(),
      ts: new Date().toISOString(),
      actor,
      program: programKey,
      ...payload,
    };
    setChangeLog((prev) => [entry, ...prev].slice(0, 300));
  }

  return (
    <div className="mx-auto mt-6 w-full max-w-[1700px] space-y-4 px-2 sm:px-4">
      {/* INTERNAL */}
      <SectionHeader
        title="Internal"
        subtitle="FTE forecast split by MS and NF"
        accent="blue"
        isOpen={!!open.internal}
        onToggle={() => setOpen((s) => ({ ...s, internal: !s.internal }))}
      />
      {open.internal ? (
        <MonthTable title="Internal (MS / NF / Total)" rows={internalRows} />
      ) : null}

      {/* TOOLS */}
      <SectionHeader
        title="Tools & Services"
        subtitle="Tools & services forecast split by MS and NF"
        accent="purple"
        isOpen={!!open.tools}
        onToggle={() => setOpen((s) => ({ ...s, tools: !s.tools }))}
      />
      {open.tools ? (
        <MonthTable title="Tools & Services (MS / NF / Total)" rows={toolsRows} />
      ) : null}

      {/* EXTERNAL */}
      <SectionHeader
        title="External"
        subtitle="Contractors + SOW (tabs: Total vs Details)"
        accent="green"
        isOpen={!!open.external}
        onToggle={() => setOpen((s) => ({ ...s, external: !s.external }))}
      />

      {open.external ? (
        <div className="space-y-4">
          {/* External Tabs */}
          <div className="flex flex-wrap items-center gap-2">
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

            <div className="ml-auto flex flex-wrap items-center gap-2">
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

          {/* TOTAL TAB */}
          {externalTab === "total" ? (
            <div className="space-y-4">
              <RollupTable
                title="External — Contractors (roll-up from details)"
                msByMonth={contractorsRollup.msByMonth}
                nfByMonth={contractorsRollup.nfByMonth}
              />

              <RollupTable
                title="External — SOW (roll-up from details)"
                msByMonth={sowRollup.msByMonth}
                nfByMonth={sowRollup.nfByMonth}
              />
            </div>
          ) : (
            /* DETAILS TAB */
            <div className="space-y-4">
              {/* Contractors Details (accordion cards inside; state saved per program inside that component) */}
              <ExternalContractorsDetails
                programKey={programKey}
                contractors={contractors}
                setContractors={setContractors}
                onLog={logChange}
              />

              {/* SOW Details (accordion cards inside; state saved per program inside that component) */}
              <ExternalSowDetails
                programKey={programKey}
                sows={sows}
                setSows={setSows}
                onLog={logChange}
              />

              {/* Change Log ONLY on Details tab */}
              <ChangeLogPanel
                programKey={programKey}
                actor={actor}
                setActor={setActor}
                changeLog={changeLog}
                setChangeLog={setChangeLog}
              />
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}