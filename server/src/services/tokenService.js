const jwt = require("jsonwebtoken");
const config = require("../config/env");

function generateAccessToken(user) {
  const payload = {
    sub: user.id || user._id.toString(),
    role: user.role,
  };

  const token = jwt.sign(payload, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn,
  });

  return token;
}

module.exports = {
  generateAccessToken,
};
