import { Fragment, useEffect, useState } from "react";
import {
  FiBox,
  FiChevronDown,
  FiChevronUp,
  FiSearch,
  FiX,
} from "react-icons/fi";
import { motion as Motion, AnimatePresence } from "framer-motion";
import Pagination from "../../../components/common/Pagination";
import { fetchInvoices } from "../api/invoices";

export default function InvoiceHistoryPage() {
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const limit = 10;
  const [expandedId, setExpandedId] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchTerm.trim());
    }, 400);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  useEffect(() => {
    let active = true;
    async function loadInvoices() {
      setLoading(true);
      try {
        const data = await fetchInvoices({
          page,
          limit,
          search: debouncedSearch || undefined,
        });
        if (!active) return;
        setInvoices(Array.isArray(data?.items) ? data.items : []);
        setTotalItems(Number(data?.total || 0));
        setTotalPages(Number(data?.pages || 1));
      } catch (err) {
        if (!active) return;
        console.error("Gagal memuat invoice:", err.message);
      } finally {
        if (active) setLoading(false);
      }
    }
    loadInvoices();
    return () => {
      active = false;
    };
  }, [page, limit, debouncedSearch]);

  const pageRows = invoices;
  const isSearching = Boolean(debouncedSearch);
  const startIndex = totalItems ? (page - 1) * limit + 1 : 0;

  return (
    <div className="p-6 bg-gray-50 min-h-[90vh] rounded-2xl animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
        <h1 className="text-3xl font-extrabold text-gray-800 tracking-tight flex items-center gap-2 mb-7">
          <FiBox className="text-red-500" /> History Invoice
        </h1>

        <div className="relative flex-grow max-w-md">
          <input
            type="text"
            placeholder="Cari invoice..."
            className="w-full pl-10 pr-4 py-2 border rounded-lg"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              title="Bersihkan pencarian"
            >
              <FiX />
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="text-center text-gray-500 py-20 animate-pulse">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="w-14 h-14 mx-auto mb-4 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M16.5 12a4.5 4.5 0 01-9 0m9 0a4.5 4.5 0 01-9 0m9 0V6.75m0 5.25H21m-4.5 0H3"
            />
          </svg>
          <p className="text-sm font-medium">Memuat data invoice...</p>
        </div>
      ) : pageRows.length === 0 ? (
        <EmptyState
          title={isSearching ? "Invoice tidak ditemukan" : "Belum ada invoice"}
          description={
            isSearching
              ? "Coba periksa kembali kata kunci pencarianmu atau reset filter."
              : "Semua transaksi akan muncul di sini setelah Anda mencatat stok masuk atau keluar."
          }
          illustration={isSearching ? "search" : "box"}
          buttonText={isSearching ? "Reset Pencarian" : undefined}
          onButtonClick={isSearching ? () => setSearchTerm("") : undefined}
        />
      ) : (
        <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
          <table className="min-w-full border-collapse text-sm text-gray-700">
            <thead className="bg-gray-100 text-xs uppercase text-gray-600">
              <tr>
                <th className="w-12 p-3 text-center">No.</th>
                <th className="p-3 text-left">Nomor Invoice</th>
                <th className="p-3 text-left">Tipe</th>
                <th className="p-3 text-left">Tanggal</th>
                <th className="p-3 text-right">Total Qty</th>
                <th className="w-16 p-3 text-center" />
              </tr>
            </thead>
            <tbody>
              <AnimatePresence initial={false}>
                {pageRows.map((row, index) => {
                  const isExpanded = expandedId === row._id;
                  const isStockIn = row.type === "in";
                  const typeLabel = isStockIn ? "Masuk" : "Keluar";
                  const badgeColor = isStockIn
                    ? "bg-emerald-100 text-emerald-600"
                    : "bg-red-100 text-red-600";
                  const invoiceDate = row.date
                    ? new Date(row.date).toLocaleDateString("id-ID")
                    : "-";
                  const totalQty =
                    row.totalQuantity ??
                    row.items?.reduce((sum, item) => sum + (item.quantity || 0), 0) ??
                    0;
                  return (
                    <Fragment key={row._id}>
                      <Motion.tr
                        layout
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.25 }}
                        className="border-b bg-white"
                      >
                        <td className="p-3 text-center text-xs font-medium text-gray-600">
                          {startIndex + index}
                        </td>
                        <td className="p-3 font-semibold">{row.invoiceNumber}</td>
                        <td className="p-3">
                          <span
                            className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${badgeColor}`}
                          >
                            {typeLabel}
                          </span>
                        </td>
                        <td className="p-3 text-gray-600">{invoiceDate}</td>
                        <td className="p-3 text-right font-semibold">
                          {totalQty}
                        </td>
                        <td className="p-3 text-center">
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedId((prev) => (prev === row._id ? null : row._id))
                            }
                            className="inline-flex items-center justify-center rounded-lg border px-3 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100"
                            title={isExpanded ? "Tutup detail" : "Lihat detail"}
                          >
                            {isExpanded ? <FiChevronUp /> : <FiChevronDown />}
                          </button>
                        </td>
                      </Motion.tr>
                      <AnimatePresence>
                        {isExpanded && (
                          <Motion.tr
                            layout
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.3 }}
                          >
                            <td colSpan={6} className="bg-gray-50 p-4">
                              <Motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                transition={{ duration: 0.25 }}
                                className="rounded-lg border bg-white p-4"
                              >
                                <div className="mb-3 text-sm text-gray-500">Detail Produk</div>
                                <table className="min-w-full text-xs text-gray-600">
                                  <thead>
                                    <tr className="bg-gray-100 text-[11px] uppercase text-gray-500">
                                      <th className="px-3 py-2 text-left">Kode Produk</th>
                                      <th className="px-3 py-2 text-left">Nama Produk</th>
                                      <th className="px-3 py-2 text-right">Qty</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {row.items?.map((d) => (
                                      <tr
                                        key={`${row._id}-${d.productCode}`}
                                        className="border-t last:border-b bg-white hover:bg-gray-50"
                                      >
                                        <td className="px-3 py-1 font-mono">
                                          {d.productCode}
                                        </td>
                                        <td className="px-3 py-1">
                                          {d.productName}
                                        </td>
                                        <td className="px-3 py-1 text-right">
                                          {d.quantity}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </Motion.div>
                            </td>
                          </Motion.tr>
                        )}
                      </AnimatePresence>
                    </Fragment>
                  );
                })}
              </AnimatePresence>
            </tbody>
          </table>
        </div>
      )}
      {!loading && totalPages > 1 && (
        <div className="mt-6 flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="text-sm text-gray-600">
            Menampilkan{" "}
            {startIndex} -{" "}
            {Math.min(page * limit, totalItems)} dari {totalItems} invoice
          </div>
          <div className="flex items-center gap-3">
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              onPageChange={setPage}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function EmptyState({
  title,
  description,
  buttonText,
  onButtonClick,
  illustration,
}) {
  const Illustrations = {
    box: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="w-28 h-28 text-red-400 mb-4"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M20.25 7.5l-8.25-4.5-8.25 4.5M3 7.5v9l9 4.5 9-4.5v-9"
        />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 12l9-4.5M12 12L3 7.5"
        />
      </svg>
    ),
    search: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="w-28 h-28 text-gray-400 mb-4"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth="1.5"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M21 21l-4.35-4.35M10.5 18a7.5 7.5 0 100-15 7.5 7.5 0 000 15z"
        />
      </svg>
    ),
  };

  return (
    <div className="flex flex-col items-center justify-center py-20 text-center animate-fadeIn">
      {Illustrations[illustration]}
      <h2 className="text-xl font-semibold text-gray-700 mb-1">{title}</h2>
      <p className="text-sm text-gray-500 mb-5">{description}</p>
      {buttonText && onButtonClick && (
        <button
          onClick={onButtonClick}
          className="px-5 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm shadow-md transition-all"
        >
          {buttonText}
        </button>
      )}
    </div>
  );
}









