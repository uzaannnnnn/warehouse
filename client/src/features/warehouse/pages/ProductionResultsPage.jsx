import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FiBox,
  FiSearch,
  FiX,
  FiChevronDown,
  FiChevronUp,
  FiArrowRight,
  FiCheckCircle,
  FiAlertTriangle,
  FiArrowUpCircle,
} from "react-icons/fi";
import { motion as Motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

import Pagination from "../../../components/common/Pagination";
import EmptyState from "../../../components/common/EmptyState";
import { WarehousePageShell } from "../../../components/templates/WarehousePageShell";

import { fetchProductions } from "../api/production";
import { createInvoiceRecord } from "../api/invoices";
import { playSuccessSound } from "../../../utils/sound";
import { PRODUCTION_LOCATIONS } from "../../../constants/warehouseLocations";
import { WAREHOUSE_STORAGE_KEYS } from "../../../constants/warehouseStorageKeys";
import { getRawLocationForProductionLocation } from "../../../utils/warehouseLocationMap";

const FETCH_LIMIT = 200; // ambil max 200 per lokasi+search, lalu paginasi di frontend
const SEARCH_DEBOUNCE_MS = 300;
const LOCATION_KEY = WAREHOUSE_STORAGE_KEYS.productionLocation;

export default function ProductionResultsPage() {
  const locationOptions = PRODUCTION_LOCATIONS;

  const [warehouseCode, setWarehouseCode] = useState(() => {
    if (typeof window === "undefined") return locationOptions[0];
    const saved = window.localStorage.getItem(LOCATION_KEY);
    if (saved && locationOptions.includes(saved)) return saved;
    return locationOptions[0];
  });

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const handleExternalUpdate = (value) => {
      if (typeof value !== "string") return;
      if (!locationOptions.includes(value)) return;
      setWarehouseCode((prev) => (prev === value ? prev : value));
    };
    const customListener = (event) => handleExternalUpdate(event?.detail);
    const storageListener = (event) => {
      if (event.key === LOCATION_KEY) {
        handleExternalUpdate(event.newValue);
      }
    };
    window.addEventListener(
      "warehouse:production-location-change",
      customListener,
    );
    window.addEventListener("storage", storageListener);
    return () => {
      window.removeEventListener(
        "warehouse:production-location-change",
        customListener,
      );
      window.removeEventListener("storage", storageListener);
    };
  }, [locationOptions]);

  const [loading, setLoading] = useState(true);
  const [allProductions, setAllProductions] = useState([]); // dari backend
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const limit = 10;
  const [reloadKey, setReloadKey] = useState(0);

  const [isStockOutOpen, setIsStockOutOpen] = useState(false);

  const productionLocation = warehouseCode;
  const rawLocation = getRawLocationForProductionLocation(productionLocation);

  // debounce search
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(searchTerm.trim());
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [searchTerm]);

  // reset page kalau lokasi / search berubah
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, warehouseCode]);

  // load data produksi (completed) based on lokasi + search
  useEffect(() => {
    let active = true;

    async function loadProductions() {
      setLoading(true);
      try {
        const data = await fetchProductions({
          page: 1,
          limit: FETCH_LIMIT,
          search: debouncedSearch || undefined,
          location: rawLocation,
          status: "completed",
        });

        if (!active) return;
        const items = Array.isArray(data?.items) ? data.items : [];
        setAllProductions(items);
      } catch (err) {
        if (!active) return;
        console.error("Gagal memuat hasil produksi:", err.message);
        toast.error("Gagal memuat hasil produksi");
      } finally {
        if (active) setLoading(false);
      }
    }

    loadProductions();
    return () => {
      active = false;
    };
  }, [rawLocation, debouncedSearch, reloadKey]);

  // hanya status completed
  const completedRows = useMemo(
    () => allProductions.filter((row) => (row.status || "produced") === "completed"),
    [allProductions],
  );

  const productionSummary = useMemo(() => {
    let totalOk = 0;
    let totalReject = 0;
    let totalRawOut = 0;
    completedRows.forEach((row) => {
      const items = Array.isArray(row.items) ? row.items : [];
      const qcItems = Array.isArray(row.qcItems) ? row.qcItems : [];
      items
        .filter((item) => item.direction === "out")
        .forEach((item) => {
          totalRawOut += Number(item.quantity || 0) || 0;
        });
      if (qcItems.length) {
        qcItems.forEach((qc) => {
          totalOk += Number(qc.okQuantity || 0) || 0;
          totalReject += Number(qc.rejectQuantity || 0) || 0;
        });
      } else {
        items
          .filter((item) => item.direction === "in")
          .forEach((item) => {
            totalOk += Number(item.quantity || 0) || 0;
          });
      }
    });
    return {
      totalBatches: completedRows.length,
      totalOk,
      totalReject,
      totalRawOut,
    };
  }, [completedRows]);

  const stockSummary = useMemo(() => {
    const map = new Map();
    completedRows.forEach((row) => {
      const items = Array.isArray(row.items) ? row.items : [];
      const finishedItems = items.filter((it) => it.direction === "in");
      const finishedNameMap = new Map();
      finishedItems.forEach((it) => {
        const code = String(it.productCode || "").trim().toUpperCase();
        if (!code) return;
        finishedNameMap.set(code, it.productName || "");
      });
      const qcItems = Array.isArray(row.qcItems) ? row.qcItems : [];
      if (qcItems.length) {
        qcItems.forEach((qc) => {
          const code = String(qc.productCode || "").trim().toUpperCase();
          if (!code) return;
          const entry = map.get(code) || {
            kode: code,
            name: finishedNameMap.get(code) || "",
            okQty: 0,
            rejectQty: 0,
          };
          entry.okQty += Number(qc.okQuantity || 0) || 0;
          entry.rejectQty += Number(qc.rejectQuantity || 0) || 0;
          map.set(code, entry);
        });
      } else {
        finishedItems.forEach((it) => {
          const code = String(it.productCode || "").trim().toUpperCase();
          if (!code) return;
          const entry = map.get(code) || {
            kode: code,
            name: it.productName || "",
            okQty: 0,
            rejectQty: 0,
          };
          entry.okQty += Number(it.quantity || 0) || 0;
          map.set(code, entry);
        });
      }
    });
    return Array.from(map.values()).filter(
      (entry) => entry.okQty > 0 || entry.rejectQty > 0,
    );
  }, [completedRows]);

  const totalItems = completedRows.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / limit));
  const startIndex = totalItems ? (page - 1) * limit + 1 : 0;

  const pageRows = useMemo(
    () => completedRows.slice((page - 1) * limit, page * limit),
    [completedRows, page, limit],
  );

  const productSearchFetcher = useCallback(
    (params = {}) =>
      fetchProductsPaged({
        ...params,
        location: productionLocation,
      }),
    [productionLocation],
  );

  const handleApplyStockOut = async ({ invoice, items }) => {
    if (!items.length) {
      toast.info("Tidak ada item stok yang dikurangi");
      return false;
    }

    try {
      const trimmedInvoice = invoice?.trim();
      const created = await createInvoiceRecord({
        invoiceNumber: trimmedInvoice || undefined,
        type: "out",
        location: productionLocation,
        segment: "finished",
        items: items.map((item) => ({
          productCode: item.kode,
          quantity: item.qty,
          quality: item.quality || "ok",
        })),
      });
      const createdInvoiceNumber =
        created?.invoiceNumber || trimmedInvoice || "";
      const suffix = createdInvoiceNumber
        ? ` (Invoice ${createdInvoiceNumber})`
        : " (Invoice otomatis)";
      toast.success(`Stok keluar berhasil disimpan${suffix}`);
      playSuccessSound();
      // tidak mengubah data produksi, jadi tidak wajib reload; tapi boleh refresh
      setReloadKey((k) => k + 1);
      return true;
    } catch (err) {
      console.error("Gagal menyimpan stok keluar:", err.message);
      toast.error(err?.message || "Gagal menyimpan stok keluar");
      return false;
    }
  };

  const hasAnyCompleted = totalItems > 0;
  const isSearching = Boolean(debouncedSearch);

  return (
    <WarehousePageShell
      title="Hasil Produksi"
      icon={FiBox}
      headerBelow={
        <div className="flex flex-wrap items-center gap-2 text-xs text-gray-700">
          <span className="font-medium">Lokasi Produksi:</span>
          <select
            value={warehouseCode}
            disabled
            className="rounded-lg border px-3 py-1 text-xs bg-gray-100 text-gray-500 cursor-not-allowed"
          >
            {locationOptions.map((loc) => (
              <option key={loc} value={loc}>
                {loc}
              </option>
            ))}
          </select>
          <span className="text-[11px] text-gray-400">
            Lokasi mengikuti pengaturan di halaman Produksi.
          </span>
        </div>
      }
      headerRight={
        <div className="flex w-full flex-col gap-2 md:w-auto md:flex-row md:items-center">
          <div className="relative flex-grow max-w-md">
            <input
              type="text"
              placeholder="Cari nomor produksi / kode produk..."
              className="w-full pl-9 pr-3 py-1.5 border rounded-lg text-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <FiSearch className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                title="Bersihkan pencarian"
              >
                <FiX className="text-sm" />
              </button>
            )}
          </div>

          <div className="flex gap-2 md:ml-3">
            <button
              type="button"
              onClick={() => setIsStockOutOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 text-xs md:text-sm font-medium text-white shadow-sm hover:bg-amber-600"
            >
              <FiArrowUpCircle className="text-sm" />
              <span>Stok Keluar</span>
            </button>
          </div>
        </div>
      }
    >
      {!loading && hasAnyCompleted && (
        <div className="mb-4 grid gap-3 md:grid-cols-3">
          <div className="rounded-xl border bg-white p-4 shadow-sm">
            <div className="text-[11px] uppercase text-gray-400">
              Batch selesai
            </div>
            <div className="text-2xl font-semibold text-gray-800">
              {productionSummary.totalBatches}
            </div>
            <p className="text-[11px] text-gray-500">
              Menggunakan {productionSummary.totalRawOut} bahan baku
            </p>
          </div>
          <div className="rounded-xl border bg-white p-4 shadow-sm">
            <div className="text-[11px] uppercase text-emerald-500">
              Barang Jadi (OK)
            </div>
            <div className="text-2xl font-semibold text-gray-800">
              {productionSummary.totalOk}
            </div>
            <p className="text-[11px] text-gray-500">
              Dari seluruh hasil produksi selesai
            </p>
          </div>
          <div className="rounded-xl border bg-white p-4 shadow-sm">
            <div className="text-[11px] uppercase text-rose-500">
              Barang Gagal
            </div>
            <div className="text-2xl font-semibold text-gray-800">
              {productionSummary.totalReject}
            </div>
            <p className="text-[11px] text-gray-500">
              Perlu ditindaklanjuti atau dikirim keluar
            </p>
          </div>
        </div>
      )}

      {loading ? (
        <div className="animate-pulse py-20 text-center text-gray-500">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="mx-auto mb-4 h-14 w-14 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M16.5 9.75L12 4.5m0 0L7.5 9.75M12 4.5v15"
            />
          </svg>
          <p className="text-sm font-medium">Memuat hasil produksi...</p>
        </div>
      ) : !hasAnyCompleted ? (
        <EmptyState
          title={
            isSearching
              ? "Hasil produksi selesai tidak ditemukan"
              : "Belum ada hasil produksi selesai"
          }
          description={
            isSearching
              ? "Coba ubah kata kunci pencarian atau reset filter."
              : "Hasil produksi akan muncul di sini setelah proses QC dinyatakan selesai."
          }
          buttonText={isSearching ? "Reset Pencarian" : undefined}
          onButtonClick={isSearching ? () => setSearchTerm("") : undefined}
          illustration={isSearching ? "search" : "box"}
        />
      ) : (
        <ProductionResultsTable rows={pageRows} />
      )}

      {!loading && hasAnyCompleted && totalPages > 1 && (
        <div className="mt-6 flex flex-col items-center justify-between gap-3 md:flex-row">
          <div className="text-sm text-gray-600">
            Menampilkan {startIndex} - {Math.min(page * limit, totalItems)} dari{" "}
            {totalItems} hasil produksi
          </div>
          <div className="flex items-center gap-2">
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              onPageChange={setPage}
            />
          </div>
        </div>
      )}

      <ProductionStockOutModal
        isOpen={isStockOutOpen}
        onClose={() => setIsStockOutOpen(false)}
        onApply={handleApplyStockOut}
        fetchFn={productSearchFetcher}
        location={productionLocation}
        stockSummary={stockSummary}
      />
    </WarehousePageShell>
  );
}

