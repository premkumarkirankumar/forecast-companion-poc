import { useEffect, useState } from "react";
import { MONTHS } from "../../data/hub";

/* =========================
   Helpers (same as contractors)
========================= */
function fmt(value) {
    if (value === null || value === undefined) return "$—";
    return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0,
    }).format(value);
}

function clampPct(n) {
    const x = Number(n);
    if (Number.isNaN(x)) return 0;
    return Math.max(0, Math.min(100, x));
}

function monthDividerClass(m) {
    const isQuarterStart = m === "Apr" || m === "Jul" || m === "Oct";
    const base = m === "Jan" ? "" : "border-l border-gray-100";
    const quarter = isQuarterStart ? " border-l-2 border-gray-200" : "";
    return (base + quarter).trim();
}

function headCellClass(m) {
    return [
        "px-3 py-3 text-right font-medium whitespace-nowrap",
        monthDividerClass(m),
    ].join(" ");
}

function bodyCellClass(m) {
    return ["px-2 py-3 align-top", monthDividerClass(m)].join(" ");
}

function distributeEvenly(total, lockedByMonth) {
    const lockedSum = MONTHS.reduce((a, m) => a + (lockedByMonth[m] ?? 0), 0);
    const remaining = Math.max(0, total - lockedSum);

    const unlockedMonths = MONTHS.filter((m) => lockedByMonth[m] === undefined);
    const per = unlockedMonths.length ? remaining / unlockedMonths.length : 0;

    const out = {};
    for (const m of MONTHS) {
        out[m] = lockedByMonth[m] === undefined ? per : lockedByMonth[m];
    }
    return out;
}

function normalizeSplit(msPct, nfPct) {
    const ms = clampPct(msPct);
    const nf = clampPct(nfPct);
    const s = ms + nf;
    if (s === 0) return { msPct: 0, nfPct: 0 };
    const msN = Math.round((ms / s) * 100);
    return { msPct: msN, nfPct: 100 - msN };
}

function num(v) {
    const x = Number(v);
    return Number.isFinite(x) ? x : 0;
}

function hasValue(v) {
    return String(v ?? "").trim().length > 0;
}

