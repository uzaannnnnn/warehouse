import { useCallback, useEffect, useMemo, useState } from "react";
import { FiBox, FiInbox, FiPrinter, FiSearch, FiTrash2, FiX } from "react-icons/fi";
import { toast } from "sonner";

import Pagination from "../../../components/common/Pagination";
import EmptyState from "../../../components/common/EmptyState";
import Barcode from "../../../components/common/Barcode";
import { WarehousePageShell } from "../../../components/templates/WarehousePageShell";

import {
  fetchProductionResults,
  destroyProductionReject,
  fetchProductionStockRequests,
  approveProductionStockRequest,
  rejectProductionStockRequest,
} from "../api/production";
import { LOCATION_TYPES, PRODUCTION_LOCATIONS } from "../../../constants/warehouseLocations";
import { WAREHOUSE_STORAGE_KEYS } from "../../../constants/warehouseStorageKeys";
import {
  getRawLocationForProductionLocation,
  getProductionLocationForRawLocation,
} from "../../../utils/warehouseLocationMap";
import { fetchManagementLocationsByType } from "../api/management";
import { buildScopedLocationOptions, pickInitialLocation } from "../../../utils/locationScope";
import { useAuth } from "../../../context/AuthContext";

const SEARCH_DEBOUNCE_MS = 300;
const LOCATION_KEY = WAREHOUSE_STORAGE_KEYS.productionLocation;
const numberFormatter = new Intl.NumberFormat("id-ID");
const formatNumberValue = (value) =>
  numberFormatter.format(Number.isFinite(Number(value)) ? Number(value) : 0);
const STOCK_REQUEST_LIMIT = 5;

function getStockRequestId(request) {
  return (
    request?._id ||
    request?.id ||
    request?.requestNumber ||
    request?.referenceNumber ||
    null
  );
}

