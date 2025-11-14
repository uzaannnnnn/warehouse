const createError = require("http-errors");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const config = require("../config/env");

async function auth(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    return next(createError(401, "Autentikasi dibutuhkan untuk mengakses resource ini"));
  }

  try {
    const payload = jwt.verify(token, config.jwt.secret);
    const user = await User.findById(payload.sub);
    if (!user) {
      throw createError(401, "Token tidak valid");
    }
    req.user = user;
    req.tokenPayload = payload;
    return next();
  } catch (error) {
    return next(createError(401, "Token tidak valid atau sudah kedaluwarsa"));
  }
}

module.exports = auth;
