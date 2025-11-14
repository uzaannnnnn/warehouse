import { useEffect, useRef, useState } from "react";
import {
  FiBox,
  FiEdit2,
  FiPrinter,
  FiSearch,
  FiTrash2,
  FiX,
} from "react-icons/fi";
import { toast } from "sonner";
import Pagination from "../../../components/common/Pagination";
import EditProductModal from "../components/EditProductModal";
import Barcode from "../../../components/common/Barcode";
import DeleteConfirmModal from "../../../components/common/DeleteConfirmModal";
import {
  fetchBrands,
  fetchCategories,
  fetchKodeMotors,
  fetchProductById,
  fetchProductsPaged,
  fetchVariants,
  deleteProductById,
  upsertProduct,
} from "../api/mockData";
import { playSuccessSound } from "../../../utils/sound";

const SAMPLE_ROWS = [
  {
    kode: "KVB-CH",
    nama: "MANGKOK GANDA KVB",
    kategori: "1.1 CH-MANGKOK GANDA (MENTAH)",
    jumlah: "565",
    hargaBeli: "56.500",
    hargaJual: "-",
  },
  {
    kode: "K16-CH",
    nama: "MANGKOK GANDA K16",
    kategori: "1.1 CH-MANGKOK GANDA (MENTAH)",
    jumlah: "15",
    hargaBeli: "52.500",
    hargaJual: "-",
  },
  {
    kode: "KVY-CH",
    nama: "MANGKOK GANDA KVY",
    kategori: "1.1 CH-MANGKOK GANDA (MENTAH)",
    jumlah: "295",
    hargaBeli: "52.500",
    hargaJual: "-",
  },
  {
    kode: "B74-CH",
    nama: "MANGKOK GANDA B74",
    kategori: "1.1 CH-MANGKOK GANDA (MENTAH)",
    jumlah: "40",
    hargaBeli: "216.000",
    hargaJual: "-",
  },
  {
    kode: "2PH-CH",
    nama: "MANGKOK GANDA 2PH",
    kategori: "1.1 CH-MANGKOK GANDA (MENTAH)",
    jumlah: "209",
    hargaBeli: "100.000",
    hargaJual: "-",
  },
];

