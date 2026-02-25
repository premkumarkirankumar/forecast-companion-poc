import { useMemo, useState } from "react";
import { addChangeLogEntry, clearChangeLog, loadChangeLog } from "./changeLogStore";

function fmtTs(iso) {
    try {
        return new Date(iso).toLocaleString();
    } catch {
        return iso;
    }
}

export default function ChangeLogPage({ onBack }) {
    const [entries, setEntries] = useState(() => loadChangeLog());
    const [author, setAuthor] = useState("");
    const [area, setArea] = useState("General");
    const [message, setMessage] = useState("");

    const canAdd = useMemo(() => author.trim() && message.trim(), [author, message]);

    function onAdd() {
        if (!canAdd) return;
        const updated = addChangeLogEntry({
            author,
            area,
            message,
            meta: {},
        });
        setEntries(updated);
        setMessage("");
    }

    function onClear() {
        const ok = confirm("Clear the change log? This cannot be undone.");
        if (!ok) return;

        const updated = clearChangeLog();
        setEntries(updated);
    }

    return (
        <div className="w-full max-w-6xl mx-auto px-6 py-6">
            <div className="flex items-center justify-between gap-4 mb-6">
                <div>
                    <div className="text-2xl font-semibold">Change Log</div>
                    <div className="text-sm text-gray-500">
                        One shared log across External + Tools & Services + future sections.
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={onClear}
                        className="px-4 py-2 rounded-xl border bg-white hover:bg-gray-50"
                    >
                        Clear Log
                    </button>
                    <button
                        onClick={onBack}
                        className="px-4 py-2 rounded-xl border bg-white hover:bg-gray-50"
                    >
                        Back
                    </button>
                </div>
            </div>

            <div className="rounded-2xl border bg-white p-5 mb-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <div className="text-xs font-semibold text-gray-600 mb-1">Your name</div>
                        <input
                            value={author}
                            onChange={(e) => setAuthor(e.target.value)}
                            placeholder="Enter your name (required)"
                            className="w-full px-3 py-2 rounded-xl border"
                        />
                    </div>

                    <div>
                        <div className="text-xs font-semibold text-gray-600 mb-1">Area</div>
                        <select
                            value={area}
                            onChange={(e) => setArea(e.target.value)}
                            className="w-full px-3 py-2 rounded-xl border bg-white"
                        >
                            <option>General</option>
                            <option>External</option>
                            <option>Tools & Services</option>
                            <option>SOW</option>
                            <option>Contractors</option>
                        </select>
                    </div>

                    <div className="flex items-end">
                        <button
                            onClick={onAdd}
                            disabled={!canAdd}
                            className={`w-full px-4 py-2 rounded-xl border ${canAdd ? "bg-black text-white" : "bg-gray-100 text-gray-400"
                                }`}
                        >
                            Add Entry
                        </button>
                    </div>
                </div>

                <div className="mt-4">
                    <div className="text-xs font-semibold text-gray-600 mb-1">What changed</div>
                    <textarea
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        placeholder="Example: Updated Tools & Services expanded layout to match SOW structure"
                        className="w-full px-3 py-2 rounded-xl border min-h-[90px]"
                    />
                </div>
            </div>

            <div className="rounded-2xl border bg-white overflow-hidden">
                <div className="px-5 py-3 border-b bg-gray-50 text-sm font-semibold">
                    Entries ({entries.length})
                </div>

                {entries.length === 0 ? (
                    <div className="p-6 text-gray-500">No entries yet.</div>
                ) : (
                    <div className="divide-y">
                        {entries.map((e) => (
                            <div key={e.id} className="p-5">
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className="text-sm font-semibold">{e.author}</span>
                                    <span className="text-xs px-2 py-1 rounded-full border bg-white">
                                        {e.area}
                                    </span>
                                    <span className="text-xs text-gray-500">{fmtTs(e.ts)}</span>
                                </div>
                                <div className="mt-2 text-sm">{e.message}</div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}