/**
 * Tabel hasil produksi + detail (raw out, finished in, QC per produk)
 */
function ProductionResultsTable({ rows }) {
  const [expandedId, setExpandedId] = useState(null);

  if (!rows?.length) return null;

  return (
    <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
      <table className="min-w-full border-collapse text-sm text-gray-700">
        <thead className="bg-gray-100 text-xs uppercase text-gray-600">
          <tr>
            <th className="w-10 p-3 text-center" />
            <th className="p-3 text-left">Nomor Produksi</th>
            <th className="p-3 text-left">Lokasi (Raw)</th>
            <th className="p-3 text-left">Tanggal</th>
            <th className="p-3 text-left">Total Bahan Keluar</th>
            <th className="p-3 text-left">Barang Jadi (OK)</th>
            <th className="p-3 text-left">Barang Gagal</th>
            <th className="p-3 text-left">Status QC</th>
          </tr>
        </thead>
        <tbody>
          <AnimatePresence initial={false}>
            {rows.map((row) => {
              const isExpanded = expandedId === row._id;
              const date = row.date
                ? new Date(row.date).toLocaleString("id-ID")
                : "-";
              const qcItems = Array.isArray(row.qcItems) ? row.qcItems : [];
              const items = Array.isArray(row.items) ? row.items : [];
              const totalRawOut = items
                .filter((item) => item.direction === "out")
                .reduce(
                  (sum, item) => sum + (Number(item.quantity || 0) || 0),
                  0,
                );
              const totalOk = qcItems.length
                ? qcItems.reduce(
                    (sum, qc) => sum + (Number(qc.okQuantity || 0) || 0),
                    0,
                  )
                : items
                    .filter((item) => item.direction === "in")
                    .reduce(
                      (sum, item) => sum + (Number(item.quantity || 0) || 0),
                      0,
                    );
              const totalReject = qcItems.length
                ? qcItems.reduce(
                    (sum, qc) =>
                      sum + (Number(qc.rejectQuantity || 0) || 0),
                    0,
                  )
                : 0;
              const isCompleted = (row.status || "produced") === "completed";

              return (
                <Fragment key={row._id}>
                  <Motion.tr
                    layout
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.15 }}
                    className="border-t hover:bg-gray-50 cursor-pointer"
                    onClick={() =>
                      setExpandedId((prev) => (prev === row._id ? null : row._id))
                    }
                  >
                    <td className="p-3 text-center">
                      <Motion.div
                        animate={{ rotate: isExpanded ? 180 : 0 }}
                        transition={{ duration: 0.2 }}
                        className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-gray-300 bg-white text-gray-600"
                      >
                        {isExpanded ? <FiChevronUp /> : <FiChevronDown />}
                      </Motion.div>
                    </td>
                    <td className="p-3 font-semibold text-gray-800">
                      {row.productionNumber}
                    </td>
                    <td className="p-3 text-xs text-gray-600">{row.location || "-"}</td>
                    <td className="p-3 text-xs text-gray-600">{date}</td>
                    <td className="p-3 text-left font-semibold">{totalRawOut}</td>
                    <td className="p-3 text-left font-semibold">
                      {totalOk}
                    </td>
                    <td className="p-3 text-left font-semibold text-rose-500">
                      {totalReject}
                    </td>
                    <td className="p-3 text-left">
                      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700">
                        <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
                        {isCompleted ? "Selesai" : "Diproduksi"}
                      </span>
                    </td>
                  </Motion.tr>

                  <AnimatePresence>
                    {isExpanded && (
                      <Motion.tr
                        layout
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.25 }}
                      >
                        <td colSpan={7} className="bg-gray-50 p-4">
                          <Motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.2 }}
                            className="grid gap-4 md:grid-cols-3"
                          >
                            {/* Bahan baku keluar */}
                            <div className="rounded-lg border bg-white p-4 md:col-span-1">
                              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-700">
                                <FiArrowRight className="text-amber-500" />
                                Bahan Baku Keluar
                              </div>
                              <table className="min-w-full text-xs text-gray-600">
                                <thead>
                                  <tr className="bg-gray-100 text-[11px] uppercase text-gray-500">
                                    <th className="px-3 py-2 text-left">Kode</th>
                                    <th className="px-3 py-2 text-left">Nama</th>
                                    <th className="px-3 py-2 text-right">Qty</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {row.items
                                    ?.filter((it) => it.direction === "out")
                                    .map((it) => (
                                      <tr
                                        key={`${row._id}-${it.productCode}-out`}
                                        className="border-t last:border-b bg-white hover:bg-gray-50"
                                      >
                                        <td className="px-3 py-1 font-mono">
                                          {it.productCode}
                                        </td>
                                        <td className="px-3 py-1">
                                          {it.productName}
                                        </td>
                                        <td className="px-3 py-1 text-right">
                                          {it.quantity}
                                        </td>
                                      </tr>
                                    ))}
                                </tbody>
                              </table>
                            </div>

                            {/* Produk jadi */}
                            <div className="rounded-lg border bg-white p-4 md:col-span-1">
                              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-700">
                                <FiCheckCircle className="text-emerald-500" />
                                Produk Jadi Masuk
                              </div>
                              <table className="min-w-full text-xs text-gray-600">
                                <thead>
                                  <tr className="bg-gray-100 text-[11px] uppercase text-gray-500">
                                    <th className="px-3 py-2 text-left">Kode</th>
                                    <th className="px-3 py-2 text-left">Nama</th>
                                    <th className="px-3 py-2 text-right">Qty</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {row.items
                                    ?.filter((it) => it.direction === "in")
                                    .map((it) => (
                                      <tr
                                        key={`${row._id}-${it.productCode}-in`}
                                        className="border-t last:border-b bg-white hover:bg-gray-50"
                                      >
                                        <td className="px-3 py-1 font-mono">
                                          {it.productCode}
                                        </td>
                                        <td className="px-3 py-1">
                                          {it.productName}
                                        </td>
                                        <td className="px-3 py-1 text-right">
                                          {it.quantity}
                                        </td>
                                      </tr>
                                    ))}
                                </tbody>
                              </table>
                            </div>

                            {/* QC per produk */}
                            <div className="flex flex-col justify-between rounded-lg border bg-white p-4 md:col-span-1">
                              <div>
                                <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-700">
                                  <FiAlertTriangle className="text-amber-500" />
                                  Hasil QC
                                </div>

                                {qcItems.length === 0 ? (
                                  <div className="rounded-lg bg-gray-50 p-3 text-[11px] text-gray-500">
                                    Data QC per produk tidak tersedia.
                                  </div>
                                ) : (
                                  <div className="rounded-lg bg-gray-50 p-3 text-xs">
                                    <table className="min-w-full text-[11px] text-gray-700">
                                      <thead>
                                        <tr className="text-gray-500">
                                          <th className="px-2 py-1 text-left">
                                            Kode
                                          </th>
                                          <th className="px-2 py-1 text-right">
                                            OK
                                          </th>
                                          <th className="px-2 py-1 text-right">
                                            Gagal
                                          </th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {qcItems.map((qc) => (
                                          <tr
                                            key={qc.productCode}
                                            className="border-t last:border-b"
                                          >
                                            <td className="px-2 py-1 font-mono">
                                              {qc.productCode}
                                            </td>
                                            <td className="px-2 py-1 text-right">
                                              {qc.okQuantity}
                                            </td>
                                            <td className="px-2 py-1 text-right text-red-500">
                                              {qc.rejectQuantity}
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                )}
                              </div>
                            </div>
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
  );
}

/**
 * Component search produk + stok keluar
 * (dijiplak dari StockOutModal di ProductsPage tapi dipake khusus hasil produksi)
 */

function ProductSearchInput({ value, onChange, onSelect, inputRef, onEnter, fetchFn }) {
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const trimmed = value.trim();
    if (trimmed.length < 3) {
      setResults([]);
      setOpen(false);
      return undefined;
    }

    let active = true;
    setLoading(true);
    const handler = window.setTimeout(async () => {
      try {
        const data = await fetchFn({
          search: trimmed,
          limit: 30,
        });
        if (!active) return;
        const items = Array.isArray(data?.items) ? data.items : [];
        setResults(items);
        setOpen(items.length > 0);
      } catch {
        if (active) {
          setResults([]);
          setOpen(false);
        }
      } finally {
        if (active) setLoading(false);
      }
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      active = false;
      window.clearTimeout(handler);
    };
  }, [value, fetchFn]);

  return (
    <div className="relative">
      <label className="mb-1 block text-xs font-medium text-gray-700">
        Scan / Kode Produk Jadi
      </label>
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value.toUpperCase())}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            onEnter?.();
          }
        }}
        className="w-full rounded-lg border px-3 py-2 text-sm font-mono outline-none focus:ring-2 focus:ring-red-500/60"
        placeholder="Ketik minimal 3 karakter"
      />
      {loading && (
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-gray-400">
          ...
        </span>
      )}
      {open && (
        <div className="absolute z-20 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border bg-white text-xs shadow-lg">
          {results.map((item) => (
            <button
              type="button"
              key={item._id}
              className="flex w-full items-center justify-between border-b px-3 py-2 text-left hover:bg-gray-50"
              onClick={() => {
                onSelect(item);
                onChange(item.code);
                setOpen(false);
              }}
            >
              <span className="font-mono text-gray-800">{item.code}</span>
              <span className="truncate pl-3 text-[11px] text-gray-500">
                {item.name}
              </span>
            </button>
          ))}
          {results.length === 0 && (
            <div className="px-3 py-2 text-gray-500">Tidak ada hasil.</div>
          )}
        </div>
      )}
    </div>
  );
}

