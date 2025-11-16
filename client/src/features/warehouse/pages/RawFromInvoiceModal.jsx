import { useState } from "react";
import { FiArrowRight, FiSearch, FiX } from "react-icons/fi";
import { toast } from "sonner";
import { fetchInvoices, claimInvoiceForProduction } from "../api/invoices";

export default function RawFromInvoiceModal({
  isOpen,
  onClose,
  onLoaded,
  rawLocation,
}) {
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleLoad = async (e) => {
    e.preventDefault();
    const inv = invoiceNumber.trim();
    if (!inv) {
      toast.error("Nomor invoice wajib diisi");
      return;
    }
    try {
      setLoading(true);
      const data = await fetchInvoices({
        page: 1,
        limit: 10,
        search: inv,
        segment: "raw",
        location: rawLocation,
      });
      const items = Array.isArray(data?.items) ? data.items : [];
      const matched = items.find(
        (it) =>
          String(it.invoiceNumber || "").trim().toUpperCase() ===
          inv.toUpperCase(),
      );
      if (!matched) {
        toast.error("Invoice tidak ditemukan");
        return;
      }
      if (matched.type !== "out" || matched.segment !== "raw") {
        toast.error("Invoice harus stok keluar bahan baku");
        return;
      }
      if (matched.productionClaimed) {
        toast.error("Invoice ini sudah diklaim untuk produksi");
        return;
      }
      const nextRaw = (matched.items || []).map((it) => ({
        kode: it.productCode,
        qty: it.quantity,
        name: it.productName,
      }));
      if (!nextRaw.length) {
        toast.error("Invoice tidak memiliki item bahan baku");
        return;
      }

      const normalizedInvoice = String(matched.invoiceNumber || "")
        .trim()
        .toUpperCase();

      await claimInvoiceForProduction(normalizedInvoice);
      onLoaded({
        invoiceNumber: normalizedInvoice,
        rawItems: nextRaw,
      });
      onClose();
      toast.success("Bahan baku dimuat dari invoice");
    } catch (err) {
      console.error("Gagal mengambil invoice:", err.message);
      toast.error("Gagal mengambil data invoice");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FiArrowRight className="text-amber-500" />
            <div>
              <h2 className="text-sm font-semibold text-gray-800">
                Ambil Bahan Baku dari Invoice
              </h2>
              <p className="text-xs text-gray-500">
                Masukkan nomor invoice stok keluar bahan baku.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-gray-300 p-1 text-gray-500 hover:bg-gray-100"
          >
            <FiX />
          </button>
        </div>

        <form onSubmit={handleLoad} className="space-y-4 text-sm">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">
              Nomor Invoice
            </label>
            <div className="relative">
              <FiSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value.toUpperCase())}
                className="w-full rounded-lg border pl-9 pr-3 py-2 text-sm outline-none focus:ring-2 focus:ring-red-500/60"
                placeholder="Contoh: INV-RAW-00123"
              />
            </div>
          </div>

          <div className="mt-3 flex justify-end gap-2 text-xs">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border px-4 py-2 font-medium text-gray-700 hover:bg-gray-100"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-500 px-4 py-2 font-medium text-white hover:bg-blue-600 disabled:opacity-60"
            >
              <FiArrowRight />
              {loading ? "Memuat..." : "Muat Bahan Baku"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
