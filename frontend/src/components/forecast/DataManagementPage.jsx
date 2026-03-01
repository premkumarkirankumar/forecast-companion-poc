import { useState } from "react";
import ImportExcelModal from "./ImportExcelModal";
import { downloadForecastTemplate } from "../../utils/excel/downloadForecastTemplate";
import { exportForecastWorkbook } from "../../utils/excel/exportWorkbook";
import {
  loadLocalProgramState,
  loadProgramState,
  saveLocalProgramState,
  saveProgramState,
} from "../../data/firestorePrograms";
import { MONTHS } from "../../data/hub";

const PROGRAM_KEYS = ["connected", "tre", "csc"];

// NOTE: We are intentionally reusing the SAME behavior you already use.
// No changes to your existing logic; just placing it on another page.

function adaptImportedProgramToState(p) {
  if (!p) return null;
  return {
    internalLaborItems: Array.isArray(p.internal) ? p.internal : [],
    tnsItems: Array.isArray(p.tns) ? p.tns : [],
    contractors: Array.isArray(p.contractors) ? p.contractors : [],
    sows: Array.isArray(p.sows) ? p.sows : [],
  };
}

export default function DataManagementPage({ onBack, entryMode }) {
  const [importOpen, setImportOpen] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  async function clearAllData() {
    const ok = confirm(
      "Are you sure you want to clear all saved forecast data for Connected, TRE, and CSC? This will remove Internal, Tools & Services, External, and budget data."
    );
    if (!ok) return;

    const emptyBudgetByMonth = Object.fromEntries(MONTHS.map((m) => [m, 0]));

    try {
      setIsClearing(true);

      for (const pk of PROGRAM_KEYS) {
        const stateToSave = {
          internalLaborItems: [],
          tnsItems: [],
          contractors: [],
          sows: [],
          externalChangeLog: [],
          tnsChangeLog: [],
          budgetByMonth: emptyBudgetByMonth,
        };

        if (entryMode === "local") {
          saveLocalProgramState(pk, stateToSave);
        } else {
          await saveProgramState(pk, stateToSave);
        }
      }
    } finally {
      setIsClearing(false);
    }
  }

  return (
    <div className="px-6 py-10">
      <div className="mx-auto w-full max-w-4xl">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-2xl font-extrabold text-gray-900">
              Data Management
            </div>
            <div className="mt-1 text-sm font-semibold text-gray-600">
              Import or export forecast data, or download the template.
            </div>
          </div>

          <button
            type="button"
            onClick={onBack}
            className="rounded-2xl border border-gray-200 bg-white px-4 py-2 text-sm font-extrabold text-gray-900 shadow-sm hover:bg-gray-50"
          >
            Back
          </button>
        </div>

        {/* Center cards */}
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          <button
            type="button"
            onClick={() => setImportOpen(true)}
            className="rounded-3xl border border-blue-200 bg-blue-50 p-6 text-left shadow-sm transition hover:bg-blue-100"
          >
            <div className="text-lg font-extrabold text-blue-900">
              Import Excel
            </div>
            <div className="mt-1 text-sm font-semibold text-blue-900/80">
              Import Connected / TRE / CSC sheets from Excel.
            </div>
          </button>

          <button
            type="button"
            onClick={async () => {
              const all = {};
              for (const pk of PROGRAM_KEYS) {
                all[pk] =
                  entryMode === "local"
                    ? loadLocalProgramState(pk) || {}
                    : (await loadProgramState(pk)) || {};
              }
              exportForecastWorkbook(all, { fileName: "forecast-export.xlsx" });
            }}
            className="rounded-3xl border border-emerald-200 bg-emerald-50 p-6 text-left shadow-sm transition hover:bg-emerald-100"
          >
            <div className="text-lg font-extrabold text-emerald-900">
              Export Excel
            </div>
            <div className="mt-1 text-sm font-semibold text-emerald-900/80">
              Export current data for Connected / TRE / CSC.
            </div>
          </button>

          <button
            type="button"
            onClick={() => downloadForecastTemplate({ includeSampleRow: true })}
            className="rounded-3xl border border-violet-200 bg-violet-50 p-6 text-left shadow-sm transition hover:bg-violet-100"
          >
            <div className="text-lg font-extrabold text-violet-900">
              Download Template
            </div>
            <div className="mt-1 text-sm font-semibold text-violet-900/80">
              Get the Excel template with correct sheets and headers.
            </div>
          </button>
        </div>

        <div className="mt-6 rounded-3xl border border-rose-200 bg-[linear-gradient(135deg,_rgba(255,241,242,0.95),_rgba(255,255,255,0.98))] p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-2xl">
              <div className="text-lg font-extrabold text-rose-900">
                Reset Workspace Data
              </div>
              <div className="mt-1 text-sm font-semibold text-rose-900/80">
                Clears saved Internal, Tools & Services, External, and budget data for Connected,
                TRE, and CSC in one step.
              </div>
              <div className="mt-2 text-xs font-semibold uppercase tracking-[0.18em] text-rose-700/80">
                Uses a browser confirmation before proceeding
              </div>
            </div>

            <button
              type="button"
              onClick={clearAllData}
              disabled={isClearing}
              className="rounded-2xl border border-rose-300 bg-white px-5 py-3 text-sm font-extrabold text-rose-900 shadow-sm transition hover:bg-rose-50 disabled:bg-rose-100/70 disabled:text-rose-500"
            >
              {isClearing ? "Clearing Data..." : "Clear All Data"}
            </button>
          </div>
        </div>
      </div>

      {/* Import modal (same as before) */}
      <ImportExcelModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onApply={async (programs, meta) => {
          void meta?.mode;

          // IMPORTANT:
          // We are not changing your business logic; we keep the same behavior:
          // Import applies and saves per program.
          // For signed-in mode, we directly save payload into Firestore program docs.
          // For local mode, we persist the same state shape in browser storage.
          // This mirrors the effect you already have after import.

          for (const pk of PROGRAM_KEYS) {
            const p = programs?.[pk];
            if (!p) continue;

            const stateToSave = adaptImportedProgramToState(p);
            if (!stateToSave) continue;

            if (entryMode === "local") {
              saveLocalProgramState(pk, stateToSave);
            } else {
              await saveProgramState(pk, stateToSave);
            }
          }

          setImportOpen(false);
        }}
      />
    </div>
  );
}
