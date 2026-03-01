import { useEffect, useRef, useState } from "react";

const FN_URL =
  "https://us-central1-forecast-poc-488523.cloudfunctions.net/assistant";

export default function AssistantDrawer({ open, onClose, programId }) {
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState([]); // {role:'user'|'ai', text}
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);
  const quickPrompts = [
    "Give me a concise summary of this program's tracked spend.",
    "Summarize the delivery risks in this forecast.",
    "How does Maintenance vs New Feature mix look in this program?",
    "What changed recently in Tools & Services and why does it matter?",
    "What is the most important shift leadership should know right now?",
    "Which area needs attention first based on the current forecast?",
  ];

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  if (!open) return null;

  async function ask(qOverride) {
  const q = (qOverride ?? question).trim();
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

  function handleQuickAsk(q) {
    setQuestion(q); // optional (so user sees it)
    ask(q);         // directly sends
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
            <div className="mt-1 text-[11px] text-gray-500">
              MS = Maintenance • NF = New Feature
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
                Ask for summaries, risk signals, and decision-ready takeaways:

              <div className="mt-2 space-y-2 text-xs">
                {quickPrompts.map((q) => (
                    <button
                    key={q}
                    type="button"
                    onClick={() => handleQuickAsk(q)}
                    className="block w-full text-left rounded-lg bg-gray-100 hover:bg-gray-200 px-3 py-2 transition text-gray-700"
                    >
                    {q}
                    </button>
                ))}
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
                placeholder="Ask for a summary, risk callout, or change explanation…"
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
