const { z } = require("zod");
const { LOCATION_TYPES } = require("../constants/locations");

const allowedRoles = ["manager", "bahanbaku", "kemasan", "produksi", "speedshop"];
const allowedStatuses = ["active", "suspended"];

const createUserSchema = z
  .object({
    name: z.string().min(1, "Nama wajib diisi").max(120, "Nama terlalu panjang"),
    email: z.string().email("Format email tidak valid"),
    password: z.string().min(8, "Password minimal 8 karakter"),
    role: z.enum(allowedRoles, { message: "Role tidak dikenal" }),
    locationCode: z.string().min(1, "Lokasi wajib diisi").optional(),
  })
  .refine(
    (data) => data.role === "manager" || Boolean(data.locationCode),
    {
      message: "Lokasi wajib diisi untuk role ini",
      path: ["locationCode"],
    },
  );

const createLocationSchema = z.object({
  name: z.string().min(1, "Nama lokasi wajib diisi").max(120, "Nama terlalu panjang"),
  type: z.enum(Object.values(LOCATION_TYPES), { message: "Jenis lokasi tidak valid" }),
});

const updateUserSchema = z
  .object({
    name: z.string().min(1, "Nama wajib diisi").max(120, "Nama terlalu panjang").optional(),
    password: z
      .string()
      .min(8, "Password minimal 8 karakter")
      .max(128, "Password terlalu panjang")
      .optional(),
    role: z.enum(allowedRoles, { message: "Role tidak dikenal" }).optional(),
    locationCode: z.string().min(1, "Lokasi wajib diisi").optional(),
    status: z.enum(allowedStatuses, { message: "Status tidak valid" }).optional(),
  })
  .refine(
    (data) => !data.role || data.role === "manager" || Boolean(data.locationCode),
    {
      message: "Lokasi wajib diisi untuk role ini",
      path: ["locationCode"],
    },
  );

const deleteUserSchema = z.object({
  confirmPassword: z.string().min(1, "Konfirmasi password wajib diisi"),
});

module.exports = {
  createUserSchema,
  createLocationSchema,
  updateUserSchema,
  deleteUserSchema,
};
