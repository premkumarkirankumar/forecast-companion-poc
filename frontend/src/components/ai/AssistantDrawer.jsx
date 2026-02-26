import {useEffect, useRef, useState} from "react";

export default function AssistantDrawer({programId}) {
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const abortRef = useRef(null);

  useEffect(() => {
    return () => {
      if (abortRef.current) abortRef.current.abort();
    };
  }, []);

  async function ask() {
    setError("");
    setAnswer("");
    setLoading(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const r = await fetch("/api/assistant", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({
          programId: programId ?? "connected",
          question,
          stream: false,
        }),
        signal: controller.signal,
      });

      const j = await r.json();

      if (!r.ok || !j.ok) {
        throw new Error(j?.details || j?.error || "AI failed");
      }

      setAnswer(j.answerText || "");
    } catch (e) {
      if (String(e?.name) === "AbortError") return;
      setError(String(e?.message || e));
    } finally {
      setLoading(false);
      abortRef.current = null;
    }
  }

  function onKeyDown(e) {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      if (!loading && question.trim()) ask();
    }
  }

  return (
    <>
      {/* Header Button */}
      <button
        onClick={() => setOpen(true)}
        className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-100"
      >
        Ask AI
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/20 backdrop-blur-sm">
          <div className="h-full w-[420px] bg-white shadow-2xl flex flex-col border-l border-gray-200">

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
              <div className="text-base font-bold text-gray-900">
                AI Assistant
              </div>
              <button
                onClick={() => setOpen(false)}
                className="text-sm font-semibold text-gray-600 hover:text-gray-900"
              >
                Close
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-auto px-5 py-4 space-y-4">
              <div className="text-xs text-gray-500">
                Program: <span className="font-semibold">{programId}</span>
              </div>

              <textarea
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Ask about forecasts, totals, trends, anomalies..."
                rows={4}
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10"
              />

              <div className="flex gap-2">
                <button
                  onClick={ask}
                  disabled={loading || !question.trim()}
                  className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800 disabled:opacity-50"
                >
                  {loading ? "Thinking..." : "Ask"}
                </button>

                <button
                  onClick={() => {
                    if (abortRef.current) abortRef.current.abort();
                    setLoading(false);
                  }}
                  disabled={!loading}
                  className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-100 disabled:opacity-50"
                >
                  Stop
                </button>
              </div>

              {error && (
                <div className="text-sm text-red-600">
                  {error}
                </div>
              )}

              {answer && (
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-800 whitespace-pre-wrap">
                  {answer}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}