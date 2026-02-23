export default function SectionHeader({ title, subtitle, accent, isOpen, onToggle }) {
  const accentMap = {
    blue: "border-blue-200 bg-blue-50 text-blue-900",
    purple: "border-purple-200 bg-purple-50 text-purple-900",
    green: "border-green-200 bg-green-50 text-green-900",
    gray: "border-gray-200 bg-gray-50 text-gray-900",
  };

  return (
    <button
      onClick={onToggle}
      className={[
        "w-full rounded-2xl border p-4 text-left transition",
        "hover:shadow-sm",
        accentMap[accent] ?? accentMap.gray,
      ].join(" ")}
    >
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="text-sm font-semibold">{title}</div>
          {subtitle ? <div className="mt-1 text-xs opacity-80">{subtitle}</div> : null}
        </div>

        <div className="flex items-center gap-2">
          <span className="rounded-full bg-white/70 px-2 py-1 text-[11px] font-medium">
            {isOpen ? "Hide" : "Show"}
          </span>
          <span className="text-lg">{isOpen ? "▾" : "▸"}</span>
        </div>
      </div>
    </button>
  );
}