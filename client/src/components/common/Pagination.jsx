export default function Pagination({ currentPage, totalPages, onPageChange }) {
  if (totalPages <= 1) return null;

  const pages = [];
  for (let i = 1; i <= totalPages; i += 1) pages.push(i);

  return (
    <div className="inline-flex items-center gap-1 rounded-full border bg-white px-2 py-1 text-xs">
      {pages.map((p) => (
        <button
          key={p}
          type="button"
          onClick={() => onPageChange(p)}
          className={`h-7 w-7 rounded-full text-center text-[11px] font-medium ${
            p === currentPage
              ? "bg-red-500 text-white"
              : "text-gray-700 hover:bg-gray-100"
          }`}
        >
          {p}
        </button>
      ))}
    </div>
  );
}

