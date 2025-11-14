const { z } = require("zod");

const loginSchema = z.object({
  email: z.string().min(1, "Email wajib diisi").email("Format email tidak valid"),
  password: z.string().min(1, "Password wajib diisi"),
  captchaToken: z.string().min(1, "Captcha wajib diisi"),
});

module.exports = {
  loginSchema,
};
