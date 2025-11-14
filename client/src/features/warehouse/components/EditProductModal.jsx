import { useEffect, useState } from "react";
import ComboBoxWithCreate from "./ComboBoxWithCreate";

const formatRupiahInput = (value) => {
  const digits = String(value || "").replace(/[^\d]/g, "");
  if (!digits) return "";
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
};

const parseRupiahToNumber = (str) => {
  const cleaned = String(str || "").replace(/[^\d]/g, "");
  if (!cleaned) return 0;
  return Number(cleaned);
};

export default function EditProductModal({
  isOpen,
  onClose,
  product,
  onSave,
  categoryList,
}) {
  const [kode, setKode] = useState("");
  const [name, setName] = useState("");
  const [category, setCategory] = useState(null);
  const [hargaBeli, setHargaBeli] = useState("");
  const [hargaJual, setHargaJual] = useState("");
  const [categories, setCategories] = useState(categoryList || []);

  useEffect(() => {
    if (!isOpen) return;
    setKode(product?.kode || product?.kodeProduk || "");
    setName(product?.name || product?.nama || "");
    const catValue =
      typeof product?.category === "object"
        ? product.category
        : (categoryList || []).find((c) => c._id === product?.category) ||
          null;
    setCategory(catValue);
    const rawBeli =
      product?.hargaBeli ?? product?.harga_pembelian ?? "";
    const rawJual =
      product?.hargaJual ?? product?.harga_jual ?? "";

    setHargaBeli(formatRupiahInput(rawBeli));
    setHargaJual(formatRupiahInput(rawJual));
    setCategories(categoryList || []);
  }, [isOpen, product, categoryList]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    const payload = {
      ...(product || {}),
      kodeProduk: kode,
      name,
      category: category?._id || category,
      hargaBeli: parseRupiahToNumber(hargaBeli),
      hargaJual: parseRupiahToNumber(hargaJual),
    };
    onSave(payload);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
        <h2 className="mb-4 text-lg font-semibold text-gray-800">
          {product ? "Edit Produk" : "Tambah Produk"}
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
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-red-500/60"
              required
            />
          </div>
          <ComboBoxWithCreate
            label="Kategori"
            items={categories}
            value={category}
            onChange={setCategory}
            onAddNew={(newItem) => {
              setCategories((prev) => [...prev, newItem]);
            }}
          />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">
                Harga Pembelian (Rp)
              </label>
              <input
                type="text"
                value={hargaBeli}
                onChange={(e) => setHargaBeli(formatRupiahInput(e.target.value))}
                className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-red-500/60"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">
                Harga Jual (Rp)
              </label>
              <input
                type="text"
                value={hargaJual}
                onChange={(e) => setHargaJual(formatRupiahInput(e.target.value))}
                className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-red-500/60"
              />
            </div>
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
              Simpan
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
