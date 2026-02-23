export default function ChartPlaceholder() {
  return (
    <div className="mt-6 rounded-2xl bg-white p-4 ring-1 ring-gray-200">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold">Trend (placeholder)</div>
          <div className="mt-1 text-xs text-gray-600">
            We’ll add a chart once forecast data wiring is in.
          </div>
        </div>
      </div>

      <div className="mt-4 flex h-52 items-center justify-center rounded-xl border border-dashed border-gray-200 bg-gray-50 text-sm text-gray-500">
        Chart will go here
      </div>
    </div>
  );
}