import { Fragment, useEffect, useMemo, useState } from "react";
import {
  FiAlertTriangle,
  FiArrowRight,
  FiBox,
  FiCheckCircle,
  FiFileText,
  FiPlus,
  FiSearch,
  FiX,
} from "react-icons/fi";
import { toast } from "sonner";
import { motion as Motion, AnimatePresence } from "framer-motion";
import Pagination from "../../../components/common/Pagination";
import { WarehousePageShell } from "../../../components/templates/WarehousePageShell";
import EmptyState from "../../../components/common/EmptyState";
import { fetchRawProductsPaged, fetchProductsPaged } from "../api/mockData";
import {
  createProductionRecord,
  fetchProductions,
  fetchProductionBuffer,
  saveProductionBuffer,
  updateProductionQc,
} from "../api/production";
import RawFromInvoiceModal from "./RawFromInvoiceModal";
import {
  RAW_LOCATIONS,
  PRODUCTION_LOCATIONS,
} from "../../../constants/warehouseLocations";
import { getRawLocationForProductionLocation } from "../../../utils/warehouseLocationMap";
import { WAREHOUSE_STORAGE_KEYS } from "../../../constants/warehouseStorageKeys";

function getProductionLabelForRawLocation(rawLocation) {
  const index = RAW_LOCATIONS.indexOf(rawLocation);
  if (index >= 0 && PRODUCTION_LOCATIONS[index]) {
    return PRODUCTION_LOCATIONS[index];
  }
  return rawLocation || "-";
}

function getQcStatusLabel(row) {
  const status = row?.status || "produced";
  if (status === "completed") return "Selesai";
  return "Diproduksi";
}

function getQcStatusColorClasses(row) {
  const status = row?.status || "produced";
  if (status === "completed") {
    return "bg-emerald-50 text-emerald-700 border-emerald-200";
  }
  return "bg-amber-50 text-amber-700 border-amber-200";
}

