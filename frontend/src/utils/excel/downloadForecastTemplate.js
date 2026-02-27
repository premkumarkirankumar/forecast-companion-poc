// frontend/src/utils/excel/downloadForecastTemplate.js
import * as XLSX from "xlsx";

// ✅ Sheet names must match what importWorkbook.js parses (Excel 31-char safe)
const SHEETS = [
  "CON-Internal",
  "CON-TNS",
  "CON-Contractors",
  "CON-SOW",

  "TRE-Internal",
  "TRE-TNS",
  "TRE-Contractors",
  "TRE-SOW",

  "CSC-Internal",
  "CSC-TNS",
  "CSC-Contractors",
  "CSC-SOW",
];

const HEADERS = {
  internal: ["FTE Name", "Run %", "Grow %"],
  tns: ["Tool / Service Name", "Total Per Year", "MS %"],
  contractors: [
    "Contractor Name",
    "Rate Per Hour",
    "Hours Per Week",
    "Weeks Per Year",
    "MS %",
    "NF %",
  ],
  sows: ["SOW Name", "Total Per Year", "MS %", "NF %"],
};

function categoryForSheet(sheetName) {
  const s = String(sheetName).toLowerCase();

  // pattern: "con-internal", "tre-tns", etc.
  if (s.endsWith("-internal")) return "internal";
  if (s.endsWith("-tns")) return "tns";
  if (s.endsWith("-sow")) return "sows";
  if (s.endsWith("-contractors")) return "contractors";

  return null;
}

function makeSheetAoA(headers, sampleRow = null) {
  const aoa = [headers];
  if (sampleRow) aoa.push(sampleRow);
  return aoa;
}

export function downloadForecastTemplate({ includeSampleRow = true } = {}) {
  const wb = XLSX.utils.book_new();

  for (const sheetName of SHEETS) {
    const cat = categoryForSheet(sheetName);
    if (!cat) continue;

    const headers = HEADERS[cat];

    // Optional sample row (helps users know how to fill it)
    let sample = null;
    if (includeSampleRow) {
      if (cat === "internal") sample = ["John Doe", 70, 30];
      if (cat === "tns") sample = ["GitHub Enterprise", 120000, 100];
      if (cat === "contractors") sample = ["Contractor A", 75, 40, 48, 100, 0];
      if (cat === "sows") sample = ["SOW - Vendor X", 250000, 60, 40];
    }

    const aoa = makeSheetAoA(headers, sample);
    const ws = XLSX.utils.aoa_to_sheet(aoa);

    // A little readability
    ws["!cols"] = headers.map(() => ({ wch: 22 }));

    XLSX.utils.book_append_sheet(wb, ws, sheetName);
  }

  const fileName = `forecast_template_${new Date()
    .toISOString()
    .slice(0, 10)}.xlsx`;

  XLSX.writeFile(wb, fileName);
}