export function Text({ children, className = "" }) {
  return (
    <p className={`text-sm text-slate-700 ${className}`}>
      {children}
    </p>
  )
}