export default function ProductsPage() {
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);
  const [kodeMotors, setKodeMotors] = useState([]);
  const [variants, setVariants] = useState([]);

  const [detailProduct, setDetailProduct] = useState(null);
  const [editProduct, setEditProduct] = useState(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const [allProducts, setAllProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [rows, setRows] = useState(SAMPLE_ROWS);
  const [printRow, setPrintRow] = useState(null);
  const [printQty, setPrintQty] = useState("1");
  const [editRow, setEditRow] = useState(null);
  const [deleteIndex, setDeleteIndex] = useState(null);
  const [isStockOpen, setIsStockOpen] = useState(false);
  const [isStockOutOpen, setIsStockOutOpen] = useState(false);

  const reloadLookups = async () => {
    try {
      const [catRes, brandRes, kmRes, varRes] = await Promise.all([
        fetchCategories(),
        fetchBrands(),
        fetchKodeMotors(),
        fetchVariants(),
      ]);
      setCategories(catRes);
      setBrands(brandRes);
      setKodeMotors(kmRes);
      setVariants(varRes);
    } catch (err) {
      console.error("❌ Error reload lookups:", err.message);
    }
  };

  const reloadPage = async (targetPage = page) => {
    try {
      setLoading(true);
      const q = (searchTerm || "").trim();
      const searchParam = q.length ? q : undefined;
      const data = await fetchProductsPaged({
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
    let active = true;
    async function loadProducts() {
      try {
        setLoading(true);
        const q = (searchTerm || "").trim();
        const searchParam = q.length ? q : undefined;
        const data = await fetchProductsPaged({
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
  }, [page, limit, searchTerm]);

  useEffect(() => {
    reloadLookups();
  }, []);

  const handleAddProduct = async (newProduct) => {
    await upsertProduct(newProduct);
    await reloadLookups();
    if (page !== 1) {
      setPage(1);
    } else {
      await reloadPage(1);
    }
  };

  const handleUpdateProduct = async (updatedProduct) => {
    if (!updatedProduct?._id) return;
    await upsertProduct(updatedProduct);
    await reloadLookups();
    await reloadPage();
  };

  const handleDeleteProduct = async (product) => {
    try {
      await deleteProductById(product._id);
      toast.success(`Produk "${product.name}" berhasil dihapus 🗑️`);
      if (allProducts.length === 1 && page > 1) {
        setPage((p) => p - 1);
      } else {
        await reloadPage();
      }
    } catch (err) {
      console.error("❌ Gagal hapus product:", err.message);
      toast.error("Gagal menghapus produk ❌");
    }
  };

  const handleRefreshSingleProduct = async (productId) => {
    try {
      const full = await fetchProductById(productId);
      setAllProducts((prev) =>
        prev.map((p) => (p._id === productId ? full : p))
      );
      setDetailProduct(full);
      if (editProduct?._id === productId) setEditProduct(full);
    } catch (err) {
      console.error("❌ Gagal reload product:", err.message);
    }
  };

  useEffect(() => {
    const t = setTimeout(() => setPage(1), 300);
    return () => clearTimeout(t);
  }, [searchTerm]);

  const hasAnyProduct = totalItems > 0;

  const handleApplyStock = ({ invoice, items }) => {
    if (!items.length) {
      toast.info("Tidak ada item stok yang ditambahkan");
      return;
    }

    setRows((prev) => {
      const updated = [...prev];
      items.forEach(({ kode, qty }) => {
        const idx = updated.findIndex(
          (r) => r.kode.toUpperCase() === String(kode).toUpperCase()
        );
        if (idx === -1) return;
        const base =
          Number(String(updated[idx].jumlah).replace(/[^\d]/g, "")) || 0;
        updated[idx] = {
          ...updated[idx],
          jumlah: (base + qty).toLocaleString("id-ID"),
        };
      });
      return updated;
    });

    toast.success(
      `Stok masuk berhasil disimpan${invoice ? ` (Invoice ${invoice})` : ""}`
    );
    playSuccessSound();
  };

  const handleApplyStockOut = ({ invoice, items }) => {
    if (!items.length) {
      toast.info("Tidak ada item stok yang dikurangi");
      return;
    }

    setRows((prev) => {
      const updated = [...prev];
      items.forEach(({ kode, qty }) => {
        const idx = updated.findIndex(
          (r) => r.kode.toUpperCase() === String(kode).toUpperCase(),
        );
        if (idx === -1) return;
        const base =
          Number(String(updated[idx].jumlah).replace(/[^\d]/g, "")) || 0;
        const nextVal = Math.max(0, base - qty);
        updated[idx] = {
          ...updated[idx],
          jumlah: nextVal.toLocaleString("id-ID"),
        };
      });
      return updated;
    });

    toast.success(
      `Stok keluar berhasil disimpan${invoice ? ` (Invoice ${invoice})` : ""}`,
    );
    playSuccessSound();
  };

  return (
    <div className="p-6 bg-gray-50 min-h-[90vh] rounded-2xl animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
        <h1 className="text-3xl font-extrabold text-gray-800 tracking-tight flex items-center gap-2 mb-7">
          <FiBox className="text-red-500" /> Daftar Produk
        </h1>

        <div className="flex w-full flex-col gap-3 md:w-auto md:flex-row md:items-center">
          <div className="relative flex-grow max-w-md">
            <input
              type="text"
              placeholder="Cari produk..."
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

          <div className="flex gap-2 md:ml-3">
            <button
              type="button"
              onClick={() => setIsStockOpen(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-500 text-sm font-medium text-white shadow-sm hover:bg-blue-600"
            >
              Stok Masuk
            </button>
            <button
              type="button"
              onClick={() => setIsStockOutOpen(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500 text-sm font-medium text-white shadow-sm hover:bg-amber-600"
            >
              Stok Keluar
            </button>
            <button
              type="button"
              onClick={() => setIsCreateOpen(true)}
              className="flex items-center gap-2 px-5 py-2 bg-red-500 hover:bg-red-600 cursor-pointer text-white rounded-lg"
            >
              <span className="text-xl">+</span> Tambah Produk
            </button>
          </div>
        </div>
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
          <table className="min-w-full border-collapse text-sm text-gray-700">
            <thead className="bg-gray-100 text-xs uppercase text-gray-600">
              <tr>
                <th className="w-12 p-3 text-center">No.</th>
                <th className="p-3 text-left">Kode Produk</th>
                <th className="p-3 text-center">Barcode</th>
                <th className="p-3 text-left">Nama Produk</th>
                <th className="p-3 text-left">Kategori</th>
                <th className="p-3 text-right">Jumlah</th>
                <th className="p-3 text-right">Harga Pembelian (Rp)</th>
                <th className="p-3 text-right">Harga Jual (Rp)</th>
                <th className="w-32 p-3 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={row.kode} className="border-t hover:bg-gray-50">
                  <td className="p-3 text-center text-xs font-medium text-gray-600">
                    {index + 1}
                  </td>
                  <td className="p-3 font-mono text-sm text-gray-800">
                    {row.kode}
                  </td>
                  <td className="p-3 text-center text-gray-900">
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
                  <td className="p-3 font-medium text-gray-900">{row.nama}</td>
                  <td className="p-3 text-gray-700">{row.kategori}</td>
                  <td className="p-3 text-right text-gray-800">{row.jumlah}</td>
                  <td className="p-3 text-right text-gray-800">
                    {row.hargaBeli}
                  </td>
                  <td className="p-3 text-right text-gray-800">
                    {row.hargaJual}
                  </td>
                  <td className="p-3 text-center">
                    <div className="inline-flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setEditRow({ index, row })}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500 text-white hover:bg-emerald-600"
                        title="Edit data"
                      >
                        <FiEdit2 className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteIndex(index)}
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
            Menampilkan {allProducts.length ? (page - 1) * limit + 1 : 0} -{" "}
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

      <RowEditModal
        data={editRow}
        onClose={() => setEditRow(null)}
        onSave={(updated) => {
          setRows((prev) =>
            prev.map((r, i) => (i === updated.index ? updated.row : r))
          );
          setEditRow(null);
        }}
      />

      <DeleteConfirmModal
        isOpen={deleteIndex !== null}
        onClose={() => setDeleteIndex(null)}
        onConfirm={() => {
          if (deleteIndex === null) return;
          const item = rows[deleteIndex];
          setRows((prev) => prev.filter((_, i) => i !== deleteIndex));
          setDeleteIndex(null);
          toast.success(`Produk "${item?.nama}" dihapus dari daftar`);
          playSuccessSound();
        }}
        itemName={
          deleteIndex !== null ? rows[deleteIndex]?.nama || "produk ini" : ""
        }
        title="Konfirmasi Hapus Produk"
        confirmLabel="Hapus"
        verb="menghapus"
      />

      <StockInModal
        isOpen={isStockOpen}
        onClose={() => setIsStockOpen(false)}
        onApply={handleApplyStock}
      />

      <StockOutModal
        isOpen={isStockOutOpen}
        onClose={() => setIsStockOutOpen(false)}
        onApply={handleApplyStockOut}
      />
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
        className="mb-4 h-28 w-28 text-red-400"
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
        className="mb-4 h-28 w-28 text-gray-400"
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
      <h2 className="mb-1 text-xl font-semibold text-gray-700">{title}</h2>
      <p className="mb-5 text-sm text-gray-500">{description}</p>
      <button
        type="button"
        onClick={onButtonClick}
        className="rounded-lg bg-red-500 px-5 py-2 text-sm text-white shadow-md transition-all hover:bg-red-600"
      >
        {buttonText}
      </button>
    </div>
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

function RowEditModal({ data, onSave, onClose }) {
  const [kode, setKode] = useState("");
  const [nama, setNama] = useState("");
  const [kategori, setKategori] = useState("");
  const [hargaBeli, setHargaBeli] = useState("");
  const [hargaJual, setHargaJual] = useState("");

  useEffect(() => {
    if (!data) return;
    setKode(data.row.kode);
    setNama(data.row.nama);
    setKategori(data.row.kategori);
    setHargaBeli(data.row.hargaBeli);
    setHargaJual(data.row.hargaJual);
  }, [data]);

  if (!data) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({
      index: data.index,
      row: {
        ...data.row,
        kode,
        nama,
        kategori,
        hargaBeli,
        hargaJual,
      },
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
        <h2 className="mb-4 text-lg font-semibold text-gray-800">
          Edit Produk
        </h2>
        <form onSubmit={handleSubmit} className="space-y-3 text-sm">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">
              Kode Produk
            </label>
            <input
              value={kode}
              onChange={(e) => setKode(e.target.value.toUpperCase())}
              className="w-full rounded-lg border px-3 py-2 text-sm font-mono outline-none focus:ring-2 focus:ring-red-500/60"
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">
              Nama Produk
            </label>
            <input
              value={nama}
              onChange={(e) => setNama(e.target.value)}
              className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-red-500/60"
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">
              Kategori
            </label>
            <input
              value={kategori}
              onChange={(e) => setKategori(e.target.value)}
              className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-red-500/60"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">
                Harga Pembelian (Rp)
              </label>
              <input
                value={hargaBeli}
                onChange={(e) => setHargaBeli(e.target.value)}
                className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-red-500/60"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">
                Harga Jual (Rp)
              </label>
              <input
                value={hargaJual}
                onChange={(e) => setHargaJual(e.target.value)}
                className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-red-500/60"
              />
            </div>
          </div>
          <p className="mt-1 text-xs text-gray-500">
            Jumlah / stok tidak bisa diubah dari sini.
          </p>

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
              Simpan
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function StockInModal({ isOpen, onClose, onApply }) {
  const [step, setStep] = useState(1);
  const [invoice, setInvoice] = useState("");
  const [kode, setKode] = useState("");
  const [qty, setQty] = useState("");
  const [items, setItems] = useState([]);
  const kodeInputRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;
    setStep(1);
    setInvoice("");
    setKode("");
    setQty("");
    setItems([]);
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

  const handleSubmit = (e) => {
    e.preventDefault();
    onApply({ invoice: invoice.trim(), items });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-xl">
        <h2 className="mb-4 text-lg font-semibold text-gray-800">Stok Masuk</h2>

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
                onChange={(e) => setInvoice(e.target.value)}
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
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">
                  Scan / Kode Produk
                </label>
                <input
                  ref={kodeInputRef}
                  type="text"
                  value={kode}
                  onChange={(e) => setKode(e.target.value.toUpperCase())}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddItem();
                    }
                  }}
                  className="w-full rounded-lg border px-3 py-2 text-sm font-mono outline-none focus:ring-2 focus:ring-red-500/60"
                  placeholder="Scan / ketik kode"
                />
              </div>
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

function StockOutModal({ isOpen, onClose, onApply }) {
  const [step, setStep] = useState(1);
  const [invoice, setInvoice] = useState("");
  const [kode, setKode] = useState("");
  const [qty, setQty] = useState("");
  const [items, setItems] = useState([]);
  const kodeInputRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;
    setStep(1);
    setInvoice("");
    setKode("");
    setQty("");
    setItems([]);
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
        (it) => it.kode.toUpperCase() === code.toUpperCase(),
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

  const handleSubmit = (e) => {
    e.preventDefault();
    onApply({ invoice: invoice.trim(), items });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-xl">
        <h2 className="mb-4 text-lg font-semibold text-gray-800">
          Stok Keluar
        </h2>

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
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">
                  Scan / Kode Produk
                </label>
                <input
                  ref={kodeInputRef}
                  type="text"
                  value={kode}
                  onChange={(e) => setKode(e.target.value.toUpperCase())}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddItem();
                    }
                  }}
                  className="w-full rounded-lg border px-3 py-2 text-sm font-mono outline-none focus:ring-2 focus:ring-red-500/60"
                  placeholder="Scan / ketik kode"
                />
              </div>
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
                      <tr
                        key={it.kode}
                        className="border-t last:border-b"
                      >
                        <td className="px-3 py-1 font-mono text-xs">
                          {it.kode}
                        </td>
                        <td className="px-3 py-1 text-right">{it.qty}</td>
                        <td className="px-3 py-1 text-center">
                          <button
                            type="button"
                            onClick={() =>
                              setItems((prev) =>
                                prev.filter((p) => p.kode !== it.kode),
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
              Total item:{" "}
              <span className="font-medium">{items.length}</span>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">
                Nomor Invoice
              </label>
              <input
                type="text"
                value={invoice}
                onChange={(e) => setInvoice(e.target.value)}
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
