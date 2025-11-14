const createError = require("http-errors");
const User = require("../models/User");
const LoginAudit = require("../models/LoginAudit");
const { generateAccessToken } = require("../services/tokenService");
const { verifyRecaptcha } = require("../services/captchaService");
const logger = require("../config/logger");
const config = require("../config/env");

async function logAttempt({ req, email, user, success, reason, metadata }) {
  try {
    await LoginAudit.create({
      user: user?._id,
      email,
      success,
      reason,
      metadata,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });
  } catch (error) {
    logger.error({ err: error }, "Failed to persist login audit");
  }
}

async function login(req, res) {
  const { email, password, captchaToken } = req.validatedBody;
  const normalizedEmail = email.trim().toLowerCase();

  const captchaResult = await verifyRecaptcha(captchaToken, req.ip);

  const user = await User.findOne({ email: normalizedEmail }).select("+password");

  if (!user) {
    await logAttempt({
      req,
      email: normalizedEmail,
      success: false,
      reason: "USER_NOT_FOUND",
      metadata: { captchaScore: captchaResult.score },
    });
    throw createError(401, "Email atau password salah");
  }

  if (user.status !== "active") {
    await logAttempt({
      req,
      email: normalizedEmail,
      user,
      success: false,
      reason: "USER_SUSPENDED",
      metadata: { captchaScore: captchaResult.score },
    });
    throw createError(403, "Akun sedang tidak aktif");
  }

  const isPasswordValid = await user.comparePassword(password);

  if (!isPasswordValid) {
    await user.recordFailedLogin();
    await logAttempt({
      req,
      email: normalizedEmail,
      user,
      success: false,
      reason: "INVALID_PASSWORD",
      metadata: { captchaScore: captchaResult.score },
    });
    throw createError(401, "Email atau password salah");
  }

  await user.recordSuccessfulLogin();

  await logAttempt({
    req,
    email: normalizedEmail,
    user,
    success: true,
    metadata: { captchaScore: captchaResult.score },
  });

  const token = generateAccessToken(user);
  logger.info(
    {
      userId: user._id,
      requestId: req.id,
    },
    "User logged in",
  );

  res.json({
    success: true,
    data: {
      token,
      expiresIn: config.jwt.expiresIn,
      user: user.toSafeObject(),
    },
  });
}

module.exports = {
  login,
};
