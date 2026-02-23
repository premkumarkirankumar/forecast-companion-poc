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

      <SummaryCards selectedProgram={selectedProgram} />

      {/* Trend chart reads saved contractors per program */}
      <ChartPlaceholder selectedProgram={selectedProgram} />
    </div>
  );
}