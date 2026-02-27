export default function TopBar() {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Program Forecast Companion
        </h1>
        <p className="mt-1 text-sm text-gray-600">
          Forecast-only dashboard for internal visibility (not finance actuals).
        </p>
      </div>

      <div className="flex items-center gap-2">
        <span className="inline-flex items-center rounded-full bg-white px-3 py-1 text-xs font-medium text-gray-700 ring-1 ring-gray-200">
          POC
        </span>
      </div>
    </div>
  );
}