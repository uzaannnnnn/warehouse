import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
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
import {
  fetchRawProductsPaged,
  fetchProductsPaged,
  fetchPackagingProductsPaged,
} from "../api/mockData";
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
import {
  getRawLocationForProductionLocation,
  getPackagingLocationForProductionLocation,
} from "../../../utils/warehouseLocationMap";
import { WAREHOUSE_STORAGE_KEYS } from "../../../constants/warehouseStorageKeys";

const STEP_LABELS = ["Bahan Baku", "Produk & Review"];
const DUMMY_PACKAGING_OPTIONS = [
  { code: "PKG-BOX-SM", name: "Kotak Kecil 250gr" },
  { code: "PKG-BOX-MED", name: "Kotak Sedang 500gr" },
  { code: "PKG-BAG-LG", name: "Pouch Besar 1kg" },
];
const MIN_RAW_SEARCH_LENGTH = 3;
const MIN_FINISHED_SEARCH_LENGTH = 3;
const MAX_RAW_SUGGESTIONS = 20;
const MAX_FINISHED_SUGGESTIONS = 30;
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
  const [packagingCatalog, setPackagingCatalog] = useState([]);
  const [packagingCatalogLocation, setPackagingCatalogLocation] = useState(null);
  const [loadingCatalog, setLoadingCatalog] = useState(false);
  const [bufferRawItems, setBufferRawItems] = useState([]);
  const [bufferInvoiceNumber, setBufferInvoiceNumber] = useState("");
  const [inlineQcDraft, setInlineQcDraft] = useState({});

  const locationOptions = PRODUCTION_LOCATIONS;
  const [productionLocation, setProductionLocation] = useState(() => {
    if (typeof window === "undefined") {
      return locationOptions[0];
    }
    const saved = window.localStorage.getItem(
      WAREHOUSE_STORAGE_KEYS.productionLocation
    );
    if (saved && locationOptions.includes(saved)) return saved;
    return locationOptions[0];
  });

  // Lokasi raw (dipakai di backend: invoice, buffer, produksi)
  const rawLocation = getRawLocationForProductionLocation(productionLocation);
  const packagingLocation =
    getPackagingLocationForProductionLocation(productionLocation);

  const rawCategoryMap = useMemo(() => {
    const map = new Map();
    (Array.isArray(rawCatalog) ? rawCatalog : []).forEach((raw) => {
      const code = String(raw.code || raw.productCode || "").toUpperCase();
      if (!code) return;
      if (!map.has(code)) {
        map.set(code, raw.category || "-");
      }
    });
    return map;
  }, [rawCatalog]);

  const getCategoryForCode = useCallback(
    (code, fallback = "-") => {
      const normalized = String(code || "").trim().toUpperCase();
      if (!normalized) return fallback || "-";
      return rawCategoryMap.get(normalized) || fallback || "-";
    },
    [rawCategoryMap],
  );

  const mergeBufferItems = useCallback(
    (currentItems, newItems) => {
      const map = new Map();
      (Array.isArray(currentItems) ? currentItems : []).forEach((item) => {
        const code = String(item.kode || item.productCode || "").toUpperCase();
        if (!code) return;
        const qty = Number(item.qty ?? item.quantity ?? 0) || 0;
        map.set(code, {
          kode: code,
          name: item.name || item.productName || "",
          qty,
          category: item.category || getCategoryForCode(code, "-"),
        });
      });
      (Array.isArray(newItems) ? newItems : []).forEach((item) => {
        const code = String(item.kode || item.productCode || "").toUpperCase();
        if (!code) return;
        const qty = Number(item.qty ?? item.quantity ?? 0) || 0;
        const existing = map.get(code);
        map.set(code, {
          kode: code,
          name: item.name || item.productName || existing?.name || "",
          qty: (existing?.qty || 0) + qty,
          category:
            item.category ||
            item.productCategory ||
            existing?.category ||
            getCategoryForCode(code, "-"),
        });
      });
      return Array.from(map.values());
    },
    [getCategoryForCode],
  );

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
          status: "produced",
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
    if (rawCatalog.length) return;
    let active = true;
    async function preloadRawCatalog() {
      try {
        const rawRes = await fetchRawProductsPaged({ page: 1, limit: 500 });
        if (!active) return;
        setRawCatalog(Array.isArray(rawRes?.items) ? rawRes.items : []);
      } catch (err) {
        console.error("Gagal memuat data kategori bahan baku:", err?.message);
      }
    }
    preloadRawCatalog();
    return () => {
      active = false;
    };
  }, [rawCatalog.length]);

  useEffect(() => {
    setInlineQcDraft((prev) => {
      const next = {};
      productions.forEach((prod) => {
        if ((prod?.status || "produced") !== "produced") {
          return;
        }
        const finished = Array.isArray(prod.items)
          ? prod.items.filter((it) => it.direction === "in")
          : [];
        if (!finished.length) return;
        const current = prev[prod._id] || {};
        next[prod._id] = {};
        finished.forEach((item) => {
          const code = item.productCode;
          if (!code) return;
          const total = Number(item.quantity || 0) || 0;
          let value =
            current[code] !== undefined ? Number(current[code]) : total;
          if (!Number.isFinite(value)) value = total;
          if (value < 0) value = 0;
          if (value > total) value = total;
          next[prod._id][code] = value;
        });
      });
      return next;
    });
  }, [productions]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(
      WAREHOUSE_STORAGE_KEYS.productionLocation,
      productionLocation
    );
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("warehouse:production-location-change", {
          detail: productionLocation,
        })
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
        const mapped = items.map((item) => {
          const code = String(item.productCode || "").toUpperCase();
          return {
            kode: code,
            name: item.productName,
            qty: item.quantity,
            category:
              item.productCategory ||
              item.category ||
              getCategoryForCode(code, "-"),
          };
        });
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
    if (loadingCatalog) return;

    try {
      setLoadingCatalog(true);

      const promises = [];

      // rawCatalog biasanya sudah di-preload, tapi kalau kosong kita ambil juga
      if (!rawCatalog.length) {
        promises.push(
          fetchRawProductsPaged({ page: 1, limit: 500 }).then((rawRes) => {
            setRawCatalog(Array.isArray(rawRes?.items) ? rawRes.items : []);
          }),
        );
      }

      // ⬇️ WAJIB: produk jadi untuk search kode produk jadi
      if (!productCatalog.length) {
        promises.push(
          fetchProductsPaged({ page: 1, limit: 200 }).then((prodRes) => {
            setProductCatalog(
              Array.isArray(prodRes?.items) ? prodRes.items : [],
            );
          }),
        );
      }

      // ⬇️ Kemasan (kalau nggak ada / error, fallback ke dummy)
      const needsPackagingRefresh =
        (!packagingCatalog.length ||
          packagingCatalogLocation !== packagingLocation) &&
        Boolean(packagingLocation);
      if (needsPackagingRefresh) {
        promises.push(
          fetchPackagingProductsPaged({
            page: 1,
            limit: 200,
            location: packagingLocation,
          })
            .then((packagingRes) => {
              const fetchedPackaging = Array.isArray(packagingRes?.items)
                ? packagingRes.items
                : [];
              setPackagingCatalog(
                fetchedPackaging.length
                  ? fetchedPackaging
                  : DUMMY_PACKAGING_OPTIONS,
              );
              setPackagingCatalogLocation(packagingLocation);
            })
            .catch(() => {
              setPackagingCatalog(DUMMY_PACKAGING_OPTIONS);
              setPackagingCatalogLocation(packagingLocation);
            }),
        );
      }

      if (promises.length) {
        await Promise.all(promises);
      }
    } catch (err) {
      console.error("Gagal memuat katalog produksi:", err.message);
      toast.error("Gagal memuat katalog bahan baku / produk");
      if (!packagingCatalog.length) {
        setPackagingCatalog(DUMMY_PACKAGING_OPTIONS);
        setPackagingCatalogLocation(packagingLocation ?? null);
      }
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

    saveProductionBuffer(
      remainingBufferItems || [],
      rawLocation,
      nextInvoice
    ).catch((err) => {
      console.error("Gagal memperbarui buffer produksi:", err.message);
    });

    toast.success("Produksi berhasil disimpan");
  };

  const handleInlineQcChange = (productionId, productCode, total, value) => {
    setInlineQcDraft((prev) => {
      const next = { ...prev };
      const current = { ...(next[productionId] || {}) };
      let safe = Number(value);
      if (!Number.isFinite(safe)) safe = 0;
      if (safe < 0) safe = 0;
      if (safe > total) safe = total;
      current[productCode] = safe;
      next[productionId] = current;
      return next;
    });
  };

  const handleInlineQcSubmit = async (production) => {
    const finishedItems = Array.isArray(production.items)
      ? production.items.filter((it) => it.direction === "in")
      : [];
    if (!finishedItems.length) {
      toast.error("Produksi ini tidak memiliki produk jadi");
      return;
    }

    const draft = inlineQcDraft[production._id] || {};
    const qcItems = [];
    for (const item of finishedItems) {
      const code = item.productCode;
      if (!code) continue;
      const total = Number(item.quantity || 0) || 0;
      let okValue = draft[code] !== undefined ? Number(draft[code]) : total;
      if (!Number.isFinite(okValue)) okValue = total;
      if (okValue < 0 || okValue > total) {
        toast.error(
          `Jumlah Lolos untuk ${code} harus di antara 0 dan ${total}`
        );
        return;
      }
      qcItems.push({ productCode: code, okQuantity: okValue });
    }

    try {
      await updateProductionQc(production._id, qcItems);
      handleQcSaved();
    } catch (err) {
      console.error("Gagal menyimpan QC:", err?.message);
      toast.error(
        err?.response?.data?.message || "Gagal menyimpan QC produksi"
      );
    }
  };

  const handleQcSaved = () => {
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
                  <th className="px-3 py-2 text-left">No.</th>
                  <th className="px-3 py-2 text-left">Kode Produk</th>
                  <th className="px-3 py-2 text-left">Nama Produk</th>
                  <th className="px-3 py-2 text-left">Kategori</th>
                  <th className="px-3 py-2 text-right">Jumlah</th>
                </tr>
              </thead>
              <tbody>
                {bufferRawItems.map((it, idx) => {
                  const category =
                    rawCategoryMap.get(String(it.kode || "").toUpperCase()) ||
                    it.category ||
                    "-";
                  return (
                    <tr key={`${it.kode}-${idx}`} className="border-t last:border-b">
                      <td className="px-3 py-1 text-xs">{idx + 1}</td>
                      <td className="px-3 py-1 font-mono text-xs">{it.kode}</td>
                      <td className="px-3 py-1 text-xs">{it.name || "-"}</td>
                      <td className="px-3 py-1 text-xs">{category}</td>
                      <td className="px-3 py-1 text-right">{it.qty}</td>
                    </tr>
                  );
                })}
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
                <th className="p-3 text-left">Kode Produk</th>
                <th className="p-3 text-left">Nama Produk</th>
                <th className="p-3 text-left">Total Produk</th>
                <th className="p-3 text-left">Lolos Produksi</th>
                <th className="p-3 text-left">Gagal Produksi</th>
                <th className="p-3 text-left">Tanggal & Jam</th>
                <th className="p-3 text-left">Status</th>
                <th className="p-3 text-left">Aksi</th>
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
                  const isCompleted =
                    (row?.status || "produced") === "completed";
                  const qcItems = Array.isArray(row.qcItems) ? row.qcItems : [];
                  const qcOkMap = new Map();
                  const qcRejectMap = new Map();
                  if (isCompleted) {
                    qcItems.forEach((qc) => {
                      const code = qc.productCode;
                      if (!code) return;
                      qcOkMap.set(code, Number(qc.okQuantity || 0) || 0);
                      qcRejectMap.set(
                        code,
                        Number(qc.rejectQuantity || 0) || 0
                      );
                    });
                  }
                  const finishedItems = Array.isArray(row.items)
                    ? row.items.filter((it) => it.direction === "in")
                    : [];
                  const displayItems = finishedItems.length
                    ? finishedItems
                    : [
                        {
                          productCode: "-",
                          productName: "-",
                          quantity: 0,
                        },
                      ];
                  const rawItems = Array.isArray(row.items)
                    ? row.items.filter((it) => it.direction === "out")
                    : [];

                  return displayItems.map((item, index) => {
                    const productCode = item.productCode || `ITEM-${index}`;
                    const productName = item.productName || "-";
                    const totalProduct = Number(item.quantity || 0) || 0;
                    const isFirstRow = index === 0;
                    let okValue = totalProduct;
                    let rejectValue = 0;
                    if (isCompleted) {
                      okValue = qcOkMap.get(productCode) ?? totalProduct;
                      rejectValue =
                        qcRejectMap.get(productCode) ?? totalProduct - okValue;
                    } else {
                      const draft = inlineQcDraft[row._id] || {};
                      const draftVal =
                        draft[productCode] !== undefined
                          ? draft[productCode]
                          : totalProduct;
                      okValue = draftVal;
                      rejectValue = totalProduct - okValue;
                    }

                    return (
                      <Fragment key={`${row._id}-${productCode}-${index}`}>
                        <Motion.tr
                          layout
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -8 }}
                          transition={{ duration: 0.15 }}
                          className="border-t hover:bg-gray-50"
                        >
                          {isFirstRow && (
                            <td
                              rowSpan={displayItems.length}
                              className="p-3 text-center align-top"
                            >
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
                          )}
                          <td className="p-3 font-semibold text-gray-800">
                            {row.productionNumber}
                          </td>
                          <td className="p-3 font-mono text-gray-800">
                            {productCode}
                          </td>
                          <td className="p-3 text-gray-600">{productName}</td>
                          <td className="p-3 text-left font-semibold">
                            {totalProduct}
                          </td>
                          <td className="p-3 text-left font-semibold">
                            {isCompleted ? (
                              okValue
                            ) : (
                              <input
                                type="number"
                                min="0"
                                max={totalProduct}
                                value={okValue}
                                onChange={(e) =>
                                  handleInlineQcChange(
                                    row._id,
                                    productCode,
                                    totalProduct,
                                    e.target.value
                                  )
                                }
                                className="w-24 rounded border px-2 py-1 text-right text-xs outline-none focus:ring-2 focus:ring-amber-500/60"
                              />
                            )}
                          </td>
                          <td className="p-3 text-left font-semibold text-red-500">
                            {rejectValue}
                          </td>
                          <td className="p-3 text-gray-600">{date}</td>
                          <td className="p-3 text-left">
                            <span
                              className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium ${statusClass}`}
                            >
                              <span className="inline-block h-1.5 w-1.5 rounded-full bg-current" />
                              {statusLabel}
                            </span>
                          </td>
                          <td className="p-2">
                            {!isCompleted &&
                              index === displayItems.length - 1 && (
                                <button
                                  type="button"
                                  onClick={() => handleInlineQcSubmit(row)}
                                  className="flex items-center gap-1 rounded-lg bg-amber-500 px-2 py-1 text-xs font-medium text-white hover:bg-amber-600"
                                >
                                  <FiCheckCircle className="h-3 w-3" />
                                QC
                                </button>
                              )}
                          </td>
                        </Motion.tr>
                        {isFirstRow && isExpanded && (
                          <Motion.tr
                            layout
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.3 }}
                          >
                            <td colSpan={9} className="bg-gray-50 p-4">
                                <div className="rounded-lg border bg-white p-4">
                                <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-700">
                                  <FiArrowRight className="text-amber-500" />
                                  Bahan Baku Dipakai
                                </div>
                                <table className="min-w-full text-xs text-gray-600">
                                  <thead>
                                    <tr className="bg-gray-100 text-[11px] uppercase text-gray-500">
                                      <th className="px-3 py-2 text-left">No.</th>
                                      <th className="px-3 py-2 text-left">
                                        Kode Produk
                                      </th>
                                      <th className="px-3 py-2 text-left">
                                        Nama Produk
                                      </th>
                                      <th className="px-3 py-2 text-left">
                                        Kategori
                                      </th>
                                      <th className="px-3 py-2 text-right">
                                        Jumlah
                                      </th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {rawItems.length === 0 ? (
                                      <tr>
                                        <td
                                          colSpan={5}
                                          className="px-3 py-2 text-center text-[11px] text-gray-500"
                                        >
                                          Tidak ada data bahan baku.
                                        </td>
                                      </tr>
                                    ) : (
                                      rawItems.map((itemOut, idx) => {
                                        const category = getCategoryForCode(
                                          itemOut.productCode,
                                          itemOut.productCategory || "-",
                                        );
                                        return (
                                          <tr
                                            key={`${row._id}-${itemOut.productCode}-out`}
                                            className="border-t last:border-b"
                                          >
                                            <td className="px-3 py-1 text-left">
                                              {idx + 1}
                                            </td>
                                            <td className="px-3 py-1 font-mono">
                                              {itemOut.productCode}
                                            </td>
                                            <td className="px-3 py-1">
                                              {itemOut.productName || "-"}
                                            </td>
                                            <td className="px-3 py-1">
                                              {category}
                                            </td>
                                            <td className="px-3 py-1 text-right">
                                              {itemOut.quantity}
                                            </td>
                                          </tr>
                                        );
                                      })
                                    )}
                                  </tbody>
                                </table>
                              </div>
                            </td>
                          </Motion.tr>
                        )}
                      </Fragment>
                    );
                  });
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
        packagingLocation={packagingLocation}
        packagingCatalog={packagingCatalog}
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
            (item) => {
              const code = (item.kode || item.productCode || "").toUpperCase();
              return {
                kode: code,
                name: item.name || item.productName || "",
                qty: Number(item.qty ?? item.quantity ?? 0) || 0,
                category:
                  item.category ||
                  item.productCategory ||
                  getCategoryForCode(code, "-"),
              };
            }
          );
          setBufferInvoiceNumber(normalizedInvoice);
          const mergedItems = mergeBufferItems(bufferRawItems, sanitizedItems);
          setBufferRawItems(mergedItems);
          saveProductionBuffer(
            mergedItems,
            rawLocation,
            normalizedInvoice
          ).catch((err) => {
            console.error("Gagal menyimpan buffer produksi:", err.message);
          });
      }}
      />
    </WarehousePageShell>
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
  packagingLocation,
  packagingCatalog,
}) {
  const [productionNumber, setProductionNumber] = useState("");
  const [rawItems, setRawItems] = useState([]); // { kode, name, qty, category }
  const [finishedItems, setFinishedItems] = useState([]); // { kode, name, qty }
  const [finishedCode, setFinishedCode] = useState("");
  const [finishedQty, setFinishedQty] = useState("");
  const [finishedOpen, setFinishedOpen] = useState(false);
  const [packagingCode, setPackagingCode] = useState("");
  const [packagingQty, setPackagingQty] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [rawScanCode, setRawScanCode] = useState("");
  const [rawScanQty, setRawScanQty] = useState("");
  const [currentStep, setCurrentStep] = useState(0);
  const rawScanInputRef = useRef(null);
  const [rawSuggestionsOpen, setRawSuggestionsOpen] = useState(false);

  const normalizedRawSource = useMemo(() => {
    if (!Array.isArray(initialRawItems)) return [];
    return initialRawItems.map((item) => ({
      kode: (item.kode || "").toUpperCase(),
      name: item.name || "",
      invoiceQty: Number(item.qty || 0) || 0,
      category: item.category || "-",
    }));
  }, [initialRawItems]);

  const bufferInfoByCode = useMemo(() => {
    const map = new Map();
    normalizedRawSource.forEach((item) => {
      map.set(item.kode, item);
    });
    return map;
  }, [normalizedRawSource]);

  const selectedRawQtyMap = useMemo(() => {
    const map = new Map();
    rawItems.forEach((item) => {
      const code = String(item.kode || "").toUpperCase();
      if (!code) return;
      const qty = Number(item.qty || 0) || 0;
      map.set(code, qty);
    });
    return map;
  }, [rawItems]);

  const selectedRawItems = useMemo(
    () => rawItems.filter((item) => (Number(item.qty || 0) || 0) > 0),
    [rawItems],
  );
  const usedRawCount = selectedRawItems.length;

  const normalizedScanCode = rawScanCode.trim().toUpperCase();
  const scanBufferInfo = normalizedScanCode
    ? bufferInfoByCode.get(normalizedScanCode)
    : null;
  const scanAvailable = scanBufferInfo?.invoiceQty || 0;
  const scanUsed = normalizedScanCode
    ? selectedRawQtyMap.get(normalizedScanCode) || 0
    : 0;
  const scanRemaining = Math.max(scanAvailable - scanUsed, 0);
  const rawSearchTerm = rawScanCode.trim();
  const rawSearchReady = rawSearchTerm.length >= MIN_RAW_SEARCH_LENGTH;
  const rawSuggestions = useMemo(() => {
    if (!rawSearchReady) return [];
    const upper = rawSearchTerm.toUpperCase();
    const lower = rawSearchTerm.toLowerCase();
    return normalizedRawSource
      .filter((item) => {
        const code = item.kode || "";
        const name = (item.name || "").toLowerCase();
        return code.includes(upper) || name.includes(lower);
      })
      .slice(0, MAX_RAW_SUGGESTIONS);
  }, [normalizedRawSource, rawSearchReady, rawSearchTerm]);

  const finishedSearchTerm = finishedCode.trim();
  const finishedSearchReady =
    finishedSearchTerm.length >= MIN_FINISHED_SEARCH_LENGTH;
  const finishedSuggestions = useMemo(() => {
    if (!finishedSearchReady) return [];
    const q = finishedSearchTerm.toUpperCase();
    const catalog = Array.isArray(productCatalog) ? productCatalog : [];
    const allMatched = catalog.filter((item) => {
      const code = (item.code || "").toUpperCase();
      const name = (item.name || "").toUpperCase();
      return code.includes(q) || name.includes(q);
    });
    const byLocation = allMatched.filter((item) => {
      if (!location) return true;
      const stocks = Array.isArray(item.stocks) ? item.stocks : [];
      if (!stocks.length) return false;
      const locKey = String(location || "").toUpperCase();
      return stocks.some((s) => {
        const loc = String(s.location || "").toUpperCase();
        const qty = Number(s.quantity || 0) || 0;
        return loc === locKey && qty > 0;
      });
    });
    const candidates = byLocation.length ? byLocation : allMatched;
    return candidates.slice(0, MAX_FINISHED_SUGGESTIONS);
  }, [finishedSearchReady, finishedSearchTerm, location, productCatalog]);

  const resolvedPackagingOptions = useMemo(() => {
    if (Array.isArray(packagingCatalog) && packagingCatalog.length) {
      const normalized = packagingCatalog
        .map((item) => {
          const code = String(
            item.code || item.kode || item.productCode || "",
          ).toUpperCase();
          if (!code) return null;
          return {
            code,
            name: item.name || item.nama || item.productName || code,
          };
        })
        .filter(Boolean);
      if (normalized.length) {
        return normalized;
      }
    }
    return DUMMY_PACKAGING_OPTIONS;
  }, [packagingCatalog]);

  useEffect(() => {
    if (!packagingCode) return;
    const exists = resolvedPackagingOptions.some(
      (item) => item.code === packagingCode,
    );
    if (!exists) {
      setPackagingCode("");
    }
  }, [packagingCode, resolvedPackagingOptions]);

  const usingFallbackPackaging =
    resolvedPackagingOptions === DUMMY_PACKAGING_OPTIONS;

  const generateProductionNumber = useCallback(() => {
    return `PRD-${Date.now().toString(36).toUpperCase()}`;
  }, []);

  useEffect(() => {
    if (!isOpen) return undefined;
    const timer =
      typeof window === "undefined"
        ? null
        : window.setTimeout(() => {
            setProductionNumber(generateProductionNumber());
            setRawItems([]);
            setFinishedItems([]);
            setFinishedCode("");
            setFinishedQty("");
            setFinishedOpen(false);
            setPackagingCode("");
            setPackagingQty("");
            setRawScanCode("");
            setRawScanQty("");
            setCurrentStep(0);
            if (rawScanInputRef.current) {
              rawScanInputRef.current.focus();
            }
          }, 0);
    return () => {
      if (timer) window.clearTimeout(timer);
    };
  }, [generateProductionNumber, isOpen, normalizedRawSource]);

  const handleAddRawFromScan = () => {
    const code = rawScanCode.trim().toUpperCase();
    const qtyValue = Number(rawScanQty || 0);
    if (!code || qtyValue <= 0) {
      toast.error("Masukkan kode dan jumlah bahan baku yang valid");
      return;
    }

    const bufferInfo = bufferInfoByCode.get(code);
    if (!bufferInfo) {
      toast.error(`Kode ${code} tidak tersedia di buffer produksi`);
      return;
    }

    const available = Number(bufferInfo.invoiceQty || 0) || 0;
    const currentUsed = selectedRawQtyMap.get(code) || 0;
    if (currentUsed + qtyValue > available) {
      toast.error(
        `Stok ${code} di buffer hanya ${available}. Anda sudah menambahkan ${currentUsed}.`,
      );
      return;
    }

    const category =
      bufferInfo.category ||
      getCategoryForCode(code, "-");
    const displayName = bufferInfo.name || code;

    setRawItems((prev) => {
      const existing = prev.find((item) => item.kode === code);
      if (existing) {
        return prev.map((item) =>
          item.kode === code ? { ...item, qty: item.qty + qtyValue } : item,
        );
      }
      return [
        ...prev,
        {
          kode: code,
          name: displayName,
          qty: qtyValue,
          category,
        },
      ];
    });

    setRawScanCode("");
    setRawScanQty("");
    rawScanInputRef.current?.focus();
  };

  const handleRemoveRawItem = (code) => {
    setRawItems((prev) => prev.filter((item) => item.kode !== code));
  };

  const handleClearRawItems = () => {
    setRawItems([]);
  };

  const handleNextStep = () => {
    if (selectedRawItems.length === 0) {
      toast.error("Tambahkan bahan baku terlebih dahulu");
      return;
    }
    setCurrentStep(1);
  };

  const handlePrevStep = () => {
    setCurrentStep(0);
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
          it.kode === code ? { ...it, qty: it.qty + qty } : it
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
      const code = String(it.kode || "")
        .trim()
        .toUpperCase();
      if (!code) return;
      const qty = Number(it.qty || 0) || 0;
      const name = it.name || "";
      const current = mapInitial.get(code);
      mapInitial.set(code, {
        kode: code,
        name,
        qty: (current?.qty || 0) + qty,
        category: it.category || current?.category || "-",
      });
    });

    const mapUsed = new Map();
    (Array.isArray(usedItems) ? usedItems : []).forEach((it) => {
      const code = String(it.kode || "")
        .trim()
        .toUpperCase();
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
          category: val.category || "-",
        });
      }
    });

    return remaining;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    let normalizedProductionNumber = productionNumber.trim();
    if (!normalizedProductionNumber) {
      normalizedProductionNumber = generateProductionNumber();
      setProductionNumber(normalizedProductionNumber);
    }

    if (!location) {
      toast.error("Lokasi produksi tidak ditemukan");
      return;
    }

    if (!selectedRawItems.length || !finishedItems.length) {
      toast.error("Minimal 1 bahan baku dan 1 produk jadi");
      return;
    }

    const normalizedPackagingCode = (packagingCode || "").trim().toUpperCase();
    const packagingQuantity = Number(packagingQty || 0) || 0;

    if (normalizedPackagingCode && packagingQuantity <= 0) {
      toast.error(
        "Jumlah kemasan harus lebih dari 0 kalau kode kemasan terisi"
      );
      return;
    }

    try {
      setSubmitting(true);

      await createProductionRecord({
        productionNumber: normalizedProductionNumber,
        location,
        rawItems: selectedRawItems.map((item) => ({
          kode: item.kode,
          qty: item.qty,
          name: item.name,
        })),
        finishedItems,
        packaging:
          normalizedPackagingCode && packagingLocation
            ? {
                code: normalizedPackagingCode,
                quantity: packagingQuantity,
                location: packagingLocation,
              }
            : undefined,
      });

      const remainingBufferItems = computeRemainingBuffer(
        initialRawItems,
        selectedRawItems
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

        <form onSubmit={handleSubmit} className="text-sm">
          <div className="rounded-2xl border bg-white/80 p-4 text-xs text-gray-600 shadow-sm">
            <div className="mb-4">
              <div className="flex items-center gap-2 text-xs font-semibold">
                {STEP_LABELS.map((label, idx) => {
                  const isActive = idx === currentStep;
                  const isDone = idx < currentStep;
                  return (
                    <Fragment key={label}>
                      {idx > 0 && (
                        <div
                          className={`h-[2px] flex-1 ${
                            idx <= currentStep ? "bg-red-400" : "bg-gray-200"
                          }`}
                        />
                      )}
                      <div className="flex items-center gap-2">
                        <span
                          className={`flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-bold ${
                            isDone
                              ? "bg-red-500 text-white"
                              : isActive
                                ? "bg-red-100 text-red-600"
                                : "bg-gray-100 text-gray-400"
                          }`}
                        >
                          {idx + 1}
                        </span>
                        <span
                          className={
                            isActive
                              ? "text-gray-900"
                              : isDone
                                ? "text-gray-600"
                                : "text-gray-400"
                          }
                        >
                          {label}
                        </span>
                      </div>
                    </Fragment>
                  );
                })}
              </div>
            </div>

            {currentStep === 0 && (
              <>
                <div className="rounded-2xl border bg-white/80 p-4">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="font-semibold text-gray-700">
                        Bahan Baku Dipakai
                      </div>
                      <p className="text-[11px] text-gray-500">
                        Scan / ketik kode bahan baku lalu isi jumlah yang akan dipakai.
                        Sistem otomatis menarik stok dari buffer lokasi ini.
                      </p>
                    </div>
                    {rawItems.length > 0 && (
                      <button
                        type="button"
                        onClick={handleClearRawItems}
                        className="rounded-lg border px-3 py-1 text-[11px] font-medium text-gray-700 hover:bg-gray-100"
                      >
                        Kosongkan daftar
                      </button>
                    )}
                  </div>

                  <div className="rounded-xl bg-gray-50/70 p-3">
                    <div className="grid grid-cols-[2fr,1fr,auto] items-end gap-3">
                    <div className="relative">
                      <label className="mb-1 block text-xs font-medium text-gray-700">
                        Scan / Kode Bahan Baku
                      </label>
                      <input
                        ref={rawScanInputRef}
                        type="text"
                        value={rawScanCode}
                        onChange={(e) => {
                          const next = e.target.value.toUpperCase();
                          setRawScanCode(next);
                          setRawSuggestionsOpen(next.trim().length > 0);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleAddRawFromScan();
                          }
                        }}
                        className="w-full rounded-lg border bg-white px-3 py-2 text-sm font-mono outline-none focus:ring-2 focus:ring-red-500/60"
                        placeholder="Ketik / scan kode bahan baku"
                      />
                      {rawSearchTerm && rawSuggestionsOpen && (
                        <div className="absolute left-0 right-0 z-10 mt-1 max-h-48 overflow-y-auto rounded-lg border bg-white text-xs shadow-lg">
                          {!rawSearchReady ? (
                            <div className="px-3 py-2 text-gray-500">
                              Ketik minimal {MIN_RAW_SEARCH_LENGTH} karakter untuk melihat daftar bahan baku.
                            </div>
                          ) : rawSuggestions.length === 0 ? (
                            <div className="px-3 py-2 text-gray-500">
                              Tidak ada kode yang cocok.
                            </div>
                          ) : (
                            rawSuggestions.map((item) => {
                              const info = bufferInfoByCode.get(item.kode);
                              const available = Number(info?.invoiceQty || 0) || 0;
                              const used = selectedRawQtyMap.get(item.kode) || 0;
                              const remaining = Math.max(available - used, 0);
                              return (
                                <button
                                  type="button"
                                  key={item.kode}
                                  className="flex w-full items-center justify-between border-b px-3 py-2 text-left hover:bg-gray-50"
                                  onClick={() => {
                                    // set kode di input, lalu TUTUP dropdown
                                    setRawScanCode(item.kode);
                                    setRawSuggestionsOpen(false);
                                    rawScanInputRef.current?.focus();
                                  }}
                                >
                                  <div className="pr-3">
                                    <div className="font-mono text-gray-800">
                                      {item.kode}
                                    </div>
                                    <div className="text-[10px] text-gray-500">
                                      {item.name || "-"}
                                    </div>
                                  </div>
                                  <div className="text-right text-[10px] text-gray-500">
                                    Sisa {remaining}/{available}
                                  </div>
                                </button>
                              );
                            })
                          )}
                        </div>
                      )}

                    </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-gray-700">
                          Jumlah
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={rawScanQty}
                          onChange={(e) => setRawScanQty(e.target.value)}
                          className="w-full rounded-lg border bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-red-500/60"
                          placeholder="Qty"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={handleAddRawFromScan}
                        className="mb-0.5 inline-flex items-center justify-center rounded-lg bg-amber-500 px-3 py-2 text-xs font-medium text-white hover:bg-amber-600"
                      >
                        Tambah
                      </button>
                    </div>

                    {rawScanCode.trim() && (
                      <div className="mt-2 text-[11px] text-gray-500">
                        {scanBufferInfo
                          ? `Stok buffer: ${scanAvailable} | Sudah dipilih: ${scanUsed} | Sisa: ${scanRemaining}`
                          : "Kode ini belum ada di buffer produksi."}
                      </div>
                    )}
                  </div>

                  <div className="mt-3 rounded-2xl border bg-white">
                    {rawItems.length === 0 ? (
                      <div className="p-4 text-xs text-gray-500">
                        Belum ada bahan baku dipilih. Gunakan kolom di atas untuk
                        scan & jumlah bahan baku yang akan dipakai.
                      </div>
                    ) : (
                      <table className="min-w-full text-xs text-gray-700">
                        <thead className="bg-gray-50 text-[11px] uppercase text-gray-500">
                          <tr>
                            <th className="px-3 py-2 text-left">No.</th>
                            <th className="px-3 py-2 text-left">Kode</th>
                            <th className="px-3 py-2 text-left">Nama</th>
                            <th className="px-3 py-2 text-right">Jumlah</th>
                            <th className="px-3 py-2" />
                          </tr>
                        </thead>
                        <tbody>
                          {rawItems.map((it, idx) => (
                            <tr key={it.kode} className="border-t last:border-b">
                              <td className="px-3 py-1 text-xs">{idx + 1}</td>
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
                                  onClick={() => handleRemoveRawItem(it.kode)}
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

                  {rawItems.length > 0 && (
                    <div className="mt-2 flex justify-between text-[11px] text-gray-500">
                      <span>Total bahan baku unik: {rawItems.length}</span>
                      <button
                        type="button"
                        onClick={handleClearRawItems}
                        className="text-red-500 hover:text-red-600"
                      >
                        Kosongkan
                      </button>
                    </div>
                  )}
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="rounded-lg border px-4 py-2 text-xs font-medium text-gray-700 hover:bg-gray-100"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    onClick={handleNextStep}
                    disabled={selectedRawItems.length === 0}
                    className="rounded-lg bg-red-500 px-4 py-2 text-xs font-medium text-white hover:bg-red-600 disabled:opacity-60"
                  >
                    Lanjut Produk
                  </button>
                </div>
              </>
            )}

            {currentStep === 1 && (
              <div className="space-y-4">
                <div className="rounded-lg border bg-gray-50 p-3 text-xs text-gray-500">
                  <div className="font-semibold text-gray-700">
                    Nomor Produksi
                  </div>
                  <div className="mt-1 font-mono text-sm text-gray-900">
                    {productionNumber || "Menyiapkan nomor..."}
                  </div>
                  <p className="text-[11px] text-gray-500">
                    Nomor dibuat otomatis ketika form dibuka.
                  </p>
                </div>

                <div className="rounded-lg border bg-gray-50 p-3 text-[11px] text-gray-500">
                  Total bahan baku dipakai: {usedRawCount}
                </div>

                <div className="space-y-2 rounded-lg border bg-gray-50 p-3 text-xs text-gray-600">
                  <div className="font-semibold text-gray-700">Kemasan</div>
                  <div className="grid grid-cols-[2fr,1fr] items-end gap-3">
                    <div>
                      <label className="mb-1 block text-[11px] font-medium text-gray-700">
                        Kode Kemasan
                      </label>
                      <select
                        value={packagingCode}
                        onChange={(e) => setPackagingCode(e.target.value)}
                        className="w-full rounded-lg border px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-red-500/60"
                      >
                        <option value="">Pilih kemasan (opsional)</option>
                        {resolvedPackagingOptions.map((item) => (
                          <option key={item.code} value={item.code}>
                            {item.code} - {item.name}
                          </option>
                        ))}
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
                    {packagingLocation
                      ? `Sinkron dengan stok kemasan lokasi ${packagingLocation}.`
                      : "Lokasi kemasan belum ditentukan."}
                    {usingFallbackPackaging &&
                      " (Menampilkan daftar default karena stok kemasan belum tersedia atau gagal dimuat.)"}
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
                        setFinishedOpen(
                          next.trim().length >= MIN_FINISHED_SEARCH_LENGTH,
                        );
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                        }
                      }}
                      className="w-full rounded-lg border px-3 py-2 text-sm font-mono outline-none focus:ring-2 focus:ring-red-500/60"
                      placeholder="Ketik minimal 3 karakter kode / nama"
                    />

                    {finishedOpen && (
                      <div className="absolute z-20 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border bg-white text-xs shadow-lg">
                        {!finishedSearchReady ? (
                          <div className="px-3 py-2 text-gray-500">
                            Ketik minimal {MIN_FINISHED_SEARCH_LENGTH} karakter untuk mencari produk.
                          </div>
                        ) : finishedSuggestions.length === 0 ? (
                          <div className="px-3 py-2 text-gray-500">
                            Tidak ada produk jadi yang cocok.
                          </div>
                        ) : (
                          finishedSuggestions.map((item) => (
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
                          ))
                        )}
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

                <div className="rounded-lg border bg-gray-50 p-3 text-[11px] text-gray-500">
                  Total produk jadi: {finishedItems.length}
                </div>

                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={handlePrevStep}
                    className="rounded-lg border px-4 py-2 text-xs font-medium text-gray-700 hover:bg-gray-100"
                  >
                    Kembali
                  </button>
                  <div className="flex gap-2">
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
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
