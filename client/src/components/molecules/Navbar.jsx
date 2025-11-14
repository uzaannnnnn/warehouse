export function Navbar() {
  return (
    <header className="flex items-center justify-between border-b border-slate-200 bg-white/80 px-6 py-3 backdrop-blur">
      <div className="text-lg font-semibold tracking-tight text-slate-900">
        Warehouse
      </div>
      <nav className="flex items-center gap-4 text-sm text-slate-600">
        <button className="hover:text-slate-900">Dashboard</button>
        <button className="hover:text-slate-900">Inventory</button>
        <button className="hover:text-slate-900">Settings</button>
      </nav>
    </header>
  )
}

