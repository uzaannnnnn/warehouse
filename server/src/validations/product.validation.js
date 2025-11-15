const { z } = require("zod");

const baseProductSchema = z.object({
  code: z
    .string({ required_error: "Kode produk wajib diisi" })
    .min(1, "Kode produk wajib diisi")
    .transform((val) => val.trim().toUpperCase()),
  name: z
    .string({ required_error: "Nama produk wajib diisi" })
    .min(1, "Nama produk wajib diisi"),
  category: z
    .string()
    .trim()
    .optional()
    .transform((val) => (val ? val : undefined)),
  location: z
    .string()
    .optional()
    .transform((val) => (val ? val.trim() : undefined)),
  stock: z.number().int().min(0).optional(),
  purchasePrice: z.number().min(0).optional(),
  sellingPrice: z.number().min(0).optional(),
});

const createProductSchema = baseProductSchema.extend({
  stock: z.number().int().min(0).optional().default(0),
});

const updateProductSchema = baseProductSchema.partial();

module.exports = {
  createProductSchema,
  updateProductSchema,
};
