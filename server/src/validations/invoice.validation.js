const { z } = require("zod");

const invoiceItemSchema = z.object({
  productCode: z
    .string({ required_error: "Kode produk wajib diisi" })
    .min(1, "Kode produk wajib diisi")
    .transform((val) => val.trim().toUpperCase()),
  quantity: z
    .number({ required_error: "Jumlah wajib diisi" })
    .int("Jumlah harus bilangan bulat")
    .positive("Jumlah harus lebih dari 0"),
});

const createInvoiceSchema = z.object({
  invoiceNumber: z
    .string()
    .optional()
    .transform((val) => (val && val.trim().length ? val.trim() : undefined)),
  type: z.enum(["in", "out"], {
    required_error: "Tipe invoice wajib diisi",
  }),
  date: z
    .union([z.string().datetime().optional(), z.date().optional()])
    .optional(),
  location: z
    .string()
    .optional()
    .transform((val) => (val && val.trim().length ? val.trim() : undefined)),
  segment: z
    .enum(["finished", "raw"])
    .optional(),
  items: z
    .array(invoiceItemSchema, {
      required_error: "Minimal satu item harus ditambahkan",
    })
    .min(1, "Minimal satu item harus ditambahkan"),
});

module.exports = {
  createInvoiceSchema,
};
