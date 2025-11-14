import React, { useMemo, useState } from "react";
import {
  FiChevronDown,
  FiChevronUp,
  FiDownload,
  FiEdit2,
  FiFileText,
  FiTrash2,
} from "react-icons/fi";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { formatRupiah, variants as VARIANTS } from "../api/mockData";
import DeleteConfirmModal from "../../../components/common/DeleteConfirmModal";
import TooltipWrapper from "../../../components/common/TooltipWrapper";

export default function ProductTable({
  products,
  brands,
  categories,
  kodeMotors,
  onEdit,
  onDelete,
  page = 1,
  limit = 10,
}) {
  const [expanded, setExpanded] = useState(null);
  const [filterBrand, setFilterBrand] = useState("all");
  const [filterCategory, setFilterCategory] = useState("all");
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);
  const [exporting, setExporting] = useState(false);

  const getBrandName = (id) =>
    typeof id === "object"
      ? id?.name
      : brands.find((b) => b._id === id)?.name || "-";

  const getCategoryName = (id) =>
    typeof id === "object"
      ? id?.name
      : categories.find((c) => c._id === id)?.name || "-";

  const getPriceRange = (product) => {
    const prices = product?.prices || [];
    const allReseller = prices
      .flatMap((pg) => pg.items.map((v) => v.price_reseller))
      .filter((p) => typeof p === "number" && p > 0);
    if (allReseller.length === 0) return "-";
    const min = Math.min(...allReseller);
    const max = Math.max(...allReseller);
    return min === max
      ? formatRupiah(min)
      : `${formatRupiah(min)} - ${formatRupiah(max)}`;
  };

  const getTotalVariants = (product) => {
    if (!product?.prices?.length) return 0;
    return product.prices.reduce(
      (acc, pg) => acc + (pg.items?.length || 0),
      0,
    );
  };

  const getKodeMotorCount = (product) => product?.prices?.length || 0;

  const filteredProducts = useMemo(
    () =>
      products.filter((p) => {
        const matchBrand =
          filterBrand === "all" ||
          (typeof p.brand === "object"
            ? p.brand._id === filterBrand
            : p.brand === filterBrand);
        const matchCategory =
          filterCategory === "all" ||
          (typeof p.category === "object"
            ? p.category._id === filterCategory
            : p.category === filterCategory);
        return matchBrand && matchCategory;
      }),
    [products, filterBrand, filterCategory],
  );

  const handleRowClick = (id) => {
    setExpanded((prev) => (prev === id ? null : id));
  };

  const handleConfirmDelete = async () => {
    if (!itemToDelete) return;
    onDelete(itemToDelete);
    setItemToDelete(null);
    setIsConfirmOpen(false);
  };

  const handleResetFilters = () => {
    setFilterBrand("all");
    setFilterCategory("all");
  };

  const fetchAllProducts = async () => filteredProducts;

  const exportExcelSingleSheet = async () => {
    setExporting(true);
    try {
      const all = await fetchAllProducts();
      const rows = [];
      all.forEach((p) => {
        (p.prices || []).forEach((pg) => {
          const kmName =
            kodeMotors.find((km) => km._id === pg.kodeMotor)?.name || "-";
          (pg.items || []).forEach((v) => {
            rows.push({
              SKU: String(v?.sku || "").trim(),
              NAMA_PRODUK: p?.name || "-",
              BRAND: getBrandName(p?.brand),
              KATEGORI: getCategoryName(p?.category),
              KODE_MOTOR: kmName,
              VARIAN:
                VARIANTS.find((vv) => vv._id === v.variant)?.name || "-",
              HPP: v?.hpp ?? "",
              HARGA_RESELLER: v?.price_reseller ?? "",
              HARGA_SPEEDSHOP: v?.price_speedshop ?? "",
              HARGA_UMUM: v?.price_umum ?? "",
            });
          });
        });
      });

      if (!rows.length) {
        toast.info("Tidak ada data untuk diexport");
        return;
      }

      const header = Object.keys(rows[0]);
      const csv = [
        header.join(","),
        ...rows.map((r) =>
          header
            .map((key) => {
              const raw = r[key] ?? "";
              const val = String(raw).replace(/"/g, '""');
              return `"${val}"`;
            })
            .join(","),
        ),
      ].join("\r\n");

      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const ts = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.setAttribute("download", `produk-${ts}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } finally {
      setExporting(false);
    }
  };

  const buildHtmlTableSection = (title, columns, rows) => {
    const head = columns
      .map(
        (c) =>
          `<th style="padding:4px 8px;border:1px solid #e5e7eb;">${c.header}</th>`,
      )
      .join("");
    const body = rows
      .map(
        (r) =>
          `<tr>${columns
            .map(
              (c) =>
                `<td style="padding:4px 8px;border:1px solid #e5e7eb;font-size:12px;">${
                  r[c.key] ?? ""
                }</td>`,
            )
            .join("")}</tr>`,
      )
      .join("");
    return `<section style="margin-bottom:24px;">
<h2 style="font-size:14px;margin-bottom:8px;">${title}</h2>
<table style="border-collapse:collapse;width:100%;font-family:system-ui;">
<thead style="background:#f3f4f6;"><tr>${head}</tr></thead>
<tbody>${body}</tbody>
</table>
</section>`;
  };

  const openPrintPreview = ({ title, logoSrc, contentHtml }) => {
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${title}</title>
  <style>
    body { font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; padding: 24px; }
    header { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; }
    header img { height: 32px; }
  </style>
</head>
<body>
  <header>
    <img src="${logoSrc}" alt="Logo" />
    <h1 style="font-size:18px;">${title}</h1>
  </header>
  ${contentHtml}
  <script>
    window.onload = function () { window.print(); };
  </script>
</body>
</html>`);
    win.document.close();
  };

  const toSummaryRows = (items) =>
    items.map((p, idx) => ({
      no: idx + 1,
      name: p.name,
      brand: getBrandName(p.brand),
      category: getCategoryName(p.category),
      priceRange: getPriceRange(p),
      variants: getTotalVariants(p),
      kodeMotor: getKodeMotorCount(p),
    }));

  const exportPDF = async () => {
    const summaryColumns = [
      { key: "no", header: "No" },
      { key: "name", header: "Produk" },
      { key: "brand", header: "Brand" },
      { key: "category", header: "Kategori" },
      { key: "priceRange", header: "Harga Reseller" },
      { key: "variants", header: "Total Varian" },
      { key: "kodeMotor", header: "Total Kode Motor" },
    ];
    setExporting(true);
    const all = await fetchAllProducts();
    const summaryRows = toSummaryRows(all);

    const detailTable = (p) => {
      const cols = [
        { key: "kodeMotor", header: "Kode Motor" },
        { key: "variant", header: "Variant" },
        { key: "hpp", header: "HPP" },
        { key: "reseller", header: "Harga Reseller" },
        { key: "umum", header: "Harga Umum" },
      ];
      const rows = (p.prices || []).flatMap((pg) =>
        (pg.items || []).map((v) => ({
          kodeMotor:
            kodeMotors.find((km) => km._id === pg.kodeMotor)?.name || "-",
          variant: VARIANTS.find((vv) => vv._id === v.variant)?.name || "-",
          hpp: formatRupiah(v?.hpp),
          reseller: formatRupiah(v?.price_reseller),
          umum: formatRupiah(v?.price_umum),
        })),
      );
      return buildHtmlTableSection(`Detail Harga: ${p.name}`, cols, rows);
    };

    const summaryHtml = buildHtmlTableSection(
      "Ringkasan Produk",
      summaryColumns,
      summaryRows,
    );

    const detailsHtml = all.map((p) => detailTable(p)).join("");

    const ts = new Date().toLocaleDateString("id-ID").replace(/\//g, "-");
    openPrintPreview({
      title: `Data Produk - ${ts}`,
      logoSrc: "/logo-modifikasiori.webp",
      contentHtml: `${summaryHtml}${detailsHtml}`,
    });
    setExporting(false);
  };

  const EmptyFilterState = ({ title, description }) => (
    <div className="flex flex-col items-center justify-center py-20 text-center animate-fadeIn">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="mb-4 h-24 w-24 text-gray-400"
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
      <h2 className="mb-1 text-lg font-semibold text-gray-700">{title}</h2>
      <p className="mb-4 text-sm text-gray-500">{description}</p>
      <button
        type="button"
        onClick={handleResetFilters}
        className="rounded-lg border px-4 py-2 text-sm hover:bg-gray-100"
      >
        Reset Filter
      </button>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <select
          className="rounded-lg border px-3 py-2"
          value={filterBrand}
          onChange={(e) => setFilterBrand(e.target.value)}
        >
          <option value="all">Semua Brand</option>
          {brands.map((b) => (
            <option key={b._id} value={b._id}>
              {b.name}
            </option>
          ))}
        </select>

        <select
          className="rounded-lg border px-3 py-2"
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
        >
          <option value="all">Semua Kategori</option>
          {categories.map((c) => (
            <option key={c._id} value={c._id}>
              {c.name}
            </option>
          ))}
        </select>

        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={exportExcelSingleSheet}
            disabled={exporting}
            className="inline-flex items-center gap-2 px-3 py-2 bg-white text-gray-800 border rounded-lg shadow-sm hover:bg-gray-50 hover:shadow transition active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 disabled:opacity-50"
            title="Export Excel (.xlsx)"
          >
            <FiDownload /> {exporting ? "Menyiapkan…" : "Export Excel"}
          </button>
          <button
            type="button"
            onClick={exportPDF}
            disabled={exporting}
            className="inline-flex items-center gap-2 px-3 py-2 bg-white text-gray-800 border rounded-lg shadow-sm hover:bg-gray-50 hover:shadow transition active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 disabled:opacity-50"
            title="Export PDF (Print Preview)"
          >
            <FiFileText /> Export PDF
          </button>
        </div>
      </div>

      {filteredProducts.length === 0 ? (
        <EmptyFilterState
          title="Produk tidak ditemukan"
          description="Coba ubah filter atau reset untuk melihat semua produk."
        />
      ) : (
        <div className="overflow-x-hidden rounded-xl border bg-white shadow-sm">
          <table className="min-w-full border-collapse text-sm text-gray-700">
            <thead className="bg-gray-100 text-xs uppercase text-gray-600">
              <tr>
                <th className="w-10 p-3 text-center" />
                <th className="w-12 p-3 text-center">No</th>
                <th className="p-3 text-left">Produk</th>
                <th className="p-3 text-left">Brand</th>
                <th className="p-3 text-left">Kategori</th>
                <th className="p-3 text-left">Harga Reseller</th>
                <th className="p-3 text-left">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.map((p, i) => {
                const isExpanded = expanded === p._id;
                const totalVariants = getTotalVariants(p);
                const totalKodeMotor = getKodeMotorCount(p);
                const priceRange = getPriceRange(p);

                return (
                  <React.Fragment key={p._id}>
                    <motion.tr
                      onClick={() => handleRowClick(p._id)}
                      layout
                      className={`cursor-pointer border-b transition ${
                        isExpanded
                          ? "bg-red-50/60 shadow-[inset_0_2px_6px_rgba(0,0,0,0.05)]"
                          : "hover:bg-gray-50"
                      }`}
                      whileHover={{ scale: 1.002 }}
                    >
                      <td className="text-center">
                        <motion.div
                          animate={{ rotate: isExpanded ? 180 : 0 }}
                          transition={{ duration: 0.25 }}
                          className="inline-flex h-7 w-7 items-center justify-center"
                        >
                          {isExpanded ? (
                            <FiChevronUp className="h-4 w-4 text-gray-500" />
                          ) : (
                            <FiChevronDown className="h-4 w-4 text-gray-500" />
                          )}
                        </motion.div>
                      </td>
                      <td className="p-3 text-center text-xs font-medium text-gray-700">
                        {((Number(page) || 1) - 1) * (Number(limit) || 10) +
                          i +
                          1}
                      </td>
                      <td className="flex items-center gap-3 p-3">
                        <img
                          src={p.image || "/placeholder.png"}
                          alt={p.name}
                          className="h-12 w-12 rounded-md border object-cover"
                        />
                        <span className="font-medium text-gray-800">
                          {p.name}
                        </span>
                      </td>
                      <td className="p-3">{getBrandName(p.brand)}</td>
                      <td className="p-3">{getCategoryName(p.category)}</td>
                      <td className="p-3">{priceRange}</td>
                      <td
                        className="p-3"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center gap-2">
                          <TooltipWrapper label="Edit">
                            <button
                              type="button"
                              onClick={() => onEdit(p)}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-emerald-500 text-white hover:bg-emerald-600"
                            >
                              <FiEdit2 className="h-4 w-4" />
                            </button>
                          </TooltipWrapper>
                          <TooltipWrapper label="Hapus">
                            <button
                              type="button"
                              onClick={() => {
                                setItemToDelete(p);
                                setIsConfirmOpen(true);
                              }}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-red-500 text-white hover:bg-red-600"
                            >
                              <FiTrash2 className="h-4 w-4" />
                            </button>
                          </TooltipWrapper>
                        </div>
                      </td>
                    </motion.tr>

                    <AnimatePresence>
                      {isExpanded && (
                        <motion.tr
                          key={`expanded-${p._id}`}
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.3 }}
                        >
                          <td colSpan={10} className="bg-white p-3">
                            <motion.div
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -10 }}
                              transition={{ duration: 0.25 }}
                              className="flex items-start gap-6 overflow-x-auto"
                            >
                              <div className="max-h-[300px] w-[320px] overflow-y-auto rounded-xl border bg-gray-50 p-3 text-sm text-gray-600 shadow-sm">
                                <strong className="text-gray-700">
                                  Deskripsi Produk:
                                </strong>
                                <p className="mt-1 whitespace-pre-wrap break-words leading-relaxed">
                                  {p.description || "-"}
                                </p>
                              </div>

                              <div className="flex-1">
                                {p.prices?.length ? (
                                  <div className="overflow-x-auto">
                                    <table className="w-full border-collapse text-xs shadow-sm">
                                      <thead>
                                        <tr className="bg-gray-100 text-gray-600">
                                          <th className="p-2 text-left">
                                            Kode Motor
                                          </th>
                                          <th className="p-2 text-left">
                                            Variant
                                          </th>
                                          <th className="p-2 text-left">HPP</th>
                                          <th className="p-2 text-left">
                                            Harga Reseller
                                          </th>
                                          <th className="p-2 text-left">
                                            Harga Umum
                                          </th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {p.prices.map((pg) =>
                                          pg.items.map((v) => (
                                            <tr
                                              key={`${pg.kodeMotor}-${v.sku}`}
                                              className="border-b hover:bg-gray-50"
                                            >
                                              <td className="p-2">
                                                {kodeMotors.find(
                                                  (km) =>
                                                    km._id === pg.kodeMotor,
                                                )?.name || "-"}
                                              </td>
                                              <td className="p-2">
                                                {VARIANTS.find(
                                                  (vv) => vv._id === v.variant,
                                                )?.name || "-"}
                                              </td>
                                              <td className="p-2 text-gray-800">
                                                {formatRupiah(v.hpp)}
                                              </td>
                                              <td className="p-2 text-gray-800">
                                                {formatRupiah(
                                                  v.price_reseller,
                                                )}
                                              </td>
                                              <td className="p-2 text-gray-800">
                                                {formatRupiah(v.price_umum)}
                                              </td>
                                            </tr>
                                          )),
                                        )}
                                      </tbody>
                                    </table>
                                  </div>
                                ) : (
                                  <p className="text-sm italic text-gray-500">
                                    Belum ada data harga.
                                  </p>
                                )}

                                <div className="mt-3 flex items-center justify-between rounded-md border bg-gray-50 p-2 text-xs text-gray-600">
                                  <span>
                                    <strong>{totalKodeMotor}</strong> Kode Motor
                                  </span>
                                  <span>
                                    <strong>{totalVariants}</strong> Varian
                                  </span>
                                  <span>Rentang: {priceRange}</span>
                                </div>
                              </div>
                            </motion.div>
                          </td>
                        </motion.tr>
                      )}
                    </AnimatePresence>
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <DeleteConfirmModal
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        onConfirm={handleConfirmDelete}
        itemName={itemToDelete?.name || "produk ini"}
      />
    </div>
  );
}
