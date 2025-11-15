const path = require("path");
const dotenv = require("dotenv");

dotenv.config({
  path: path.join(__dirname, "../../.env"),
  override: true,
});

const env = process.env.NODE_ENV || "development";

const rawOrigins = (process.env.CORS_ORIGIN || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const corsOrigin = rawOrigins.includes("*") ? [] : rawOrigins;

const config = {
  env,
  isProd: env === "production",
  port: Number(process.env.PORT) || 8000,
  mongoUri: process.env.MONGODB_URI,
  corsOrigin,
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN || "1d",
  },
  captcha: {
    secretKey: process.env.RECAPTCHA_SECRET_KEY,
    bypass: String(process.env.RECAPTCHA_BYPASS).toLowerCase() === "true",
  },
  logging: {
    level: process.env.LOG_LEVEL || (env === "production" ? "info" : "debug"),
  },
};

if (!config.mongoUri) {
  throw new Error("MONGODB_URI is required");
}

if (!config.jwt.secret) {
  throw new Error("JWT_SECRET is required");
}

if (!config.captcha.secretKey && !config.captcha.bypass) {
  throw new Error("RECAPTCHA_SECRET_KEY is required when captcha bypass is disabled");
}

module.exports = config;
