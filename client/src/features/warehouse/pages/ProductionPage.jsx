import { Fragment, useEffect, useState } from "react";
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
import { fetchRawProductsPaged, fetchProductsPaged } from "../api/mockData";
import {
  createProductionRecord,
  fetchProductions,
  fetchProductionBuffer,
  saveProductionBuffer,
} from "../api/production";
import RawFromInvoiceModal from "./RawFromInvoiceModal";

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
  const [bufferInvoiceNumber, setBufferInvoiceNumber] = useState("");
  const [bufferRawItems, setBufferRawItems] = useState([]);

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
  }, [page, limit, debouncedSearch, reloadKey]);

  useEffect(() => {
    let active = true;
    async function loadBuffer() {
      try {
        const data = await fetchProductionBuffer();
        if (!active) return;
        const mapped = (Array.isArray(data) ? data : []).map((item) => ({
          kode: item.productCode,
          name: item.productName,
          qty: item.quantity,
        }));
        setBufferRawItems(mapped);
      } catch (err) {
        console.error("Gagal memuat buffer produksi:", err.message);
      }
    }
    loadBuffer();
    return () => {
      active = false;
    };
  }, []);

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
    if (!bufferInvoiceNumber || bufferRawItems.length === 0) {
      toast.error("Silakan ambil bahan baku dari invoice terlebih dahulu");
      return;
    }
    await ensureCatalogLoaded();
    setIsProductionModalOpen(true);
  };

  const handleCreated = async () => {
    setIsProductionModalOpen(false);
    setReloadKey((key) => key + 1);
    toast.success("Produksi berhasil disimpan");
  };

  return (
    <WarehousePageShell
      title="Produksi"
      icon={FiBox}
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
                <th className="p-3 text-left">Tanggal</th>
                <th className="p-3 text-left">Total Bahan Keluar</th>
                <th className="p-3 text-left">Total Produk Jadi</th>
              </tr>
            </thead>
            <tbody>
              <AnimatePresence initial={false}>
                {productions.map((row) => {
                  const isExpanded = expandedId === row._id;
                  const date = row.date
                    ? new Date(row.date).toLocaleString("id-ID")
                    : "-";
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
                        <td className="p-3 text-gray-600">{date}</td>
                        <td className="p-3 text-left font-semibold">
                          {row.totalOutQuantity}
                        </td>
                        <td className="p-3 text-left font-semibold">
                          {row.totalInQuantity}
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
                            <td colSpan={5} className="bg-gray-50 p-4">
                              <Motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                transition={{ duration: 0.25 }}
                                className="grid gap-4 md:grid-cols-2"
                              >
                                <div className="rounded-lg border bg-white p-4">
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
                                <div className="rounded-lg border bg-white p-4">
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
        invoiceNumber={bufferInvoiceNumber}
        initialRawItems={bufferRawItems}
        rawCatalog={rawCatalog}
        productCatalog={productCatalog}
        loadingCatalog={loadingCatalog}
      />

      <RawFromInvoiceModal
        isOpen={isRawModalOpen}
        onClose={() => setIsRawModalOpen(false)}
        onLoaded={({ invoiceNumber, rawItems }) => {
          setBufferInvoiceNumber(invoiceNumber);
          setBufferRawItems((prev) => {
            const map = new Map();
            prev.forEach((it) => {
              map.set(it.kode, { ...it });
            });
            rawItems.forEach((it) => {
              const existing = map.get(it.kode);
              if (existing) {
                map.set(it.kode, {
                  ...existing,
                  qty: existing.qty + it.qty,
                  name: existing.name || it.name,
                });
              } else {
                map.set(it.kode, { ...it });
              }
            });
            const merged = Array.from(map.values());
            // Persist merged buffer to backend
            saveProductionBuffer(merged).catch((err) => {
              console.error("Gagal menyimpan buffer produksi:", err.message);
            });
            return merged;
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
  invoiceNumber,
  initialRawItems,
  rawCatalog,
  productCatalog,
  loadingCatalog,
}) {
  const [step, setStep] = useState(1);
  const [productionNumber, setProductionNumber] = useState("");
  const [rawItems, setRawItems] = useState([]);
  const [finishedItems, setFinishedItems] = useState([]);
  const [rawCode, setRawCode] = useState("");
  const [rawQty, setRawQty] = useState("");
  const [finishedCode, setFinishedCode] = useState("");
  const [finishedQty, setFinishedQty] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Legacy handler no longer used (invoice diambil dari RawFromInvoiceModal),
  // didefinisikan kosong agar tidak menyebabkan ReferenceError.
  const handleLoadFromInvoice = () => {};

  useEffect(() => {
    if (!isOpen) return undefined;
    const t =
      typeof window === "undefined"
        ? null
        : window.setTimeout(() => {
            setStep(1);
            setProductionNumber("");
            setRawItems(initialRawItems || []);
            setFinishedItems([]);
            setRawCode("");
            setRawQty("");
            setFinishedCode("");
            setFinishedQty("");
          }, 0);
    return () => {
      if (t) window.clearTimeout(t);
    };
  }, [isOpen]);

  const handleAddRaw = () => {
    const code = rawCode.trim().toUpperCase();
    const qty = Number(rawQty || 0);
    if (!code || qty <= 0) return;
    setRawItems((prev) => {
      const existing = prev.find((it) => it.kode === code);
      if (existing) {
        return prev.map((it) =>
          it.kode === code ? { ...it, qty: it.qty + qty } : it
        );
      }
      const catalog = rawCatalog || [];
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
    setRawCode("");
    setRawQty("");
  };

  const handleAddFinished = () => {
    const code = finishedCode.trim().toUpperCase();
    const qty = Number(finishedQty || 0);
    if (!code || qty <= 0) return;
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!productionNumber.trim()) {
      toast.error("Nomor produksi wajib diisi");
      return;
    }
    if (!rawItems.length || !finishedItems.length) {
      toast.error("Minimal 1 bahan baku dan 1 produk jadi");
      return;
    }
    try {
      setSubmitting(true);
      await createProductionRecord({
        invoiceNumber: invoiceNumber.trim(),
        productionNumber: productionNumber.trim(),
        rawItems,
        finishedItems,
      });
      onSuccess();
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
            <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
              <FiFileText className="text-red-500" /> Produksi Baru
            </h2>
            <p className="text-xs text-gray-500">
              Catat pemakaian bahan baku dan hasil produk jadi dalam satu
              transaksi.
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

        <div className="mb-4 flex gap-2 text-xs font-medium text-gray-600">
          <span
            className={`rounded-full px-3 py-1 ${
              step === 1 ? "bg-red-500 text-white" : "bg-gray-100"
            }`}
          >
            1. Bahan Baku
          </span>
          <span
            className={`rounded-full px-3 py-1 ${
              step === 2 ? "bg-red-500 text-white" : "bg-gray-100"
            }`}
          >
            2. Produk Jadi & Nomor
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
            <div className="grid gap-3 md:grid-cols-[2fr,auto] items-end">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">
                  Nomor Invoice Bahan Baku
                </label>
                <input
                  type="text"
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-red-500/60"
                  placeholder="Harus sama dengan invoice stok keluar bahan baku"
                />
              </div>
              <button
                type="button"
                onClick={handleLoadFromInvoice}
                className="inline-flex items-center justify-center rounded-lg bg-blue-500 px-3 py-2 text-xs font-medium text-white hover:bg-blue-600"
              >
                Ambil dari Invoice
              </button>
            </div>

            <div className="grid grid-cols-[2fr,1fr,auto] items-end gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">
                  Kode Bahan Baku
                </label>
                <input
                  type="text"
                  value={rawCode}
                  onChange={(e) => setRawCode(e.target.value.toUpperCase())}
                  className="w-full rounded-lg border px-3 py-2 text-sm font-mono outline-none focus:ring-2 focus:ring-red-500/60"
                  placeholder="Contoh: KVB-CH"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">
                  Jumlah
                </label>
                <input
                  type="number"
                  min="1"
                  value={rawQty}
                  onChange={(e) => setRawQty(e.target.value)}
                  className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-red-500/60"
                />
              </div>
              <button
                type="button"
                onClick={handleAddRaw}
                className="mb-0.5 inline-flex items-center justify-center rounded-lg bg-amber-500 px-3 py-2 text-xs font-medium text-white hover:bg-amber-600"
              >
                Tambah
              </button>
            </div>

            <div className="max-h-52 overflow-y-auto rounded-lg border">
              {rawItems.length === 0 ? (
                <div className="p-3 text-xs text-gray-500">
                  Belum ada bahan baku. Isi kode dan jumlah lalu klik Tambah.
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
                    {rawItems.map((it) => (
                      <tr key={it.kode} className="border-t last:border-b">
                        <td className="px-3 py-1 font-mono text-xs">
                          {it.kode}
                        </td>
                        <td className="px-3 py-1 text-xs">{it.name || "-"}</td>
                        <td className="px-3 py-1 text-right">{it.qty}</td>
                        <td className="px-3 py-1 text-center">
                          <button
                            type="button"
                            onClick={() =>
                              setRawItems((prev) =>
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

            <div className="mt-2 flex justify-between text-xs text-gray-500">
              <span>Total item bahan baku: {rawItems.length}</span>
              <button
                type="submit"
                className="rounded-lg bg-red-500 px-4 py-2 text-xs font-medium text-white hover:bg-red-600"
              >
                Lanjut ke produk jadi
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 text-sm">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-lg border bg-gray-50 p-3 text-xs text-gray-600">
                <div className="mb-1 font-semibold text-gray-700">
                  Ringkasan Bahan Baku
                </div>
                <ul className="space-y-1">
                  {rawItems.map((it) => (
                    <li key={it.kode} className="flex justify-between">
                      <span className="font-mono">{it.kode}</span>
                      <span>x {it.qty}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">
                  Nomor Produksi
                </label>
                <input
                  type="text"
                  value={productionNumber}
                  onChange={(e) => setProductionNumber(e.target.value)}
                  className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-red-500/60"
                  placeholder="Contoh: PRD-00123"
                />
              </div>
            </div>

            <div className="grid grid-cols-[2fr,1fr,auto] items-end gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">
                  Kode Produk Jadi
                </label>
                <input
                  type="text"
                  value={finishedCode}
                  onChange={(e) =>
                    setFinishedCode(e.target.value.toUpperCase())
                  }
                  className="w-full rounded-lg border px-3 py-2 text-sm font-mono outline-none focus:ring-2 focus:ring-red-500/60"
                  placeholder="Contoh: KVB-OR"
                />
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
                        <td className="px-3 py-1 text-xs">{it.name || "-"}</td>
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

            <div className="mt-3 flex justify-between text-xs text-gray-500">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="text-gray-500 hover:text-gray-700"
              >
                ⬅ Kembali ke bahan baku
              </button>
              <span>
                Total bahan baku: {rawItems.length} • Total produk:{" "}
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
          </form>
        )}
      </div>
    </div>
  );
}