/* =========================
   Main Component
========================= */
export default function ExternalSowDetails({
    programKey,
    sows,
    setSows,
    onLog,
}) {
    // ✅ Persist expanded cards per program (SOW)
    const expandedKey = `pfc.${programKey}.ui.sow.expandedIds`;
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
        msPct: "",
        nfPct: "",
    });

    function upd(k, v) {
        setDraft((d) => ({ ...d, [k]: v }));
    }

    const canAdd =
        hasValue(draft.name) &&
        hasValue(draft.totalYear) &&
        (hasValue(draft.msPct) || hasValue(draft.nfPct)) &&
        clampPct(draft.msPct) + clampPct(draft.nfPct) > 0;

    function updateSow(id, patchFn) {
        setSows((arr) => arr.map((s) => (s.id === id ? patchFn(s) : s)));
    }

    function recomputeFromYearTarget(s) {
        const msYear = s.yearTargetTotal * (s.msPct / 100);
        const nfYear = s.yearTargetTotal * (s.nfPct / 100);

        return {
            ...s,
            msByMonth: distributeEvenly(msYear, s.msLocked),
            nfByMonth: distributeEvenly(nfYear, s.nfLocked),
        };
    }

    function addSow() {
        if (!canAdd) return;

        const yearTarget = num(draft.totalYear);
        const split = normalizeSplit(draft.msPct, draft.nfPct);

        const msYear = yearTarget * (split.msPct / 100);
        const nfYear = yearTarget * (split.nfPct / 100);

        const newItem = {
            id: crypto.randomUUID(),
            name: String(draft.name).trim(),
            msPct: split.msPct,
            nfPct: split.nfPct,
            yearTargetTotal: yearTarget,
            msByMonth: distributeEvenly(msYear, {}),
            nfByMonth: distributeEvenly(nfYear, {}),
            msLocked: {},
            nfLocked: {},
        };

        setSows((arr) => [newItem, ...arr]);

        onLog?.({
            action: "ADD_SOW",
            entityType: "sow",
            entityId: newItem.id,
            entityName: newItem.name,
        });

        setDraft({ name: "", totalYear: "", msPct: "", nfPct: "" });
    }

    function removeSow(id) {
        const existing = sows.find((s) => s.id === id);
        onLog?.({
            action: "REMOVE_SOW",
            entityType: "sow",
            entityId: id,
            entityName: existing?.name,
        });

        setExpandedIds((prev) => prev.filter((x) => x !== id));
        setSows((arr) => arr.filter((s) => s.id !== id));
    }

    function updateName(id, name) {
        const existing = sows.find((s) => s.id === id);
        updateSow(id, (s) => ({ ...s, name }));
        onLog?.({
            action: "UPDATE_SOW_NAME",
            entityType: "sow",
            entityId: id,
            entityName: existing?.name,
            field: "name",
            from: existing?.name,
            to: name,
        });
    }

    function updateSplit(id, msPct, nfPct) {
        const existing = sows.find((s) => s.id === id);
        const nextSplit = normalizeSplit(msPct, nfPct);
        updateSow(id, (s) => {
            const next = { ...s, ...nextSplit };
            return recomputeFromYearTarget(next);
        });

        // ✅ log only if something really changed
        if (
            Number(existing?.msPct ?? 0) !== Number(nextSplit.msPct) ||
            Number(existing?.nfPct ?? 0) !== Number(nextSplit.nfPct)
        ) {
            onLog?.({
                action: "UPDATE_SOW_SPLIT",
                entityType: "sow",
                entityId: id,
                entityName: existing?.name,
                field: "split",
                from: { msPct: existing?.msPct, nfPct: existing?.nfPct },
                to: { msPct: nextSplit.msPct, nfPct: nextSplit.nfPct },
            });
        }
    }

    function setYearTarget(id, value) {
        const v = Number(value);
        const val = Number.isFinite(v) ? v : 0;

        const existing = sows.find((s) => s.id === id);
        onLog?.({
            action: "UPDATE_SOW_YEAR_TARGET",
            entityType: "sow",
            entityId: id,
            entityName: existing?.name,
            field: "yearTargetTotal",
            from: existing?.yearTargetTotal,
            to: val,
        });

        updateSow(id, (s) => recomputeFromYearTarget({ ...s, yearTargetTotal: val }));
    }

    function setMonthValue(id, kind, month, value) {
        const v = Number(value);
        const val = Number.isFinite(v) ? v : 0;

        const existing = sows.find((s) => s.id === id);
        const from = kind === "ms" ? existing?.msLocked?.[month] : existing?.nfLocked?.[month];

        onLog?.({
            action: kind === "ms" ? "EDIT_SOW_MS_MONTH" : "EDIT_SOW_NF_MONTH",
            entityType: "sow",
            entityId: id,
            entityName: existing?.name,
            field: `${kind}.${month}`,
            from,
            to: val,
        });

        updateSow(id, (s) => {
            const lockedKey = kind === "ms" ? "msLocked" : "nfLocked";
            const next = { ...s, [lockedKey]: { ...s[lockedKey], [month]: val } };
            return recomputeFromYearTarget(next);
        });
    }

    const subtlePanel =
        "rounded-2xl border border-emerald-200/60 bg-emerald-50/25 p-5 shadow-sm";

    return (
        <div className={subtlePanel}>
            <div className="flex items-start justify-between gap-4">
                <div>
                    <div className="text-sm font-semibold text-gray-900">External Details — SOW</div>
                    <div className="mt-1 text-xs text-gray-600">
                        Add SOW → set yearly target → edit MS/NF by month (auto rebalances remaining months).
                    </div>
                </div>

                <div className="hidden sm:flex items-center gap-2 rounded-xl bg-white/60 px-3 py-2 text-xs text-gray-600 ring-1 ring-gray-100">
                    Quarter separators at Apr / Jul / Oct
                </div>
            </div>

            {/* Add SOW form */}
            <div className="mt-5 grid gap-3 rounded-2xl bg-white/70 p-4 ring-1 ring-gray-100 lg:grid-cols-12">
                <div className="lg:col-span-5">
                    <label className="text-xs font-medium text-gray-600">SOW Name</label>
                    <input
                        className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gray-200"
                        value={draft.name}
                        onChange={(e) => upd("name", e.target.value)}
                        placeholder="e.g., SOW — Vendor X"
                    />
                </div>

                <div className="lg:col-span-3">
                    <label className="text-xs font-medium text-gray-600">SOW Total (year)</label>
                    <input
                        type="number"
                        className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gray-200 tabular-nums"
                        value={draft.totalYear}
                        onChange={(e) => upd("totalYear", e.target.value)}
                        placeholder="$ total"
                    />
                </div>

                <div className="lg:col-span-2">
                    <label className="text-xs font-medium text-gray-600">MS %</label>
                    <input
                        type="number"
                        className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gray-200 tabular-nums"
                        value={draft.msPct}
                        onChange={(e) => upd("msPct", e.target.value)}
                        placeholder="%"
                    />
                </div>

                <div className="lg:col-span-1">
                    <label className="text-xs font-medium text-gray-600">NF %</label>
                    <input
                        type="number"
                        className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gray-200 tabular-nums"
                        value={draft.nfPct}
                        onChange={(e) => upd("nfPct", e.target.value)}
                        placeholder="%"
                    />
                </div>

                <div className="lg:col-span-1 flex items-end">
                    <button
                        onClick={addSow}
                        disabled={!canAdd}
                        className={[
                            "w-full rounded-xl px-3 py-2 text-sm font-semibold transition",
                            canAdd
                                ? "bg-gray-900 text-white hover:bg-gray-800"
                                : "bg-gray-200 text-gray-500 cursor-not-allowed",
                        ].join(" ")}
                    >
                        Add
                    </button>
                </div>
            </div>

            {/* SOW accordion cards */}
            <div className="mt-5 space-y-3">
                {sows.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-gray-200 bg-white/60 p-4 text-sm text-gray-600">
                        No SOW items added yet.
                    </div>
                ) : (
                    sows.map((s) => {
                        const msYear = MONTHS.reduce((a, m) => a + (s.msByMonth?.[m] ?? 0), 0);
                        const nfYear = MONTHS.reduce((a, m) => a + (s.nfByMonth?.[m] ?? 0), 0);
                        const totalYear = msYear + nfYear;

                        const expanded = isExpanded(s.id);

                        return (
                            <div
                                key={s.id}
                                className="rounded-2xl border border-emerald-200/50 bg-white shadow-sm"
                            >
                                {/* Header row */}
                                <button
                                    type="button"
                                    onClick={() => toggleExpanded(s.id)}
                                    className="w-full px-5 py-4 text-left"
                                >
                                    <div className="flex flex-wrap items-center justify-between gap-3">
                                        <div className="min-w-[280px]">
                                            <div className="text-xs font-medium text-gray-600">SOW Name</div>
                                            <div className="mt-1 text-sm font-semibold text-gray-900">
                                                {s.name || "Untitled"}
                                            </div>
                                            <div className="mt-1 text-xs text-gray-600">
                                                Year Target:{" "}
                                                <span className="font-semibold">{fmt(s.yearTargetTotal)}</span>{" "}
                                                • Split{" "}
                                                <span className="font-semibold text-blue-700">MS {s.msPct}%</span>{" "}
                                                /{" "}
                                                <span className="font-semibold text-purple-700">NF {s.nfPct}%</span>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-3">
                                            <div className="rounded-xl bg-emerald-50 px-3 py-2 text-xs text-gray-700 ring-1 ring-emerald-100">
                                                Total (calc):{" "}
                                                <span className="font-semibold">{fmt(totalYear)}</span>
                                            </div>

                                            <span className="rounded-full bg-gray-100 px-2 py-1 text-[11px] font-medium text-gray-700">
                                                {expanded ? "Hide" : "Show"}
                                            </span>
                                            <span className="text-lg text-gray-600">{expanded ? "▾" : "▸"}</span>
                                        </div>
                                    </div>
                                </button>

                                {/* Expanded details */}
                                {expanded ? (
                                    <div className="border-t border-gray-100">
                                        <div className="flex flex-wrap items-start justify-between gap-3 px-5 py-4">
                                            <div className="w-full sm:w-auto">
                                                <div className="text-xs font-medium text-gray-600">
                                                    SOW Name (editable)
                                                </div>
                                                <input
                                                    className="mt-1 w-full sm:w-[520px] rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-900 outline-none focus:ring-2 focus:ring-gray-200"
                                                    value={s.name}
                                                    onChange={(e) => updateName(s.id, e.target.value)}
                                                />
                                            </div>

                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => removeSow(s.id)}
                                                    className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-900 hover:bg-gray-50"
                                                >
                                                    Remove
                                                </button>
                                            </div>
                                        </div>

                                        {/* Inputs row */}
                                        <div className="grid gap-3 px-5 pb-4 md:grid-cols-5">
                                            <div>
                                                <label className="text-xs font-medium text-gray-600">MS %</label>
                                                <input
                                                    type="number"
                                                    className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gray-200 tabular-nums"
                                                    value={s.msPct}
                                                    onChange={(e) => updateSplit(s.id, e.target.value, s.nfPct)}
                                                />
                                            </div>

                                            <div>
                                                <label className="text-xs font-medium text-gray-600">NF %</label>
                                                <input
                                                    type="number"
                                                    className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gray-200 tabular-nums"
                                                    value={s.nfPct}
                                                    onChange={(e) => updateSplit(s.id, s.msPct, e.target.value)}
                                                />
                                            </div>

                                            <div className="md:col-span-2">
                                                <label className="text-xs font-medium text-gray-600">
                                                    Year Target (editable)
                                                </label>
                                                <input
                                                    type="number"
                                                    className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gray-200 tabular-nums"
                                                    value={Math.round(s.yearTargetTotal)}
                                                    onChange={(e) => setYearTarget(s.id, e.target.value)}
                                                />
                                            </div>

                                            <div className="rounded-xl bg-gray-50 p-3 ring-1 ring-gray-100">
                                                <div className="text-xs font-medium text-gray-600">Total (calc)</div>
                                                <div className="mt-1 text-sm font-semibold text-gray-900 tabular-nums">
                                                    {fmt(totalYear)}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Monthly grid */}
                                        <div className="overflow-x-auto border-t border-gray-100">
                                            <table className="min-w-[1650px] w-full border-collapse">
                                                <thead>
                                                    <tr className="text-xs text-gray-600">
                                                        <th className="sticky left-0 bg-white px-5 py-3 text-left font-medium">
                                                            Month
                                                        </th>
                                                        {MONTHS.map((m) => (
                                                            <th key={m} className={headCellClass(m)}>
                                                                {m}
                                                            </th>
                                                        ))}
                                                        <th className="px-5 py-3 text-right font-medium">Year</th>
                                                    </tr>
                                                </thead>

                                                <tbody>
                                                    {/* MS editable */}
                                                    <tr className="border-t border-gray-100 bg-blue-50/35">
                                                        <td className="sticky left-0 bg-white px-5 py-4 text-sm font-semibold text-gray-900">
                                                            MS (editable)
                                                        </td>
                                                        {MONTHS.map((m) => (
                                                            <td key={m} className={bodyCellClass(m)}>
                                                                <input
                                                                    type="number"
                                                                    inputMode="numeric"
                                                                    className={[
                                                                        "w-full min-w-[160px]",
                                                                        "rounded-xl border border-gray-200 bg-white",
                                                                        "px-3 py-2 text-right text-sm font-semibold tabular-nums",
                                                                        "outline-none focus:ring-2 focus:ring-gray-200",
                                                                    ].join(" ")}
                                                                    value={Math.round(s.msByMonth?.[m] ?? 0)}
                                                                    onChange={(e) => setMonthValue(s.id, "ms", m, e.target.value)}
                                                                />
                                                            </td>
                                                        ))}
                                                        <td className="px-5 py-4 text-right text-sm font-semibold tabular-nums text-gray-900 whitespace-nowrap">
                                                            {fmt(msYear)}
                                                        </td>
                                                    </tr>

                                                    {/* NF editable */}
                                                    <tr className="border-t border-gray-100 bg-purple-50/35">
                                                        <td className="sticky left-0 bg-white px-5 py-4 text-sm font-semibold text-gray-900">
                                                            NF (editable)
                                                        </td>
                                                        {MONTHS.map((m) => (
                                                            <td key={m} className={bodyCellClass(m)}>
                                                                <input
                                                                    type="number"
                                                                    inputMode="numeric"
                                                                    className={[
                                                                        "w-full min-w-[160px]",
                                                                        "rounded-xl border border-gray-200 bg-white",
                                                                        "px-3 py-2 text-right text-sm font-semibold tabular-nums",
                                                                        "outline-none focus:ring-2 focus:ring-gray-200",
                                                                    ].join(" ")}
                                                                    value={Math.round(s.nfByMonth?.[m] ?? 0)}
                                                                    onChange={(e) => setMonthValue(s.id, "nf", m, e.target.value)}
                                                                />
                                                            </td>
                                                        ))}
                                                        <td className="px-5 py-4 text-right text-sm font-semibold tabular-nums text-gray-900 whitespace-nowrap">
                                                            {fmt(nfYear)}
                                                        </td>
                                                    </tr>

                                                    {/* Total calc */}
                                                    <tr className="border-t border-gray-100 bg-gray-50/60">
                                                        <td className="sticky left-0 bg-white px-5 py-4 text-sm font-semibold text-gray-900">
                                                            Total (calc)
                                                        </td>
                                                        {MONTHS.map((m) => (
                                                            <td
                                                                key={m}
                                                                className={[
                                                                    "px-3 py-4 text-right text-sm font-semibold tabular-nums text-gray-900 whitespace-nowrap",
                                                                    monthDividerClass(m),
                                                                ].join(" ")}
                                                            >
                                                                {fmt((s.msByMonth?.[m] ?? 0) + (s.nfByMonth?.[m] ?? 0))}
                                                            </td>
                                                        ))}
                                                        <td className="px-5 py-4 text-right text-sm font-semibold tabular-nums text-gray-900 whitespace-nowrap">
                                                            {fmt(totalYear)}
                                                        </td>
                                                    </tr>
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                ) : null}
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}