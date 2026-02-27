import { useState } from "react";
import ImportExcelModal from "./ImportExcelModal";
import { downloadForecastTemplate } from "../../utils/excel/downloadForecastTemplate";
import { exportForecastWorkbook } from "../../utils/excel/exportWorkbook";
import { loadProgramState, saveProgramState } from "../../data/firestorePrograms";

// NOTE: We are intentionally reusing the SAME behavior you already use.
// No changes to your existing logic; just placing it on another page.

export default function DataManagementPage({ onBack }) {
  const [importOpen, setImportOpen] = useState(false);

  return (
    <div className="px-6 py-10">
      <div className="mx-auto w-full max-w-3xl">
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
              for (const pk of ["connected", "tre", "csc"]) {
                all[pk] = (await loadProgramState(pk)) || {};
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
      </div>

      {/* Import modal (same as before) */}
      <ImportExcelModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onApply={async (programs, meta) => {
          const mode = meta?.mode || "replace";

          // IMPORTANT:
          // We are not changing your business logic; we keep the same behavior:
          // Import applies and saves per program.
          // For this page, we directly save payload into Firestore program docs.
          // This mirrors the effect you already have after import.

          for (const pk of ["connected", "tre", "csc"]) {
            const p = programs?.[pk];
            if (!p) continue;

            // We save the imported structure exactly as the existing Import modal outputs.
            // If your ImportExcelModal already outputs the "stateToSave" shape, keep it.
            // If it outputs the raw sheet payload, we can reuse your existing SummaryCards apply logic later.
            // (See Step 3 note below.)
            await saveProgramState(pk, p);
          }

          setImportOpen(false);
        }}
      />
    </div>
  );
}