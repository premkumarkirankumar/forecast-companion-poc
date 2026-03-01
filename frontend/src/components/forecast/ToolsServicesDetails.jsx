// frontend/src/components/forecast/ToolsServicesDetails.jsx
import { useEffect, useState } from "react";
import { MONTHS } from "../../data/hub";

/* ========================= Helpers (adapted from ExternalSowDetails) ========================= */

function fmt(value) {
    if (value === null || value === undefined) return "$—";
    return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0,
    }).format(value);
}

function monthDividerClass(m) {
    const isQuarterStart = m === "Apr" || m === "Jul" || m === "Oct";
    const base = m === "Jan" ? "" : "border-l border-gray-100";
    const quarter = isQuarterStart ? " border-l-2 border-gray-200" : "";
    return (base + quarter).trim();
}

function headCellClass(m) {
    return ["px-3 py-3 text-right font-medium whitespace-nowrap", monthDividerClass(m)].join(
        " "
    );
}

function bodyCellClass(m) {
    return ["px-2 py-3 align-top", monthDividerClass(m)].join(" ");
}

function num(v) {
  if (v === null || v === undefined) return 0;

  // Treat empty string as 0 (important for controlled inputs)
  if (typeof v === "string") {
    const s = v.trim();
    if (s === "") return 0;

    // Remove commas and $ (common when users paste values)
    const cleaned = s.replace(/[$,]/g, "");
    const x = Number(cleaned);
    return Number.isFinite(x) ? x : 0;
  }

  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

function hasValue(v) {
    return String(v ?? "").trim().length > 0;
}

/**
 * Distributes (total - lockedSum) evenly across unlocked months.
 * lockedByMonth uses MONTHS keys: { Jan: 1000, Feb: undefined, ... }
 */
function distributeEvenly(total, lockedByMonth) {
  const safeTotal = num(total);

  // Only count locked values if they are finite numbers
  const lockedSum = MONTHS.reduce((a, m) => {
    const v = lockedByMonth?.[m];
    if (v === undefined) return a;
    const n = num(v);
    return a + n;
  }, 0);

  const remaining = Math.max(0, safeTotal - lockedSum);

  // A month is "unlocked" if it has no explicit locked value
  const unlockedMonths = MONTHS.filter((m) => lockedByMonth?.[m] === undefined);
  const per = unlockedMonths.length ? remaining / unlockedMonths.length : 0;

  const out = {};
  for (const m of MONTHS) {
    out[m] = lockedByMonth?.[m] === undefined ? per : num(lockedByMonth[m]);
  }
  return out;
}

/**
 * Normalize old stored T&S shape to the new SOW-like shape.
 * Supports previous shape:
 *  - { months: { ms: number[12], nf: number[12] }, yearTarget }
 * And new shape:
 *  - { msByMonth: {Jan..}, nfByMonth: {Jan..}, yearTargetTotal, msLocked }
 */
function normalizeTnsItem(raw) {
    if (!raw || typeof raw !== "object") return null;

    // Already new shape
    if (raw.msByMonth && typeof raw.msByMonth === "object") {
        const msByMonth = {};
        const nfByMonth = {};
        for (const m of MONTHS) {
            msByMonth[m] = num(raw.msByMonth?.[m]);
            nfByMonth[m] = 0; // enforce NF 0
        }
        return {
            id: raw.id || crypto.randomUUID(),
            name: String(raw.name || "").trim(),
            msPct: 100,
            nfPct: 0,
            yearTargetTotal: num(raw.yearTargetTotal ?? raw.yearTarget ?? 0),
            msByMonth,
            nfByMonth,
            msLocked: raw.msLocked && typeof raw.msLocked === "object" ? raw.msLocked : {},
            nfLocked: {}, // enforce
        };
    }

    // Old shape (months arrays)
    const arr = raw.months?.ms;
    const msByMonth = {};
    const nfByMonth = {};
    for (let i = 0; i < MONTHS.length; i++) {
        msByMonth[MONTHS[i]] = num(Array.isArray(arr) ? arr[i] : 0);
        nfByMonth[MONTHS[i]] = 0;
    }

    const yearTargetTotal =
        num(raw.yearTarget) ||
        MONTHS.reduce((a, m) => a + (msByMonth[m] ?? 0), 0);

    return {
        id: raw.id || crypto.randomUUID(),
        name: String(raw.name || "").trim(),
        msPct: 100,
        nfPct: 0,
        yearTargetTotal,
        msByMonth,
        nfByMonth,
        msLocked: {}, // cannot infer from old shape
        nfLocked: {},
    };
}

/* ========================= Main Component ========================= */

export default function ToolsServicesDetails({
    programKey,
    items,
    setItems,
    onLog,
    onCommitNow, // ✅ NEW (Update button support)
}) {
    // Persist expanded cards per program (T&S)
    const expandedKey = `pfc.${programKey}.ui.tns.expandedIds`;

    const [expandedIds, setExpandedIds] = useState(() => {
        try {
            const raw = localStorage.getItem(expandedKey);
            return raw ? JSON.parse(raw) : [];
        } catch {
            return [];
        }
    });

    useEffect(() => {
        try {
            localStorage.setItem(expandedKey, JSON.stringify(expandedIds));
        } catch {
            // ignore
        }
    }, [expandedKey, expandedIds]);

    // Normalize existing items once (supports migration from older T&S shape)
    useEffect(() => {
        const normalized = (items || [])
            .map(normalizeTnsItem)
            .filter(Boolean);

        const sameLength = normalized.length === (items || []).length;

        // If shape differs, replace with normalized
        // (simple check: if any item lacks msByMonth, we normalize)
        const needs =
            (items || []).some((x) => x && !x.msByMonth) || !sameLength;

        if (needs) {
            setItems(normalized);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    function isExpanded(id) {
        return expandedIds.includes(id);
    }

    function toggleExpanded(id) {
        setExpandedIds((prev) =>
            prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
        );
    }

    const [draft, setDraft] = useState({
        name: "",
        totalYear: "",
    });
    const [showSavedItems, setShowSavedItems] = useState(false);

    function upd(k, v) {
        setDraft((d) => ({ ...d, [k]: v }));
    }

    const canAdd = hasValue(draft.name) && hasValue(draft.totalYear);

    function updateItem(id, patchFn) {
        setItems((arr) => arr.map((x) => (x.id === id ? patchFn(x) : x)));
    }

    function recomputeFromYearTarget(s) {
        // MS is 100%, NF is 0%
        const msYear = num(s.yearTargetTotal);
        return {
            ...s,
            msByMonth: distributeEvenly(msYear, s.msLocked || {}),
            nfByMonth: Object.fromEntries(MONTHS.map((m) => [m, 0])),
        };
    }

    function addItem() {
        if (!canAdd) return;

        const yearTarget = num(draft.totalYear);
        const msYear = yearTarget;

        const newItem = {
            id: crypto.randomUUID(),
            name: String(draft.name).trim(),
            msPct: 100,
            nfPct: 0,
            yearTargetTotal: yearTarget,
            msByMonth: distributeEvenly(msYear, {}),
            nfByMonth: Object.fromEntries(MONTHS.map((m) => [m, 0])),
            msLocked: {},
            nfLocked: {},
        };

        setItems((arr) => [newItem, ...(arr || [])]);

        onLog?.({
            action: "ADD_TNS",
            entityType: "tns",
            entityId: newItem.id,
            entityName: newItem.name,
        });

        setDraft({ name: "", totalYear: "" });
    }

    function removeItem(id) {
        const existing = (items || []).find((x) => x.id === id);

        onLog?.({
            action: "REMOVE_TNS",
            entityType: "tns",
            entityId: id,
            entityName: existing?.name,
        });

        setExpandedIds((prev) => prev.filter((x) => x !== id));
        setItems((arr) => (arr || []).filter((x) => x.id !== id));
    }

    function updateName(id, name) {
        const existing = (items || []).find((x) => x.id === id);
        const before = String(existing?.name ?? "");
        const after = String(name ?? "");

        // ✅ avoid noisy logs
        if (before === after) return;

        updateItem(id, (s) => ({ ...s, name: after }));

        onLog?.({
            action: "UPDATE_TNS_NAME",
            entityType: "tns",
            entityId: id,
            entityName: existing?.name,
            field: "name",
            from: before,
            to: after,
        });
    }

    function setYearTarget(id, value) {
        const val = num(value);
        const existing = (items || []).find((x) => x.id === id);
        const before = num(existing?.yearTargetTotal ?? 0);

        // ✅ avoid noisy logs
        if (before === val) return;

        onLog?.({
            action: "UPDATE_TNS_YEAR_TARGET",
            entityType: "tns",
            entityId: id,
            entityName: existing?.name,
            field: "yearTargetTotal",
            from: before,
            to: val,
        });

        updateItem(id, (s) => recomputeFromYearTarget({ ...s, yearTargetTotal: val }));
    }

    function setMonthValue(id, month, value) {
        const val = num(value);
        const existing = (items || []).find((x) => x.id === id);

        // ✅ "before" should be what user sees in the grid
        const before = num(existing?.msByMonth?.[month] ?? 0);

        // ✅ avoid noisy logs
        if (before === val) return;

        onLog?.({
            action: "EDIT_TNS_MS_MONTH",
            entityType: "tns",
            entityId: id,
            entityName: existing?.name,
            field: `ms.${month}`,
            from: before,
            to: val,
        });

        updateItem(id, (s) => {
            const next = { ...s, msLocked: { ...(s.msLocked || {}), [month]: val } };
            return recomputeFromYearTarget(next);
        });
    }

    const subtlePanel =
        "rounded-2xl border border-purple-200/60 bg-purple-50/20 p-5 shadow-sm";

    return (
        <div className="space-y-4">
            <div className={subtlePanel}>
                <div className="text-sm font-semibold text-gray-900">Tools & Services Details</div>
                <div className="mt-1 text-xs text-gray-600">
                    Add Tool/Service → set yearly target → edit MS by month (auto rebalances remaining months).
                </div>

                <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-semibold text-gray-700 ring-1 ring-gray-200">
                    Quarter separators at Apr / Jul / Oct
                </div>

                {/* Add form (SOW-like) */}
                <div className="mt-4 rounded-2xl border border-gray-200 bg-white p-4">
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
                        <div className="md:col-span-2">
                            <div className="text-xs font-semibold text-gray-700">Tool / Service Name</div>
                            <input
                                value={draft.name}
                                onChange={(e) => upd("name", e.target.value)}
                                placeholder="e.g., GitHub Enterprise"
                                className="mt-1 w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-900"
                            />
                        </div>

                        <div>
                            <div className="text-xs font-semibold text-gray-700">T&S Total (year)</div>
                            <input
                                value={draft.totalYear}
                                onChange={(e) => upd("totalYear", e.target.value)}
                                placeholder="$ total"
                                className="mt-1 w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-900"
                            />
                        </div>

                        <div>
                            <div className="text-xs font-semibold text-gray-700">MS %</div>
                            <input
                                value="100"
                                disabled
                                className="mt-1 w-full cursor-not-allowed rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-semibold text-gray-700"
                            />
                        </div>

                        <div className="flex items-end">
                            <button
                                onClick={addItem}
                                disabled={!canAdd}
                                className={[
                                    "w-full rounded-2xl px-4 py-3 text-sm font-semibold transition",
                                    canAdd
                                        ? "bg-gray-900 text-white hover:bg-gray-800"
                                        : "bg-gray-100 text-gray-400 cursor-not-allowed",
                                ].join(" ")}
                            >
                                Add
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Cards */}
            {(items || []).length === 0 ? (
                <div className="rounded-2xl border border-gray-200 bg-white p-5 text-sm text-gray-600">
                    No Tools & Services items added yet.
                </div>
            ) : (
                <div className="rounded-2xl border border-gray-200 bg-white p-3 shadow-sm">
                    <button
                        type="button"
                        onClick={() => setShowSavedItems((prev) => !prev)}
                        aria-expanded={showSavedItems}
                        className="flex w-full items-center justify-between gap-3 rounded-2xl px-3 py-3 text-left transition hover:bg-gray-50"
                    >
                        <div className="min-w-0">
                            <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                                Saved Tools & Services Entries
                            </div>
                            <div className="mt-1 text-base font-bold text-gray-900">
                                {(items || []).length} {(items || []).length === 1 ? "entry" : "entries"}
                            </div>
                            <div className="mt-1 text-sm text-gray-600">
                                Click to {showSavedItems ? "hide" : "view"} saved tools and services details
                            </div>
                        </div>

                        <div className="flex items-center gap-2 rounded-full bg-gray-50 px-3 py-1.5 text-xs font-semibold text-gray-600 ring-1 ring-gray-200">
                            <span>{showSavedItems ? "Hide list" : "Show list"}</span>
                            <span
                                className={[
                                    "text-sm transition-transform duration-200",
                                    showSavedItems ? "rotate-180" : "",
                                ].join(" ")}
                            >
                                ▾
                            </span>
                        </div>
                    </button>

                    <div
                        className={[
                            "overflow-hidden transition-all duration-200 ease-out",
                            showSavedItems ? "mt-3 max-h-[200rem] opacity-100" : "max-h-0 opacity-0",
                        ].join(" ")}
                    >
                        <div className="space-y-3 border-t border-gray-100 pt-3">
                            {(items || []).map((s) => {
                                const msYear = MONTHS.reduce((a, m) => a + (s.msByMonth?.[m] ?? 0), 0);
                                const nfYear = 0;
                                const totalYear = msYear;

                                const expanded = isExpanded(s.id);

                                return (
                                    <div
                                        key={s.id}
                                        className={[
                                            "rounded-2xl border bg-white px-4 py-4 shadow-sm transition",
                                            expanded
                                                ? "border-gray-300 shadow-md"
                                                : "border-gray-200 hover:border-gray-300",
                                        ].join(" ")}
                                    >
                                        <div className="flex flex-wrap items-center justify-between gap-3">
                                            <button
                                                type="button"
                                                onClick={() => toggleExpanded(s.id)}
                                                aria-expanded={expanded}
                                                className="flex min-w-0 flex-1 items-center justify-between gap-3 rounded-xl px-2 py-2 text-left transition hover:bg-gray-50"
                                            >
                                                <div className="min-w-0">
                                                    <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                                                        Tool / Service Name
                                                    </div>
                                                    <div className="mt-1 truncate text-lg font-bold text-gray-900">
                                                        {s.name || "Untitled"}
                                                    </div>
                                                    <div className="mt-1 text-sm font-medium text-gray-600">
                                                        Year Target: <span className="font-semibold">{fmt(s.yearTargetTotal)}</span>{" "}
                                                        • Split <span className="font-semibold">MS 100%</span> /{" "}
                                                        <span className="font-semibold">NF 0%</span>
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-2">
                                                    <div className="rounded-full bg-purple-50 px-3 py-1.5 text-xs font-bold text-gray-900 ring-1 ring-purple-200">
                                                        Total (calc): {fmt(totalYear)}
                                                    </div>
                                                    <div className="flex items-center gap-2 rounded-full bg-gray-50 px-3 py-1.5 text-xs font-semibold text-gray-600 ring-1 ring-gray-200">
                                                        <span>{expanded ? "Hide details" : "Edit details"}</span>
                                                        <span
                                                            className={[
                                                                "text-sm transition-transform duration-200",
                                                                expanded ? "rotate-180" : "",
                                                            ].join(" ")}
                                                        >
                                                            ▾
                                                        </span>
                                                    </div>
                                                </div>
                                            </button>

                                            <button
                                                onClick={() => removeItem(s.id)}
                                                className="rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                                            >
                                                Remove
                                            </button>
                                        </div>

                                        <div
                                            className={[
                                                "overflow-hidden transition-all duration-200 ease-out",
                                                expanded ? "mt-3 max-h-[200rem] opacity-100" : "max-h-0 opacity-0",
                                            ].join(" ")}
                                        >
                                            <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
                                {/* Expanded */}
                                    <div className="flex flex-wrap items-center justify-between gap-3">
                                        <div className="text-sm font-semibold text-gray-900">Tool / Service Name (editable)</div>

                                        <div className="flex items-center gap-2">
                                            {/* ✅ NEW: Update button (before Remove) */}
                                            <button
                                                onClick={() => onCommitNow?.()}
                                                className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-900 hover:bg-gray-50"
                                            >
                                                Update
                                            </button>
                                        </div>
                                    </div>

                                    <input
                                        value={s.name}
                                        onChange={(e) => updateName(s.id, e.target.value)}
                                        className="mt-2 w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-900"
                                    />

                                    {/* Inputs row (like SOW expanded) */}
                                    <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-4">
                                        <div>
                                            <div className="text-xs font-semibold text-gray-700">MS %</div>
                                            <input
                                                value="100"
                                                disabled
                                                className="mt-1 w-full cursor-not-allowed rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-semibold text-gray-700"
                                            />
                                        </div>

                                        <div>
                                            <div className="text-xs font-semibold text-gray-700">NF %</div>
                                            <input
                                                value="0"
                                                disabled
                                                className="mt-1 w-full cursor-not-allowed rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-semibold text-gray-700"
                                            />
                                        </div>

                                        <div className="md:col-span-2">
                                            <div className="text-xs font-semibold text-gray-700">Year Target (editable)</div>
                                            <input
                                                value={s.yearTargetTotal}
                                                onChange={(e) => setYearTarget(s.id, e.target.value)}
                                                className="mt-1 w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-900"
                                            />
                                        </div>
                                    </div>

                                    {/* Total calc */}
                                    <div className="mt-4 rounded-2xl border border-gray-200 bg-gray-50 p-4">
                                        <div className="text-xs font-semibold text-gray-700">Total (calc)</div>
                                        <div className="mt-1 text-lg font-extrabold text-gray-900">
                                            {fmt(totalYear)}
                                        </div>
                                    </div>

                                    {/* Monthly grid */}
                                    <div className="mt-5 overflow-auto rounded-2xl border border-gray-200">
                                        <table className="min-w-[980px] w-full border-collapse">
                                            <thead className="bg-gray-50">
                                                <tr>
                                                    <th className="px-3 py-3 text-left text-sm font-semibold text-gray-700">
                                                        Month
                                                    </th>
                                                    {MONTHS.map((m) => (
                                                        <th key={m} className={headCellClass(m)}>
                                                            {m}
                                                        </th>
                                                    ))}
                                                    <th className="px-3 py-3 text-right font-medium whitespace-nowrap border-l border-gray-100">
                                                        Year
                                                    </th>
                                                </tr>
                                            </thead>

                                            <tbody>
                                                {/* MS editable row */}
                                                <tr className="border-t border-gray-100">
                                                    <td className="px-3 py-3 text-left text-sm font-semibold text-gray-900">
                                                        MS (editable)
                                                    </td>
                                                    {MONTHS.map((m) => (
                                                        <td key={m} className={bodyCellClass(m)}>
                                                            <input
                                                                value={Math.round(s.msByMonth?.[m] ?? 0)}
                                                                onChange={(e) => setMonthValue(s.id, m, e.target.value)}
                                                                className="w-28 rounded-xl border border-gray-200 bg-white px-3 py-2 text-right text-sm font-semibold text-gray-900"
                                                            />
                                                        </td>
                                                    ))}
                                                    <td className="px-3 py-3 text-right font-bold text-gray-900 border-l border-gray-100">
                                                        {fmt(msYear)}
                                                    </td>
                                                </tr>

                                                {/* NF row (forced 0) */}
                                                <tr className="border-t border-gray-100 bg-white">
                                                    <td className="px-3 py-3 text-left text-sm font-semibold text-gray-900">
                                                        NF (locked 0)
                                                    </td>
                                                    {MONTHS.map((m) => (
                                                        <td key={m} className={bodyCellClass(m)}>
                                                            <div className="w-28 rounded-xl border border-gray-100 bg-gray-50 px-3 py-2 text-right text-sm font-semibold text-gray-600">
                                                                0
                                                            </div>
                                                        </td>
                                                    ))}
                                                    <td className="px-3 py-3 text-right font-bold text-gray-700 border-l border-gray-100">
                                                        {fmt(nfYear)}
                                                    </td>
                                                </tr>

                                                {/* Total calc row */}
                                                <tr className="border-t border-gray-200 bg-gray-50">
                                                    <td className="px-3 py-3 text-left text-sm font-semibold text-gray-900">
                                                        Total (calc)
                                                    </td>
                                                    {MONTHS.map((m) => (
                                                        <td key={m} className={bodyCellClass(m)}>
                                                            <div className="w-28 px-3 py-2 text-right text-sm font-bold text-gray-900">
                                                                {fmt((s.msByMonth?.[m] ?? 0) + 0)}
                                                            </div>
                                                        </td>
                                                    ))}
                                                    <td className="px-3 py-3 text-right text-sm font-extrabold text-gray-900 border-l border-gray-100">
                                                        {fmt(totalYear)}
                                                    </td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>

                                    <div className="mt-3 text-xs text-gray-500">
                                        Tip: Editing a month locks that month and redistributes the remaining amount across other months.
                                    </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
