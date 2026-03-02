// frontend/src/App.jsx

import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged, signInWithPopup } from "firebase/auth";
import SummaryCards from "./components/forecast/SummaryCards";
import ChangelogPage from "./components/forecast/ChangelogPage";
import ToolsServicesDetails from "./components/forecast/ToolsServicesDetails";
import TrendsPage from "./components/forecast/TrendsPage";
import DataManagementPage from "./components/forecast/DataManagementPage";
import ExecutiveOverview from "./components/forecast/ExecutiveOverview";
import TechStackPage from "./components/forecast/TechStackPage";
import AuthBar from "./components/AuthBar";
import AssistantDrawer from "./components/ai/AssistantDrawer";
import { auth, googleProvider } from "./firebase";

// ✅ Firestore helpers
import { loadProgramState, saveProgramState } from "./data/firestorePrograms";

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
  const [page, setPage] = useState("dashboard"); // dashboard | executive | changelog | trends | techstack | data
  const [user, setUser] = useState(null);
  const [authBusy, setAuthBusy] = useState(false);
  const [entryMode, setEntryMode] = useState(() => {
    try {
      const raw = localStorage.getItem("pfc.ui.entryMode");
      const v = raw ? JSON.parse(raw) : null;
      return ["local", "google"].includes(v) ? v : null;
    } catch {
      return null;
    }
  });

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

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser || null);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (user && entryMode === "local") {
      setEntryMode("google");
      setPage("executive");
    }
  }, [user, entryMode]);

  useEffect(() => {
    try {
      if (!entryMode) {
        localStorage.removeItem("pfc.ui.entryMode");
      } else {
        localStorage.setItem("pfc.ui.entryMode", JSON.stringify(entryMode));
      }
    } catch {
      // ignore
    }
  }, [entryMode]);

  const [tnsItems, setTnsItems] = useState(seedTns);

  // NOTE: In your current app, this is always false.
  // SummaryCards is the owner of program Firestore state.
  const showToolsServicesOnly = useMemo(() => false, []);

  const [isHydrating, setIsHydrating] = useState(false);

  // ✅ AI Drawer state
  const [aiOpen, setAiOpen] = useState(false);

  // ✅ Load Firestore on program change (ONLY if ToolsServicesDetails is being used here)
  useEffect(() => {
    if (!showToolsServicesOnly) return;

    let cancelled = false;

    async function run() {
      try {
        setIsHydrating(true);

        const remoteState = await loadProgramState(selectedProgram);

        if (cancelled) return;

        if (remoteState && Array.isArray(remoteState.tnsItems)) {
          setTnsItems(remoteState.tnsItems);
        }
      } catch (e) {
        console.error("Failed to load Firestore state:", e);
      } finally {
        if (!cancelled) setIsHydrating(false);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [selectedProgram, showToolsServicesOnly]);

  // ✅ Save Firestore (debounced) (ONLY if ToolsServicesDetails is being used here)
  useEffect(() => {
    if (!showToolsServicesOnly) return;
    if (isHydrating) return;

    const t = setTimeout(() => {
      (async () => {
        try {
          // ✅ IMPORTANT: Don't overwrite the entire program state with only { tnsItems }.
          // Load existing state and merge, overriding only tnsItems.
          const existing = (await loadProgramState(selectedProgram)) || {};
          const nextState = { ...existing, tnsItems };

          await saveProgramState(selectedProgram, nextState);
        } catch (e) {
          console.error("Failed to save Firestore state:", e);
        }
      })();
    }, 800);

    return () => clearTimeout(t);
  }, [selectedProgram, tnsItems, isHydrating, showToolsServicesOnly]);

  async function handleGoogleEntry() {
    if (user) {
      setEntryMode("google");
      setPage("executive");
      return;
    }

    setAuthBusy(true);
    try {
      await signInWithPopup(auth, googleProvider);
      setEntryMode("google");
      setPage("executive");
    } catch (e) {
      console.error("Google sign-in failed:", e);
      alert(e?.message || "Sign-in failed");
    } finally {
      setAuthBusy(false);
    }
  }

  function returnToEntry() {
    setPage("dashboard");
    setEntryMode(null);
  }

  function handleAuthEntry() {
    setEntryMode("google");
    setPage("executive");
  }

  if (!entryMode) {
    return (
      <div className="min-h-screen bg-[radial-gradient(circle_at_18%_18%,_#1f2937_0%,_#0f172a_42%,_#172554_72%,_#082f49_100%)] text-white">
        <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col justify-center px-6 py-10">
          <div className="rounded-[2rem] border border-white/10 bg-slate-950/35 p-8 shadow-2xl shadow-black/35 backdrop-blur-2xl sm:p-12">
            <div className="max-w-4xl">
              <div className="inline-flex items-center rounded-full border border-white/10 bg-white/10 px-7 py-3 text-lg font-black uppercase tracking-[0.34em] text-white shadow-lg shadow-black/15 sm:text-xl">
                Forecast Companion
              </div>

              <div className="mt-8 flex flex-wrap gap-3">
                <button
                  type="button"
                  disabled={authBusy}
                  onClick={handleGoogleEntry}
                  className="rounded-2xl bg-slate-900 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-black/20 hover:bg-slate-800 disabled:opacity-60"
                >
                  {authBusy
                    ? "Signing in…"
                    : user
                      ? "Continue with Google"
                      : "Sign in with Google"}
                </button>

                <button
                  type="button"
                  onClick={() => setEntryMode("local")}
                  className="rounded-2xl border border-white/15 bg-white/10 px-6 py-3 text-sm font-semibold text-white hover:bg-white/15"
                >
                  Continue in Local Mode
                </button>
              </div>

              {user ? (
                <div className="mt-4 text-sm font-medium text-slate-300">
                  Signed in as {user.displayName || user.email}
                </div>
              ) : (
                <div className="mt-4 text-sm text-slate-300">
                  Google sign-in enables saved cloud-backed access. Local mode keeps the current
                  lightweight workflow available without sign-in.
                </div>
              )}
            </div>

            <div className="mt-10 grid gap-4 lg:grid-cols-3">
              <div className="rounded-2xl border border-orange-400/20 bg-white/8 p-5 shadow-lg shadow-black/10">
                <div className="text-xs font-semibold uppercase tracking-wide text-orange-300">
                  Signed-In Mode
                </div>
                <div className="mt-2 text-lg font-bold text-white">Cloud-backed access</div>
                <div className="mt-2 text-sm text-slate-300">
                  Use Google sign-in when you want account-aware access and a more durable saved
                  experience.
                </div>
              </div>

              <div className="rounded-2xl border border-sky-400/20 bg-white/8 p-5 shadow-lg shadow-black/10">
                <div className="text-xs font-semibold uppercase tracking-wide text-sky-300">
                  Local Mode
                </div>
                <div className="mt-2 text-lg font-bold text-white">Fast local entry</div>
                <div className="mt-2 text-sm text-slate-300">
                  Keep working with the current local-first behavior when you need immediate
                  access without signing in.
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/8 p-5 shadow-lg shadow-black/10">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-300">
                  What You’ll Enter
                </div>
                <div className="mt-2 text-sm text-slate-300">
                  Internal staffing, Tools & Services, External vendors, Trends, Change Log, and
                  AI guidance in one shared workspace.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (page === "changelog") {
    return (
      <div className="min-h-screen bg-gray-50">
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
        onProgramChange={setSelectedProgram}
        onBack={() => setPage("dashboard")}
        entryMode={entryMode}
      />
    );
  }

  // ✅ Data Management page (UI-only navigation)
  if (page === "data") {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="w-full px-3 py-4">
          <DataManagementPage onBack={() => setPage("dashboard")} entryMode={entryMode} />
        </div>
      </div>
    );
  }

  if (page === "techstack") {
    return <TechStackPage onBack={() => setPage("dashboard")} entryMode={entryMode} />;
  }

  if (page === "executive") {
    return (
      <ExecutiveOverview
        entryMode={entryMode}
        selectedProgram={selectedProgram}
        onSelectProgram={setSelectedProgram}
        onContinue={() => setPage("dashboard")}
      />
    );
  }

  const navButtonClass = (active) =>
    [
      "rounded-xl px-4 py-2 text-sm font-semibold transition duration-200 ease-out transform-gpu",
      active
        ? "bg-gray-900 text-white shadow-sm ring-1 ring-gray-900"
        : "bg-white text-gray-900 hover:-translate-y-0.5 hover:scale-[1.03] hover:bg-sky-50 hover:text-sky-900 hover:shadow-md hover:ring-1 hover:ring-sky-200",
    ].join(" ");

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Bar */}
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

          <div className="flex flex-wrap items-center justify-end gap-3">
            <div className="flex items-center gap-2 rounded-2xl border border-gray-200 bg-gray-50/80 p-1.5">
              <button
                onClick={() => setPage("executive")}
                className={navButtonClass(page === "executive")}
              >
                Executive Summary
              </button>

              <button
                onClick={() => setPage("techstack")}
                className={navButtonClass(page === "techstack")}
              >
                Strategic View
              </button>

              <button onClick={() => setAiOpen(true)} className={navButtonClass(aiOpen)}>
                AI Advisor
              </button>

              <button
                onClick={() => setPage("trends")}
                className={navButtonClass(page === "trends")}
              >
                Trends
              </button>
            </div>

            <div className="flex items-center gap-2 rounded-2xl border border-gray-200 bg-white p-1.5 shadow-sm">
              <button
                onClick={() => setPage("changelog")}
                className={navButtonClass(page === "changelog")}
              >
                Change Log
              </button>

              <button
                onClick={() => setPage("data")}
                className={navButtonClass(page === "data")}
              >
                Data Management
              </button>

              <button onClick={returnToEntry} className={navButtonClass(false)}>
                Entry Options
              </button>
            </div>

            <AuthBar onSignedIn={handleAuthEntry} onSignedOut={returnToEntry} />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="w-full px-3 py-5">
        {!showToolsServicesOnly ? (
          <SummaryCards
            selectedProgram={selectedProgram}
            onProgramChange={setSelectedProgram}
            entryMode={entryMode}
          />
        ) : (
          <ToolsServicesDetails items={tnsItems} setItems={setTnsItems} onLog={() => {}} />
        )}
      </div>

      <AssistantDrawer
        open={aiOpen}
        onClose={() => setAiOpen(false)}
        programId={selectedProgram}
      />
    </div>
  );
}
