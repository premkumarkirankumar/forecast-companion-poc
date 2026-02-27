// frontend/src/components/forecast/ImportExcelModal.jsx
import { useMemo, useState } from "react";
import { parseForecastWorkbook } from "../../utils/excel/importWorkbook";

function cx(...parts) {
  return parts.filter(Boolean).join(" ");
}

function CountPill({ label, value }) {
  return (
    <div className="flex items-center gap-2 rounded-full border px-3 py-1 text-sm">
      <span className="text-slate-600">{label}</span>
      <span className="font-semibold text-slate-900">{value}</span>
    </div>
  );
}

export default function ImportExcelModal({ open, onClose, onApply }) {
  const [file, setFile] = useState(null);
  const [mode, setMode] = useState("replace"); // replace | merge (merge optional later)
  const [parsing, setParsing] = useState(false);
  const [result, setResult] = useState(null); // { programs, errors, warnings }
  const [parseErr, setParseErr] = useState("");

  const counts = useMemo(() => {
    const empty = {
      connected: { internal: 0, tns: 0, contractors: 0, sows: 0 },
      tre: { internal: 0, tns: 0, contractors: 0, sows: 0 },
      csc: { internal: 0, tns: 0, contractors: 0, sows: 0 },
    };
    if (!result?.programs) return empty;

    const c = structuredClone(empty);
    for (const pid of Object.keys(c)) {
      for (const k of Object.keys(c[pid])) {
        c[pid][k] = Array.isArray(result.programs[pid]?.[k])
          ? result.programs[pid][k].length
          : 0;
      }
    }
    return c;
  }, [result]);

  const hasErrors = !!result?.errors?.length;

  // ✅ Step 7 gate: block apply if there is zero data across all sheets/programs
  const totalDetectedRows = useMemo(() => {
    return (
      (counts.connected.internal || 0) +
      (counts.connected.tns || 0) +
      (counts.connected.contractors || 0) +
      (counts.connected.sows || 0) +
      (counts.tre.internal || 0) +
      (counts.tre.tns || 0) +
      (counts.tre.contractors || 0) +
      (counts.tre.sows || 0) +
      (counts.csc.internal || 0) +
      (counts.csc.tns || 0) +
      (counts.csc.contractors || 0) +
      (counts.csc.sows || 0)
    );
  }, [counts]);

  // ✅ Apply gate: must have programs, no errors, and at least 1 detected row
  const canApply = !!result?.programs && !hasErrors && totalDetectedRows > 0;

  async function handlePick(f) {
    setFile(f || null);
    setResult(null);
    setParseErr("");

    if (!f) return;

    setParsing(true);
    try {
      const parsed = await parseForecastWorkbook(f);
      setResult(parsed);
    } catch (e) {
      setParseErr(e?.message || "Failed to parse workbook.");
    } finally {
      setParsing(false);
    }
  }

  function resetAndClose() {
    setFile(null);
    setResult(null);
    setParseErr("");
    setMode("replace");
    onClose?.();
  }

  async function handleApply() {
    if (!result?.programs) return;
    if (result?.errors?.length) return;
    if (totalDetectedRows <= 0) return;

    // Parent will implement actual write/persist in Step 3+
    await onApply?.(result.programs, {
      mode,
      fileName: file?.name || "workbook.xlsx",
    });

    resetAndClose();
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={resetAndClose} />

      {/* Modal */}
      <div className="absolute left-1/2 top-1/2 w-[min(980px,92vw)] -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div>
            <div className="text-lg font-semibold text-slate-900">
              Import Excel
            </div>
            <div className="text-sm text-slate-600">
              Upload your template (.xlsx). We’ll validate and prepare program
              data (CON / TRE / CSC).
            </div>
            <div className="mt-1 text-xs text-slate-500">
              Expected sheets (examples):{" "}
              <span className="font-medium">CON-Internal</span>,{" "}
              <span className="font-medium">CON-TNS</span>,{" "}
              <span className="font-medium">CON-Contractors</span>,{" "}
              <span className="font-medium">CON-SW</span>{" "}
              (and the same pattern for TRE/CSC).
            </div>
          </div>

          <button
            className="rounded-lg border px-3 py-1.5 text-sm hover:bg-slate-50"
            onClick={resetAndClose}
          >
            Close
          </button>
        </div>

        <div className="px-6 py-5">
          {/* File picker */}
          <div className="flex flex-col gap-3">
            <label className="text-sm font-medium text-slate-800">
              Excel file
            </label>

            <div className="flex items-center gap-3">
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={(e) => handlePick(e.target.files?.[0] || null)}
                className="block w-full text-sm"
              />

              {file?.name ? (
                <div className="truncate rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-800">
                  {file.name}
                </div>
              ) : null}
            </div>

            {parsing ? (
              <div className="text-sm text-slate-600">Parsing workbook…</div>
            ) : null}

            {parseErr ? (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                {parseErr}
              </div>
            ) : null}
          </div>

          {/* Mode */}
          <div className="mt-6">
            <label className="text-sm font-medium text-slate-800">
              Import mode
            </label>
            <div className="mt-2 flex gap-3">
              <button
                className={cx(
                  "rounded-lg border px-3 py-2 text-sm",
                  mode === "replace"
                    ? "bg-slate-900 text-white border-slate-900"
                    : "hover:bg-slate-50"
                )}
                onClick={() => setMode("replace")}
              >
                Replace (recommended)
              </button>

              <button
                className={cx(
                  "rounded-lg border px-3 py-2 text-sm",
                  mode === "merge"
                    ? "bg-slate-900 text-white border-slate-900"
                    : "hover:bg-slate-50"
                )}
                onClick={() => setMode("merge")}
                title="Optional; parent apply logic can choose to support later"
              >
                Merge (optional)
              </button>
            </div>

            {/* ✅ Step 7: brief semantics explanation (UI only, no logic change) */}
            <div className="mt-2 text-xs text-slate-600">
              <span className="font-semibold">Replace</span> overwrites existing
              items for each program.{" "}
              <span className="font-semibold">Merge</span> adds only new names
              and skips duplicates.
            </div>
          </div>

          {/* Counts */}
          <div className="mt-6">
            <div className="text-sm font-medium text-slate-800">
              Detected rows
            </div>

            <div className="mt-3 grid gap-4 md:grid-cols-3">
              {["connected", "tre", "csc"].map((pid) => (
                <div key={pid} className="rounded-xl border p-4">
                  <div className="mb-3 text-sm font-semibold uppercase text-slate-800">
                    {pid === "connected" ? "CON" : pid.toUpperCase()}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <CountPill label="Internal" value={counts[pid].internal} />
                    <CountPill label="TNS" value={counts[pid].tns} />
                    <CountPill
                      label="Contractors"
                      value={counts[pid].contractors}
                    />
                    <CountPill label="SW" value={counts[pid].sows} />
                  </div>
                </div>
              ))}
            </div>

            {/* ✅ Step 7: import summary */}
            {result?.programs ? (
              <div className="mt-3 rounded-xl border bg-slate-50 p-4 text-sm text-slate-800">
                <div className="font-semibold text-slate-900">
                  Import summary
                </div>
                <div className="mt-2 space-y-1">
                  <div>
                    <span className="font-medium">Total rows:</span>{" "}
                    {totalDetectedRows}
                  </div>
                  <div className="text-slate-700">
                    <span className="font-medium">CON:</span>{" "}
                    {counts.connected.internal} internal, {counts.connected.tns}{" "}
                    tns, {counts.connected.contractors} contractors,{" "}
                    {counts.connected.sows} sw
                  </div>
                  <div className="text-slate-700">
                    <span className="font-medium">TRE:</span>{" "}
                    {counts.tre.internal} internal, {counts.tre.tns} tns,{" "}
                    {counts.tre.contractors} contractors, {counts.tre.sows} sw
                  </div>
                  <div className="text-slate-700">
                    <span className="font-medium">CSC:</span>{" "}
                    {counts.csc.internal} internal, {counts.csc.tns} tns,{" "}
                    {counts.csc.contractors} contractors, {counts.csc.sows} sw
                  </div>
                </div>

                {totalDetectedRows <= 0 ? (
                  <div className="mt-2 text-xs font-semibold text-amber-800">
                    No data rows found (only headers). Add rows under headers and
                    re-upload.
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>

          {/* Warnings */}
          {result?.warnings?.length ? (
            <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4">
              <div className="text-sm font-semibold text-amber-900">
                Warnings
              </div>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-amber-900">
                {result.warnings.slice(0, 10).map((w, idx) => (
                  <li key={idx}>
                    <span className="font-medium">{w.sheet}:</span> {w.message}
                  </li>
                ))}
                {result.warnings.length > 10 ? (
                  <li>…and {result.warnings.length - 10} more</li>
                ) : null}
              </ul>
            </div>
          ) : null}

          {/* Errors */}
          {result?.errors?.length ? (
            <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4">
              <div className="text-sm font-semibold text-red-900">
                Errors (fix these in Excel)
              </div>
              <div className="mt-2 max-h-64 overflow-auto rounded-lg border border-red-200 bg-white">
                <table className="w-full text-left text-sm">
                  <thead className="sticky top-0 bg-white">
                    <tr className="border-b">
                      <th className="px-3 py-2 font-semibold text-slate-800">
                        Sheet
                      </th>
                      <th className="px-3 py-2 font-semibold text-slate-800">
                        Row
                      </th>
                      <th className="px-3 py-2 font-semibold text-slate-800">
                        Field
                      </th>
                      <th className="px-3 py-2 font-semibold text-slate-800">
                        Message
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.errors.map((e, idx) => (
                      <tr key={idx} className="border-b last:border-b-0">
                        <td className="px-3 py-2 text-slate-800">{e.sheet}</td>
                        <td className="px-3 py-2 text-slate-800">{e.row}</td>
                        <td className="px-3 py-2 text-slate-800">{e.field}</td>
                        <td className="px-3 py-2 text-slate-800">{e.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t px-6 py-4">
          <div className="text-xs text-slate-500">
            Apply is enabled only when there are no errors and at least one data
            row is detected.
          </div>

          <div className="flex items-center gap-3">
            <button
              className="rounded-lg border px-4 py-2 text-sm hover:bg-slate-50"
              onClick={resetAndClose}
            >
              Cancel
            </button>

            <button
              className={cx(
                "rounded-lg px-4 py-2 text-sm font-medium",
                canApply
                  ? "bg-slate-900 text-white hover:bg-slate-800"
                  : "bg-slate-200 text-slate-500 cursor-not-allowed"
              )}
              disabled={!canApply}
              onClick={handleApply}
            >
              Apply Import
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}