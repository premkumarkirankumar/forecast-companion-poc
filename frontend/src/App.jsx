import { useState } from "react";
import AppShell from "./layout/AppShell";
import Dashboard from "./pages/Dashboard";

export default function App() {
  const [selectedProgram, setSelectedProgram] = useState("program1");
  const [selectedMonth, setSelectedMonth] = useState("Jan");

  return (
    <AppShell>
      <Dashboard
        selectedProgram={selectedProgram}
        setSelectedProgram={setSelectedProgram}
        selectedMonth={selectedMonth}
        setSelectedMonth={setSelectedMonth}
      />
    </AppShell>
  );
}