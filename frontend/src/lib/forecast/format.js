import { MONTHS } from "../../data/hub";

export function fmt(value) {
  if (value === null || value === undefined) return "$—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

export function clampPct(n) {
  const x = Number(n);
  if (Number.isNaN(x)) return 0;
  return Math.max(0, Math.min(100, x));
}

export function monthDividerClass(m) {
  const isQuarterStart = m === "Apr" || m === "Jul" || m === "Oct";
  const base = m === "Jan" ? "" : "border-l border-gray-100";
  const quarter = isQuarterStart ? " border-l-2 border-gray-200" : "";
  return (base + quarter).trim();
}

export function headCellClass(m) {
  return [
    "px-3 py-3 text-right font-medium whitespace-nowrap",
    monthDividerClass(m),
  ].join(" ");
}

export function bodyCellClass(m) {
  return ["px-2 py-3 align-top", monthDividerClass(m)].join(" ");
}

export function sumYear(map) {
  return MONTHS.reduce((acc, m) => acc + (map?.[m] ?? 0), 0);
}