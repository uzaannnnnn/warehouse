import { Fragment, useEffect, useState } from "react";
import {
  FiChevronDown,
  FiChevronUp,
  FiSearch,
  FiX,
  FiRefreshCcw,
  FiFileText,
} from "react-icons/fi";
import { motion as Motion, AnimatePresence } from "framer-motion";
import Pagination from "../../../components/common/Pagination";
import { fetchInvoices } from "../api/invoices";
import EmptyState from "../../../components/common/EmptyState";
import { WarehousePageShell } from "../../../components/templates/WarehousePageShell";

export default function InvoiceHistoryPage({ segment = "finished" }) {
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const limit = 10;
  const [expandedId, setExpandedId] = useState(null);
  const [filterType, setFilterType] = useState("all");
  const [reloadKey, setReloadKey] = useState(0);
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
          segment,
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
  }, [page, limit, debouncedSearch, reloadKey]);

  const pageRows =
    filterType === "all"
      ? invoices
      : invoices.filter((row) => row.type === filterType);
  const isSearching = Boolean(debouncedSearch);
  const startIndex = totalItems ? (page - 1) * limit + 1 : 0;

  return (
    <WarehousePageShell
      title="History Invoice"
      icon={FiFileText}
      headerRight={(
        <div className="flex items-center gap-3">
          <button
            onClick={() => setReloadKey((key) => key + 1)}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md border bg-white hover:bg-gray-50 text-sm disabled:opacity-60 cursor-pointer"
            title="Muat ulang data"
          >
            <FiRefreshCcw className={loading ? "animate-spin" : ""} /> Refresh
          </button>
        </div>
      )}
    >
      {/* Filter bar ala Resi */}
      <div className="flex flex-wrap justify-between items-center text-sm mb-4 gap-3">
        <div className="flex gap-2 flex-wrap">
          <select
            className="border rounded-lg px-3 py-2"
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
          >
            <option value="all">Semua Tipe</option>
            <option value="in">Stok Masuk</option>
            <option value="out">Stok Keluar</option>
          </select>
        </div>

        <div className="relative">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Cari invoice (nomor, tanggal)..."
            className="w-72 pl-9 pr-10 py-2 border text-sm border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-red-400 focus:border-transparent"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
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
      ) : totalItems === 0 ? (
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
      ) : pageRows.length === 0 ? (
        <EmptyState
          title="Invoice tidak ditemukan"
          description="Coba ubah kata kunci atau reset filter untuk melihat semua data."
          illustration="search"
          buttonText="Reset Filter"
          onButtonClick={() => {
            setSearchTerm("");
            setFilterType("all");
          }}
        />
      ) : (
        <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
          <table className="min-w-full border-collapse text-sm text-gray-700">
            <thead className="bg-gray-100 text-xs uppercase text-gray-600">
              <tr>
                <th className="p-3 text-center w-10" />
                <th className="p-3 text-left">Nomor Invoice</th>
                <th className="p-3 text-left">Tipe</th>
                <th className="p-3 text-left">Produksi</th>
                <th className="p-3 text-left">Tanggal</th>
                <th className="p-3 text-left">Total Qty</th>
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
                        onClick={() =>
                          setExpandedId((prev) => (prev === row._id ? null : row._id))
                        }
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.25 }}
                        className={`border-b cursor-pointer transition ${
                          isExpanded
                            ? "bg-red-50/60 shadow-[inset_0_2px_6px_rgba(0,0,0,0.05)]"
                            : "bg-white hover:bg-gray-50"
                        }`}
                      >
                        <td className="p-3 text-center align-middle">
                          <Motion.div
                            animate={{ rotate: isExpanded ? 180 : 0 }}
                            transition={{ duration: 0.25 }}
                            className="inline-flex items-center justify-center w-7 h-7"
                          >
                            {isExpanded ? (
                              <FiChevronUp className="w-4 h-4 text-gray-500" />
                            ) : (
                              <FiChevronDown className="w-4 h-4 text-gray-500" />
                            )}
                          </Motion.div>
                        </td>
                        <td className="p-3 font-semibold text-gray-800">
                          {row.invoiceNumber}
                        </td>
                        <td className="p-3">
                          <span
                            className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${badgeColor}`}
                          >
                            {typeLabel}
                          </span>
                        </td>
                        <td className="p-3 text-xs">
                          {row.segment === "raw" && row.type === "out" ? (
                            row.productionClaimed ? (
                              <span className="inline-flex rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-600">
                                Sudah diklaim
                              </span>
                            ) : (
                              <span className="inline-flex rounded-full bg-gray-100 px-2 py-1 text-[11px] font-medium text-gray-600">
                                Belum diklaim
                              </span>
                            )
                          ) : (
                            <span className="text-[11px] text-gray-400">-</span>
                          )}
                        </td>
                        <td className="p-3 text-gray-600">{invoiceDate}</td>
                        <td className="p-3 text-left font-semibold">{totalQty}</td>
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
    </WarehousePageShell>
  );
}








