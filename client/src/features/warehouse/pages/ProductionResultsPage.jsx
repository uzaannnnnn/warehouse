import { useEffect, useMemo, useState } from "react";
import { FiBox, FiPrinter, FiSearch, FiTrash2, FiX } from "react-icons/fi";
import { toast } from "sonner";

import Pagination from "../../../components/common/Pagination";
import EmptyState from "../../../components/common/EmptyState";
import Barcode from "../../../components/common/Barcode";
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
const numberFormatter = new Intl.NumberFormat("id-ID");
const formatNumberValue = (value) =>
  numberFormatter.format(Number.isFinite(Number(value)) ? Number(value) : 0);

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
      customListener
    );
    window.addEventListener("storage", storageListener);
    return () => {
      window.removeEventListener(
        "warehouse:production-location-change",
        customListener
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
  const [printRow, setPrintRow] = useState(null);
  const [printQty, setPrintQty] = useState("1");
  const [rejectToDestroy, setRejectToDestroy] = useState(null);
  const [rejectDestroyQty, setRejectDestroyQty] = useState("");

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
  const displayRows = useMemo(() => {
    const mapped = [];
    results.forEach((row) => {
      const code = String(row.productCode || "").toUpperCase();
      if (!code) return;
      const productName = row.productName || "-";
      const okQty = Number(row.okRemaining || 0) || 0;
      const rejectQty = Number(row.rejectRemaining || 0) || 0;
      if (okQty > 0) {
        mapped.push({
          key: `${code}-ok`,
          type: "ok",
          displayCode: code,
          baseCode: code,
          barcodeValue: code,
          productName,
          quantity: okQty,
        });
      }
      if (rejectQty > 0) {
        mapped.push({
          key: `${code}-reject`,
          type: "reject",
          displayCode: `${code}-REJECT`,
          baseCode: code,
          barcodeValue: `${code}-REJECT`,
          productName,
          quantity: rejectQty,
        });
      }
    });
    return mapped;
  }, [results]);
  const tableRows = useMemo(
    () =>
      displayRows.map((row, idx) => ({
        ...row,
        no: startIndex + idx,
      })),
    [displayRows, startIndex]
  );

  const openDestroyModal = (row) => {
    const maxQty = Number(row.quantity || 0) || 0;
    if (!maxQty) {
      toast.error("Tidak ada stok gagal yang tersisa untuk produk ini");
      return;
    }
    setRejectToDestroy(row);
    setRejectDestroyQty(String(maxQty));
  };

  const closeDestroyModal = () => {
    setRejectToDestroy(null);
    setRejectDestroyQty("");
  };

  const handleConfirmDestroyReject = async () => {
    if (!rejectToDestroy) return;
    const maxQty = Number(rejectToDestroy.quantity || 0) || 0;
    const qty = Number(rejectDestroyQty);
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
        productCode: rejectToDestroy.baseCode,
        location: rawLocation,
        quantity: qty,
      });
      toast.success("Produk gagal berhasil dihapus");
      setReloadKey((prev) => prev + 1);
      closeDestroyModal();
    } catch (err) {
      console.error("Gagal memusnahkan stok gagal:", err?.message);
      toast.error(
        err?.response?.data?.message || "Gagal memusnahkan stok gagal"
      );
    }
  };

  const handleOpenPrint = (row) => {
    setPrintRow(row);
    setPrintQty("1");
  };

  const handleLocationSelect = (value) => {
    setWarehouseCode(value);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(LOCATION_KEY, value);
      window.dispatchEvent(
        new CustomEvent("warehouse:production-location-change", {
          detail: value,
        })
      );
    }
  };

  return (
    <WarehousePageShell
      title="Hasil Produksi"
      icon={FiBox}
      headerBelow={
        <div className="flex flex-wrap items-center gap-2 text-xs text-gray-700">
          <span className="font-medium">Lokasi Hasil Produksi:</span>
          <select
            value={warehouseCode}
            onChange={(e) => handleLocationSelect(e.target.value)}
            className="rounded-lg border px-3 py-1 text-xs outline-none focus:ring-2 focus:ring-red-500/60"
          >
            {locationOptions.map((loc) => (
              <option key={loc} value={loc}>
                {loc}
              </option>
            ))}
          </select>
        </div>
      }
      headerRight={
        <div className="flex w-full flex-col gap-2 md:w-auto">
          <div className="relative w-full max-w-md">
            <input
              type="text"
              placeholder="Cari kode / nama hasil produksi..."
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
          <div className="text-[11px] text-gray-500 md:text-right">
            Total hasil tercatat:{" "}
            <span className="font-semibold text-gray-700">
              {formatNumberValue(totalItems)}
            </span>
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
        <ProductionResultsTable
          rows={tableRows}
          onDestroyRequest={openDestroyModal}
          onPrint={handleOpenPrint}
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
      <ProductionBarcodePrintModal
        row={printRow}
        qty={printQty}
        onQtyChange={setPrintQty}
        onClose={() => setPrintRow(null)}
      />
      <RejectDestroyModal
        row={rejectToDestroy}
        quantity={rejectDestroyQty}
        onQuantityChange={setRejectDestroyQty}
        onClose={closeDestroyModal}
        onConfirm={handleConfirmDestroyReject}
      />
    </WarehousePageShell>
  );
}

