// frontend/src/utils/excel/importWorkbook.js
import * as XLSX from "xlsx";

/**
 * Parse an uploaded Excel workbook and return a normalized structure:
 * {
 *   programs: {
 *     connected: { internal: [], tns: [], contractors: [], sows: [] },
 *     tre:       { internal: [], tns: [], contractors: [], sows: [] },
 *     csc:       { internal: [], tns: [], contractors: [], sows: [] },
 *   },
 *   summary: {
 *     connected: { internal: number, tns: number, contractors: number, sows: number },
 *     tre:       { internal: number, tns: number, contractors: number, sows: number },
 *     csc:       { internal: number, tns: number, contractors: number, sows: number },
 *     sheetsParsed: string[],
 *     sheetsFound: string[],
 *   },
 *   errors: [{ sheet, row, field, message }],
 *   warnings: [{ sheet, row?, field?, message }]
 * }
 *
 * ✅ Sheet naming standard (Excel 31-char safe):
 *   CON-Internal, CON-TNS, CON-Contractors, CON-SOW
 *   TRE-Internal, TRE-TNS, TRE-Contractors, TRE-SOW
 *   CSC-Internal, CSC-TNS, CSC-Contractors, CSC-SOW
 */

const PROGRAM_KEYS = {
  CONNECTED: "connected",
  TRE: "tre",
  CSC: "csc",
};

const CATEGORY_KEYS = {
  INTERNAL: "internal",
  TNS: "tns",
  CONTRACTORS: "contractors",
  SOWS: "sows",
};

