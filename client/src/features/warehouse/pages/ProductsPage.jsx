import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FiBox,
  FiEdit2,
  FiPrinter,
  FiSearch,
  FiTrash2,
  FiX,
  FiArrowDownCircle,
  FiArrowUpCircle,
  FiPlus,
} from "react-icons/fi";
import { toast } from "sonner";
import Pagination from "../../../components/common/Pagination";
import EditProductModal from "../components/EditProductModal";
import Barcode from "../../../components/common/Barcode";
import DeleteConfirmModal from "../../../components/common/DeleteConfirmModal";
import {
  fetchCategories as fetchProductCategories,
  fetchProductsPaged,
  deleteProductById,
  upsertProduct,
  formatRupiah,
  fetchRawCategories,
  fetchRawProductsPaged,
  deleteRawProductById,
  upsertRawProduct,
} from "../api/mockData";
import { createInvoiceRecord } from "../api/invoices";
import { playSuccessSound } from "../../../utils/sound";
import EmptyState from "../../../components/common/EmptyState";
import { WarehousePageShell } from "../../../components/templates/WarehousePageShell";
import {
  RAW_LOCATIONS,
  PRODUCT_LOCATIONS,
} from "../../../constants/warehouseLocations";

const STORAGE_KEYS = {
  warehouseRaw: "warehouseCode_raw",
  warehouseFinished: "warehouseCode_finished",
  searchRaw: "searchTerm_raw",
  searchFinished: "searchTerm_finished",
};

