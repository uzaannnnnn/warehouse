const MAX_VISIBLE = 5;

export default function Pagination({ currentPage, totalPages, onPageChange }) {
  if (totalPages <= 1) return null;

  const goToPage = (page) => {
    if (page >= 1 && page <= totalPages && page !== currentPage) {
      onPageChange(page);
    }
  };

  const buildVisiblePages = () => {
    if (totalPages <= MAX_VISIBLE) {
      return Array.from({ length: totalPages }, (_, idx) => idx + 1);
    }

    let start = Math.max(1, currentPage - Math.floor(MAX_VISIBLE / 2));
    let end = start + MAX_VISIBLE - 1;

    if (end > totalPages) {
      end = totalPages;
      start = end - MAX_VISIBLE + 1;
    }

    const pages = [];
    for (let i = start; i <= end; i += 1) {
      pages.push(i);
    }
    return pages;
  };

  const visiblePages = buildVisiblePages();
  const showStartEllipsis = visiblePages[0] > 2;
  const showEndEllipsis = visiblePages[visiblePages.length - 1] < totalPages - 1;

  return (
    <div className="inline-flex items-center gap-1 rounded-full border bg-white px-2 py-1 text-xs">
      <button
        type="button"
        onClick={() => goToPage(currentPage - 1)}
        disabled={currentPage === 1}
        className="h-7 rounded-full px-2 text-[11px] text-gray-600 disabled:opacity-40"
      >
        ‹
      </button>

      <button
        type="button"
        onClick={() => goToPage(1)}
        className={`h-7 w-7 rounded-full text-center text-[11px] font-medium ${
          currentPage === 1 ? "bg-red-500 text-white" : "text-gray-700 hover:bg-gray-100"
        }`}
      >
        1
      </button>

      {showStartEllipsis && (
        <span className="px-1 text-gray-500">…</span>
      )}

      {visiblePages.map((page) => {
        if (page === 1 || page === totalPages) return null;
        return (
          <button
            key={page}
            type="button"
            onClick={() => goToPage(page)}
            className={`h-7 w-7 rounded-full text-center text-[11px] font-medium ${
              page === currentPage
                ? "bg-red-500 text-white"
                : "text-gray-700 hover:bg-gray-100"
            }`}
          >
            {page}
          </button>
        );
      })}

      {showEndEllipsis && <span className="px-1 text-gray-500">…</span>}

      {totalPages > 1 && (
        <button
          type="button"
          onClick={() => goToPage(totalPages)}
          className={`h-7 w-7 rounded-full text-center text-[11px] font-medium ${
            currentPage === totalPages
              ? "bg-red-500 text-white"
              : "text-gray-700 hover:bg-gray-100"
          }`}
        >
          {totalPages}
        </button>
      )}

      <button
        type="button"
        onClick={() => goToPage(currentPage + 1)}
        disabled={currentPage === totalPages}
        className="h-7 rounded-full px-2 text-[11px] text-gray-600 disabled:opacity-40"
      >
        ›
      </button>
    </div>
  );
}

