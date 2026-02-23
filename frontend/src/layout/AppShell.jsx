export default function AppShell({ children }) {
  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <div className="mx-auto max-w-6xl px-4 py-6">{children}</div>
    </div>
  );
}