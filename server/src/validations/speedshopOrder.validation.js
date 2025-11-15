const { z } = require("zod");

const objectIdSchema = z
  .string({ required_error: "Produk wajib dipilih" })
  .trim()
  .regex(/^[0-9a-fA-F]{24}$/, "ID produk tidak valid");

const numberFromInput = (options = {}) =>
  z.preprocess((val) => {
    if (val === undefined || val === null || val === "") {
      return options.fallbackUndefined ? undefined : 0;
    }
    const parsed = Number(val);
    if (Number.isNaN(parsed)) {
      return val;
    }
    return parsed;
  }, options.schema || z.number());

const positiveIntegerField = () =>
  numberFromInput({ schema: z.number().int().min(1, "Jumlah minimal 1") });

const nonNegativeNumberField = () =>
  numberFromInput({ schema: z.number().min(0, "Nilai tidak boleh negatif") });

const optionalNonNegativeNumber = () =>
  numberFromInput({
    fallbackUndefined: true,
    schema: z.number().min(0, "Nilai tidak boleh negatif").optional(),
  });

const orderDateField = z
  .string()
  .trim()
  .optional()
  .refine(
    (val) => {
      if (!val) return true;
      const parsed = new Date(val);
      return !Number.isNaN(parsed.getTime());
    },
    { message: "Tanggal order tidak valid" },
  );

const partSchema = z.object({
  productId: objectIdSchema,
  productCode: z
    .string()
    .trim()
    .optional(),
  productName: z
    .string()
    .trim()
    .optional(),
  quantity: positiveIntegerField(),
  unitPrice: nonNegativeNumberField(),
});

const serviceSchema = z.object({
  name: z
    .string({ required_error: "Nama jasa servis wajib diisi" })
    .trim()
    .min(1, "Nama jasa servis wajib diisi"),
  cost: nonNegativeNumberField().optional().default(0),
});

const statusEnum = z.enum(["draft", "pending_payment", "completed"]);

const baseSchema = z.object({
  location: z
    .string({ required_error: "Lokasi Speedshop wajib dipilih" })
    .trim()
    .min(1, "Lokasi Speedshop wajib dipilih"),
  orderType: z.enum(["parts-only", "service"], {
    required_error: "Jenis order wajib dipilih",
  }),
  orderDate: orderDateField,
  invoiceNumber: z
    .string()
    .trim()
    .optional(),
  customerName: z
    .string({ required_error: "Nama customer wajib diisi" })
    .trim()
    .min(1, "Nama customer wajib diisi"),
  customerPhone: z
    .string()
    .trim()
    .optional(),
  customerAddress: z
    .string()
    .trim()
    .optional(),
  customerNote: z
    .string()
    .trim()
    .optional(),
  vehiclePlate: z
    .string()
    .trim()
    .optional(),
  vehicleType: z
    .string()
    .trim()
    .optional(),
  vehicleKm: optionalNonNegativeNumber(),
  vehicleYear: numberFromInput({
    fallbackUndefined: true,
    schema: z.number().int().min(1900).max(2100).optional(),
  }),
  mechanicName: z
    .string()
    .trim()
    .optional(),
  paymentMethod: z
    .string()
    .trim()
    .optional(),
  parts: z.array(partSchema).default([]),
  services: z.array(serviceSchema).default([]),
  status: statusEnum.optional(),
});

const withBusinessRules = (schema) =>
  schema.superRefine((data, ctx) => {
    const effectiveStatus = data.status || "draft";
    const isDraft = effectiveStatus === "draft";

    if (!isDraft) {
      const partsProvided = Array.isArray(data.parts);
      const servicesProvided = Array.isArray(data.services);

      if (partsProvided || servicesProvided) {
        const partsCount = partsProvided ? data.parts.length : 0;
        const servicesCount = servicesProvided ? data.services.length : 0;

        if (partsCount === 0 && servicesCount === 0) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Minimal harus ada satu parts atau jasa servis",
            path: ["parts"],
          });
        }
      }
    }

    if (!isDraft && data.orderType === "service") {
      const requiredFields = [
        ["invoiceNumber", "No. Invoice wajib diisi untuk servis"],
        ["vehiclePlate", "No. Polisi wajib diisi untuk servis"],
        ["vehicleType", "Jenis kendaraan wajib diisi untuk servis"],
        ["vehicleKm", "KM kendaraan wajib diisi untuk servis"],
        ["vehicleYear", "Tahun kendaraan wajib diisi untuk servis"],
        ["mechanicName", "Nama mekanik wajib diisi untuk servis"],
        ["paymentMethod", "Metode pembayaran wajib diisi untuk servis"],
      ];

      requiredFields.forEach(([field, message]) => {
        const value = data[field];
        if (value === undefined || value === null || value === "") {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message,
            path: [field],
          });
        }
      });
    }
  });

const createSpeedshopOrderSchema = withBusinessRules(baseSchema);

const updateSpeedshopOrderSchema = withBusinessRules(
  baseSchema
    .partial()
    .extend({
      parts: z.array(partSchema).optional(),
      services: z.array(serviceSchema).optional(),
      status: statusEnum.optional(),
    })
    .refine(
      (data) =>
        data.parts !== undefined ||
        data.services !== undefined ||
        data.status !== undefined ||
        data.customerName !== undefined ||
        data.orderType !== undefined ||
        data.orderDate !== undefined ||
        data.location !== undefined ||
        data.invoiceNumber !== undefined ||
        data.customerPhone !== undefined ||
        data.customerAddress !== undefined ||
        data.customerNote !== undefined ||
        data.vehiclePlate !== undefined ||
        data.vehicleType !== undefined ||
        data.vehicleKm !== undefined ||
        data.vehicleYear !== undefined ||
        data.mechanicName !== undefined ||
        data.paymentMethod !== undefined,
      {
        message: "Tidak ada data yang diubah",
        path: [],
      },
    ),
);

const updateSpeedshopStatusSchema = z.object({
  status: statusEnum,
  note: z
    .string()
    .trim()
    .optional(),
});

module.exports = {
  createSpeedshopOrderSchema,
  updateSpeedshopOrderSchema,
  updateSpeedshopStatusSchema,
};
