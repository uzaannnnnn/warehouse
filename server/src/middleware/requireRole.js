const createError = require("http-errors");

function requireRole(...allowedRoles) {
  const roles = allowedRoles.flat().filter(Boolean);
  return (req, res, next) => {
    const userRole = req.user?.role;
    if (!userRole || !roles.includes(userRole)) {
      return next(createError(403, "Anda tidak memiliki akses ke resource ini"));
    }
    return next();
  };
}

module.exports = requireRole;
