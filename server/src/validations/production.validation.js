const { z } = require("zod");

const productionItemSchema = z.object({
  productCode: z
    .string({ required_error: "Kode produk wajib diisi" })
    .min(1, "Kode produk wajib diisi")
    .transform((val) => val.trim().toUpperCase()),
  quantity: z
    .number({ required_error: "Jumlah wajib diisi" })
    .int("Jumlah harus bilangan bulat")
    .min(1, "Jumlah wajib lebih dari 0"),
});

const createProductionSchema = z.object({
  productionNumber: z
    .string({ required_error: "Nomor produksi wajib diisi" })
    .trim()
    .min(1, "Nomor produksi wajib diisi"),

  location: z
    .string({ required_error: "Lokasi wajib diisi" })
    .trim()
    .min(1, "Lokasi wajib diisi"),

  date: z
    .string()
    .trim()
    .optional(),

  rawItems: z
    .array(productionItemSchema, {
      required_error: "Daftar bahan baku wajib diisi",
    })
    .nonempty("Minimal 1 bahan baku"),

  finishedItems: z
    .array(productionItemSchema, {
      required_error: "Daftar produk jadi wajib diisi",
    })
    .nonempty("Minimal 1 produk jadi"),
});

module.exports = {
  createProductionSchema,
};