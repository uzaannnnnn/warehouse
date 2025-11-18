const { z } = require("zod");

const requestItemSchema = z.object({
  productCode: z
    .string({ required_error: "Kode produk wajib diisi" })
    .trim()
    .min(1, "Kode produk wajib diisi")
    .transform((val) => val.toUpperCase()),
  quantity: z
    .number({ required_error: "Jumlah wajib diisi" })
    .int("Jumlah harus bilangan bulat")
    .min(1, "Jumlah minimal 1"),
});

const createProductionStockRequestSchema = z.object({
  originLocation: z
    .string({ required_error: "Lokasi asal wajib diisi" })
    .trim()
    .min(1, "Lokasi asal wajib diisi"),
  targetLocation: z
    .string({ required_error: "Lokasi produksi tujuan wajib diisi" })
    .trim()
    .min(1, "Lokasi produksi tujuan wajib diisi"),
  items: z
    .array(requestItemSchema, {
      required_error: "Daftar produk wajib diisi",
    })
    .nonempty("Minimal 1 produk diajukan"),
});

const processProductionStockRequestSchema = z.object({
  note: z
    .string()
    .optional()
    .transform((val) => {
      if (!val) return undefined;
      const trimmed = val.trim();
      return trimmed.length ? trimmed : undefined;
    }),
  items: z
    .array(requestItemSchema)
    .nonempty("Minimal 1 produk harus diproses")
    .optional(),
});

module.exports = {
  createProductionStockRequestSchema,
  processProductionStockRequestSchema,
};
