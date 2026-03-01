// frontend/src/App.jsx

import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged, signInWithPopup } from "firebase/auth";
import SummaryCards from "./components/forecast/SummaryCards";
import ChangelogPage from "./components/forecast/ChangelogPage";
import ToolsServicesDetails from "./components/forecast/ToolsServicesDetails";
import TrendsPage from "./components/forecast/TrendsPage";
import DataManagementPage from "./components/forecast/DataManagementPage";
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
  const [page, setPage] = useState("dashboard"); // dashboard | changelog | trends | data
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
      return;
    }

    setAuthBusy(true);
    try {
      await signInWithPopup(auth, googleProvider);
      setEntryMode("google");
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

  if (!entryMode) {
    return (
      <div className="min-h-screen bg-[radial-gradient(circle_at_18%_18%,_#f8fafc_0%,_#ede9fe_34%,_#dbeafe_70%,_#d1fae5_100%)] text-gray-900">
        <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col justify-center px-6 py-10">
          <div className="rounded-[2rem] border border-white/70 bg-white/35 p-8 shadow-2xl shadow-slate-200/70 backdrop-blur-xl sm:p-12">
            <div className="max-w-4xl">
              <div className="inline-flex items-center rounded-full border border-white/80 bg-white/90 px-5 py-2.5 text-sm font-bold uppercase tracking-[0.28em] text-gray-700 shadow-sm">
                Forecast Companion
              </div>
              <p className="mt-8 max-w-3xl text-lg leading-8 text-gray-700 sm:text-2xl">
                Choose a signed-in cloud session for saved collaboration, or continue in local
                mode to work directly in the browser with the current offline-friendly flow.
              </p>

              <div className="mt-10 flex flex-wrap gap-3">
                <button
                  type="button"
                  disabled={authBusy}
                  onClick={handleGoogleEntry}
                  className="rounded-2xl bg-gray-950 px-6 py-3 text-sm font-semibold text-white hover:bg-gray-800 disabled:opacity-60"
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
                  className="rounded-2xl border border-gray-300 bg-white/90 px-6 py-3 text-sm font-semibold text-gray-900 hover:bg-white"
                >
                  Continue in Local Mode
                </button>
              </div>

              {user ? (
                <div className="mt-4 text-sm font-medium text-gray-600">
                  Signed in as {user.displayName || user.email}
                </div>
              ) : (
                <div className="mt-4 text-sm text-gray-500">
                  Google sign-in enables saved cloud-backed access. Local mode keeps the current
                  lightweight workflow available without sign-in.
                </div>
              )}
            </div>

            <div className="mt-10 grid gap-4 lg:grid-cols-3">
              <div className="rounded-2xl border border-orange-100 bg-white/80 p-5 shadow-sm">
                <div className="text-xs font-semibold uppercase tracking-wide text-orange-700">
                  Signed-In Mode
                </div>
                <div className="mt-2 text-lg font-bold text-gray-900">Cloud-backed access</div>
                <div className="mt-2 text-sm text-gray-600">
                  Use Google sign-in when you want account-aware access and a more durable saved
                  experience.
                </div>
              </div>

              <div className="rounded-2xl border border-blue-100 bg-white/80 p-5 shadow-sm">
                <div className="text-xs font-semibold uppercase tracking-wide text-blue-700">
                  Local Mode
                </div>
                <div className="mt-2 text-lg font-bold text-gray-900">Fast local entry</div>
                <div className="mt-2 text-sm text-gray-600">
                  Keep working with the current local-first behavior when you need immediate
                  access without signing in.
                </div>
              </div>

              <div className="rounded-2xl border border-gray-200 bg-white/80 p-5 shadow-sm">
                <div className="text-xs font-semibold uppercase tracking-wide text-gray-600">
                  What You’ll Enter
                </div>
                <div className="mt-2 text-sm text-gray-700">
                  Internal staffing, Tools & Services, External vendors, trends, change logs, and
                  AI guidance remain exactly where they are after entry.
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
          <DataManagementPage onBack={() => setPage("dashboard")} />
        </div>
      </div>
    );
  }

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

          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage("data")}
              className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-100"
            >
              Data Management
            </button>

            <button
              onClick={() => setAiOpen(true)}
              className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-100"
            >
              AI Advisor
            </button>

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

            <button
              onClick={returnToEntry}
              className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-100"
            >
              Entry Options
            </button>

            <AssistantDrawer programId={selectedProgram} />
            <AuthBar onSignedOut={returnToEntry} />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="w-full px-3 py-5">
        {!showToolsServicesOnly ? (
          <SummaryCards
            selectedProgram={selectedProgram}
            onProgramChange={setSelectedProgram}
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