// Expected headers (based on your uploaded template)
const EXPECTED_HEADERS = {
  internal: ["FTE Name", "Role", "Run %", "Growth %"],
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

/* =========================================================
   ✅ Sheet name helpers (single source of truth)
   ========================================================= */

const PROGRAM_PREFIX = {
  connected: "CON",
  tre: "TRE",
  csc: "CSC",
};

const AREA_SUFFIX = {
  internal: "Internal",
  tns: "TNS",
  contractors: "Contractors",
  sows: "SOW",
};

function sheetName(programKey, areaKey) {
  const p = PROGRAM_PREFIX[programKey] || String(programKey).toUpperCase();
  const a = AREA_SUFFIX[areaKey];
  return `${p}-${a}`;
}

// Sheet names in your file (strict, 31-char safe)
const EXPECTED_SHEETS = [
  sheetName("connected", "internal"),
  sheetName("connected", "tns"),
  sheetName("connected", "contractors"),
  sheetName("connected", "sows"),

  sheetName("tre", "internal"),
  sheetName("tre", "tns"),
  sheetName("tre", "contractors"),
  sheetName("tre", "sows"),

  sheetName("csc", "internal"),
  sheetName("csc", "tns"),
  sheetName("csc", "contractors"),
  sheetName("csc", "sows"),
];

// ✅ HARD requirements (gates)
const REQUIRED_BY_PROGRAM = {
  connected: {
    internal: [sheetName("connected", "internal")],
    tns: [sheetName("connected", "tns")],
    contractors: [sheetName("connected", "contractors")],
    sows: [sheetName("connected", "sows")],
  },
  tre: {
    internal: [sheetName("tre", "internal")],
    tns: [sheetName("tre", "tns")],
    contractors: [sheetName("tre", "contractors")],
    sows: [sheetName("tre", "sows")],
  },
  csc: {
    internal: [sheetName("csc", "internal")],
    tns: [sheetName("csc", "tns")],
    contractors: [sheetName("csc", "contractors")],
    sows: [sheetName("csc", "sows")],
  },
};

function norm(s) {
  return String(s ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function isBlank(v) {
  return v === null || v === undefined || String(v).trim() === "";
}

function toNumber(v) {
  if (v === null || v === undefined) return NaN;
  if (typeof v === "number") return v;
  const s = String(v).trim().replace(/,/g, "");
  if (s === "") return NaN;
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}

// Handles 60, "60", "60%", 0.6 (Excel percent), "0.6"
function toPercent(v, { allowBlank = true } = {}) {
  if (isBlank(v)) return allowBlank ? null : NaN;

  if (typeof v === "string") {
    const s = v.trim();
    if (s.endsWith("%")) {
      const n = toNumber(s.slice(0, -1));
      return Number.isFinite(n) ? n : NaN;
    }
  }

  const n = toNumber(v);
  if (!Number.isFinite(n)) return NaN;

  // If user typed 0.6 in Excel intending 60%, convert
  if (n >= 0 && n <= 1) return n * 100;

  return n;
}

function clampPct(p) {
  if (!Number.isFinite(p)) return p;
  return Math.max(0, Math.min(100, p));
}

function makeId() {
  // Works in modern browsers
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `id_${Math.random().toString(16).slice(2)}_${Date.now()}`;
}

/**
 * ✅ NEW naming parser:
 *   CON-Internal / TRE-Contractors / CSC-SOW
 */
function parseSheetName(sheetNameRaw) {
  const sheetNameStr = String(sheetNameRaw ?? "").trim();
  const parts = sheetNameStr.split("-").map((p) => p.trim());
  if (parts.length !== 2) return null;

  const prefix = parts[0];
  const suffix = parts[1];

  let programId = null;
  const p = norm(prefix).toUpperCase();
  if (p === "CON" || p === "CONNECTED") programId = PROGRAM_KEYS.CONNECTED;
  else if (p === "TRE") programId = PROGRAM_KEYS.TRE;
  else if (p === "CSC") programId = PROGRAM_KEYS.CSC;

  const s = norm(suffix);

  let categoryKey = null;
  if (s === "internal") categoryKey = CATEGORY_KEYS.INTERNAL;
  else if (s === "tns") categoryKey = CATEGORY_KEYS.TNS;
  else if (s === "contractors" || s === "contractor")
    categoryKey = CATEGORY_KEYS.CONTRACTORS;
  else if (s === "sow" || s === "sows") categoryKey = CATEGORY_KEYS.SOWS;

  if (!programId || !categoryKey) return null;
  return { programId, categoryKey };
}

function getRowMap(headerRow) {
  // Returns { normalizedHeader -> index }
  const m = {};
  headerRow.forEach((h, idx) => {
    const key = norm(h);
    if (key) m[key] = idx;
  });
  return m;
}

function requireHeaders({ sheet, headerRow, expected, errors }) {
  const headerMap = getRowMap(headerRow);
  const missing = expected.filter((h) => !(norm(h) in headerMap));
  if (missing.length) {
    errors.push({
      sheet,
      row: 1,
      field: "Headers",
      message: `Missing required columns: ${missing.join(", ")}`,
    });
    return null;
  }
  return headerMap;
}

function readAOA(ws) {
  // Array-of-arrays, preserving empty cells
  return XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
}

function isEmptyRow(row) {
  return !row || row.every((v) => isBlank(v));
}

function computeMsNf(ms, nf) {
  // Allow (ms only), (nf only), (both), (neither -> default ms=100,nf=0)
  if (ms === null && nf === null) return { msPct: 100, nfPct: 0 };
  if (ms !== null && nf === null) return { msPct: ms, nfPct: clampPct(100 - ms) };
  if (ms === null && nf !== null) return { msPct: clampPct(100 - nf), nfPct: nf };
  return { msPct: ms, nfPct: nf };
}

function validatePct(sheet, rowNum, field, v, errors) {
  if (!Number.isFinite(v)) {
    errors.push({ sheet, row: rowNum, field, message: `Invalid percent value.` });
    return false;
  }
  if (v < 0 || v > 100) {
    errors.push({
      sheet,
      row: rowNum,
      field,
      message: `Percent must be between 0 and 100.`,
    });
    return false;
  }
  return true;
}

function validateNumber(sheet, rowNum, field, v, errors) {
  if (!Number.isFinite(v)) {
    errors.push({ sheet, row: rowNum, field, message: `Invalid number value.` });
    return false;
  }
  if (v < 0) {
    errors.push({ sheet, row: rowNum, field, message: `Value cannot be negative.` });
    return false;
  }
  return true;
}

// ✅ warnings (do NOT block apply)
function warn(warnings, sheet, message, row, field) {
  const w = { sheet, message };
  if (row !== undefined) w.row = row;
  if (field) w.field = field;
  warnings.push(w);
}

function warnIfDuplicateName({ sheet, rowNum, name, seen, warnings, label }) {
  const k = String(name ?? "").trim().toLowerCase();
  if (!k) return;
  if (seen.has(k)) {
    warn(
      warnings,
      sheet,
      `Duplicate ${label} "${name}" (case-insensitive).`,
      rowNum,
      label
    );
  } else {
    seen.add(k);
  }
}

function parseInternal({ sheet, rows, headerMap, errors, warnings }) {
  const out = [];
  const seenNames = new Set();

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (isEmptyRow(row)) continue;

    const rowNum = i + 1;
    const name = String(row[headerMap[norm("FTE Name")]] ?? "").trim();
    const role = String(row[headerMap[norm("Role")]] ?? "").trim();
    const runPct = toPercent(row[headerMap[norm("Run %")]]);
    const growPct = toPercent(row[headerMap[norm("Growth %")]]);

    if (!name) {
      errors.push({
        sheet,
        row: rowNum,
        field: "FTE Name",
        message: "FTE Name is required.",
      });
      continue;
    }

    warnIfDuplicateName({
      sheet,
      rowNum,
      name,
      seen: seenNames,
      warnings,
      label: "FTE Name",
    });

    const run = runPct === null ? 0 : clampPct(runPct);
    const grow = growPct === null ? 0 : clampPct(growPct);

    if (!validatePct(sheet, rowNum, "Run %", run, errors)) continue;
    if (!validatePct(sheet, rowNum, "Growth %", grow, errors)) continue;

    out.push({
      id: makeId(),
      name,
      role,
      runPct: run,
      growthPct: grow, // ✅ UI expects this
    });
  }
  return out;
}

const TNS_MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function spreadEven12(total) {
  const t = Math.round(Number(total) || 0);
  const base = Math.floor(t / 12);
  let rem = t - base * 12;

  const arr = TNS_MONTHS.map(() => base);
  for (let i = 0; i < 12 && rem > 0; i++) {
    arr[i] += 1;
    rem -= 1;
  }
  return arr;
}

function monthMapFrom(arr) {
  const m = {};
  for (let i = 0; i < 12; i++) m[TNS_MONTHS[i]] = arr[i] ?? 0;
  return m;
}

function zeroMonthMap() {
  const m = {};
  for (const k of TNS_MONTHS) m[k] = 0;
  return m;
}

function parseTns({ sheet, rows, headerMap, errors, warnings }) {
  const out = [];
  const seenNames = new Set();

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (isEmptyRow(row)) continue;

    const rowNum = i + 1;
    const name = String(row[headerMap[norm("Tool / Service Name")]] ?? "").trim();
    const yearTotal = toNumber(row[headerMap[norm("Total Per Year")]]);
    const msPctRaw = toPercent(row[headerMap[norm("MS %")]]); // optional
    const msPct = msPctRaw === null ? 100 : clampPct(msPctRaw);

    if (!name) {
      errors.push({
        sheet,
        row: rowNum,
        field: "Tool / Service Name",
        message: "Tool / Service Name is required.",
      });
      continue;
    }

    warnIfDuplicateName({
      sheet,
      rowNum,
      name,
      seen: seenNames,
      warnings,
      label: "Tool / Service Name",
    });

    if (!validateNumber(sheet, rowNum, "Total Per Year", yearTotal, errors)) continue;
    if (!validatePct(sheet, rowNum, "MS %", msPct, errors)) continue;

    if (yearTotal === 0) {
      warn(warnings, sheet, `Total Per Year is 0 for "${name}".`, rowNum, "Total Per Year");
    }

    const fixedMsPct = 100;
    const fixedNfPct = 0;

    // Put the entire yearly amount into MS (NF locked to 0)
    const msByMonth = monthMapFrom(spreadEven12(yearTotal));
    const nfByMonth = zeroMonthMap();

    out.push({
      id: makeId(),
      name,
      yearTargetTotal: yearTotal,
      msPct: fixedMsPct,
      nfPct: fixedNfPct,
      msByMonth,
      nfByMonth,
    });
  }
  return out;
}

function parseContractors({ sheet, rows, headerMap, errors, warnings }) {
  const out = [];
  const seenNames = new Set();

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (isEmptyRow(row)) continue;

    const rowNum = i + 1;
    const name = String(row[headerMap[norm("Contractor Name")]] ?? "").trim();
    const role = String(row[headerMap[norm("Role")]] ?? "").trim();
    const ratePerHour = toNumber(row[headerMap[norm("Rate Per Hour")]]);
    const hoursPerWeek = toNumber(row[headerMap[norm("Hours Per Week")]]);
    const weeksPerYear = toNumber(row[headerMap[norm("Weeks Per Year")]]);
    const msRaw = toPercent(row[headerMap[norm("MS %")]]);
    const nfRaw = toPercent(row[headerMap[norm("NF %")]]);

    if (!name) {
      errors.push({
        sheet,
        row: rowNum,
        field: "Contractor Name",
        message: "Contractor Name is required.",
      });
      continue;
    }

    warnIfDuplicateName({
      sheet,
      rowNum,
      name,
      seen: seenNames,
      warnings,
      label: "Contractor Name",
    });

    if (!validateNumber(sheet, rowNum, "Rate Per Hour", ratePerHour, errors)) continue;
    if (!validateNumber(sheet, rowNum, "Hours Per Week", hoursPerWeek, errors)) continue;
    if (!validateNumber(sheet, rowNum, "Weeks Per Year", weeksPerYear, errors)) continue;

    if (hoursPerWeek > 80) {
      warn(
        warnings,
        sheet,
        `Hours Per Week is unusually high (${hoursPerWeek}).`,
        rowNum,
        "Hours Per Week"
      );
    }
    if (weeksPerYear > 53) {
      warn(
        warnings,
        sheet,
        `Weeks Per Year is unusually high (${weeksPerYear}).`,
        rowNum,
        "Weeks Per Year"
      );
    }

    const msPctParsed = msRaw === null ? null : clampPct(msRaw);
    const nfPctParsed = nfRaw === null ? null : clampPct(nfRaw);
    if (msPctParsed !== null && !validatePct(sheet, rowNum, "MS %", msPctParsed, errors))
      continue;
    if (nfPctParsed !== null && !validatePct(sheet, rowNum, "NF %", nfPctParsed, errors))
      continue;

    const { msPct, nfPct } = computeMsNf(msPctParsed, nfPctParsed);

    if ((msPct ?? 0) + (nfPct ?? 0) === 0) {
      errors.push({
        sheet,
        row: rowNum,
        field: "MS% / NF%",
        message: `MS % + NF % cannot be 0.`,
      });
      continue;
    }

    if (msPctParsed !== null && nfPctParsed !== null) {
      const sum = Math.round((msPct + nfPct) * 1000) / 1000;
      if (sum !== 100) {
        errors.push({
          sheet,
          row: rowNum,
          field: "MS% / NF%",
          message: `MS % + NF % must equal 100 (got ${sum}).`,
        });
        continue;
      }
    }

    const yearTotal = ratePerHour * hoursPerWeek * weeksPerYear;
    if (yearTotal === 0) {
      warn(
        warnings,
        sheet,
        `Computed yearly total is 0 for "${name}" (rate*hours*weeks).`,
        rowNum,
        "Rate/Hours/Weeks"
      );
    }

    out.push({
      id: makeId(),
      name,
      role,
      ratePerHour,
      hoursPerWeek,
      weeksPerYear,
      msPct,
      nfPct,
    });
  }
  return out;
}

