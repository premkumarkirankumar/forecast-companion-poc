// frontend/src/App.jsx

import { useEffect, useMemo, useState } from "react";
import SummaryCards from "./components/forecast/SummaryCards";
import ChangelogPage from "./components/forecast/ChangelogPage";
import ToolsServicesDetails from "./components/forecast/ToolsServicesDetails";
import TrendsPage from "./components/forecast/TrendsPage";
import AuthBar from "./components/AuthBar";
import AssistantDrawer from "./components/ai/AssistantDrawer";

// ✅ Firestore helpers (Step 6B + 6C)
import { loadProgramState, saveProgramState } from "./data/firestorePrograms";

// simple seed for T&S (only used if you want to render ToolsServicesDetails directly)
const seedTns = [
  {
    id: "tns-1",
    name: "Tool 1",
    yearTarget: 120000,
    msByMonth: {
      Jan: 10000,
      Feb: 10000,
      Mar: 10000,
      Apr: 10000,
      May: 10000,
      Jun: 10000,
      Jul: 10000,
      Aug: 10000,
      Sep: 10000,
      Oct: 10000,
      Nov: 10000,
      Dec: 10000,
    },
    nfByMonth: {
      Jan: 0,
      Feb: 0,
      Mar: 0,
      Apr: 0,
      May: 0,
      Jun: 0,
      Jul: 0,
      Aug: 0,
      Sep: 0,
      Oct: 0,
      Nov: 0,
      Dec: 0,
    },
  },
];

export default function App() {
  const [page, setPage] = useState("dashboard"); // dashboard | changelog | trends
  const [selectedProgram, setSelectedProgram] = useState(() => {
    try {
      const raw = localStorage.getItem("pfc.ui.program");
      const v = raw ? JSON.parse(raw) : "connected";
      return ["connected", "tre", "csc"].includes(v) ? v : "connected";
    } catch {
      return "connected";
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem("pfc.ui.program", JSON.stringify(selectedProgram));
    } catch {
      // ignore
    }
  }, [selectedProgram]);

  const [tnsItems, setTnsItems] = useState(seedTns);
  const showToolsServicesOnly = useMemo(() => false, []);

  // ✅ Hydration flag so we don't auto-save while loading remote state
  const [isHydrating, setIsHydrating] = useState(false);

  // ✅ Step 6B: Load from Firestore when program changes (shared doc per program)
  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        setIsHydrating(true);

        const remoteState = await loadProgramState(selectedProgram);

        if (cancelled) return;

        // Only apply what App.jsx owns today.
        // (Later you can expand this to include internal/external state too.)
        if (remoteState && Array.isArray(remoteState.tnsItems)) {
          setTnsItems(remoteState.tnsItems);
        }
      } catch (e) {
        // Keep app usable even if Firestore fails
        console.error("Failed to load Firestore state:", e);
      } finally {
        if (!cancelled) setIsHydrating(false);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [selectedProgram]);

  // ✅ Step 6C: Save to Firestore when state changes (debounced)
  useEffect(() => {
    if (isHydrating) return;

    const t = setTimeout(() => {
      // Save shared program doc: programs/{connected|tre|csc}
      saveProgramState(selectedProgram, { tnsItems }).catch((e) => {
        console.error("Failed to save Firestore state:", e);
      });
    }, 800);

    return () => clearTimeout(t);
  }, [selectedProgram, tnsItems, isHydrating]);

  if (page === "changelog") {
    return (
      <div className="min-h-screen bg-gray-50">
        {/* No mx-auto, minimal padding so it aligns left */}
        <div className="w-full px-3 py-4">
          <ChangelogPage onBack={() => setPage("dashboard")} />
        </div>
      </div>
    );
  }

  if (page === "trends") {
    return (
      <TrendsPage
        selectedProgram={selectedProgram}
        onBack={() => setPage("dashboard")}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Bar (full width, left aligned) */}
      <div className="border-b border-gray-200 bg-white">
        <div className="flex w-full items-center justify-between px-3 py-4">
          <div>
            <div className="text-lg font-extrabold text-gray-900">
              Forecast Companion (POC)
            </div>
            <div className="mt-1 text-sm text-gray-600">
              Internal • Tools & Services • External
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage("trends")}
              className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-100"
            >
              Trends
            </button>

            <button
              onClick={() => setPage("changelog")}
              className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800"
            >
              Change Log
            </button>
            {/* ✅ Gemini Assistant */}
            <AssistantDrawer programId={selectedProgram} />
            <AuthBar />
          </div>
        </div>
      </div>

      {/* Main Content (full width, left aligned) */}
      <div className="w-full px-3 py-5">
        {!showToolsServicesOnly ? (
          <SummaryCards
            selectedProgram={selectedProgram}
            onProgramChange={setSelectedProgram}
          />
        ) : (
          <ToolsServicesDetails
            items={tnsItems}
            setItems={setTnsItems}
            onLog={() => { }}
          />
        )}
      </div>
    </div>
  );
}