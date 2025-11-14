const { z } = require("zod");

const productionItemSchema = z.object({
  productCode: z
    .string({ required_error: "Kode produk wajib diisi" })
    .min(1, "Kode produk wajib diisi")
    .transform((val) => val.trim().toUpperCase()),
  quantity: z
    .number({ required_error: "Jumlah wajib diisi" })
    .int()
    .min(1, "Jumlah wajib lebih dari 0"),
});

const createProductionSchema = z.object({
  invoiceNumber: z
    .string()
    .trim()
    .min(1, "Nomor invoice wajib diisi"),
  productionNumber: z
    .string()
    .trim()
    .min(1, "Nomor produksi wajib diisi"),
  date: z
    .string()
    .datetime()
    .optional()
    .or(z.string().min(1).optional()),
  rawItems: z
    .array(productionItemSchema)
    .nonempty("Minimal 1 bahan baku"),
  finishedItems: z
    .array(productionItemSchema)
    .nonempty("Minimal 1 produk jadi"),
});

module.exports = {
  createProductionSchema,
};
