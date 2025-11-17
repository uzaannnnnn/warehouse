import { useEffect, useMemo, useState } from "react";
import { FiBox, FiSearch, FiX } from "react-icons/fi";
import { toast } from "sonner";

import Pagination from "../../../components/common/Pagination";
import EmptyState from "../../../components/common/EmptyState";
import { WarehousePageShell } from "../../../components/templates/WarehousePageShell";

import { fetchProductions } from "../api/production";
import { PRODUCTION_LOCATIONS } from "../../../constants/warehouseLocations";
import { WAREHOUSE_STORAGE_KEYS } from "../../../constants/warehouseStorageKeys";
import { getRawLocationForProductionLocation } from "../../../utils/warehouseLocationMap";

const FETCH_LIMIT = 200; // ambil max 200 per lokasi+search, lalu paginasi di frontend
const SEARCH_DEBOUNCE_MS = 300;
const LOCATION_KEY = WAREHOUSE_STORAGE_KEYS.productionLocation;
const FAILED_PRODUCT_SUFFIX = "-GAGAL";

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
  }, [rawLocation, debouncedSearch]);

  // hanya status completed
  const completedRows = useMemo(
    () =>
      allProductions.filter(
        (row) => (row.status || "produced") === "completed",
      ),
    [allProductions],
  );

  // rekap per produk (OK & Reject)
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

  // bentukkan baris stok per produk (jadi + gagal)
  const productRows = useMemo(() => {
    const rows = [];
    stockSummary.forEach((entry) => {
      const baseName = entry.name || "-";

      // Produk jadi (OK)
      if (entry.okQty > 0) {
        rows.push({
          id: `${entry.kode}-ok`,
          kode: entry.kode,
          displayCode: entry.kode,
          name: baseName,
          qty: entry.okQty,
          status: "success",
        });
      }

      // Produk gagal (reject)
      if (entry.rejectQty > 0) {
        rows.push({
          id: `${entry.kode}-failed`,
          kode: entry.kode,
          displayCode: `${entry.kode}${FAILED_PRODUCT_SUFFIX}`,
          name: baseName,
          qty: entry.rejectQty,
          status: "failed",
        });
      }
    });
    return rows;
  }, [stockSummary]);

  const totalItems = productRows.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / limit));
  const startIndex = totalItems ? (page - 1) * limit + 1 : 0;

  const pageRows = useMemo(
    () => productRows.slice((page - 1) * limit, page * limit),
    [productRows, page, limit],
  );
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
          <div className="relative flex-grow max-w-md">
            <input
              type="text"
              placeholder="Cari nomor produksi / kode produk..."
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
        <ProductionProductsTable rows={pageRows} startIndex={startIndex} />
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
    </WarehousePageShell>
  );
}

function ProductionProductsTable({ rows, startIndex }) {
  if (!rows?.length) return null;

  return (
    <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
      <table className="min-w-full text-sm text-gray-700">
        <thead className="bg-gray-100 text-xs uppercase text-gray-600">
          <tr>
            <th className="w-16 px-3 py-2 text-left">No.</th>
            <th className="px-3 py-2 text-left">Kode Produk (Display)</th>
            <th className="px-3 py-2 text-left">Kode Induk</th>
            <th className="px-3 py-2 text-left">Nama Produk</th>
            <th className="px-3 py-2 text-right">Jumlah</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => {
            const isFailed = row.status === "failed";

            return (
              <tr
                key={row.id}
                className={`border-t ${
                  isFailed ? "bg-rose-50/70 text-rose-700" : "bg-white"
                }`}
              >
                <td className="px-3 py-2 text-xs text-gray-500">
                  {startIndex + idx}
                </td>

                {/* Kode yang dipakai di stok (untuk gagal sudah ada suffix -GAGAL) */}
                <td className="px-3 py-2 font-mono">{row.displayCode}</td>

                {/* Kode induk / kode asli produk */}
                <td className="px-3 py-2 font-mono text-xs text-gray-700">
                  {row.kode}
                </td>

                <td className="px-3 py-2 text-sm">{row.name || "-"}</td>

                <td className="px-3 py-2 text-right font-semibold">
                  {row.qty}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}