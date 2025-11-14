import { Fragment, useEffect, useMemo, useState } from "react";
import {
  FiBox,
  FiChevronDown,
  FiChevronUp,
  FiSearch,
  FiX,
} from "react-icons/fi";
import { motion, AnimatePresence } from "framer-motion";
import Pagination from "../../../components/common/Pagination";

const SAMPLE_INVOICES = [
  {
    id: 1,
    invoice: "INV-IN-001",
    type: "Masuk",
    date: "2025-01-10",
    totalQty: 45,
    details: [
      { kode: "KVB-CH", nama: "MANGKOK GANDA KVB", qty: 20 },
      { kode: "K16-CH", nama: "MANGKOK GANDA K16", qty: 15 },
      { kode: "KVY-CH", nama: "MANGKOK GANDA KVY", qty: 10 },
    ],
  },
  {
    id: 2,
    invoice: "INV-OUT-002",
    type: "Keluar",
    date: "2025-01-11",
    totalQty: 12,
    details: [
      { kode: "B74-CH", nama: "MANGKOK GANDA B74", qty: 4 },
      { kode: "2PH-CH", nama: "MANGKOK GANDA 2PH", qty: 8 },
    ],
  },
  {
    id: 3,
    invoice: "INV-IN-003",
    type: "Masuk",
    date: "2025-01-12",
    totalQty: 72,
    details: [
      { kode: "KVB-CH", nama: "MANGKOK GANDA KVB", qty: 30 },
      { kode: "KVY-CH", nama: "MANGKOK GANDA KVY", qty: 18 },
      { kode: "B74-CH", nama: "MANGKOK GANDA B74", qty: 24 },
    ],
  },
];

export default function InvoiceHistoryPage() {
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 400);
    return () => clearTimeout(t);
  }, []);

  const filtered = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return SAMPLE_INVOICES;
    return SAMPLE_INVOICES.filter((row) => {
      return (
        row.invoice.toLowerCase().includes(q) ||
        row.type.toLowerCase().includes(q) ||
        row.date.toLowerCase().includes(q)
      );
    });
  }, [searchTerm]);

  const totalItems = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / limit));
  const startIndex = (page - 1) * limit;
  const pageRows = filtered.slice(startIndex, startIndex + limit);

  useEffect(() => {
    const t = setTimeout(() => setPage(1), 300);
    return () => clearTimeout(t);
  }, [searchTerm]);

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
      ) : totalItems === 0 && !searchTerm ? (
        <EmptyState
          title="Belum ada invoice"
          description="Belum ada riwayat stok masuk maupun keluar."
          buttonText=""
          onButtonClick={null}
          illustration="box"
        />
      ) : totalItems === 0 && searchTerm ? (
        <EmptyState
          title="Invoice tidak ditemukan"
          description="Coba periksa kembali kata kunci pencarianmu atau reset filter."
          buttonText="Reset Pencarian"
          onButtonClick={() => setSearchTerm("")}
          illustration="search"
        />
      ) : (
        <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
          <table className="min-w-full border-collapse text-sm text-gray-700">
            <thead className="bg-gray-100 text-xs uppercase text-gray-600">
              <tr>
                <th className="w-10 p-3 text-center" />
                <th className="w-12 p-3 text-center">No</th>
                <th className="p-3 text-left">No. Invoice</th>
                <th className="p-3 text-left">Tanggal</th>
                <th className="p-3 text-left">Tipe</th>
                <th className="p-3 text-right">Total Item</th>
                <th className="p-3 text-right">Total Qty</th>
              </tr>
            </thead>
            <tbody>
              <AnimatePresence initial={false}>
                {pageRows.map((row, index) => {
                  const isExpanded = expandedId === row.id;
                  return (
                    <Fragment key={row.id}>
                      <motion.tr
                        layout
                        onClick={() =>
                          setExpandedId((prev) =>
                            prev === row.id ? null : row.id,
                          )
                        }
                        className={`border-t cursor-pointer transition ${
                          isExpanded
                            ? "bg-red-50/60 shadow-[inset_0_2px_6px_rgba(0,0,0,0.05)]"
                            : "hover:bg-gray-50"
                        }`}
                        whileHover={{ scale: 1.002 }}
                      >
                        <td className="text-center">
                          <motion.div
                            animate={{ rotate: isExpanded ? 180 : 0 }}
                            transition={{ duration: 0.25 }}
                            className="inline-flex items-center justify-center w-7 h-7"
                          >
                            {isExpanded ? (
                              <FiChevronUp className="w-4 h-4 text-gray-500" />
                            ) : (
                              <FiChevronDown className="w-4 h-4 text-gray-500" />
                            )}
                          </motion.div>
                        </td>
                        <td className="p-3 text-center text-xs font-medium text-gray-600">
                          {startIndex + index + 1}
                        </td>
                        <td className="p-3 font-mono text-sm text-gray-800">
                          {row.invoice}
                        </td>
                        <td className="p-3 text-gray-800">
                          {row.date}
                        </td>
                        <td className="p-3">
                          <span
                            className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${
                              row.type === "Masuk"
                                ? "bg-emerald-50 text-emerald-700"
                                : "bg-amber-50 text-amber-700"
                            }`}
                          >
                            {row.type}
                          </span>
                        </td>
                        <td className="p-3 text-right text-gray-800">
                          {row.details?.length || 0}
                        </td>
                        <td className="p-3 text-right text-gray-800">
                          {row.totalQty}
                        </td>
                      </motion.tr>

                      <AnimatePresence>
                        {isExpanded && (
                          <motion.tr
                            key={`expanded-${row.id}`}
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.25 }}
                          >
                            <td
                              colSpan={7}
                              className="bg-white px-6 pb-5 pt-1 text-xs text-gray-700"
                            >
                              <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                transition={{ duration: 0.25 }}
                                className="mt-2 overflow-x-auto rounded-lg border bg-gray-50"
                              >
                                <table className="min-w-full border-collapse text-xs">
                                  <thead className="bg-gray-100 text-[11px] uppercase text-gray-500">
                                    <tr>
                                      <th className="px-3 py-2 text-left">
                                        Kode Produk
                                      </th>
                                      <th className="px-3 py-2 text-left">
                                        Nama Produk
                                      </th>
                                      <th className="px-3 py-2 text-right">
                                        Qty
                                      </th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {row.details?.map((d) => (
                                      <tr
                                        key={d.kode}
                                        className="border-t last:border-b bg-white hover:bg-gray-50"
                                      >
                                        <td className="px-3 py-1 font-mono">
                                          {d.kode}
                                        </td>
                                        <td className="px-3 py-1">
                                          {d.nama}
                                        </td>
                                        <td className="px-3 py-1 text-right">
                                          {d.qty}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </motion.div>
                            </td>
                          </motion.tr>
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
            {totalItems ? startIndex + 1 : 0} -{" "}
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