export default function ProductsPage({
  mode = "finished",
  locationOptionsOverride,
  locationStorageKeyOverride,
  searchStorageKeyOverride,
  pageTitle = "Daftar Produk",
}) {
  const isRawMode = mode === "raw";

  const defaultLocationOptions = isRawMode ? RAW_LOCATIONS : PRODUCT_LOCATIONS;
  const locationOptions =
    Array.isArray(locationOptionsOverride) && locationOptionsOverride.length
      ? locationOptionsOverride
      : defaultLocationOptions;

  const api = useMemo(
    () =>
      isRawMode
        ? {
            fetchCategories: fetchRawCategories,
            fetchPaged: fetchRawProductsPaged,
            upsert: upsertRawProduct,
            deleteById: deleteRawProductById,
          }
        : {
            fetchCategories: fetchProductCategories,
            fetchPaged: fetchProductsPaged,
            upsert: upsertProduct,
            deleteById: deleteProductById,
          },
    [isRawMode],
  );
  const [categories, setCategories] = useState([]);

  const [editProduct, setEditProduct] = useState(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const [allProducts, setAllProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const warehouseStorageKey =
    locationStorageKeyOverride ||
    (isRawMode ? STORAGE_KEYS.warehouseRaw : STORAGE_KEYS.warehouseFinished);

  const searchStorageKey =
    searchStorageKeyOverride ||
    (isRawMode ? STORAGE_KEYS.searchRaw : STORAGE_KEYS.searchFinished);

  const [warehouseCode, setWarehouseCode] = useState(() => {
    if (typeof window === "undefined") {
      return locationOptions[0];
    }
    const saved = window.localStorage.getItem(warehouseStorageKey);
    if (saved && locationOptions.includes(saved)) return saved;
    return locationOptions[0];
  });

  const [searchTerm, setSearchTerm] = useState(() => {
    if (typeof window === "undefined") return "";
    return window.localStorage.getItem(searchStorageKey) || "";
  });
  const [page, setPage] = useState(1);
  const limit = 10;
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [printRow, setPrintRow] = useState(null);
  const [printQty, setPrintQty] = useState("1");
  const [isStockOpen, setIsStockOpen] = useState(false);
  const [isStockOutOpen, setIsStockOutOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState(null);

  const reloadLookups = useCallback(async () => {
    try {
      const catRes = await api.fetchCategories();
      setCategories(catRes);
    } catch (err) {
      console.error("Gagal memuat data kategori:", err.message);
    }
  }, [api]);

  const locationParam = warehouseCode;

  const fetchWithLocation = useCallback(
    (params = {}) => {
      const query = {
        ...params,
      };
      if (locationParam) {
        query.location = locationParam;
      }
      return api.fetchPaged(query);
    },
    [api, locationParam],
  );

  const productSearchFetcher = useCallback(
    (params = {}) => fetchWithLocation(params),
    [fetchWithLocation],
  );

  const reloadPage = async (targetPage = page) => {
    try {
      setLoading(true);
      const q = (searchTerm || "").trim();
      const searchParam = q.length ? q : undefined;
      const data = await fetchWithLocation({
        page: targetPage,
        limit,
        search: searchParam,
      });
      setAllProducts(Array.isArray(data?.items) ? data.items : []);
      setTotalItems(Number(data?.total || 0));
      setTotalPages(Number(data?.pages || 1));
    } catch (err) {
      console.error("Error reload page:", err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = window.localStorage.getItem(warehouseStorageKey);
    setWarehouseCode(
      saved && locationOptions.includes(saved)
        ? saved
        : locationOptions[0],
    );
  }, [warehouseStorageKey, locationOptions]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!warehouseCode) return;
    window.localStorage.setItem(warehouseStorageKey, warehouseCode);
  }, [warehouseCode, warehouseStorageKey]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = window.localStorage.getItem(searchStorageKey) || "";
    setSearchTerm(saved);
  }, [isRawMode, searchStorageKey]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(searchStorageKey, searchTerm);
  }, [searchTerm, searchStorageKey]);


  useEffect(() => {
    let active = true;
    async function loadProducts() {
      try {
        setLoading(true);
        const q = (searchTerm || "").trim();
        const searchParam = q.length ? q : undefined;
        const data = await fetchWithLocation({
          page,
          limit,
          search: searchParam,
        });
        if (!active) return;
        setAllProducts(Array.isArray(data?.items) ? data.items : []);
        setTotalItems(Number(data?.total || 0));
        setTotalPages(Number(data?.pages || 1));
      } catch (err) {
        console.error("Error load products:", err.message);
      } finally {
        if (active) setLoading(false);
      }
    }
    loadProducts();
    return () => {
      active = false;
    };
  }, [page, limit, searchTerm, fetchWithLocation]);

  useEffect(() => {
    setPage(1);
  }, [locationParam]);

  useEffect(() => {
    reloadLookups();
  }, [reloadLookups]);

  const handleAddProduct = async (newProduct) => {
    const locationPayload = { location: warehouseCode };
    await api.upsert({ ...newProduct, ...locationPayload });
    await reloadLookups();
    if (page !== 1) {
      setPage(1);
    } else {
      await reloadPage(1);
    }
  };

  const handleUpdateProduct = async (updatedProduct) => {
    if (!updatedProduct?._id) return;
    const locationPayload = { location: warehouseCode };
    await api.upsert({ ...updatedProduct, ...locationPayload });
    await reloadLookups();
    await reloadPage();
  };

  const handleDeleteProduct = async (product) => {
    if (!product?._id) return;
    try {
      await api.deleteById(product._id);
      toast.success(
        `Produk "${product.name || product.kode}" berhasil dihapus`
      );
      playSuccessSound();
      if (totalItems === 1 && page > 1) {
        setPage((p) => p - 1);
      } else {
        await reloadPage();
      }
    } catch (err) {
      console.error("Gagal hapus product:", err.message);
      toast.error(err?.message || "Gagal menghapus produk");
    }
  };

  useEffect(() => {
    const t = setTimeout(() => setPage(1), 300);
    return () => clearTimeout(t);
  }, [searchTerm]);

  const hasAnyProduct = totalItems > 0;

  const getLocationStock = useCallback((product) => {
    const stocks = Array.isArray(product.stocks) ? product.stocks : null;
    if (stocks && stocks.length) {
      const entry = stocks.find((s) => s.location === warehouseCode);
      if (entry && typeof entry.quantity === "number") {
        return entry.quantity;
      }
    }
    if (typeof product.stock === "number") {
      return product.stock;
    }
    return 0;
  }, [warehouseCode]);

  const tableRows = useMemo(
    () =>
      allProducts.map((product) => ({
        kode: product.code,
        nama: product.name,
        kategori: product.category || "-",
        jumlah: getLocationStock(product),
        hargaBeli:
          typeof product.purchasePrice === "number"
            ? product.purchasePrice
            : null,
        hargaJual:
          typeof product.sellingPrice === "number"
            ? product.sellingPrice
            : null,
        product,
      })),
    [allProducts, getLocationStock]
  );

  const formatNumber = (value) =>
    new Intl.NumberFormat("id-ID").format(
      typeof value === "number" ? value : Number(value) || 0
    );

  const handleApplyStock = async ({ invoice, items }) => {
    if (!items.length) {
      toast.info("Tidak ada item stok yang ditambahkan");
      return false;
    }

    try {
      await createInvoiceRecord({
        invoiceNumber: invoice?.trim(),
        type: "in",
        location: warehouseCode,
        segment: isRawMode ? "raw" : "finished",
        items: items.map((item) => ({
          productCode: item.kode,
          quantity: item.qty,
        })),
      });
      const suffix = invoice ? ` (Invoice ${invoice})` : "";
      toast.success(`Stok masuk berhasil disimpan${suffix}`);
      playSuccessSound();
      await reloadPage();
      return true;
    } catch (err) {
      console.error("Gagal menyimpan stok masuk:", err.message);
      toast.error(err?.message || "Gagal menyimpan stok masuk");
      return false;
    }
  };

  const handleApplyStockOut = async ({ invoice, items }) => {
    if (!items.length) {
      toast.info("Tidak ada item stok yang dikurangi");
      return false;
    }

    try {
      await createInvoiceRecord({
        invoiceNumber: invoice?.trim(),
        type: "out",
        location: warehouseCode,
        segment: isRawMode ? "raw" : "finished",
        items: items.map((item) => ({
          productCode: item.kode,
          quantity: item.qty,
        })),
      });
      const suffix = invoice ? ` (Invoice ${invoice})` : "";
      toast.success(`Stok keluar berhasil disimpan${suffix}`);
      playSuccessSound();
      await reloadPage();
      return true;
    } catch (err) {
      console.error("Gagal menyimpan stok keluar:", err.message);
      toast.error(err?.message || "Gagal menyimpan stok keluar");
      return false;
    }
  };

  const handleOpenStockIn = () => {
    setIsStockOpen(true);
  };

  const handleOpenStockOut = () => {
    setIsStockOutOpen(true);
  };

  return (
    <WarehousePageShell
      title={pageTitle}
      icon={FiBox}
      headerBelow={
        <div className="flex flex-wrap items-center gap-2 text-xs text-gray-700">
          <span className="font-medium">Lokasi:</span>
          <select
            value={warehouseCode}
            onChange={(e) => setWarehouseCode(e.target.value)}
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
          <div className="relative flex-grow max-w-md">
            <input
              type="text"
              placeholder="Cari produk..."
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
              onClick={handleOpenStockIn}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500 text-xs md:text-sm font-medium text-white shadow-sm hover:bg-blue-600"
            >
              <FiArrowDownCircle className="text-sm" />
              <span>Stok Masuk</span>
            </button>
            <button
              type="button"
              onClick={handleOpenStockOut}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 text-xs md:text-sm font-medium text-white shadow-sm hover:bg-amber-600"
            >
              <FiArrowUpCircle className="text-sm" />
              <span>Stok Keluar</span>
            </button>
            <button
              type="button"
              onClick={() => setIsCreateOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-red-500 hover:bg-red-600 cursor-pointer text-white rounded-lg text-xs md:text-sm font-medium"
            >
              <FiPlus className="text-sm" />
              <span>Tambah Produk</span>
            </button>
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
              d="M16.5 12a4.5 4.5 0 01-9 0m9 0a4.5 4.5 0 01-9 0m9 0V6.75m0 5.25H21m-4.5 0H3"
            />
          </svg>
          <p className="text-sm font-medium">Memuat data produk...</p>
        </div>
      ) : !hasAnyProduct && !searchTerm ? (
        <EmptyState
          title="Belum ada produk"
          description="Yuk mulai tambahkan produk pertamamu!"
          buttonText="+ Tambah Produk"
          onButtonClick={() => setIsCreateOpen(true)}
          illustration="box"
        />
      ) : !hasAnyProduct && searchTerm ? (
        <EmptyState
          title="Produk tidak ditemukan"
          description="Coba periksa kembali kata kunci pencarianmu atau reset filter."
          buttonText="Reset Pencarian"
          onButtonClick={() => setSearchTerm("")}
          illustration="search"
        />
      ) : (
        <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
          <table className="min-w-full border-collapse text-xs text-gray-700">
            <thead className="bg-gray-100 text-xs uppercase text-gray-600">
              <tr>
                <th className="w-12 p-3 text-center">No.</th>
                <th className="p-3 text-left">Kode Produk</th>
                <th className="p-3 text-center">Barcode</th>
                <th className="p-3 text-left">Nama Produk</th>
                <th className="p-3 text-left">Kategori</th>
                <th className="p-3 text-right">Jumlah</th>
                <th className="p-3 text-right">Harga Pembelian</th>
                <th className="p-3 text-right">Harga Jual</th>
                <th className="w-32 p-3 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {tableRows.map((row, index) => (
                <tr
                  key={row.product?._id || row.kode || index}
                  className="border-t hover:bg-gray-50"
                >
                  <td className="p-3 text-center text-xs font-medium text-gray-600">
                    {(page - 1) * limit + index + 1}
                  </td>
                  <td className="p-3 font-mono text-xs text-gray-800">
                    {row.kode}
                  </td>
                  <td className="p-3 text-center text-xs text-gray-900">
                    <div className="flex flex-col items-center gap-2">
                      <Barcode value={row.kode} className="mx-auto h-10" />
                      <button
                        type="button"
                        onClick={() => {
                          setPrintRow(row);
                          setPrintQty("1");
                        }}
                        className="inline-flex items-center gap-1 rounded-full bg-blue-500 px-3 py-1 text-xs font-medium text-white hover:bg-blue-600"
                        title="Print barcode"
                      >
                        <FiPrinter className="h-3 w-3" />
                        Print
                      </button>
                    </div>
                  </td>
                  <td className="p-3 text-xs font-medium text-gray-900">{row.nama}</td>
                  <td className="p-3 text-xs text-gray-700">{row.kategori || "-"}</td>
                  <td
                    className={`p-3 text-center text-xs text-gray-800 ${
                      typeof row.jumlah === "number" && row.jumlah < 10
                        ? "bg-red-50 text-red-600 font-semibold"
                        : ""
                    }`}
                  >
                    {formatNumber(row.jumlah)}
                  </td>
                  <td className="p-3 text-right text-xs text-gray-800">
                    {row.hargaBeli ? formatRupiah(row.hargaBeli) : "-"}
                  </td>
                  <td className="p-3 text-right text-xs text-gray-800">
                    {row.hargaJual ? formatRupiah(row.hargaJual) : "-"}
                  </td>
                  <td className="p-3 text-center text-xs">
                    <div className="inline-flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          if (!row.product) return;
                          setEditProduct(row.product);
                          setIsEditOpen(true);
                        }}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500 text-white hover:bg-emerald-600"
                        title="Edit data"
                      >
                        <FiEdit2 className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setProductToDelete(row.product)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-red-500 text-white hover:bg-red-600"
                        title="Hapus data"
                      >
                        <FiTrash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && totalPages > 1 && (
        <div className="mt-6 flex flex-col items-center justify-between gap-3 md:flex-row">
          <div className="text-sm text-gray-600">
            Menampilkan {totalItems ? (page - 1) * limit + 1 : 0} -{" "}
            {Math.min(page * limit, totalItems)} dari {totalItems} produk
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

      <EditProductModal
        isOpen={isEditOpen}
        onClose={() => {
          setIsEditOpen(false);
          setEditProduct(null);
        }}
        product={editProduct}
        onSave={handleUpdateProduct}
        categoryList={categories}
      />

      <EditProductModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        product={null}
        onSave={handleAddProduct}
        categoryList={categories}
      />

      <BarcodePrintModal
        row={printRow}
        qty={printQty}
        onQtyChange={setPrintQty}
        onClose={() => setPrintRow(null)}
      />

      <DeleteConfirmModal
        isOpen={Boolean(productToDelete)}
        onClose={() => setProductToDelete(null)}
        onConfirm={async () => {
          if (!productToDelete) return;
          await handleDeleteProduct(productToDelete);
          setProductToDelete(null);
        }}
        itemName={productToDelete?.name || productToDelete?.nama || ""}
        title="Konfirmasi Hapus Produk"
        confirmLabel="Hapus"
        verb="menghapus"
      />

      <StockInModal
        isOpen={isStockOpen}
        onClose={() => setIsStockOpen(false)}
        onApply={handleApplyStock}
        fetchFn={productSearchFetcher}
        location={warehouseCode}
      />

      <StockOutModal
        isOpen={isStockOutOpen}
        onClose={() => setIsStockOutOpen(false)}
        onApply={handleApplyStockOut}
        fetchFn={productSearchFetcher}
        location={warehouseCode}
      />
    </WarehousePageShell>
  );
}

function BarcodePrintModal({ row, qty, onQtyChange, onClose }) {
  if (!row) return null;

  const handlePrint = () => {
    const count = Math.max(1, Number(qty || 1));
    const win = window.open("", "_blank");
    if (!win) return;

    const safeCode = String(row.kode || "");

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
          <Barcode value={row.kode} className="h-12" />
          <div className="text-sm font-mono text-gray-800">{row.kode}</div>
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

const SEARCH_DEBOUNCE_MS = 250;

function ProductSearchInput({ value, onChange, onSelect, inputRef, onEnter, fetchFn = fetchProductsPaged }) {
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
        Scan / Kode Produk
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

function StockInModal({ isOpen, onClose, onApply, fetchFn, location }) {
  const [step, setStep] = useState(1);
  const [invoice, setInvoice] = useState("");
  const [kode, setKode] = useState("");
  const [qty, setQty] = useState("");
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
          }, 0);
    return () => {
      if (timer) {
        window.clearTimeout(timer);
      }
    };
  }, [isOpen]);

  useEffect(() => {
    if (step === 2 && kodeInputRef.current) {
      kodeInputRef.current.focus();
    }
  }, [step]);

  if (!isOpen) return null;

  const handleAddItem = () => {
    const code = kode.trim();
    const nQty = Number(qty || 0);
    if (!code || nQty <= 0) return;

    setItems((prev) => {
      const existingIndex = prev.findIndex(
        (it) => it.kode.toUpperCase() === code.toUpperCase()
      );
      if (existingIndex !== -1) {
        const next = [...prev];
        next[existingIndex] = {
          ...next[existingIndex],
          qty: next[existingIndex].qty + nQty,
        };
        return next;
      }
      return [...prev, { kode: code, qty: nQty }];
    });
    setKode("");
    setQty("");
    if (kodeInputRef.current) kodeInputRef.current.focus();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const success = await onApply({ invoice: invoice.trim(), items });
    if (success !== false) {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-xl">
        <h2 className="mb-4 text-lg font-semibold text-gray-800">Stok Masuk</h2>

        {location && (
          <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-gray-100 px-3 py-1 text-[11px] font-medium text-gray-700">
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
            Lokasi: {location}
          </div>
        )}

        <div className="mb-4 flex gap-2 text-xs font-medium text-gray-600">
          <span
            className={`rounded-full px-3 py-1 ${
              step === 1 ? "bg-red-500 text-white" : "bg-gray-100"
            }`}
          >
            1. Invoice
          </span>
          <span
            className={`rounded-full px-3 py-1 ${
              step === 2 ? "bg-red-500 text-white" : "bg-gray-100"
            }`}
          >
            2. Scan & Jumlah
          </span>
        </div>

        {step === 1 ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setStep(2);
            }}
            className="space-y-3 text-sm"
          >
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">
                Nomor Invoice
              </label>
              <input
                type="text"
                value={invoice}
                onChange={(e) => setInvoice(e.target.value.toUpperCase())}
                className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-red-500/60"
                placeholder="Contoh: INV-00123"
              />
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
                className="rounded-lg bg-red-500 px-4 py-2 text-xs font-medium text-white hover:bg-red-600"
              >
                Lanjut
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 text-sm">
            <div className="rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600">
              Invoice:{" "}
              <span className="font-medium">
                {invoice.trim() || "Belum diisi"}
              </span>
            </div>

            <div className="grid grid-cols-[2fr,1fr,auto] items-end gap-3">
              <ProductSearchInput
                value={kode}
                onChange={setKode}
                inputRef={kodeInputRef}
                onEnter={handleAddItem}
                fetchFn={fetchFn}
                onSelect={(product) => {
                  setKode(product.code);
                  setQty("1");
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
              <button
                type="button"
                onClick={handleAddItem}
                className="mb-0.5 inline-flex items-center justify-center rounded-lg bg-blue-500 px-3 py-2 text-xs font-medium text-white hover:bg-blue-600"
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
                      <th className="px-3 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((it) => (
                      <tr key={it.kode} className="border-t last:border-b">
                        <td className="px-3 py-1 font-mono text-xs">
                          {it.kode}
                        </td>
                        <td className="px-3 py-1 text-right">{it.qty}</td>
                        <td className="px-3 py-1 text-center">
                          <button
                            type="button"
                            onClick={() =>
                              setItems((prev) =>
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
              <button
                type="button"
                onClick={() => setStep(1)}
                className="text-gray-500 hover:text-gray-700"
              >
                ← Kembali ke invoice
              </button>
              <span>Total item: {items.length}</span>
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
                Simpan Stok Masuk
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

function StockOutModal({ isOpen, onClose, onApply, fetchFn, location }) {
  const [step, setStep] = useState(1);
  const [invoice, setInvoice] = useState("");
  const [kode, setKode] = useState("");
  const [qty, setQty] = useState("");
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
          }, 0);
    return () => {
      if (timer) {
        window.clearTimeout(timer);
      }
    };
  }, [isOpen]);

  useEffect(() => {
    if (step === 1 && kodeInputRef.current) {
      kodeInputRef.current.focus();
    }
  }, [step]);

  if (!isOpen) return null;

  const handleAddItem = () => {
    const code = kode.trim();
    const nQty = Number(qty || 0);
    if (!code || nQty <= 0) return;

    setItems((prev) => {
      const existingIndex = prev.findIndex(
        (it) => it.kode.toUpperCase() === code.toUpperCase()
      );
      if (existingIndex !== -1) {
        const next = [...prev];
        next[existingIndex] = {
          ...next[existingIndex],
          qty: next[existingIndex].qty + nQty,
        };
        return next;
      }
      return [...prev, { kode: code, qty: nQty }];
    });
    setKode("");
    setQty("");
    if (kodeInputRef.current) kodeInputRef.current.focus();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const success = await onApply({ invoice: invoice.trim(), items });
    if (success !== false) {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-xl">
        <h2 className="mb-4 text-lg font-semibold text-gray-800">
          Stok Keluar
        </h2>

        {location && (
          <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-gray-100 px-3 py-1 text-[11px] font-medium text-gray-700">
            <span className="inline-block h-2 w-2 rounded-full bg-amber-500" />
            Lokasi: {location}
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
            <div className="grid grid-cols-[2fr,1fr,auto] items-end gap-3">
              <ProductSearchInput
                value={kode}
                onChange={setKode}
                inputRef={kodeInputRef}
                onEnter={handleAddItem}
                fetchFn={fetchFn}
                onSelect={(product) => {
                  setKode(product.code);
                  setQty("1");
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
                      <th className="px-3 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((it) => (
                      <tr key={it.kode} className="border-t last:border-b">
                        <td className="px-3 py-1 font-mono text-xs">
                          {it.kode}
                        </td>
                        <td className="px-3 py-1 text-right">{it.qty}</td>
                        <td className="px-3 py-1 text-center">
                          <button
                            type="button"
                            onClick={() =>
                              setItems((prev) =>
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
          <form onSubmit={handleSubmit} className="space-y-3 text-sm">
            <div className="rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600">
              Total item: <span className="font-medium">{items.length}</span>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">
                Nomor Invoice
              </label>
              <input
                type="text"
                value={invoice}
                onChange={(e) => setInvoice(e.target.value.toUpperCase())}
                className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-red-500/60"
                placeholder="Contoh: INV-OUT-00123"
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

// simple fade-in animation
const style = document.createElement("style");
style.innerHTML = `
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}
.animate-fadeIn {
  animation: fadeIn 0.4s ease-in-out;
}
`;
if (typeof document !== "undefined") {
  document.head.appendChild(style);
}
