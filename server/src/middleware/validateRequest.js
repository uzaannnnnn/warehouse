function validateRequest(schema) {
  return (req, res, next) => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: "Validasi gagal",
        errors: parsed.error.errors.map((error) => ({
          path: error.path.join("."),
          message: error.message,
        })),
      });
    }

    req.validatedBody = parsed.data;
    return next();
  };
}

module.exports = validateRequest;