function parseSows({ sheet, rows, headerMap, errors, warnings }) {
  const out = [];
  const seenNames = new Set();

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (isEmptyRow(row)) continue;

    const rowNum = i + 1;
    const name = String(row[headerMap[norm("SOW Name")]] ?? "").trim();
    const yearTotal = toNumber(row[headerMap[norm("Total Per Year")]]);
    const developersCount = isBlank(row[headerMap[norm("Developers Count")]])
      ? null
      : toNumber(row[headerMap[norm("Developers Count")]]);
    const qaCount = isBlank(row[headerMap[norm("QA Count")]])
      ? null
      : toNumber(row[headerMap[norm("QA Count")]]);
    const msRaw = toPercent(row[headerMap[norm("MS %")]]);
    const nfRaw = toPercent(row[headerMap[norm("NF %")]]);

    if (!name) {
      errors.push({
        sheet,
        row: rowNum,
        field: "SOW Name",
        message: "SOW Name is required.",
      });
      continue;
    }

    warnIfDuplicateName({
      sheet,
      rowNum,
      name,
      seen: seenNames,
      warnings,
      label: "SOW Name",
    });

    if (!validateNumber(sheet, rowNum, "Total Per Year", yearTotal, errors)) continue;
    if (developersCount !== null && !validateNumber(sheet, rowNum, "Developers Count", developersCount, errors))
      continue;
    if (qaCount !== null && !validateNumber(sheet, rowNum, "QA Count", qaCount, errors)) continue;

    const msPctParsed = msRaw === null ? null : clampPct(msRaw);
    const nfPctParsed = nfRaw === null ? null : clampPct(nfRaw);
    if (msPctParsed !== null && !validatePct(sheet, rowNum, "MS %", msPctParsed, errors))
      continue;
    if (nfPctParsed !== null && !validatePct(sheet, rowNum, "NF %", nfPctParsed, errors))
      continue;

    const { msPct, nfPct } = computeMsNf(msPctParsed, nfPctParsed);

    if ((msPct ?? 0) + (nfPct ?? 0) === 0) {
      errors.push({
        sheet,
        row: rowNum,
        field: "MS% / NF%",
        message: `MS % + NF % cannot be 0.`,
      });
      continue;
    }

    if (msPctParsed !== null && nfPctParsed !== null) {
      const sum = Math.round((msPct + nfPct) * 1000) / 1000;
      if (sum !== 100) {
        errors.push({
          sheet,
          row: rowNum,
          field: "MS% / NF%",
          message: `MS % + NF % must equal 100 (got ${sum}).`,
        });
        continue;
      }
    }

    if (yearTotal === 0) {
      warn(
        warnings,
        sheet,
        `Total Per Year is 0 for "${name}".`,
        rowNum,
        "Total Per Year"
      );
    }

    out.push({
      id: makeId(),
      name,
      yearTotal,
      totalDevelopers: developersCount,
      totalQa: qaCount,
      msPct,
      nfPct,
    });
  }
  return out;
}

