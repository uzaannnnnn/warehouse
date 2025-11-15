const createError = require("http-errors");
const RawMaterial = require("../models/RawMaterial");
const {
  setLocationStock,
  setLocationPricing,
  getPricingForLocation,
} = require("../utils/stockUtils");

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

function formatMaterialResponse(material, location) {
  if (!material) {
    return material;
  }
  const payload = material.toObject ? material.toObject() : material;
  if (!location) {
    return payload;
  }
  const pricing = getPricingForLocation(payload, location);
  if (pricing.purchasePrice !== undefined) {
    payload.purchasePrice = pricing.purchasePrice;
  }
  if (pricing.sellingPrice !== undefined) {
    payload.sellingPrice = pricing.sellingPrice;
  }
  return payload;
}

async function listRawMaterials(req, res) {
  const { page, limit } = parsePagination(req.query);
  const search = (req.query.search || "").trim();
  const filter = buildSearchFilter(search);
  const location = (req.query.location || "").trim();
  if (location) {
    filter["stocks.location"] = location;
  }

  const [items, total] = await Promise.all([
    RawMaterial.find(filter)
      .sort({ updatedAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    RawMaterial.countDocuments(filter),
  ]);
  const normalizedItems = items.map((item) => formatMaterialResponse(item, location));

  res.json({
    success: true,
    data: {
      items: normalizedItems,
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
  const location = (req.body.location || "").trim();
  const hasStockValue = typeof payload.stock === "number" && Number.isFinite(payload.stock);
  const stockValue = hasStockValue ? payload.stock : 0;
  const hasPurchase =
    typeof payload.purchasePrice === "number" && Number.isFinite(payload.purchasePrice);
  const hasSelling =
    typeof payload.sellingPrice === "number" && Number.isFinite(payload.sellingPrice);
  try {
    let material = await RawMaterial.findOne({ code: payload.code });
    if (material) {
      if (!location) {
        return next(createError(409, "Kode bahan baku sudah digunakan"));
      }
      material.set(payload);
      if (hasStockValue) {
        setLocationStock(material, location, stockValue);
      }
      if (hasPurchase || hasSelling) {
        setLocationPricing(material, location, {
          purchasePrice: hasPurchase ? payload.purchasePrice : undefined,
          sellingPrice: hasSelling ? payload.sellingPrice : undefined,
        });
      }
      await material.save();
      return res.json({
        success: true,
        data: formatMaterialResponse(material, location),
      });
    }

    if (location) {
      setLocationStock(payload, location, stockValue);
      if (hasPurchase || hasSelling) {
        setLocationPricing(payload, location, {
          purchasePrice: hasPurchase ? payload.purchasePrice : undefined,
          sellingPrice: hasSelling ? payload.sellingPrice : undefined,
        });
      }
    }

    material = await RawMaterial.create(payload);
    return res.status(201).json({
      success: true,
      data: formatMaterialResponse(material, location),
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
  const location = (req.body.location || "").trim();
  const hasPurchase =
    typeof payload.purchasePrice === "number" && Number.isFinite(payload.purchasePrice);
  const hasSelling =
    typeof payload.sellingPrice === "number" && Number.isFinite(payload.sellingPrice);
  try {
    const material = await RawMaterial.findById(id);
    if (!material) {
      return next(createError(404, "Bahan baku tidak ditemukan"));
    }
    material.set(payload);
    if (location && typeof payload.stock === "number" && Number.isFinite(payload.stock)) {
      setLocationStock(material, location, payload.stock);
    }
    if (location && (hasPurchase || hasSelling)) {
      setLocationPricing(material, location, {
        purchasePrice: hasPurchase ? payload.purchasePrice : undefined,
        sellingPrice: hasSelling ? payload.sellingPrice : undefined,
      });
    }
    await material.save();
    return res.json({
      success: true,
      data: formatMaterialResponse(material, location),
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
