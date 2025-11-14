const pino = require("pino");
const config = require("./env");

const logger = pino({
  level: config.logging.level,
  base: undefined,
  redact: ["req.headers.authorization", "password"],
  transport: config.isProd
    ? undefined
    : {
        target: "pino-pretty",
        options: {
          colorize: true,
          translateTime: "SYS:standard",
        },
      },
});

module.exports = logger;