function buildSummary(programs, sheetNames, sheetsParsed) {
  const summary = {
    connected: { internal: 0, tns: 0, contractors: 0, sows: 0 },
    tre: { internal: 0, tns: 0, contractors: 0, sows: 0 },
    csc: { internal: 0, tns: 0, contractors: 0, sows: 0 },
    sheetsParsed: sheetsParsed || [],
    sheetsFound: sheetNames || [],
  };

  for (const pid of ["connected", "tre", "csc"]) {
    summary[pid].internal = Array.isArray(programs?.[pid]?.internal)
      ? programs[pid].internal.length
      : 0;
    summary[pid].tns = Array.isArray(programs?.[pid]?.tns) ? programs[pid].tns.length : 0;
    summary[pid].contractors = Array.isArray(programs?.[pid]?.contractors)
      ? programs[pid].contractors.length
      : 0;
    summary[pid].sows = Array.isArray(programs?.[pid]?.sows) ? programs[pid].sows.length : 0;
  }

  return summary;
}

function enforceRequiredSheets(workbookSheetNames, errors) {
  const existing = new Set(workbookSheetNames);

  for (const pid of Object.keys(REQUIRED_BY_PROGRAM)) {
    const req = REQUIRED_BY_PROGRAM[pid];

    for (const cat of Object.keys(req)) {
      const candidates = req[cat] || [];
      const found = candidates.some((s) => existing.has(s));

      if (!found) {
        errors.push({
          sheet: pid.toUpperCase(),
          row: 0,
          field: "Sheets",
          message: `Missing required sheet for ${pid.toUpperCase()} / ${cat}: expected one of [${candidates.join(
            " | "
          )}].`,
        });
      }
    }
  }
}

