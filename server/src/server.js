const http = require("http");
const app = require("./app");
const config = require("./config/env");
const connectDatabase = require("./config/database");
const logger = require("./config/logger");

async function bootstrap() {
  await connectDatabase();

  const server = http.createServer(app);

  server.listen(config.port, () => {
    logger.info(`Server listening on port ${config.port}`);
  });

  const shutdown = (signal) => {
    logger.info({ signal }, "Shutting down server");
    server.close(() => {
      process.exit(0);
    });
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

bootstrap().catch((error) => {
  logger.error({ err: error }, "Failed to bootstrap server");
  process.exit(1);
});
