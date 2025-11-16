function validateRequest(schema) {
  return (req, res, next) => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      const issues = Array.isArray(parsed.error?.issues) ? parsed.error.issues : [];
      return res.status(400).json({
        success: false,
        message: "Validasi gagal",
        errors: issues.map((error) => ({
          path: Array.isArray(error.path) ? error.path.join(".") : "",
          message: error.message,
        })),
      });
    }

    req.validatedBody = parsed.data;
    return next();
  };
}

module.exports = validateRequest;
