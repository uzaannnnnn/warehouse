import { Navbar } from "../molecules/Navbar";

export function MainLayout({ children }) {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <Navbar />
      <main className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-6">
        {children}
      </main>
    </div>
  );
}

