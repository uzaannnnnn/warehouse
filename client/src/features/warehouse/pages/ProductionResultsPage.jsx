import { useEffect, useMemo, useState } from "react";
import { FiBox, FiSearch, FiX } from "react-icons/fi";
import { toast } from "sonner";

import Pagination from "../../../components/common/Pagination";
import EmptyState from "../../../components/common/EmptyState";
import { WarehousePageShell } from "../../../components/templates/WarehousePageShell";

import {
  fetchProductionResults,
  destroyProductionReject,
} from "../api/production";
import { PRODUCTION_LOCATIONS } from "../../../constants/warehouseLocations";
import { WAREHOUSE_STORAGE_KEYS } from "../../../constants/warehouseStorageKeys";
import { getRawLocationForProductionLocation } from "../../../utils/warehouseLocationMap";

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
  const [results, setResults] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const limit = 10;
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);

  const rawLocation = getRawLocationForProductionLocation(warehouseCode);

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(searchTerm.trim());
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [searchTerm]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, warehouseCode]);

  useEffect(() => {
    let active = true;
    async function loadResults() {
      setLoading(true);
      try {
        const data = await fetchProductionResults({
          page,
          limit,
          search: debouncedSearch || undefined,
          location: rawLocation,
        });
        if (!active) return;
        setResults(Array.isArray(data?.items) ? data.items : []);
        setTotalItems(Number(data?.total || 0));
        setTotalPages(Number(data?.pages || 1));
      } catch (err) {
        if (!active) return;
        console.error("Gagal memuat hasil produksi:", err?.message);
        toast.error("Gagal memuat hasil produksi");
      } finally {
        if (active) setLoading(false);
      }
    }
    loadResults();
    return () => {
      active = false;
    };
  }, [page, limit, debouncedSearch, rawLocation, reloadKey]);

  const startIndex = totalItems ? (page - 1) * limit + 1 : 0;
  const hasAnyResults = totalItems > 0;
  const pageRows = useMemo(() => results, [results]);

  const handleDestroyReject = async (row) => {
    const maxQty = Number(row.rejectRemaining || 0);
    if (!maxQty) return;
    const input = window.prompt(
      `Masukkan jumlah produk gagal ${row.productCode} yang dimusnahkan (maks ${maxQty})`,
      String(maxQty),
    );
    if (input === null) return;
    const qty = Number(input);
    if (!Number.isFinite(qty) || qty <= 0) {
      toast.error("Jumlah harus lebih dari 0");
      return;
    }
    if (qty > maxQty) {
      toast.error(`Jumlah tidak boleh lebih dari ${maxQty}`);
      return;
    }
    try {
      await destroyProductionReject({
        productCode: row.productCode,
        location: rawLocation,
        quantity: qty,
      });
      toast.success("Produk gagal berhasil dimusnahkan");
      setReloadKey((prev) => prev + 1);
    } catch (err) {
      console.error("Gagal memusnahkan stok gagal:", err?.message);
      toast.error(err?.response?.data?.message || "Gagal memusnahkan stok gagal");
    }
  };

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
            className="cursor-not-allowed rounded-lg border bg-gray-100 px-3 py-1 text-xs text-gray-500"
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
          <div className="relative w-full max-w-md">
            <input
              type="text"
              placeholder="Cari kode / nama produk hasil produksi..."
              className="w-full rounded-lg border px-3 py-1.5 pl-9 pr-3 text-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <FiSearch className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-gray-400" />
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
        </div>
      }
    >
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
      ) : !hasAnyResults ? (
        <EmptyState
          title={
            debouncedSearch
              ? "Hasil produksi selesai tidak ditemukan"
              : "Belum ada hasil produksi selesai"
          }
          description={
            debouncedSearch
              ? "Coba ubah kata kunci pencarian atau reset filter."
              : "Hasil produksi akan muncul di sini setelah proses QC dinyatakan selesai."
          }
          buttonText={debouncedSearch ? "Reset Pencarian" : undefined}
          onButtonClick={debouncedSearch ? () => setSearchTerm("") : undefined}
          illustration={debouncedSearch ? "search" : "box"}
        />
      ) : (
        <ProductionProductsTable
          rows={pageRows}
          startIndex={startIndex}
          onDestroy={handleDestroyReject}
        />
      )}

      {!loading && hasAnyResults && totalPages > 1 && (
        <div className="mt-6 flex flex-col items-center justify-between gap-3 md:flex-row">
          <div className="text-sm text-gray-600">
            Menampilkan {startIndex} - {Math.min(page * limit, totalItems)} dari{" "}
            {totalItems} hasil produksi
          </div>
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            onPageChange={setPage}
          />
        </div>
      )}
    </WarehousePageShell>
  );
}

function ProductionProductsTable({ rows, startIndex, onDestroy }) {
  if (!rows?.length) return null;

  return (
    <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
      <table className="min-w-full text-sm text-gray-700">
        <thead className="bg-gray-100 text-xs uppercase text-gray-600">
          <tr>
            <th className="w-16 px-3 py-2 text-left">No.</th>
            <th className="px-3 py-2 text-left">Kode Produk</th>
            <th className="px-3 py-2 text-left">Nama Produk</th>
            <th className="px-3 py-2 text-right">Produk Jadi</th>
            <th className="px-3 py-2 text-right">Produk Gagal</th>
            <th className="px-3 py-2 text-left">Aksi</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => (
            <tr key={row._id || row.productCode} className="border-t">
              <td className="px-3 py-2 text-xs text-gray-500">
                {startIndex + idx}
              </td>
              <td className="px-3 py-2 font-mono">{row.productCode}</td>
              <td className="px-3 py-2 text-sm">{row.productName || "-"}</td>
              <td className="px-3 py-2 text-right font-semibold text-emerald-600">
                {row.okRemaining || 0}
              </td>
              <td className="px-3 py-2 text-right font-semibold text-rose-600">
                {row.rejectRemaining || 0}
              </td>
              <td className="px-3 py-2">
                {row.rejectRemaining > 0 ? (
                  <button
                    type="button"
                    onClick={() => onDestroy?.(row)}
                    className="rounded-lg border border-rose-200 px-3 py-1 text-[11px] font-medium text-rose-600 hover:bg-rose-50"
                  >
                    Musnahkan
                  </button>
                ) : (
                  <span className="text-[11px] text-gray-400">-</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
