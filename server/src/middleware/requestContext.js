const { nanoid } = require("nanoid");

function requestContext(req, res, next) {
  const requestId = nanoid(12);
  req.id = requestId;
  res.setHeader("X-Request-Id", requestId);
  next();
}

module.exports = requestContext;
