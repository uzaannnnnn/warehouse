const { z } = require("zod");

const destroyProductionRejectSchema = z.object({
  productCode: z
    .string({ required_error: "Kode produk wajib diisi" })
    .trim()
    .min(1, "Kode produk wajib diisi")
    .transform((val) => val.toUpperCase()),
  location: z
    .string({ required_error: "Lokasi wajib diisi" })
    .trim()
    .min(1, "Lokasi wajib diisi"),
  quantity: z
    .number({ required_error: "Jumlah yang dimusnahkan wajib diisi" })
    .int("Jumlah harus bilangan bulat")
    .min(1, "Jumlah harus lebih dari 0"),
});

module.exports = {
  destroyProductionRejectSchema,
};
