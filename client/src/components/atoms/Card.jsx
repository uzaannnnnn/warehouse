export default function Card({ children, className = "" }) {
  return (
    <div
      className={`w-full rounded-xl border border-slate-200 bg-white p-6 shadow-sm ${className}`}
    >
      {children}
    </div>
  );
}

