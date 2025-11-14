const logger = require("../config/logger");

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  logger.error(
    {
      err,
      requestId: req.id,
    },
    "Unhandled error",
  );

  const status = err.status || err.statusCode || 500;
  const message =
    status >= 500
      ? "Terjadi kesalahan pada server. Silakan coba kembali."
      : err.message || "Request tidak dapat diproses.";

  res.status(status).json({
    success: false,
    message,
    requestId: req.id,
    details: err.errors || undefined,
  });
}

module.exports = errorHandler;
