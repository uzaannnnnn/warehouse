export function WarehousePageShell({
  title,
  icon: Icon,
  headerRight,
  headerBelow,
  children,
}) {
  return (
    <div className="p-6 bg-gray-50 min-h-[90vh] rounded-2xl animate-fadeIn">
      <div className="mb-6">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <h1 className="text-3xl font-extrabold text-gray-800 tracking-tight flex items-center gap-2 mb-3 md:mb-4">
            {Icon ? <Icon className="text-red-500" /> : null}
            {title}
          </h1>
          {headerRight}
        </div>
        {headerBelow ? <div className="mt-1 md:mt-0">{headerBelow}</div> : null}
      </div>
      {children}
    </div>
  );
}
