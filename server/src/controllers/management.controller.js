const createError = require("http-errors");
const User = require("../models/User");
const Location = require("../models/Location");
const {
  DEFAULT_LOCATIONS,
  LOCATION_TYPES,
  LOCATION_TYPE_LABELS,
  formatLocationLabel,
} = require("../constants/locations");
const logger = require("../config/logger");

async function ensureBaseLocations() {
  const existing = await Location.find({}).lean();
  const existingCodes = new Set(existing.map((loc) => loc.code));
  const existingNumbers = new Set(existing.map((loc) => loc.number));

  const payloads = DEFAULT_LOCATIONS.filter(
    (loc) => !existingCodes.has(formatLocationLabel(loc)) && !existingNumbers.has(loc.number),
  ).map((loc) => {
    const label = formatLocationLabel(loc);
    return {
      ...loc,
      name: String(loc.name || "").trim().toUpperCase(),
      label,
      code: label,
    };
  });

  if (payloads.length) {
    await Location.insertMany(payloads, { ordered: false }).catch(() => {});
  }
}

async function listLocations(req, res) {
  await ensureBaseLocations();

  const locations = await Location.find({}).sort({ number: 1 });
  res.json({
    success: true,
    data: locations.map((loc) => loc.toResponse()),
  });
}

async function createLocation(req, res, next) {
  const { name, type } = req.validatedBody;
  const normalizedName = String(name || "").trim().toUpperCase();
  const normalizedType = String(type || "").trim();

  await ensureBaseLocations();

  const duplicate = await Location.findOne({
    type: normalizedType,
    name: normalizedName,
  });
  if (duplicate) {
    return next(createError(409, "Lokasi dengan nama tersebut sudah ada"));
  }

  const existing = await Location.find({}).select("number label code").lean();
  const maxNumber = existing.reduce((max, loc) => {
    const parsed =
      Number(loc?.number) ||
      Number(String(loc?.label || loc?.code || "").split("-")[0]);
    if (!Number.isNaN(parsed)) {
      return Math.max(max, parsed);
    }
    return max;
  }, 0);
  const nextNumber = maxNumber + 1;
  const label = formatLocationLabel({
    number: nextNumber,
    type: normalizedType,
    name: normalizedName,
  });

  const location = new Location({
    number: nextNumber,
    type: normalizedType,
    name: normalizedName,
    label,
    code: label,
  });

  if (req.user?._id) {
    location.createdBy = {
      userId: req.user._id,
      name: req.user.name,
    };
  }

  try {
    await location.save();
  } catch (error) {
    if (error.code === 11000) {
      return next(createError(409, "Kode lokasi sudah digunakan"));
    }
    return next(error);
  }

  return res.status(201).json({
    success: true,
    data: location.toResponse(),
  });
}

function buildUserFilter(query = {}) {
  const filter = {};
  const search = (query.search || "").trim();
  const role = (query.role || "").trim();

  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: "i" } },
      { email: { $regex: search, $options: "i" } },
    ];
  }

  if (role) {
    filter.role = role;
  }

  return filter;
}

async function listUsers(req, res) {
  const filter = buildUserFilter(req.query);
  const users = await User.find(filter).sort({ createdAt: -1 });
  res.json({
    success: true,
    data: users.map((user) => user.toSafeObject()),
  });
}

async function createUser(req, res, next) {
  const { name, email, password, role, locationCode } = req.validatedBody;
  const normalizedEmail = email.trim().toLowerCase();
  const normalizedRole = role.trim();

  if (normalizedRole !== "manager" && !locationCode) {
    return next(createError(400, "Lokasi wajib dipilih untuk role non-manager"));
  }

  let resolvedLocation = null;
  if (locationCode) {
    const location = await Location.findOne({ code: locationCode });
    if (!location) {
      return next(createError(400, "Lokasi tidak ditemukan"));
    }
    resolvedLocation = location.code;
  }

  const existing = await User.findOne({ email: normalizedEmail });
  if (existing) {
    return next(createError(409, "Email sudah terdaftar"));
  }

  try {
    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      password,
      role: normalizedRole,
      location: resolvedLocation,
    });

    return res.status(201).json({
      success: true,
      data: user.toSafeObject(),
    });
  } catch (error) {
    if (error.code === 11000) {
      return next(createError(409, "Email sudah terdaftar"));
    }
    return next(error);
  }
}

async function verifyConfirmPassword(req, confirmPassword) {
  const manager = await User.findById(req.user?._id).select("+password");
  if (!manager) {
    throw createError(401, "Autentikasi tidak valid");
  }
  const isValid = await manager.comparePassword(confirmPassword || "");
  if (!isValid) {
    throw createError(403, "Konfirmasi password salah");
  }
  return manager;
}

async function updateUser(req, res, next) {
  const { id } = req.params;
  const { name, role, locationCode, password, status } = req.validatedBody;

  const user = await User.findById(id).select("+password");
  if (!user) {
    return next(createError(404, "Akun tidak ditemukan"));
  }

  if (role && role !== "manager" && !locationCode) {
    return next(createError(400, "Lokasi wajib diisi untuk role ini"));
  }

  let resolvedLocation = null;
  if (locationCode) {
    const location = await Location.findOne({ code: locationCode });
    if (!location) {
      return next(createError(400, "Lokasi tidak ditemukan"));
    }
    resolvedLocation = location.code;
  }

  if (name) user.name = name.trim();
  if (role) user.role = role.trim();
  if (status) user.status = status;
  if (role === "manager") {
    user.location = null;
  } else if (resolvedLocation) {
    user.location = resolvedLocation;
  }
  if (password) {
    user.password = password;
  }

  try {
    await user.save();
  } catch (error) {
    logger.error({ err: error }, "Failed to update user");
    return next(error);
  }

  return res.json({
    success: true,
    data: user.toSafeObject(),
  });
}

async function deleteUser(req, res, next) {
  const { id } = req.params;
  const { confirmPassword } = req.validatedBody;

  if (String(id) === String(req.user?._id)) {
    return next(createError(400, "Anda tidak dapat menghapus akun sendiri"));
  }

  const user = await User.findById(id);
  if (!user) {
    return next(createError(404, "Akun tidak ditemukan"));
  }

  await verifyConfirmPassword(req, confirmPassword);

  await user.deleteOne();

  return res.json({
    success: true,
    data: { deleted: true, id },
  });
}

module.exports = {
  listLocations,
  createLocation,
  listUsers,
  createUser,
  updateUser,
  deleteUser,
  LOCATION_TYPES,
  LOCATION_TYPE_LABELS,
};
