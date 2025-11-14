const mongoose = require("mongoose");
const logger = require("./logger");
const config = require("./env");

mongoose.set("strictQuery", false);

async function connectDatabase() {
  try {
    await mongoose.connect(config.mongoUri);
    logger.info("MongoDB connected");
  } catch (error) {
    logger.error({ err: error }, "Failed to connect to MongoDB");
    throw error;
  }
}

module.exports = connectDatabase;