export async function parseForecastWorkbook(file) {
  const errors = [];
  const warnings = [];

  const programs = {
    connected: { internal: [], tns: [], contractors: [], sows: [] },
    tre: { internal: [], tns: [], contractors: [], sows: [] },
    csc: { internal: [], tns: [], contractors: [], sows: [] },
  };

  const buf = await file.arrayBuffer();
  const workbook = XLSX.read(buf, { type: "array" });

  const sheetNames = workbook.SheetNames || [];

  // ✅ HARD gate check (required sheets)
  enforceRequiredSheets(sheetNames, errors);

  // Keep “expected sheets” warnings (non-blocking)
  const existing = new Set(sheetNames);
  for (const s of EXPECTED_SHEETS) {
    if (!existing.has(s)) {
      warnings.push({ sheet: s, message: "Expected sheet not found (will be skipped)." });
    }
  }

  const sheetsParsed = [];

  // Parse only sheets that match your (program + category) pattern
  for (const sheetName of sheetNames) {
    const parsed = parseSheetName(sheetName);
    if (!parsed) continue; // ignore unknown sheets

    const { programId, categoryKey } = parsed;
    const ws = workbook.Sheets[sheetName];
    const rows = readAOA(ws);
    if (!rows.length) continue;

    const headerRow = rows[0] ?? [];
    const expectedHeaders = EXPECTED_HEADERS[categoryKey];

    const headerMap = requireHeaders({
      sheet: sheetName,
      headerRow,
      expected: expectedHeaders,
      errors,
    });
    if (!headerMap) continue;

    let items = [];
    if (categoryKey === "internal")
      items = parseInternal({ sheet: sheetName, rows, headerMap, errors, warnings });
    if (categoryKey === "tns")
      items = parseTns({ sheet: sheetName, rows, headerMap, errors, warnings });
    if (categoryKey === "contractors")
      items = parseContractors({ sheet: sheetName, rows, headerMap, errors, warnings });
    if (categoryKey === "sows")
      items = parseSows({ sheet: sheetName, rows, headerMap, errors, warnings });

    programs[programId][categoryKey] = items;
    sheetsParsed.push(sheetName);
  }

  const summary = buildSummary(programs, sheetNames, sheetsParsed);

  return { programs, summary, errors, warnings };
}