function ProductionResultsTable({ rows, onDestroyRequest, onPrint }) {
  if (!rows?.length) {
    return (
      <div className="rounded-xl border bg-white p-6 text-center text-sm text-gray-500 shadow-sm">
        Belum ada hasil produksi di halaman ini.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
      <table className="min-w-full border-collapse text-sm text-gray-700">
        <thead className="bg-gray-50 text-[11px] uppercase text-gray-500">
          <tr>
            <th className="w-16 p-3 text-center">No.</th>
            <th className="p-3 text-left">Kode Produk</th>
            <th className="p-3 text-center">Barcode</th>
            <th className="p-3 text-left">Nama Produk</th>
            <th className="p-3 text-right">Jumlah</th>
            <th className="w-28 p-3 text-center">Aksi</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key} className="border-t hover:bg-gray-50">
              <td className="p-3 text-center text-xs text-gray-500">
                {row.no}
              </td>
              <td className="p-3 font-mono text-xs text-gray-800">
                {row.displayCode}
              </td>
              <td className="p-3 text-center">
                <div className="flex flex-col items-center gap-2">
                  <Barcode value={row.barcodeValue} className="mx-auto h-10" />
                  <button
                    type="button"
                    onClick={() => onPrint?.(row)}
                    className="inline-flex items-center gap-1 rounded-full bg-blue-500 px-3 py-1 text-[11px] font-medium text-white hover:bg-blue-600"
                  >
                    <FiPrinter className="h-3 w-3" />
                    Print
                  </button>
                </div>
              </td>
              <td className="p-3 text-sm font-semibold text-gray-900">
                {row.productName}
              </td>
              <td className="p-3 text-right text-sm font-semibold text-gray-900">
                {formatNumberValue(row.quantity)}
              </td>
              <td className="p-3 text-center">
                {row.type === "reject" ? (
                  <button
                    type="button"
                    onClick={() => onDestroyRequest?.(row)}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-red-500 text-white hover:bg-red-600"
                  >
                    <FiTrash2 className="h-4 w-4" />
                  </button>
                ) : (
                  <span className="text-xs text-gray-400">-</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ProductionBarcodePrintModal({ row, qty, onQtyChange, onClose }) {
  if (!row) return null;

  const safeCode = String(row.barcodeValue || row.displayCode || "");

  const handlePrint = () => {
    const count = Math.max(1, Number(qty || 1));
    const win = window.open("", "_blank");
    if (!win) return;

    win.document.write(`
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Print Barcode - ${safeCode}</title>
  <style>
    body { font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; padding: 24px; }
    .grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; }
    .item { text-align: center; padding: 8px; border: 1px solid #e5e7eb; border-radius: 8px; }
    .code { margin-top: 4px; font-size: 12px; letter-spacing: 0.12em; }
  </style>
</head>
<body>
  <div class="grid">
    ${Array.from({ length: count })
      .map(
        () => `
      <div class="item">
        <svg class="barcode"></svg>
        <div class="code">${safeCode}</div>
      </div>`
      )
      .join("")}
  </div>
  <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js"></script>
  <script>
    window.onload = function () {
      document.querySelectorAll('.barcode').forEach(function (el) {
        JsBarcode(el, ${JSON.stringify(safeCode)}, {
          format: "CODE128",
          displayValue: false,
          lineColor: "#111827",
          width: 1,
          height: 40,
          margin: 0
        });
      });
      window.print();
    };
  </script>
</body>
</html>`);
    win.document.close();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
        <h2 className="mb-3 text-base font-semibold text-gray-800">
          Print Barcode
        </h2>
        <div className="mb-4 flex flex-col items-center gap-2">
          <Barcode value={safeCode} className="h-12" />
          <div className="text-sm font-mono text-gray-800">{safeCode}</div>
        </div>
        <div className="mb-4">
          <label className="mb-1 block text-xs font-medium text-gray-700">
            Jumlah print
          </label>
          <input
            type="number"
            min="1"
            value={qty}
            onChange={(e) => onQtyChange(e.target.value)}
            className="w-24 rounded-lg border px-3 py-1 text-sm outline-none focus:ring-2 focus:ring-red-500/60"
          />
        </div>
        <div className="flex justify-end gap-2 text-xs">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border px-4 py-2 font-medium text-gray-700 hover:bg-gray-100"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center gap-1 rounded-lg bg-blue-500 px-4 py-2 font-medium text-white hover:bg-blue-600"
          >
            <FiPrinter className="h-3 w-3" />
            Print PDF
          </button>
        </div>
      </div>
    </div>
  );
}

function RejectDestroyModal({
  row,
  quantity,
  onQuantityChange,
  onConfirm,
  onClose,
}) {
  if (!row) return null;
  const maxQty = Number(row.quantity || 0) || 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
        <h2 className="mb-3 text-base font-semibold text-gray-800">
          Hapus Produk Gagal
        </h2>
        <div className="mb-4 rounded-xl border bg-gray-50 p-3 text-sm text-gray-700">
          <div className="font-mono text-sm font-semibold text-gray-900">
            {row.displayCode}
          </div>
          <div className="text-xs text-gray-500">{row.productName}</div>
          <div className="mt-2 text-xs text-gray-500">
            Sisa stok gagal: <span className="font-semibold">{maxQty}</span>
          </div>
        </div>
        <div className="mb-5">
          <label className="mb-1 block text-xs font-medium text-gray-700">
            Jumlah yang dihapus
          </label>
          <input
            type="number"
            min="1"
            max={maxQty}
            value={quantity}
            onChange={(e) => onQuantityChange(e.target.value)}
            className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-red-500/60"
          />
          <p className="mt-1 text-[11px] text-gray-500">
            Maksimal {maxQty} unit. Jumlah stok akan berkurang sesuai input.
          </p>
        </div>
        <div className="flex justify-end gap-2 text-xs">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border px-4 py-2 font-medium text-gray-700 hover:bg-gray-100"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="inline-flex items-center gap-1 rounded-lg bg-red-500 px-4 py-2 font-medium text-white hover:bg-red-600"
          >
            <FiTrash2 className="h-3 w-3" />
            Hapus
          </button>
        </div>
      </div>
    </div>
  );
}
