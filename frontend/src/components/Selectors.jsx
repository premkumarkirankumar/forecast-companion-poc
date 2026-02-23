import { PROGRAMS } from "../data/hub";

export function Selectors({ selectedProgram, setSelectedProgram }) {
  return (
    <div className="mt-6 rounded-2xl bg-white p-4 ring-1 ring-gray-200">
      <label className="block text-xs font-medium text-gray-600">Program</label>
      <select
        className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gray-200"
        value={selectedProgram}
        onChange={(e) => setSelectedProgram(e.target.value)}
      >
        {PROGRAMS.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
    </div>
  );
}