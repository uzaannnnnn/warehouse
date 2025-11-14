const createError = require("http-errors");
const RawMaterial = require("../models/RawMaterial");

function parsePagination(query) {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 10));
  return { page, limit };
}

function buildSearchFilter(search) {
  if (!search) return {};
  return {
    $or: [
      { code: { $regex: search, $options: "i" } },
      { name: { $regex: search, $options: "i" } },
      { category: { $regex: search, $options: "i" } },
    ],
  };
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function listRawMaterials(req, res) {
  const { page, limit } = parsePagination(req.query);
  const search = (req.query.search || "").trim();
  const filter = buildSearchFilter(search);

  const [items, total] = await Promise.all([
    RawMaterial.find(filter)
      .sort({ updatedAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    RawMaterial.countDocuments(filter),
  ]);

  res.json({
    success: true,
    data: {
      items,
      total,
      pages: Math.max(1, Math.ceil(total / limit)),
      page,
      limit,
    },
  });
}

async function getRawMaterial(req, res, next) {
  const { id } = req.params;
  const material = await RawMaterial.findById(id);
  if (!material) {
    return next(createError(404, "Bahan baku tidak ditemukan"));
  }
  return res.json({
    success: true,
    data: material,
  });
}

function normalizePayload(payload) {
  const data = { ...payload };
  if (typeof data.code === "string") {
    data.code = data.code.trim().toUpperCase();
  }
  if (typeof data.category === "string") {
    data.category = data.category.trim();
  }
  return data;
}

async function createRawMaterial(req, res, next) {
  const payload = normalizePayload(req.validatedBody);
  try {
    const material = await RawMaterial.create(payload);
    res.status(201).json({
      success: true,
      data: material,
    });
  } catch (error) {
    if (error.code === 11000) {
      return next(createError(409, "Kode bahan baku sudah digunakan"));
    }
    return next(error);
  }
}

async function updateRawMaterial(req, res, next) {
  const { id } = req.params;
  const payload = normalizePayload(req.validatedBody);
  try {
    const material = await RawMaterial.findByIdAndUpdate(id, payload, {
      new: true,
      runValidators: true,
    });
    if (!material) {
      return next(createError(404, "Bahan baku tidak ditemukan"));
    }
    return res.json({
      success: true,
      data: material,
    });
  } catch (error) {
    if (error.code === 11000) {
      return next(createError(409, "Kode bahan baku sudah digunakan"));
    }
    return next(error);
  }
}

async function deleteRawMaterial(req, res, next) {
  const { id } = req.params;
  const material = await RawMaterial.findByIdAndDelete(id);
  if (!material) {
    return next(createError(404, "Bahan baku tidak ditemukan"));
  }
  return res.json({
    success: true,
    message: "Bahan baku berhasil dihapus",
  });
}

async function listRawCategories(req, res) {
  const categories = await RawMaterial.distinct("category");
  const normalized = categories
    .filter(Boolean)
    .sort()
    .map((category) => ({
      _id: category,
      name: category,
    }));
  res.json({
    success: true,
    data: normalized,
  });
}

module.exports = {
  listRawMaterials,
  getRawMaterial,
  createRawMaterial,
  updateRawMaterial,
  deleteRawMaterial,
  listRawCategories,
};
