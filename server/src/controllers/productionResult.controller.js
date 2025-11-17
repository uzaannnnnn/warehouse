const createError = require("http-errors");
const ProductionResultStock = require("../models/ProductionResultStock");
const { normalizeLocation } = require("../utils/stockUtils");

function parsePagination(query) {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 10));
  return { page, limit };
}

async function listProductionResultStocks(req, res, next) {
  try {
    const { page, limit } = parsePagination(req.query);
    const search = (req.query.search || "").trim();
    const locationRaw = (req.query.location || "").trim();
    const normalizedLocation = normalizeLocation(locationRaw);

    const filter = {};
    if (normalizedLocation) {
      filter.location = normalizedLocation;
    }
    if (search) {
      const regex = new RegExp(search, "i");
      filter.$or = [
        { productCode: regex },
        { productName: regex },
        { category: regex },
      ];
    }

    const [items, total] = await Promise.all([
      ProductionResultStock.find(filter)
        .sort({ updatedAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      ProductionResultStock.countDocuments(filter),
    ]);

    return res.json({
      success: true,
      data: {
        items,
        total,
        pages: Math.max(1, Math.ceil(total / limit)),
        page,
        limit,
      },
    });
  } catch (err) {
    return next(err);
  }
}

async function destroyProductionReject(req, res, next) {
  try {
    const productCode = String(req.body.productCode || "")
      .trim()
      .toUpperCase();
    const locationRaw = String(req.body.location || "").trim();
    const quantity = Number(req.body.quantity || 0);

    const normalizedLocation = normalizeLocation(locationRaw) || "GLOBAL";

    if (!productCode || !quantity || quantity <= 0) {
      throw createError(
        400,
        "Produk, lokasi, dan jumlah musnah wajib diisi dengan benar",
      );
    }

    const stock = await ProductionResultStock.findOne({
      location: normalizedLocation,
      productCode,
    });
    if (!stock) {
      throw createError(404, "Stok hasil produksi tidak ditemukan");
    }
    if (quantity > stock.rejectRemaining) {
      throw createError(
        400,
        `Stok gagal ${stock.rejectRemaining} tidak mencukupi untuk dimusnahkan ${quantity}`,
      );
    }

    stock.rejectRemaining -= quantity;
    await stock.save();

    return res.json({
      success: true,
      data: stock,
    });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  listProductionResultStocks,
  destroyProductionReject,
};
