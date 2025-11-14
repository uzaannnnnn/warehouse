export default function TooltipWrapper({ children, label, position = "top" }) {
  const posClass =
    position === "top"
      ? "bottom-full left-1/2 mb-1 -translate-x-1/2"
      : "top-full left-1/2 mt-1 -translate-x-1/2";

  return (
    <div className="group relative inline-block">
      {children}
      <div
        className={`pointer-events-none absolute hidden rounded bg-gray-800 px-2 py-1 text-[10px] text-white group-hover:block ${posClass}`}
      >
        {label}
      </div>
    </div>
  );
}

