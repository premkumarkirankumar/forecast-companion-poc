import { useMemo, useState } from "react";
import { MONTHS } from "../../data/hub";

import { useLocalStorageState } from "../../lib/forecast/storage";
import { makeChange } from "../../lib/forecast/changelog";
import { computeRollup } from "../../lib/forecast/contractors";

import SectionHeader from "./SectionHeader";
import MonthTable from "./MonthTable";
import RollupTable from "./RollupTable";
import ChangeLogPanel from "./ChangeLogPanel";
import ExternalContractorsDetails from "./ExternalContractorsDetails";
import ExternalSowDetails from "./ExternalSowDetails";

/* =========================================================
   Placeholder month maps for Internal / Tools
   (SOW placeholder removed as requested)
========================================================= */
function useEmptyMonthMaps(selectedProgram) {
  return useMemo(() => {
    const empty = Object.fromEntries(MONTHS.map((m) => [m, undefined]));
    return {
      internal: [{ label: "Internal", msByMonth: empty, nfByMonth: empty }],
      tools: [{ label: "Tools & Services", msByMonth: empty, nfByMonth: empty }],
    };
  }, [selectedProgram]);
}

/* =========================================================
   MAIN EXPORT
========================================================= */
export default function SummaryCards({ selectedProgram }) {
  const programKey = selectedProgram || "default";

  // Persist per program:
  const contractorsKey = `pfc.${programKey}.contractors`;
  const sowsKey = `pfc.${programKey}.sows`;
  const changelogKey = `pfc.${programKey}.changelog`;

  const [actor, setActor] = useLocalStorageState("pfc.actor", "Neo");
  const [contractors, setContractors] = useLocalStorageState(contractorsKey, []);
  const [sows, setSows] = useLocalStorageState(sowsKey, []);
  const [changeLog, setChangeLog] = useLocalStorageState(changelogKey, []);

  const [open, setOpen] = useState({
    internal: true,
    tools: false,
    external: true,
  });

  const [externalTab, setExternalTab] = useState("total"); // "total" | "details"

  const base = useEmptyMonthMaps(selectedProgram);

  const contractorsRollup = useMemo(() => computeRollup(contractors), [contractors]);
  const sowsRollup = useMemo(() => computeRollup(sows), [sows]);

  function logChange(payload) {
    const entry = makeChange({
      actor,
      program: programKey,
      ...payload,
    });

    setChangeLog((prev) => [entry, ...prev].slice(0, 300));
  }

  return (
    <div className="mx-auto mt-6 w-full max-w-[1700px] space-y-4 px-2 sm:px-4">
      {/* INTERNAL */}
      <SectionHeader
        title="Internal"
        subtitle="FTE forecast split by MS and NF"
        accent="blue"
        isOpen={open.internal}
        onToggle={() => setOpen((s) => ({ ...s, internal: !s.internal }))}
      />
      {open.internal ? (
        <MonthTable title="Internal (MS / NF / Total)" rows={base.internal} />
      ) : null}

      {/* TOOLS */}
      <SectionHeader
        title="Tools & Services"
        subtitle="Tools & services forecast split by MS and NF"
        accent="purple"
        isOpen={open.tools}
        onToggle={() => setOpen((s) => ({ ...s, tools: !s.tools }))}
      />
      {open.tools ? (
        <MonthTable title="Tools & Services (MS / NF / Total)" rows={base.tools} />
      ) : null}

      {/* EXTERNAL */}
      <SectionHeader
        title="External"
        subtitle="Contractors + SOW (tabs: Total vs Details)"
        accent="green"
        isOpen={open.external}
        onToggle={() => setOpen((s) => ({ ...s, external: !s.external }))}
      />

      {open.external ? (
        <div className="space-y-4">
          {/* Tabs */}
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
                  if (confirm(`Clear saved contractors for ${programKey}?`)) setContractors([]);
                }}
                className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-50"
              >
                Reset Contractors
              </button>

              <button
                onClick={() => {
                  if (confirm(`Clear saved SOW items for ${programKey}?`)) setSows([]);
                }}
                className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-50"
              >
                Reset SOW
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
                msByMonth={sowsRollup.msByMonth}
                nfByMonth={sowsRollup.nfByMonth}
              />
            </div>
          ) : (
            /* DETAILS TAB */
            <div className="space-y-4">
              <ExternalContractorsDetails
                contractors={contractors}
                setContractors={setContractors}
                onLog={logChange}
              />

              <ExternalSowDetails sows={sows} setSows={setSows} onLog={logChange} />

              {/* Change Log ONLY here (Details tab) */}
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