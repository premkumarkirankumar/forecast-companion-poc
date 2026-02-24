import { useMemo, useState } from "react";

import SummaryCards from "./components/forecast/SummaryCards";

// ✅ keep changelog inside forecast folder (matches your structure)
import ChangelogPage from "./components/forecast/ChangelogPage";

// ✅ Tools & Services details is under forecast (as you said)
import ToolsServicesDetails from "./components/forecast/ToolsServicesDetails";

/**
 * NOTE:
 * - If your real app already uses SummaryCards as the main UI, keep it.
 * - This App.jsx provides a top-level "Change Log" button that opens a separate page.
 * - If you want the Change Log button to appear inside SummaryCards instead, tell me and I’ll move it.
 */

// simple seed for T&S (only used if you want to render ToolsServicesDetails directly)
const seedTns = [
  {
    id: "tns-1",
    name: "Tool 1",
    yearTarget: 120000,
    msByMonth: {
      Jan: 10000, Feb: 10000, Mar: 10000, Apr: 10000, May: 10000, Jun: 10000,
      Jul: 10000, Aug: 10000, Sep: 10000, Oct: 10000, Nov: 10000, Dec: 10000,
    },
    nfByMonth: {
      Jan: 0, Feb: 0, Mar: 0, Apr: 0, May: 0, Jun: 0,
      Jul: 0, Aug: 0, Sep: 0, Oct: 0, Nov: 0, Dec: 0,
    },
  },
];

export default function App() {
  // "dashboard" shows your app; "changelog" shows the changelog page
  const [page, setPage] = useState("dashboard");

  // If you already store TNS in localStorage in SummaryCards, you can ignore this.
  // This only exists so ToolsServicesDetails can render if you want it.
  const [tnsItems, setTnsItems] = useState(seedTns);

  const showToolsServicesOnly = useMemo(() => false, []);
  // set to true ONLY if you want to test ToolsServicesDetails standalone

  if (page === "changelog") {
    return <ChangelogPage onBack={() => setPage("dashboard")} />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Bar */}
      <div className="w-full border-b bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-6 py-4">
          <div>
            <div className="text-lg font-bold text-gray-900">Forecast Companion (POC)</div>
            <div className="text-xs font-semibold text-gray-500">
              External • Tools & Services • Trend
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage("changelog")}
              className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800"
            >
              Change Log
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="mx-auto max-w-6xl px-6 py-6">
        {/* Your real UI */}
        {!showToolsServicesOnly ? (
          <SummaryCards selectedProgram="default" />
        ) : (
          <ToolsServicesDetails
            programKey="default"
            items={tnsItems}
            setItems={setTnsItems}
            // If your ToolsServicesDetails expects onLog, you can pass a no-op for now:
            onLog={() => {}}
          />
        )}
      </div>
    </div>
  );
}