export default function ProductionPage() {
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const limit = 10;
  const [productions, setProductions] = useState([]);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);
  const [expandedId, setExpandedId] = useState(null);

  const [isRawModalOpen, setIsRawModalOpen] = useState(false);
  const [isProductionModalOpen, setIsProductionModalOpen] = useState(false);
  const [rawCatalog, setRawCatalog] = useState([]);
  const [productCatalog, setProductCatalog] = useState([]);
  const [loadingCatalog, setLoadingCatalog] = useState(false);
  const [bufferRawItems, setBufferRawItems] = useState([]);
  const [bufferInvoiceNumber, setBufferInvoiceNumber] = useState("");

  const [qcTarget, setQcTarget] = useState(null);

  const locationOptions = PRODUCTION_LOCATIONS;
  const [productionLocation, setProductionLocation] = useState(() => {
    if (typeof window === "undefined") {
      return locationOptions[0];
    }
    const saved = window.localStorage.getItem(
      WAREHOUSE_STORAGE_KEYS.productionLocation,
    );
    if (saved && locationOptions.includes(saved)) return saved;
    return locationOptions[0];
  });

  // Lokasi raw (dipakai di backend: invoice, buffer, produksi)
  const rawLocation = getRawLocationForProductionLocation(productionLocation);

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
    async function loadProductions() {
      setLoading(true);
      try {
        const data = await fetchProductions({
          page,
          limit,
          search: debouncedSearch || undefined,
          location: rawLocation,
        });
        if (!active) return;
        setProductions(Array.isArray(data?.items) ? data.items : []);
        setTotalItems(Number(data?.total || 0));
        setTotalPages(Number(data?.pages || 1));
      } catch (err) {
        if (!active) return;
        console.error("Gagal memuat data produksi:", err.message);
        toast.error("Gagal memuat data produksi");
      } finally {
        if (active) setLoading(false);
      }
    }
    loadProductions();
    return () => {
      active = false;
    };
  }, [page, limit, debouncedSearch, reloadKey, rawLocation]);

  useEffect(() => {
    setPage(1);
  }, [productionLocation]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(
      WAREHOUSE_STORAGE_KEYS.productionLocation,
      productionLocation,
    );
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("warehouse:production-location-change", {
          detail: productionLocation,
        }),
      );
    }
  }, [productionLocation]);

  useEffect(() => {
    let active = true;
    async function loadBuffer() {
      try {
        const data = await fetchProductionBuffer(rawLocation);
        if (!active) return;
        const items = Array.isArray(data?.items) ? data.items : [];
        const mapped = items.map((item) => ({
          kode: item.productCode,
          name: item.productName,
          qty: item.quantity,
        }));
        setBufferRawItems(mapped);

        const normalizedInvoice = String(data?.invoiceNumber || "")
          .trim()
          .toUpperCase();
        setBufferInvoiceNumber(normalizedInvoice);
      } catch (err) {
        console.error("Gagal memuat buffer produksi:", err.message);
      }
    }
    loadBuffer();
    return () => {
      active = false;
    };
  }, [rawLocation]);

  const hasAnyProduction = totalItems > 0;
  const startIndex = totalItems ? (page - 1) * limit + 1 : 0;

  const ensureCatalogLoaded = async () => {
    if (rawCatalog.length || productCatalog.length || loadingCatalog) return;
    try {
      setLoadingCatalog(true);
      const [rawRes, prodRes] = await Promise.all([
        fetchRawProductsPaged({ page: 1, limit: 100 }),
        fetchProductsPaged({ page: 1, limit: 100 }),
      ]);
      setRawCatalog(Array.isArray(rawRes?.items) ? rawRes.items : []);
      setProductCatalog(Array.isArray(prodRes?.items) ? prodRes.items : []);
    } catch (err) {
      console.error("Gagal memuat katalog produksi:", err.message);
      toast.error("Gagal memuat katalog bahan baku / produk");
    } finally {
      setLoadingCatalog(false);
    }
  };

  const handleOpenRawModal = async () => {
    await ensureCatalogLoaded();
    setIsRawModalOpen(true);
  };

  const handleOpenProductionModal = async () => {
    if (bufferRawItems.length === 0) {
      toast.error("Silakan ambil bahan baku dari invoice terlebih dahulu");
      return;
    }
    await ensureCatalogLoaded();
    setIsProductionModalOpen(true);
  };

  const handleCreated = async ({ remainingBufferItems }) => {
    setIsProductionModalOpen(false);
    setReloadKey((key) => key + 1);

    setBufferRawItems(remainingBufferItems || []);

    const nextInvoice =
      Array.isArray(remainingBufferItems) && remainingBufferItems.length > 0
        ? bufferInvoiceNumber
        : "";

    setBufferInvoiceNumber(nextInvoice);

    saveProductionBuffer(remainingBufferItems || [], rawLocation, nextInvoice).catch(
      (err) => {
        console.error("Gagal memperbarui buffer produksi:", err.message);
      }
    );

    toast.success("Produksi berhasil disimpan");
  };

  const handleQcSaved = () => {
    setQcTarget(null);
    setReloadKey((key) => key + 1);
    toast.success("QC produksi berhasil disimpan");
  };

  return (
    <WarehousePageShell
      title="Produksi"
      icon={FiBox}
      headerBelow={
        <div className="flex flex-wrap items-center gap-2 text-xs text-gray-700">
          <span className="font-medium">Lokasi:</span>
          <select
            value={productionLocation}
            onChange={(e) => setProductionLocation(e.target.value)}
            className="rounded-lg border bg-white px-3 py-1 text-xs text-gray-700 hover:bg-gray-50"
          >
            {locationOptions.map((loc) => (
              <option key={loc} value={loc}>
                {loc}
              </option>
            ))}
          </select>
          <span className="text-[11px] text-gray-400">
            Pilih lokasi produksi. Invoice yang bisa diklaim harus dari lokasi
            bahan baku yang sesuai.
          </span>
        </div>
      }
      headerRight={
        <div className="flex w-full flex-col gap-3 md:w-auto md:flex-row md:items-center">
          <div className="relative flex-grow max-w-md">
            <input
              type="text"
              placeholder="Cari nomor produksi atau kode..."
              className="w-full pl-10 pr-4 py-2 border rounded-lg"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <FiSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
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

          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleOpenRawModal}
              className="flex items-center justify-center gap-2 rounded-lg bg-blue-500 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-600"
            >
              <FiPlus /> Barang Masuk (Invoice)
            </button>
            <button
              type="button"
              onClick={handleOpenProductionModal}
              className="flex items-center justify-center gap-2 rounded-lg bg-red-500 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-red-600"
            >
              <FiCheckCircle /> Produksi
            </button>
          </div>
        </div>
      }
    >
      {bufferRawItems.length > 0 && (
        <div className="mb-6 rounded-xl border bg-white p-4 shadow-sm">
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
              <FiArrowRight className="text-amber-500" />
              Bahan Baku Produksi
            </div>
            {bufferInvoiceNumber && (
              <div className="rounded-full bg-gray-100 px-3 py-1 text-[11px] text-gray-600">
                Invoice buffer:{" "}
                <span className="font-mono font-semibold">
                  {bufferInvoiceNumber}
                </span>
              </div>
            )}
          </div>
          <div className="max-h-64 overflow-y-auto rounded-lg border">
            <table className="min-w-full text-xs text-gray-700">
              <thead className="bg-gray-50 text-[11px] uppercase text-gray-500">
                <tr>
                  <th className="px-3 py-2 text-left">Kode</th>
                  <th className="px-3 py-2 text-left">Nama</th>
                  <th className="px-3 py-2 text-right">Qty Invoice</th>
                </tr>
              </thead>
              <tbody>
                {bufferRawItems.map((it) => (
                  <tr key={it.kode} className="border-t last:border-b">
                    <td className="px-3 py-1 font-mono text-xs">{it.kode}</td>
                    <td className="px-3 py-1 text-xs">{it.name || "-"}</td>
                    <td className="px-3 py-1 text-right">{it.qty}</td>
                  </tr>
                ))}
              </tbody>
            </table>
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
          <p className="text-sm font-medium">Memuat history produksi...</p>
        </div>
      ) : !hasAnyProduction && !searchTerm ? (
        <EmptyState
          title="Belum ada data produksi"
          description="Catat proses produksi pertama agar stok produk jadi dan bahan baku selalu akurat."
          buttonText="Barang Masuk (Invoice)"
          onButtonClick={handleOpenRawModal}
          illustration="box"
        />
      ) : !hasAnyProduction && searchTerm ? (
        <EmptyState
          title="Produksi tidak ditemukan"
          description="Coba ubah kata kunci pencarian atau reset filter."
          buttonText="Reset Pencarian"
          onButtonClick={() => setSearchTerm("")}
          illustration="search"
        />
      ) : (
        <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
          <table className="min-w-full border-collapse text-sm text-gray-700">
            <thead className="bg-gray-100 text-xs uppercase text-gray-600">
              <tr>
                <th className="w-12 p-3 text-center" />
                <th className="p-3 text-left">Nomor Produksi</th>
                <th className="p-3 text-left">Lokasi</th>
                <th className="p-3 text-left">Tanggal</th>
                <th className="p-3 text-left">Total Bahan Keluar</th>
                <th className="p-3 text-left">Total Produk Jadi</th>
                <th className="p-3 text-left">Status</th>
              </tr>
            </thead>
            <tbody>
              <AnimatePresence initial={false}>
                {productions.map((row) => {
                  const isExpanded = expandedId === row._id;
                  const date = row.date
                    ? new Date(row.date).toLocaleString("id-ID")
                    : "-";
                  const statusLabel = getQcStatusLabel(row);
                  const statusClass = getQcStatusColorClasses(row);
                  const isCompleted = (row?.status || "produced") === "completed";
                  const qcItems = Array.isArray(row.qcItems) ? row.qcItems : [];

                  return (
                    <Fragment key={row._id}>
                      <Motion.tr
                        layout
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{ duration: 0.15 }}
                        className="border-t hover:bg-gray-50"
                      >
                        <td className="p-3 text-center">
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedId(isExpanded ? null : row._id)
                            }
                            className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-gray-300 bg-white text-gray-600 hover:bg-gray-100"
                          >
                            {isExpanded ? "−" : "+"}
                          </button>
                        </td>
                        <td className="p-3 font-semibold text-gray-800">
                          {row.productionNumber}
                        </td>
                        <td className="p-3 text-gray-600">
                          {getProductionLabelForRawLocation(row.location)}
                        </td>
                        <td className="p-3 text-gray-600">{date}</td>
                        <td className="p-3 text-left font-semibold">
                          {row.totalOutQuantity}
                        </td>
                        <td className="p-3 text-left font-semibold">
                          {row.totalInQuantity}
                        </td>
                        <td className="p-3 text-left">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium ${statusClass}`}
                          >
                            <span className="inline-block h-1.5 w-1.5 rounded-full bg-current" />
                            {statusLabel}
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
                            transition={{ duration: 0.3 }}
                          >
                            <td colSpan={7} className="bg-gray-50 p-4">
                              <Motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                transition={{ duration: 0.25 }}
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
                                        <th className="px-3 py-2 text-left">
                                          Kode
                                        </th>
                                        <th className="px-3 py-2 text-left">
                                          Nama
                                        </th>
                                        <th className="px-3 py-2 text-right">
                                          Qty
                                        </th>
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
                                        <th className="px-3 py-2 text-left">
                                          Kode
                                        </th>
                                        <th className="px-3 py-2 text-left">
                                          Nama
                                        </th>
                                        <th className="px-3 py-2 text-right">
                                          Qty
                                        </th>
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

                                {/* QC card */}
                                <div className="flex flex-col justify-between rounded-lg border bg-white p-4 md:col-span-1">
                                  <div>
                                    <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-700">
                                      <FiAlertTriangle className="text-amber-500" />
                                      QC Produksi
                                    </div>

                                    {isCompleted ? (
                                      <div className="space-y-2 text-xs text-gray-600">
                                        <div className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700">
                                          <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                          QC selesai
                                        </div>

                                        <div className="mt-2 rounded-lg bg-gray-50 p-3 text-xs">
                                          <div className="mb-1 font-semibold text-gray-700">
                                            Hasil QC per Produk
                                          </div>
                                          {qcItems.length === 0 ? (
                                            <div className="text-[11px] text-gray-500">
                                              Data QC tidak tersedia.
                                            </div>
                                          ) : (
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
                                          )}
                                        </div>
                                      </div>
                                    ) : (
                                      <div className="space-y-2 text-xs text-gray-600">
                                        <p className="text-[11px] text-gray-500">
                                          Atur jumlah produk jadi OK per kode.
                                          Sisa jumlah akan otomatis dihitung
                                          sebagai{" "}
                                          <span className="font-semibold text-red-500">
                                            produk gagal
                                          </span>
                                          .
                                        </p>
                                      </div>
                                    )}
                                  </div>

                                  {!isCompleted && (
                                    <div className="mt-3 flex justify-end">
                                      <button
                                        type="button"
                                        onClick={() => setQcTarget(row)}
                                        className="inline-flex items-center gap-1 rounded-lg bg-amber-500 px-3 py-2 text-xs font-medium text-white hover:bg-amber-600"
                                      >
                                        <FiAlertTriangle />
                                        QC Produksi
                                      </button>
                                    </div>
                                  )}
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
      )}

      {!loading && totalPages > 1 && (
        <div className="mt-6 flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="text-sm text-gray-600">
            Menampilkan {startIndex} - {Math.min(page * limit, totalItems)} dari{" "}
            {totalItems} produksi
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

      <ProductionModal
        isOpen={isProductionModalOpen}
        onClose={() => setIsProductionModalOpen(false)}
        onSuccess={handleCreated}
        initialRawItems={bufferRawItems}
        rawCatalog={rawCatalog}
        productCatalog={productCatalog}
        loadingCatalog={loadingCatalog}
        location={rawLocation}
      />

      <RawFromInvoiceModal
        isOpen={isRawModalOpen}
        onClose={() => setIsRawModalOpen(false)}
        rawLocation={rawLocation}
        onLoaded={({ invoiceNumber, rawItems }) => {
          const normalizedInvoice = String(invoiceNumber || "")
            .trim()
            .toUpperCase();
          const sanitizedItems = (Array.isArray(rawItems) ? rawItems : []).map(
            (item) => ({
              kode: (item.kode || item.productCode || "").toUpperCase(),
              name: item.name || item.productName || "",
              qty: Number(item.qty ?? item.quantity ?? 0) || 0,
            }),
          );
          setBufferInvoiceNumber(normalizedInvoice);
          setBufferRawItems(sanitizedItems);
          saveProductionBuffer(sanitizedItems, rawLocation, normalizedInvoice).catch(
            (err) => {
              console.error("Gagal menyimpan buffer produksi:", err.message);
            },
          );
        }}
      />

      {qcTarget && (
        <ProductionQcModal
          production={qcTarget}
          onClose={() => setQcTarget(null)}
          onSaved={handleQcSaved}
        />
      )}
    </WarehousePageShell>
  );
}

function ProductionQcModal({ production, onClose, onSaved }) {
  if (!production) return null;

  const finishedItems = (production.items || []).filter(
    (it) => it.direction === "in"
  );

  const [rows, setRows] = useState(() =>
    finishedItems.map((it) => ({
      productCode: it.productCode,
      productName: it.productName,
      total: Number(it.quantity || 0) || 0,
      ok: Number(it.quantity || 0) || 0,
    }))
  );

  const [submitting, setSubmitting] = useState(false);

  const handleChangeOk = (code, value) => {
    setRows((prev) =>
      prev.map((row) => {
        if (row.productCode !== code) return row;
        const num = Number(value || 0);
        let safe = Number.isNaN(num) ? 0 : num;
        if (safe < 0) safe = 0;
        if (safe > row.total) safe = row.total;
        return { ...row, ok: safe };
      })
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!rows.length) {
      toast.error("Tidak ada produk jadi untuk di-QC");
      return;
    }

    const confirmed = window.confirm(
      "Pastikan jumlah produk OK sudah benar. Setelah QC disimpan, data tidak bisa diubah lagi. Lanjutkan?"
    );
    if (!confirmed) return;

    try {
      setSubmitting(true);
      const qcItems = rows.map((row) => ({
        productCode: row.productCode,
        okQuantity: row.ok,
      }));

      await updateProductionQc(production._id, qcItems);
      toast.success("QC produksi berhasil disimpan");
      onSaved?.();
    } catch (err) {
      console.error("Gagal menyimpan QC:", err?.message);
      toast.error(
        err?.response?.data?.message || "Gagal menyimpan QC produksi"
      );
    } finally {
      setSubmitting(false);
    }
  };

  const totalAll = rows.reduce((sum, r) => sum + (r.total || 0), 0);
  const totalOk = rows.reduce((sum, r) => sum + (r.ok || 0), 0);
  const totalReject = rows.reduce(
    (sum, r) => sum + (r.total - r.ok || 0),
    0
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-2xl rounded-2xl bg-white p-5 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-800">
              <FiCheckCircle className="text-amber-500" />
              QC Produksi
            </h2>
            <p className="text-xs text-gray-500">
              Atur jumlah produk jadi OK per kode. Sisa akan otomatis dihitung
              sebagai produk gagal.
            </p>
            <p className="mt-1 text-[11px] text-gray-500">
              Nomor produksi:{" "}
              <span className="font-mono font-semibold">
                {production.productionNumber}
              </span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-gray-300 p-1 text-gray-500 hover:bg-gray-100"
          >
            <FiX />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-sm">
          <div className="max-h-72 overflow-y-auto rounded-lg border">
            <table className="min-w-full text-xs text-gray-700">
              <thead className="bg-gray-50 text-[11px] uppercase text-gray-500">
                <tr>
                  <th className="px-3 py-2 text-left">Kode Produk</th>
                  <th className="px-3 py-2 text-left">Nama</th>
                  <th className="px-3 py-2 text-right">Total</th>
                  <th className="px-3 py-2 text-right">Produk OK</th>
                  <th className="px-3 py-2 text-right">Produk Gagal</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const reject = row.total - row.ok;
                  return (
                    <tr
                      key={row.productCode}
                      className="border-t last:border-b"
                    >
                      <td className="px-3 py-1 font-mono text-xs">
                        {row.productCode}
                      </td>
                      <td className="px-3 py-1 text-xs">
                        {row.productName || "-"}
                      </td>
                      <td className="px-3 py-1 text-right">{row.total}</td>
                      <td className="px-3 py-1 text-right">
                        <input
                          type="number"
                          min="0"
                          max={row.total}
                          value={row.ok}
                          onChange={(e) =>
                            handleChangeOk(row.productCode, e.target.value)
                          }
                          className="w-20 rounded-lg border px-2 py-1 text-right text-xs outline-none focus:ring-2 focus:ring-amber-500/60"
                        />
                      </td>
                      <td className="px-3 py-1 text-right text-red-500">
                        {reject}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="mt-3 flex justify-between text-xs text-gray-500">
            <span>Total produk: {totalAll}</span>
            <span>
              Total OK: {totalOk} • Total gagal: {totalReject}
            </span>
          </div>

          <div className="mt-2 rounded-lg bg-amber-50 p-3 text-[11px] text-amber-700">
            <div className="mb-1 flex items-center gap-1 font-semibold">
              <FiAlertTriangle className="h-3 w-3" />
              Perhatian
            </div>
            <p>
              Setelah QC disimpan, status produksi akan menjadi{" "}
              <span className="font-semibold">SELESAI</span> dan tidak dapat
              diubah kembali.
            </p>
          </div>

          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border px-4 py-2 text-xs font-medium text-gray-700 hover:bg-gray-100"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-xs font-medium text-white hover:bg-amber-600 disabled:opacity-60"
            >
              <FiCheckCircle />
              {submitting ? "Menyimpan QC..." : "Simpan QC"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ProductionModal({
  isOpen,
  onClose,
  onSuccess,
  initialRawItems,
  rawCatalog, // belum dipakai tapi disiapkan
  productCatalog,
  loadingCatalog, // belum dipakai tapi disiapkan
  location,
}) {
  const [productionNumber, setProductionNumber] = useState("");
  const [rawItems, setRawItems] = useState([]); // { kode, name, invoiceQty, qty }
  const [finishedItems, setFinishedItems] = useState([]); // { kode, name, qty }
  const [finishedCode, setFinishedCode] = useState("");
  const [finishedQty, setFinishedQty] = useState("");
  const [finishedOpen, setFinishedOpen] = useState(false);
  const [packagingCode, setPackagingCode] = useState("");
  const [packagingQty, setPackagingQty] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const normalizedRawSource = useMemo(() => {
    if (!Array.isArray(initialRawItems)) return [];
    return initialRawItems.map((item) => ({
      kode: (item.kode || "").toUpperCase(),
      name: item.name || "",
      invoiceQty: Number(item.qty || 0) || 0,
    }));
  }, [initialRawItems]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const timer =
      typeof window === "undefined"
        ? null
        : window.setTimeout(() => {
            setProductionNumber("");
            setRawItems(
              normalizedRawSource.map((item) => ({
                ...item,
                qty: item.invoiceQty,
              })),
            );
            setFinishedItems([]);
            setFinishedCode("");
            setFinishedQty("");
            setFinishedOpen(false);
            setPackagingCode("");
            setPackagingQty("");
          }, 0);
    return () => {
      if (timer) window.clearTimeout(timer);
    };
  }, [isOpen, normalizedRawSource]);

  const handleGenerateProductionNumber = () => {
    const auto = `PRD-${Date.now().toString(36).toUpperCase()}`;
    setProductionNumber(auto);
  };

  const handleRawQtyChange = (kode, value) => {
    const safeCode = (kode || "").toUpperCase();
    const parsed = Number(value);
    const qty = Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
    let limited = false;
    let maxAllowed = 0;
    setRawItems((prev) =>
      prev.map((item) => {
        if (item.kode !== safeCode) return item;
        const max = item.invoiceQty ?? 0;
        maxAllowed = max;
        if (qty > max) {
          limited = true;
          return item;
        }
        return { ...item, qty };
      }),
    );
    if (limited) {
      toast.error(
        `Jumlah bahan baku ${safeCode} tidak boleh melebihi qty invoice (${maxAllowed})`,
      );
    }
  };

  const handleResetRawFromInvoice = () => {
    setRawItems(
      normalizedRawSource.map((item) => ({
        ...item,
        qty: item.invoiceQty,
      })),
    );
  };

  const handleAddFinished = () => {
    const code = finishedCode.trim().toUpperCase();
    const qty = Number(finishedQty || 0);
    if (!code || qty <= 0) {
      toast.error("Masukkan kode dan jumlah produk jadi yang valid");
      return;
    }

    setFinishedItems((prev) => {
      const existing = prev.find((it) => it.kode === code);
      if (existing) {
        return prev.map((it) =>
          it.kode === code ? { ...it, qty: it.qty + qty } : it,
        );
      }
      const catalog = productCatalog || [];
      const found = catalog.find((p) => p.code === code);
      return [
        ...prev,
        {
          kode: code,
          qty,
          name: found?.name || "",
        },
      ];
    });

    setFinishedCode("");
    setFinishedQty("");
  };

  const computeRemainingBuffer = (allBufferItems, usedItems) => {
    const mapInitial = new Map();

    (Array.isArray(allBufferItems) ? allBufferItems : []).forEach((it) => {
      const code = String(it.kode || "").trim().toUpperCase();
      if (!code) return;
      const qty = Number(it.qty || 0) || 0;
      const name = it.name || "";
      const current = mapInitial.get(code);
      mapInitial.set(code, {
        kode: code,
        name,
        qty: (current?.qty || 0) + qty,
      });
    });

    const mapUsed = new Map();
    (Array.isArray(usedItems) ? usedItems : []).forEach((it) => {
      const code = String(it.kode || "").trim().toUpperCase();
      if (!code) return;
      const qty = Number(it.qty || 0) || 0;
      const current = mapUsed.get(code) || 0;
      mapUsed.set(code, current + qty);
    });

    const remaining = [];
    mapInitial.forEach((val, code) => {
      const used = mapUsed.get(code) || 0;
      const left = val.qty - used;
      if (left > 0) {
        remaining.push({
          kode: code,
          name: val.name,
          qty: left,
        });
      }
    });

    return remaining;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!productionNumber.trim()) {
      toast.error("Nomor produksi wajib diisi");
      return;
    }

    if (!location) {
      toast.error("Lokasi produksi tidak ditemukan");
      return;
    }

    const selectedRawItems = rawItems.filter((item) => item.qty > 0);
    if (!selectedRawItems.length || !finishedItems.length) {
      toast.error("Minimal 1 bahan baku dan 1 produk jadi");
      return;
    }

    try {
      setSubmitting(true);

      await createProductionRecord({
        productionNumber: productionNumber.trim(),
        location,
        rawItems: selectedRawItems.map((item) => ({
          kode: item.kode,
          qty: item.qty,
          name: item.name,
        })),
        finishedItems,
      });

      const remainingBufferItems = computeRemainingBuffer(
        initialRawItems,
        selectedRawItems,
      );

      onSuccess?.({ remainingBufferItems });
    } catch (err) {
      console.error("Gagal menyimpan produksi:", err.message);
      toast.error(err?.response?.data?.message || "Gagal menyimpan produksi");
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const usedRawCount = rawItems.filter((item) => item.qty > 0).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-3xl rounded-2xl bg-white p-5 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-800">
              <FiFileText className="text-red-500" /> Produksi Baru
            </h2>
            <p className="text-xs text-gray-500">
              Catat pemakaian bahan baku dan hasil produk jadi dalam satu
              transaksi.
            </p>
            {location && (
              <p className="mt-1 text-[11px] text-gray-500">
                Lokasi produksi:{" "}
                <span className="font-mono font-semibold">{location}</span>
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-gray-300 p-1 text-gray-500 hover:bg-gray-100"
          >
            <FiX />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-sm">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-lg border bg-gray-50 p-3 text-xs text-gray-600">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="font-semibold text-gray-700">
                    Bahan Baku Dipakai
                  </div>
                  <p className="text-[11px] text-gray-500">
                    Data di bawah otomatis diambil dari buffer produksi lokasi
                    ini. Sesuaikan jumlah yang dipakai.
                  </p>
                </div>
                {rawItems.length > 0 && (
                  <button
                    type="button"
                    onClick={handleResetRawFromInvoice}
                    className="rounded-lg border px-3 py-1 text-[11px] font-medium text-gray-700 hover:bg-gray-100"
                  >
                    Reset Qty Invoice
                  </button>
                )}
              </div>

              <div className="max-h-64 overflow-y-auto rounded-lg border bg-white">
                {rawItems.length === 0 ? (
                  <div className="p-3 text-xs text-gray-500">
                    Belum ada bahan baku di buffer. Silakan ambil dari invoice
                    stok keluar.
                  </div>
                ) : (
                  <table className="min-w-full text-xs text-gray-700">
                    <thead className="bg-gray-50 text-[11px] uppercase text-gray-500">
                      <tr>
                        <th className="px-3 py-2 text-left">Kode</th>
                        <th className="px-3 py-2 text-left">Nama</th>
                        <th className="px-3 py-2 text-right">Qty Invoice</th>
                        <th className="px-3 py-2 text-right">Dipakai</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rawItems.map((it) => (
                        <tr key={it.kode} className="border-t last:border-b">
                          <td className="px-3 py-1 font-mono text-xs">
                            {it.kode}
                          </td>
                          <td className="px-3 py-1 text-xs">{it.name || "-"}</td>
                          <td className="px-3 py-1 text-right">
                            {it.invoiceQty}
                          </td>
                          <td className="px-3 py-1 text-right">
                            <input
                              type="number"
                              min="0"
                              max={it.invoiceQty}
                              step="1"
                              value={it.qty}
                              onChange={(e) =>
                                handleRawQtyChange(it.kode, e.target.value)
                              }
                              className="w-24 rounded border px-2 py-1 text-right text-xs outline-none focus:ring-2 focus:ring-red-500/60"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-1">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">
                  Nomor Produksi
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={productionNumber}
                    onChange={(e) => setProductionNumber(e.target.value)}
                    className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-red-500/60"
                    placeholder="Contoh: PRD-00123"
                  />
                  <button
                    type="button"
                    onClick={handleGenerateProductionNumber}
                    className="whitespace-nowrap rounded-lg border px-3 py-2 text-[11px] font-medium text-gray-700 hover:bg-gray-100"
                    title="Generate nomor produksi otomatis"
                  >
                    Auto
                  </button>
                </div>
              </div>

              <div className="space-y-2 rounded-lg border bg-gray-50 p-3 text-xs text-gray-600">
                <div className="font-semibold text-gray-700">Kemasan</div>
                <div className="grid grid-cols-[2fr,1fr] items-end gap-3">
                  <div>
                    <label className="mb-1 block text-[11px] font-medium text-gray-700">
                      Kode Kemasan (dummy)
                    </label>
                    <select
                      value={packagingCode}
                      onChange={(e) => setPackagingCode(e.target.value)}
                      className="w-full rounded-lg border px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-red-500/60"
                    >
                      <option value="">Pilih kemasan</option>
                      <option value="KMS-250">KMS-250 - Botol 250ml</option>
                      <option value="KMS-500">KMS-500 - Botol 500ml</option>
                      <option value="KMS-REFILL">KMS-REFILL - Refill</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-medium text-gray-700">
                      Jumlah Kemasan
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={packagingQty}
                      onChange={(e) => setPackagingQty(e.target.value)}
                      className="w-full rounded-lg border px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-red-500/60"
                    />
                  </div>
                </div>
                <p className="text-[10px] text-gray-400">
                  Data kemasan ini masih dummy (belum tersimpan ke database).
                </p>
              </div>

              <div className="grid grid-cols-[2fr,1fr,auto] items-end gap-3">
                <div className="relative">
                  <label className="mb-1 block text-xs font-medium text-gray-700">
                    Kode Produk Jadi
                  </label>
                  <input
                    type="text"
                    value={finishedCode}
                    onChange={(e) => {
                      const next = e.target.value.toUpperCase();
                      setFinishedCode(next);
                      setFinishedOpen(next.trim().length >= 3);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        // biasanya user pilih dari dropdown dulu
                      }
                    }}
                    className="w-full rounded-lg border px-3 py-2 text-sm font-mono outline-none focus:ring-2 focus:ring-red-500/60"
                    placeholder="Ketik minimal 3 karakter kode / nama"
                  />

                  {finishedOpen && finishedCode.trim().length >= 3 && (
                    <div className="absolute z-20 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border bg-white text-xs shadow-lg">
                      {(() => {
                        const q = finishedCode.trim().toUpperCase();

                        const allMatched = (productCatalog || []).filter(
                          (item) => {
                            const code = (item.code || "").toUpperCase();
                            const name = (item.name || "").toUpperCase();
                            return code.includes(q) || name.includes(q);
                          }
                        );

                        const byLocation = allMatched.filter((item) => {
                          if (!location) return true;
                          const stocks = Array.isArray(item.stocks)
                            ? item.stocks
                            : [];
                          if (!stocks.length) return false;
                          const locKey = String(location || "").toUpperCase();
                          return stocks.some((s) => {
                            const loc = String(s.location || "").toUpperCase();
                            const qty = Number(s.quantity || 0) || 0;
                            return loc === locKey && qty > 0;
                          });
                        });

                        const toShow =
                          byLocation.length > 0 ? byLocation : allMatched;

                        if (toShow.length === 0) {
                          return (
                            <div className="px-3 py-2 text-gray-500">
                              Tidak ada produk jadi yang cocok.
                            </div>
                          );
                        }

                        return toShow.map((item) => (
                          <button
                            key={item.code}
                            type="button"
                            className="flex w-full items-center justify-between border-b px-3 py-2 text-left hover:bg-gray-50"
                            onClick={() => {
                              setFinishedCode(item.code || "");
                              if (!finishedQty) {
                                setFinishedQty("1");
                              }
                              setFinishedOpen(false);
                            }}
                          >
                            <span className="font-mono text-gray-800">
                              {item.code}
                            </span>
                            <span className="truncate pl-3 text-[11px] text-gray-500">
                              {item.name}
                            </span>
                          </button>
                        ));
                      })()}
                    </div>
                  )}
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-700">
                    Jumlah
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={finishedQty}
                    onChange={(e) => setFinishedQty(e.target.value)}
                    className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-red-500/60"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleAddFinished}
                  className="mb-0.5 inline-flex items-center justify-center rounded-lg bg-emerald-500 px-3 py-2 text-xs font-medium text-white hover:bg-emerald-600"
                >
                  Tambah
                </button>
              </div>

              <div className="max-h-52 overflow-y-auto rounded-lg border">
                {finishedItems.length === 0 ? (
                  <div className="p-3 text-xs text-gray-500">
                    Belum ada produk jadi. Isi kode dan jumlah lalu klik Tambah.
                  </div>
                ) : (
                  <table className="min-w-full text-xs text-gray-700">
                    <thead className="bg-gray-50 text-[11px] uppercase text-gray-500">
                      <tr>
                        <th className="px-3 py-2 text-left">Kode</th>
                        <th className="px-3 py-2 text-left">Nama</th>
                        <th className="px-3 py-2 text-right">Qty</th>
                        <th className="px-3 py-2" />
                      </tr>
                    </thead>
                    <tbody>
                      {finishedItems.map((it) => (
                        <tr key={it.kode} className="border-t last:border-b">
                          <td className="px-3 py-1 font-mono text-xs">
                            {it.kode}
                          </td>
                          <td className="px-3 py-1 text-xs">
                            {it.name || "-"}
                          </td>
                          <td className="px-3 py-1 text-right">{it.qty}</td>
                          <td className="px-3 py-1 text-center">
                            <button
                              type="button"
                              onClick={() =>
                                setFinishedItems((prev) =>
                                  prev.filter((p) => p.kode !== it.kode)
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

              <div className="mt-3 flex justify-end text-xs text-gray-500">
                <span>
                  Total bahan baku dipakai: {usedRawCount} • Total produk:{" "}
                  {finishedItems.length}
                </span>
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
                  disabled={submitting}
                  className="inline-flex items-center gap-2 rounded-lg bg-red-500 px-4 py-2 text-xs font-medium text-white hover:bg-red-600 disabled:opacity-60"
                >
                  <FiCheckCircle />
                  {submitting ? "Menyimpan..." : "Simpan Produksi"}
                </button>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
