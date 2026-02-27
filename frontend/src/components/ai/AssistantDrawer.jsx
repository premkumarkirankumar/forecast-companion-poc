import { useEffect, useRef, useState } from "react";

const FN_URL =
  "https://us-central1-forecast-poc-488523.cloudfunctions.net/assistant";

export default function AssistantDrawer({ open, onClose, programId }) {
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState([]); // {role:'user'|'ai', text}
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  if (!open) return null;

  async function ask() {
    const q = question.trim();
    if (!q || loading) return;

    setMessages((m) => [...m, { role: "user", text: q }]);
    setQuestion("");
    setLoading(true);

    try {
      const r = await fetch(FN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ programId, question: q }),
      });

      const j = await r.json();
      const text = j?.answerText || j?.error || "No response";

      setMessages((m) => [...m, { role: "ai", text }]);
    } catch (e) {
      setMessages((m) => [
        ...m,
        { role: "ai", text: "Request failed. Check console/network." },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function onKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      ask();
    }
  }

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/30"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer */}
      <div className="absolute right-0 top-0 h-full w-full max-w-md bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
          <div>
            <div className="text-sm font-extrabold text-gray-900">
              AI Advisor
            </div>
            <div className="text-xs text-gray-600">
              Program: <span className="font-semibold">{programId}</span>
            </div>
          </div>

          <button
            onClick={onClose}
            className="rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-sm font-semibold text-gray-900 hover:bg-gray-100"
          >
            Close
          </button>
        </div>

        <div className="flex h-[calc(100%-56px)] flex-col">
          {/* Messages */}
          <div className="flex-1 overflow-auto px-4 py-4">
            {messages.length === 0 ? (
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700">
                Ask questions like:
                <div className="mt-2 space-y-1 text-xs text-gray-600">
                  <div>• What are the totals for MS vs NF?</div>
                  <div>• Summarize external contractors for this program.</div>
                  <div>• What changed recently in Tools & Services?</div>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {messages.map((m, idx) => (
                  <div
                    key={idx}
                    className={
                      m.role === "user"
                        ? "ml-8 rounded-2xl bg-gray-900 p-3 text-sm text-white"
                        : "mr-8 rounded-2xl border border-gray-200 bg-white p-3 text-sm text-gray-900"
                    }
                    style={{ whiteSpace: "pre-wrap" }}
                  >
                    {m.text}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Input */}
          <div className="border-t border-gray-200 p-3">
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={onKeyDown}
                rows={2}
                placeholder="Ask something about the forecast data…"
                className="w-full resize-none rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-400"
              />

              <button
                onClick={ask}
                disabled={loading}
                className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800 disabled:opacity-60"
              >
                {loading ? "Asking..." : "Ask"}
              </button>
            </div>
            <div className="mt-1 text-xs text-gray-500">
              Tip: Press Enter to send, Shift+Enter for new line.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}