function ProductionStockOutModal({
  isOpen,
  onClose,
  onApply,
  fetchFn,
  location,
  stockSummary = [],
}) {
  const [step, setStep] = useState(1);
  const [invoice, setInvoice] = useState("");
  const [kode, setKode] = useState("");
  const [qty, setQty] = useState("");
  const [quality, setQuality] = useState("ok");
  const [items, setItems] = useState([]);
  const kodeInputRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return undefined;
    const timer =
      typeof window === "undefined"
        ? null
        : window.setTimeout(() => {
            setStep(1);
            setInvoice("");
            setKode("");
            setQty("");
            setItems([]);
            setQuality("ok");
          }, 0);
    return () => {
      if (timer) window.clearTimeout(timer);
    };
  }, [isOpen]);

  useEffect(() => {
    if (step === 1 && kodeInputRef.current) {
      kodeInputRef.current.focus();
    }
  }, [step]);

  if (!isOpen) return null;

  const availableOk = stockSummary.filter((entry) => entry.okQty > 0);
  const availableReject = stockSummary.filter((entry) => entry.rejectQty > 0);

  const handleAddItem = () => {
    const code = kode.trim();
    const nQty = Number(qty || 0);
    if (!code || nQty <= 0) return;
    const normalizedQuality =
      quality === "reject" ? "reject" : "ok";

    setItems((prev) => {
      const existingIndex = prev.findIndex(
        (it) =>
          it.kode.toUpperCase() === code.toUpperCase() &&
          it.quality === normalizedQuality
      );
      if (existingIndex !== -1) {
        const next = [...prev];
        next[existingIndex] = {
          ...next[existingIndex],
          qty: next[existingIndex].qty + nQty,
        };
        return next;
      }
      return [...prev, { kode: code.toUpperCase(), qty: nQty, quality: normalizedQuality }];
    });
    setKode("");
    setQty("");
    setQuality("ok");
    if (kodeInputRef.current) kodeInputRef.current.focus();
  };

  const handleSubmitInvoice = async (e) => {
    e.preventDefault();
    const success = await onApply({
      invoice: invoice.trim(),
      items,
    });
    if (success !== false) {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-xl">
        <h2 className="mb-4 text-lg font-semibold text-gray-800">Stok Keluar (Hasil Produksi)</h2>

        {location && (
          <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-gray-100 px-3 py-1 text-[11px] font-medium text-gray-700">
            <span className="inline-block h-2 w-2 rounded-full bg-amber-500" />
            Lokasi Produksi: {location}
          </div>
        )}

        <div className="mb-4 flex gap-2 text-xs font-medium text-gray-600">
          <span
            className={`rounded-full px-3 py-1 ${
              step === 1 ? "bg-red-500 text-white" : "bg-gray-100"
            }`}
          >
            1. Scan & Jumlah
          </span>
          <span
            className={`rounded-full px-3 py-1 ${
              step === 2 ? "bg-red-500 text-white" : "bg-gray-100"
            }`}
          >
            2. Invoice
          </span>
        </div>

        {step === 1 ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setStep(2);
            }}
            className="space-y-4 text-sm"
          >
            {(availableOk.length > 0 || availableReject.length > 0) && (
              <div className="rounded-lg border bg-gray-50 p-3 text-xs text-gray-600">
                <div className="mb-2 font-semibold text-gray-700">
                  Ringkasan Barang Jadi & Gagal
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  {availableOk.length > 0 && (
                    <div>
                      <div className="mb-1 text-[11px] font-semibold text-emerald-600">
                        Barang Jadi (OK)
                      </div>
                      <div className="space-y-1 max-h-32 overflow-y-auto pr-1">
                        {availableOk.map((entry) => (
                          <div
                            key={`${entry.kode}-ok`}
                            className="flex items-center justify-between rounded border border-emerald-100 bg-white px-2 py-1"
                          >
                            <div>
                              <div className="font-mono text-xs text-gray-800">
                                {entry.kode}
                              </div>
                              <div className="text-[10px] text-gray-500">
                                Ready: {entry.okQty}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setKode(entry.kode);
                                setQty(String(entry.okQty));
                                setQuality("ok");
                                kodeInputRef.current?.focus();
                              }}
                              className="rounded bg-emerald-500 px-2 py-1 text-[10px] font-semibold text-white hover:bg-emerald-600"
                            >
                              Gunakan
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {availableReject.length > 0 && (
                    <div>
                      <div className="mb-1 text-[11px] font-semibold text-rose-600">
                        Barang Gagal
                      </div>
                      <div className="space-y-1 max-h-32 overflow-y-auto pr-1">
                        {availableReject.map((entry) => (
                          <div
                            key={`${entry.kode}-reject`}
                            className="flex items-center justify-between rounded border border-rose-100 bg-white px-2 py-1"
                          >
                            <div>
                              <div className="font-mono text-xs text-gray-800">
                                {entry.kode}
                              </div>
                              <div className="text-[10px] text-gray-500">
                                Siap kirim: {entry.rejectQty}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setKode(entry.kode);
                                setQty(String(entry.rejectQty));
                                setQuality("reject");
                                kodeInputRef.current?.focus();
                              }}
                              className="rounded bg-rose-500 px-2 py-1 text-[10px] font-semibold text-white hover:bg-rose-600"
                            >
                              Kirim gagal
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="grid grid-cols-[2fr,1fr,1fr,auto] items-end gap-3">
              <ProductSearchInput
                value={kode}
                onChange={setKode}
                inputRef={kodeInputRef}
                onEnter={handleAddItem}
                fetchFn={fetchFn}
                onSelect={(product) => {
                  setKode(product.code);
                  setQty("1");
                  setQuality("ok");
                  kodeInputRef.current?.focus();
                }}
              />
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">
                  Jumlah
                </label>
                <input
                  type="number"
                  min="1"
                  value={qty}
                  onChange={(e) => setQty(e.target.value)}
                  className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-red-500/60"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">
                  Kategori
                </label>
                <select
                  value={quality}
                  onChange={(e) => setQuality(e.target.value)}
                  className="w-full rounded-lg border px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-red-500/60"
                >
                  <option value="ok">Barang Jadi (OK)</option>
                  <option value="reject">Barang Gagal</option>
                </select>
              </div>
              <button
                type="button"
                onClick={handleAddItem}
                className="mb-0.5 inline-flex items-center justify-center rounded-lg bg-amber-500 px-3 py-2 text-xs font-medium text-white hover:bg-amber-600"
              >
                Tambah
              </button>
            </div>

            <div className="max-h-52 overflow-y-auto rounded-lg border">
              {items.length === 0 ? (
                <div className="p-3 text-xs text-gray-500">
                  Belum ada item. Scan atau ketik kode produk lalu isi jumlah.
                </div>
              ) : (
                <table className="min-w-full text-xs text-gray-700">
                  <thead className="bg-gray-50 text-[11px] uppercase text-gray-500">
                    <tr>
                      <th className="px-3 py-2 text-left">Kode Produk</th>
                      <th className="px-3 py-2 text-right">Jumlah</th>
                      <th className="px-3 py-2 text-left">Kategori</th>
                      <th className="px-3 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((it, idx) => (
                      <tr key={`${it.kode}-${it.quality}-${idx}`} className="border-t last:border-b">
                        <td className="px-3 py-1 font-mono text-xs">
                          {it.kode}
                        </td>
                        <td className="px-3 py-1 text-right">{it.qty}</td>
                        <td className="px-3 py-1 text-left">
                          {it.quality === "reject" ? (
                            <span className="inline-flex items-center rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-semibold text-rose-600">
                              Barang Gagal
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-600">
                              Barang Jadi
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-1 text-center">
                          <button
                            type="button"
                            onClick={() =>
                              setItems((prev) =>
                                prev.filter((_, pIdx) => pIdx !== idx)
                              )
                            }
                            className="text-[11px] text-red-500 hover:text-red-600"
                          >
                            Hapus
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="mt-2 flex justify-between text-xs text-gray-500">
              <span>Total item: {items.length}</span>
              <button
                type="submit"
                className="rounded-lg bg-red-500 px-4 py-2 text-xs font-medium text-white hover:bg-red-600"
              >
                Lanjut ke invoice
              </button>
            </div>

            <div className="mt-3 flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border px-4 py-2 text-xs font-medium text-gray-700 hover:bg-gray-100"
              >
                Batal
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleSubmitInvoice} className="space-y-3 text-sm">
            <div className="rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600">
              Total item: <span className="font-medium">{items.length}</span>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">
                Nomor Invoice (kosongkan untuk otomatis)
              </label>
              <input
                type="text"
                value={invoice}
                onChange={(e) => setInvoice(e.target.value.toUpperCase())}
                className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-red-500/60"
                placeholder="Contoh: INV-OUT-PRD-00123"
              />
            </div>

            <div className="mt-3 flex justify-between text-xs text-gray-500">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="text-gray-500 hover:text-gray-700"
              >
                ← Kembali ke scan
              </button>
            </div>

            <div className="mt-3 flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border px-4 py-2 text-xs font-medium text-gray-700 hover:bg-gray-100"
              >
                Batal
              </button>
              <button
                type="submit"
                className="rounded-lg bg-red-500 px-4 py-2 text-xs font-medium text-white hover:bg-red-600"
              >
                Simpan Stok Keluar
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
