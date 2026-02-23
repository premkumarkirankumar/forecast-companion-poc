import TopBar from "../components/TopBar";
import { Selectors } from "../components/Selectors";
import SummaryCards from "../components/SummaryCards";
import ChartPlaceholder from "../components/ChartPlaceholder";

export default function Dashboard({
  selectedProgram,
  setSelectedProgram,
  selectedMonth,
  setSelectedMonth,
}) {
  return (
    <div>
      <TopBar />

      <Selectors
        selectedProgram={selectedProgram}
        setSelectedProgram={setSelectedProgram}
        selectedMonth={selectedMonth}
        setSelectedMonth={setSelectedMonth}
      />

      {/* IMPORTANT: pass selectedProgram so localStorage is per-program */}
      <SummaryCards selectedProgram={selectedProgram} />

      <ChartPlaceholder />
    </div>
  );
}