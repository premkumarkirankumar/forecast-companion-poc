// frontend/src/utils/excel/exportWorkbook.js
import * as XLSX from "xlsx";
import { MONTHS } from "../../data/hub";

/**
 * Export current Forecast Companion state into an Excel workbook
 * with the same sheets/headers that importWorkbook.js expects.
 *
 * ✅ Sheet naming standard (Excel 31-char safe):
 *   CON-Internal, CON-TNS, CON-Contractors, CON-SOW
 *   TRE-Internal, TRE-TNS, TRE-Contractors, TRE-SOW
 *   CSC-Internal, CSC-TNS, CSC-Contractors, CSC-SOW
 *
 * This file does NOT change any app logic; it only converts state -> workbook.
 */

/* =========================================================
   Constants / helpers
   ========================================================= */

const PROGRAMS = [
  { key: "connected", prefix: "CON" },
  { key: "tre", prefix: "TRE" },
  { key: "csc", prefix: "CSC" },
];

const HEADERS = {
  internal: ["FTE Name", "Role", "Run %", "Grow %"],
  tns: ["Tool / Service Name", "Total Per Year", "MS %"],
  contractors: [
    "Contractor Name",
    "Role",
    "Rate Per Hour",
    "Hours Per Week",
    "Weeks Per Year",
    "MS %",
    "NF %",
  ],
  sows: ["SOW Name", "Total Per Year", "Developers Count", "QA Count", "MS %", "NF %"],
};

function sheetName(prefix, area) {
  // Must match importWorkbook.js parseSheetName()
  // area: Internal | TNS | Contractors | SOW
  return `${prefix}-${area}`;
}

function clampPct(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, n));
}

function numOr0(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

// If you want export to respect actual monthly distribution,
// you can compute totals from msByMonth + nfByMonth.
// If not available, fallback to yearTargetTotal.
function sumYearFromByMonth(item) {
  const ms = item?.msByMonth || {};
  const nf = item?.nfByMonth || {};
  let total = 0;
  for (const m of MONTHS) total += numOr0(ms[m]) + numOr0(nf[m]);
  return total;
}

function computeYearTotal(item) {
  const byMonthTotal = sumYearFromByMonth(item);
  if (byMonthTotal > 0) return byMonthTotal;
  return numOr0(item?.yearTargetTotal);
}

/* =========================================================
   Row builders (state -> sheet rows)
   ========================================================= */

function buildInternalRows(state) {
  const items = Array.isArray(state?.internalLaborItems)
    ? state.internalLaborItems
    : [];
  const rows = items
    .map((it) => [
      String(it?.name ?? "").trim(),
      String(it?.role ?? "").trim(),
      clampPct(it?.runPct ?? it?.run ?? it?.runPercent ?? 0),
      clampPct(it?.growthPct ?? it?.growPct ?? it?.grow ?? it?.growPercent ?? 0),
    ])
    .filter((r) => r[0]); // keep only named rows
  return [HEADERS.internal, ...rows];
}

function buildTnsRows(state) {
  const items = Array.isArray(state?.tnsItems) ? state.tnsItems : [];
  const rows = items
    .map((it) => {
      const name = String(it?.name ?? "").trim();
      const totalPerYear = computeYearTotal(it);
      const msPct = clampPct(it?.msPct ?? 100);
      return [name, totalPerYear, msPct];
    })
    .filter((r) => r[0]);
  return [HEADERS.tns, ...rows];
}

function buildContractorRows(state) {
  const items = Array.isArray(state?.contractors) ? state.contractors : [];
  const rows = items
    .map((it) => {
      const name = String(it?.name ?? "").trim();
      const role = String(it?.role ?? "").trim();
      const rate = numOr0(it?.ratePerHour);
      const hpw = numOr0(it?.hoursPerWeek);
      const wpy = numOr0(it?.weeksPerYear);

      // If app has yearTargetTotal but not weeks/rate/hours, we still export it
      // by backfilling weeks/year with 52 if weeks missing.
      const weeks = wpy || 52;

      const msPct = clampPct(it?.msPct ?? 100);
      const nfPct = clampPct(it?.nfPct ?? 0);

      return [name, role, rate, hpw, weeks, msPct, nfPct];
    })
    .filter((r) => r[0]);
  return [HEADERS.contractors, ...rows];
}

function buildSowRows(state) {
  const items = Array.isArray(state?.sows) ? state.sows : [];
  const rows = items
    .map((it) => {
      const name = String(it?.name ?? "").trim();
      const totalPerYear = computeYearTotal(it);
      const developersCount =
        it?.totalDevelopers === null || it?.totalDevelopers === undefined
          ? ""
          : numOr0(it.totalDevelopers);
      const qaCount =
        it?.totalQa === null || it?.totalQa === undefined ? "" : numOr0(it.totalQa);
      const msPct = clampPct(it?.msPct ?? 0);
      const nfPct = clampPct(it?.nfPct ?? 0);
      return [name, totalPerYear, developersCount, qaCount, msPct, nfPct];
    })
    .filter((r) => r[0]);
  return [HEADERS.sows, ...rows];
}

/* =========================================================
   Workbook builder + download
   ========================================================= */

/**
 * @param {object} allProgramsState
 * Shape:
 * {
 *   connected: { internalLaborItems, tnsItems, contractors, sows, ... },
 *   tre:       { internalLaborItems, tnsItems, contractors, sows, ... },
 *   csc:       { internalLaborItems, tnsItems, contractors, sows, ... },
 * }
 *
 * @returns XLSX.WorkBook
 */
export function buildForecastWorkbook(allProgramsState = {}) {
  const wb = XLSX.utils.book_new();

  for (const p of PROGRAMS) {
    const st = allProgramsState?.[p.key] || {};

    const internalAOA = buildInternalRows(st);
    const tnsAOA = buildTnsRows(st);
    const contractorsAOA = buildContractorRows(st);
    const sowsAOA = buildSowRows(st);

    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet(internalAOA),
      sheetName(p.prefix, "Internal")
    );

    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet(tnsAOA),
      sheetName(p.prefix, "TNS")
    );

    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet(contractorsAOA),
      sheetName(p.prefix, "Contractors")
    );

    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet(sowsAOA),
      sheetName(p.prefix, "SOW")
    );
  }

  return wb;
}

/**
 * Convenience helper to build + download a file.
 * @param {object} allProgramsState - same shape as buildForecastWorkbook
 * @param {object} opts
 * @param {string} opts.fileName - default "forecast-export.xlsx"
 */
export function exportForecastWorkbook(allProgramsState = {}, opts = {}) {
  const wb = buildForecastWorkbook(allProgramsState);
  const fileName = opts?.fileName || "forecast-export.xlsx";
  XLSX.writeFile(wb, fileName);
}
