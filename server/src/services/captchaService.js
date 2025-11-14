const fetch = require("node-fetch");
const createError = require("http-errors");
const config = require("../config/env");
const logger = require("../config/logger");

async function verifyRecaptcha(token, remoteIp) {
  if (config.captcha.bypass) {
    logger.warn("Captcha verification bypassed via configuration flag");
    return {
      success: true,
      score: 1,
      action: "bypass",
    };
  }

  if (!token) {
    throw createError(400, "Captcha token wajib disertakan");
  }

  const params = new URLSearchParams();
  params.append("secret", config.captcha.secretKey);
  params.append("response", token);
  if (remoteIp) {
    params.append("remoteip", remoteIp);
  }

  const response = await fetch("https://www.google.com/recaptcha/api/siteverify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params,
  });

  const data = await response.json();

  if (!data.success) {
    logger.warn({ data }, "Captcha verification failed");
    throw createError(400, "Verifikasi captcha gagal");
  }

  return data;
}

module.exports = {
  verifyRecaptcha,
};
