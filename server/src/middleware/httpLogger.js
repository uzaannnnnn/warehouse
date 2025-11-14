const pinoHttp = require("pino-http");
const logger = require("../config/logger");

const httpLogger = pinoHttp({
  logger,
  customLogLevel: (req, res, err) => {
    if (res.statusCode >= 500 || err) return "error";
    if (res.statusCode >= 400) return "warn";
    return "info";
  },
  customSuccessMessage: (req, res) =>
    `${req.method} ${req.url} ${res.statusCode} - ${res.responseTime}ms`,
});

module.exports = httpLogger;