export default function ProductionResultsPage() {
  const { user } = useAuth();
  const [locationOptions, setLocationOptions] = useState(PRODUCTION_LOCATIONS);

  const scopedLocationOptions = useMemo(
    () => buildScopedLocationOptions(user, LOCATION_TYPES.PRODUCTION, locationOptions),
    [user, locationOptions],
  );

  const [warehouseCode, setWarehouseCode] = useState(() =>
    pickInitialLocation(LOCATION_KEY, scopedLocationOptions, user?.location),
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const remote = await fetchManagementLocationsByType(LOCATION_TYPES.PRODUCTION);
        if (cancelled) return;
        const labels = remote.map((loc) => loc.label || loc.code).filter(Boolean);
        if (labels.length) setLocationOptions(labels);
      } catch (error) {
        console.error("Gagal memuat lokasi produksi:", error.message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!warehouseCode) return;
    if (scopedLocationOptions.includes(warehouseCode)) return;
    setWarehouseCode(scopedLocationOptions[0] || warehouseCode);
  }, [scopedLocationOptions, warehouseCode]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const handleExternalUpdate = (value) => {
      if (typeof value !== "string") return;
      if (!scopedLocationOptions.includes(value)) return;
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
  }, [scopedLocationOptions]);

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
  const [stockRequestsLoading, setStockRequestsLoading] = useState(false);
  const [stockRequests, setStockRequests] = useState([]);
  const [stockRequestPage, setStockRequestPage] = useState(1);
  const [stockRequestTotalItems, setStockRequestTotalItems] = useState(0);
  const [stockRequestTotalPages, setStockRequestTotalPages] = useState(1);
  const [stockRequestReloadKey, setStockRequestReloadKey] = useState(0);
  const [requestActionState, setRequestActionState] = useState({
    id: null,
    type: null,
  });
  const [partialApprovalRequest, setPartialApprovalRequest] = useState(null);
  const [partialApprovalSubmitting, setPartialApprovalSubmitting] = useState(false);

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

  useEffect(() => {
    if (!warehouseCode && !rawLocation) return;
    let active = true;
    async function loadStockRequests() {
      setStockRequestsLoading(true);
      try {
        const targetCandidates = Array.from(
          new Set(
            [rawLocation, warehouseCode].filter(
              (loc) => typeof loc === "string" && loc.trim().length,
            ),
          ),
        );
        if (!targetCandidates.length) {
          if (active) {
            setStockRequests([]);
            setStockRequestTotalItems(0);
            setStockRequestTotalPages(1);
          }
          return;
        }

        const responses = await Promise.all(
          targetCandidates.map((target) =>
            fetchProductionStockRequests({
              page: 1,
              limit: 200,
              status: "pending",
              targetLocation: target,
            }).catch((err) => {
              console.error(
                "Gagal memuat permintaan stok produksi:",
                err?.message || err,
              );
              return null;
            }),
          ),
        );
        if (!active) return;

        const combined = [];
        responses.forEach((data) => {
          if (Array.isArray(data?.items)) {
            combined.push(...data.items);
          }
        });

        const deduped = [];
        const seen = new Set();
        combined.forEach((item, idx) => {
          const id = getStockRequestId(item) || `legacy-${idx}`;
          if (seen.has(id)) return;
          seen.add(id);
          deduped.push(item);
        });

        deduped.sort((a, b) => {
          const aTime = new Date(a?.createdAt || 0).getTime();
          const bTime = new Date(b?.createdAt || 0).getTime();
          return bTime - aTime;
        });

        const total = deduped.length;
        const totalPages = Math.max(1, Math.ceil(total / STOCK_REQUEST_LIMIT));
        const safePage = Math.min(stockRequestPage, totalPages) || 1;
        const startIndexPage = (safePage - 1) * STOCK_REQUEST_LIMIT;
        const paginated = deduped.slice(
          startIndexPage,
          startIndexPage + STOCK_REQUEST_LIMIT,
        );

        setStockRequests(paginated);
        setStockRequestTotalItems(total);
        setStockRequestTotalPages(totalPages);
        if (safePage !== stockRequestPage) {
          setStockRequestPage(safePage);
        }
      } catch (err) {
        if (!active) return;
        console.error(
          "Gagal memuat permintaan stok produksi:",
          err?.message || err,
        );
      } finally {
        if (active) {
          setStockRequestsLoading(false);
        }
      }
    }
    loadStockRequests();
    return () => {
      active = false;
    };
  }, [warehouseCode, rawLocation, stockRequestPage, stockRequestReloadKey]);

  const refreshStockRequests = useCallback(() => {
    setStockRequestReloadKey((key) => key + 1);
  }, []);

  const isRequestProcessing = (requestId, action) =>
    requestActionState.id === requestId && requestActionState.type === action;

  const handleApproveStockRequest = async (request) => {
    const requestId = getStockRequestId(request);
    if (!requestId) return;
    setRequestActionState({ id: requestId, type: "approve" });
    try {
      await approveProductionStockRequest(requestId);
      toast.success("Permintaan stok produksi disetujui");
      refreshStockRequests();
    } catch (err) {
      console.error("Gagal menyetujui permintaan produksi:", err?.message);
      toast.error(
        err?.response?.data?.message || "Gagal menyetujui permintaan produksi",
      );
    } finally {
      setRequestActionState({ id: null, type: null });
    }
  };

  const handleRejectStockRequest = async (request) => {
    const requestId = getStockRequestId(request);
    if (!requestId) return;
    setRequestActionState({ id: requestId, type: "reject" });
    try {
      await rejectProductionStockRequest(requestId);
      toast.success("Permintaan stok produksi ditolak");
      refreshStockRequests();
    } catch (err) {
      console.error("Gagal menolak permintaan produksi:", err?.message);
      toast.error(
        err?.response?.data?.message || "Gagal menolak permintaan produksi",
      );
    } finally {
      setRequestActionState({ id: null, type: null });
    }
  };

  const handleOpenPartialApproval = (request) => {
    setPartialApprovalRequest(request);
  };

  const handleClosePartialApproval = () => {
    if (partialApprovalSubmitting) return;
    setPartialApprovalRequest(null);
  };

  const handlePartialApprovalSubmit = async (selectedItems) => {
    if (!partialApprovalRequest) return;
    const requestId = getStockRequestId(partialApprovalRequest);
    if (!requestId) return;
    setPartialApprovalSubmitting(true);
    setRequestActionState({ id: requestId, type: "partial" });
    try {
      await approveProductionStockRequest(requestId, { items: selectedItems });
      toast.success("Permintaan stok produksi sebagian disetujui");
      setPartialApprovalRequest(null);
      refreshStockRequests();
    } catch (err) {
      console.error("Gagal menyetujui sebagian permintaan:", err?.message);
      toast.error(
        err?.response?.data?.message ||
          "Gagal menyetujui sebagian permintaan produksi",
      );
    } finally {
      setPartialApprovalSubmitting(false);
      setRequestActionState({ id: null, type: null });
    }
  };

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
            {scopedLocationOptions.map((loc) => (
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
      <div className="mb-6 rounded-2xl border border-indigo-100 bg-white p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-indigo-700">
            <FiInbox />
            Permintaan Stok Produksi
          </div>
          <div className="text-xs text-gray-500">
            {stockRequestsLoading
              ? "Memuat permintaan..."
              : stockRequestTotalItems > 0
                ? `${stockRequestTotalItems} permintaan menunggu`
                : `Belum ada permintaan untuk ${warehouseCode}`}
          </div>
        </div>

        {stockRequestsLoading && stockRequests.length === 0 ? (
          <div className="rounded-lg border border-dashed border-indigo-200 bg-indigo-50/70 px-4 py-3 text-xs text-indigo-700">
            Memuat data permintaan stok produksi...
          </div>
        ) : stockRequests.length === 0 ? (
          <div className="rounded-lg border border-dashed px-4 py-3 text-xs text-gray-500">
            Belum ada pengajuan stok dari lokasi produk lain.
          </div>
        ) : (
          <div className="space-y-4">
            {stockRequests.map((request, idx) => {
              const requestId =
                getStockRequestId(request) || `request-${idx}`;
              const items = Array.isArray(request?.items) ? request.items : [];
              const totalItems = items.length;
              const rejectBusy = isRequestProcessing(requestId, "reject");
              const approveBusy = isRequestProcessing(requestId, "approve");
              const partialBusy = isRequestProcessing(requestId, "partial");
              const isBusy = requestActionState.id === requestId;
              const displayTargetLocation =
                getProductionLocationForRawLocation(request?.targetLocation) ||
                request?.targetLocation ||
                "-";

              return (
                <div
                  key={requestId}
                  className="rounded-xl border bg-white px-4 py-3 text-sm text-gray-700 shadow-sm"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="text-[11px] uppercase tracking-wide text-gray-500">
                        Permintaan dari
                      </div>
                      <div className="text-base font-semibold text-gray-900">
                        {request?.originLocation || "-"}
                      </div>
                      <div className="text-xs text-gray-500">
                        Tujuan: {displayTargetLocation}
                      </div>
                    </div>
                    {totalItems > 0 && (
                      <div className="rounded-full bg-indigo-50 px-3 py-1 text-[11px] font-semibold text-indigo-600">
                        {totalItems} item diminta
                      </div>
                    )}
                  </div>

                  <div className="mt-3 rounded-lg border">
                    <table className="min-w-full text-xs text-gray-700">
                      <thead className="bg-gray-50 text-[11px] uppercase text-gray-500">
                        <tr>
                          <th className="px-3 py-2 text-left">Produk</th>
                          <th className="px-3 py-2 text-right">Jumlah</th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.length === 0 ? (
                          <tr>
                            <td
                              colSpan={2}
                              className="px-3 py-4 text-center text-gray-500"
                            >
                              Tidak ada detail item.
                            </td>
                          </tr>
                        ) : (
                          items.map((item, itemIdx) => (
                            <tr
                              key={`${requestId}-${item.productCode || itemIdx}`}
                              className="border-t last:border-b-0"
                            >
                              <td className="px-3 py-2">
                                <div className="font-mono text-xs text-gray-900">
                                  {item.productCode}
                                </div>
                                <div className="text-[11px] text-gray-500">
                                  {item.productName}
                                </div>
                              </td>
                              <td className="px-3 py-2 text-right font-semibold text-gray-800">
                                {item.quantity}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[11px] text-gray-500">
                    <span>
                      Dibuat:{" "}
                      {request?.createdAt
                        ? new Date(request.createdAt).toLocaleString("id-ID")
                        : "-"}
                    </span>
                    <div className="flex flex-wrap gap-2 text-xs">
                      <button
                        type="button"
                        onClick={() => handleRejectStockRequest(request)}
                        disabled={isBusy}
                        className={`rounded-lg border px-4 py-2 font-medium transition ${
                          rejectBusy
                            ? "cursor-not-allowed border-gray-200 text-gray-400"
                            : "border-red-200 text-red-600 hover:bg-red-50"
                        }`}
                      >
                        {rejectBusy ? "Menolak..." : "Tolak"}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOpenPartialApproval(request)}
                        disabled={isBusy}
                        className={`rounded-lg border px-4 py-2 font-medium transition ${
                          partialBusy
                            ? "cursor-not-allowed border-gray-200 text-gray-400"
                            : "border-indigo-200 text-indigo-600 hover:bg-indigo-50"
                        }`}
                      >
                        {partialBusy ? "Memproses..." : "Setujui Beberapa"}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleApproveStockRequest(request)}
                        disabled={isBusy}
                        className={`rounded-lg px-4 py-2 font-medium text-white transition ${
                          approveBusy
                            ? "cursor-not-allowed bg-gray-300"
                            : "bg-emerald-500 hover:bg-emerald-600"
                        }`}
                      >
                        {approveBusy ? "Menyetujui..." : "Setujui"}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {stockRequestTotalPages > 1 && (
          <div className="mt-4 flex justify-end">
            <Pagination
              currentPage={stockRequestPage}
              totalPages={stockRequestTotalPages}
              onPageChange={setStockRequestPage}
            />
          </div>
        )}
      </div>

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
      {partialApprovalRequest && (
        <PartialApprovalModal
          request={partialApprovalRequest}
          onClose={handleClosePartialApproval}
          onSubmit={handlePartialApprovalSubmit}
          submitting={partialApprovalSubmitting}
        />
      )}
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

function PartialApprovalModal({ request, onClose, onSubmit, submitting }) {
  const [rows, setRows] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!request) return;
    const initialized = (Array.isArray(request.items) ? request.items : []).map(
      (item) => {
        const qty = Number(item.quantity || 0) || 0;
        return {
          productCode: item.productCode,
          productName: item.productName || item.productCode,
          maxQuantity: qty,
          quantityInput: String(qty),
          approved: qty > 0,
        };
      },
    );
    setRows(initialized);
    setError("");
  }, [request]);

  if (!request) return null;

  const handleToggleItem = (code) => {
    setRows((prev) =>
      prev.map((row) =>
        row.productCode === code ? { ...row, approved: !row.approved } : row,
      ),
    );
  };

  const handleQuantityChange = (code, value) => {
    setRows((prev) =>
      prev.map((row) => {
        if (row.productCode !== code) return row;
        if (!value.trim().length) {
          return { ...row, quantityInput: "" };
        }
        const parsed = Number(value);
        if (!Number.isFinite(parsed)) {
          return row;
        }
        const normalized = Math.max(
          1,
          Math.min(row.maxQuantity, Math.floor(parsed)),
        );
        return { ...row, quantityInput: String(normalized) };
      }),
    );
  };

  const selectedSummary = useMemo(() => {
    let totalQty = 0;
    let selectedCount = 0;
    rows.forEach((row) => {
      const qty = Number(row.quantityInput || 0) || 0;
      if (row.approved && qty > 0) {
        selectedCount += 1;
        totalQty += qty;
      }
    });
    return { totalQty, selectedCount };
  }, [rows]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (submitting) return;

    const payload = rows
      .filter((row) => row.approved)
      .map((row) => ({
        productCode: row.productCode,
        quantity: Number(row.quantityInput || 0) || 0,
        maxQuantity: row.maxQuantity,
      }))
      .filter((row) => row.quantity > 0);

    if (!payload.length) {
      setError("Pilih minimal 1 produk untuk disetujui.");
      return;
    }

    const invalid = payload.find(
      (row) => row.quantity > row.maxQuantity || row.quantity < 1,
    );
    if (invalid) {
      setError(
        `Jumlah untuk ${invalid.productCode} harus antara 1 dan ${invalid.maxQuantity}`,
      );
      return;
    }

    setError("");
    onSubmit(
      payload.map((row) => ({
        productCode: row.productCode,
        quantity: row.quantity,
      })),
    );
  };

  const displayTarget =
    getProductionLocationForRawLocation(request.targetLocation) ||
    request.targetLocation ||
    "-";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-3xl rounded-2xl bg-white p-6 shadow-2xl">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-gray-800">
            Setujui Beberapa Produk
          </h2>
          <p className="mt-1 text-xs text-gray-500">
            Memproses permintaan dari{" "}
            <span className="font-semibold text-gray-700">
              {request.originLocation || "-"}
            </span>{" "}
            menuju{" "}
            <span className="font-semibold text-indigo-600">{displayTarget}</span>
            . Nonaktifkan produk yang tidak ingin dikirim atau ubah jumlahnya
            sesuai ketersediaan stok.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="max-h-80 overflow-y-auto rounded-xl border">
            <table className="min-w-full text-xs text-gray-700">
              <thead className="bg-gray-50 text-[11px] uppercase text-gray-500">
                <tr>
                  <th className="px-3 py-2 text-left">Pilih</th>
                  <th className="px-3 py-2 text-left">Produk</th>
                  <th className="px-3 py-2 text-right">Diminta</th>
                  <th className="px-3 py-2 text-right">Disetujui</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-3 py-6 text-center text-gray-500"
                    >
                      Tidak ada item pada permintaan ini.
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => (
                    <tr key={row.productCode} className="border-t last:border-b-0">
                      <td className="px-3 py-2">
                        <label className="inline-flex items-center gap-2 text-xs font-medium text-gray-700">
                          <input
                            type="checkbox"
                            className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                            checked={row.approved}
                            onChange={() => handleToggleItem(row.productCode)}
                          />
                          Pilih
                        </label>
                      </td>
                      <td className="px-3 py-2">
                        <div className="font-mono text-xs text-gray-900">
                          {row.productCode}
                        </div>
                        <div className="text-[11px] text-gray-500">
                          {row.productName || "-"}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right font-semibold text-gray-700">
                        {row.maxQuantity}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <input
                          type="number"
                          min="1"
                          max={row.maxQuantity}
                          value={row.quantityInput}
                          onChange={(e) =>
                            handleQuantityChange(row.productCode, e.target.value)
                          }
                          disabled={!row.approved || row.maxQuantity <= 0}
                          className="w-24 rounded-lg border px-2 py-1 text-right font-semibold text-gray-800 outline-none focus:ring-2 focus:ring-indigo-500/60 disabled:cursor-not-allowed disabled:bg-gray-50"
                        />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-xs text-red-600">
              {error}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-gray-600">
            <div>
              <span className="font-semibold text-gray-800">
                {selectedSummary.selectedCount}
              </span>{" "}
              produk dipilih — total{" "}
              <span className="font-semibold text-gray-800">
                {selectedSummary.totalQty}
              </span>{" "}
              qty
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border px-4 py-2 font-medium text-gray-700 hover:bg-gray-100"
                disabled={submitting}
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="rounded-lg bg-indigo-500 px-4 py-2 font-medium text-white hover:bg-indigo-600 disabled:opacity-60"
              >
                {submitting ? "Menyetujui..." : "Setujui Pilihan"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
