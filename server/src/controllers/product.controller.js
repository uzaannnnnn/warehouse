const createError = require("http-errors");
const Product = require("../models/Product");
const {
  setLocationStock,
  setLocationPricing,
  setLocationName,
  getPricingForLocation,
  getNameForLocation,
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

function formatProductResponse(product, location) {
  if (!product) {
    return product;
  }
  const payload = product.toObject ? product.toObject() : product;
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
  const locationName = getNameForLocation(payload, location);
  if (locationName) {
    payload.name = locationName;
  }
  return payload;
}

async function listProducts(req, res) {
  const { page, limit } = parsePagination(req.query);
  const search = (req.query.search || "").trim();
  const filter = buildSearchFilter(search);
  const location = (req.query.location || "").trim();
  if (location) {
    filter["stocks.location"] = location;
  }

  const [items, total] = await Promise.all([
    Product.find(filter)
      .sort({ updatedAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Product.countDocuments(filter),
  ]);
  const normalizedItems = items.map((item) => formatProductResponse(item, location));

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

async function getProduct(req, res, next) {
  const { id } = req.params;
  const product = await Product.findById(id);
  if (!product) {
    return next(createError(404, "Produk tidak ditemukan"));
  }
  return res.json({
    success: true,
    data: product,
  });
}

function normalizeProductPayload(payload) {
  const data = { ...payload };
  if (typeof data.code === "string") {
    data.code = data.code.trim().toUpperCase();
  }
  if (typeof data.category === "string") {
    data.category = data.category.trim();
  }
  return data;
}

async function createProduct(req, res, next) {
  const payload = normalizeProductPayload(req.validatedBody);
  const location = (req.body.location || "").trim();
  const hasStockValue = typeof payload.stock === "number" && Number.isFinite(payload.stock);
  const stockValue = hasStockValue ? payload.stock : 0;
  const hasPurchase =
    typeof payload.purchasePrice === "number" && Number.isFinite(payload.purchasePrice);
  const hasSelling =
    typeof payload.sellingPrice === "number" && Number.isFinite(payload.sellingPrice);

  try {
    let product = await Product.findOne({ code: payload.code });

    if (product) {
      // PRODUK SUDAH ADA
      if (!location) {
        return next(createError(409, "Kode produk sudah digunakan"));
      }

      // ⬇️ Jangan timpa harga/stok/nama global ketika ada location
      const basePayload = { ...payload };
      delete basePayload.purchasePrice;
      delete basePayload.sellingPrice;
      delete basePayload.stock;
      delete basePayload.name; // ⬅️ penting

      product.set(basePayload);

      if (hasStockValue) {
        setLocationStock(product, location, stockValue);
      }

      if (hasPurchase || hasSelling) {
        setLocationPricing(product, location, {
          purchasePrice: hasPurchase ? payload.purchasePrice : undefined,
          sellingPrice: hasSelling ? payload.sellingPrice : undefined,
        });
      }

      // ⬇️ simpan nama khusus lokasi
      if (payload.name) {
        setLocationName(product, location, payload.name);
      }

      await product.save();
      return res.json({
        success: true,
        data: formatProductResponse(product, location),
      });
    }

    // PRODUK BELUM ADA SAMA SEKALI
    if (location) {
      const basePayload = { ...payload };

      // field global diset minimal / default, tapi boleh kamu biarkan juga
      // kalau mau nama global ikut sama nama pertama, boleh tidak dihapus:
      // di sini aku biarkan name tetap ada sebagai default global.
      delete basePayload.purchasePrice;
      delete basePayload.sellingPrice;
      delete basePayload.stock;

      if (hasStockValue) {
        setLocationStock(basePayload, location, stockValue);
      }
      if (hasPurchase || hasSelling) {
        setLocationPricing(basePayload, location, {
          purchasePrice: hasPurchase ? payload.purchasePrice : undefined,
          sellingPrice: hasSelling ? payload.sellingPrice : undefined,
        });
      }
      if (payload.name) {
        setLocationName(basePayload, location, payload.name);
      }

      product = await Product.create(basePayload);
    } else {
      // tanpa location → bener2 global
      product = await Product.create(payload);
    }

    return res.status(201).json({
      success: true,
      data: formatProductResponse(product, location),
    });
  } catch (error) {
    if (error.code === 11000) {
      return next(createError(409, "Kode produk sudah digunakan"));
    }
    return next(error);
  }
}

async function updateProduct(req, res, next) {
  const { id } = req.params;
  const payload = normalizeProductPayload(req.validatedBody);
  const location = (req.body.location || "").trim();
  const hasStockValue = typeof payload.stock === "number" && Number.isFinite(payload.stock);
  const hasPurchase =
    typeof payload.purchasePrice === "number" && Number.isFinite(payload.purchasePrice);
  const hasSelling =
    typeof payload.sellingPrice === "number" && Number.isFinite(payload.sellingPrice);

  try {
    const product = await Product.findById(id);
    if (!product) {
      return next(createError(404, "Produk tidak ditemukan"));
    }

    const basePayload = { ...payload };

    if (location) {
      // ⬇️ kalau update per lokasi, JANGAN ubah field global
      delete basePayload.purchasePrice;
      delete basePayload.sellingPrice;
      delete basePayload.stock;
      delete basePayload.name; // ⬅️ ini yang bikin nama global nggak ikut ganti
    }

    product.set(basePayload);

    if (location && hasStockValue) {
      setLocationStock(product, location, payload.stock);
    }

    if (location && (hasPurchase || hasSelling)) {
      setLocationPricing(product, location, {
        purchasePrice: hasPurchase ? payload.purchasePrice : undefined,
        sellingPrice: hasSelling ? payload.sellingPrice : undefined,
      });
    }

    if (location && payload.name) {
      // ⬇️ simpan nama khusus per lokasi
      setLocationName(product, location, payload.name);
    }

    await product.save();
    return res.json({
      success: true,
      data: formatProductResponse(product, location),
    });
  } catch (error) {
    if (error.code === 11000) {
      return next(createError(409, "Kode produk sudah digunakan"));
    }
    return next(error);
  }
}

async function deleteProduct(req, res, next) {
  const { id } = req.params;
  const product = await Product.findByIdAndDelete(id);
  if (!product) {
    return next(createError(404, "Produk tidak ditemukan"));
  }
  return res.json({
    success: true,
    message: "Produk berhasil dihapus",
  });
}

async function listCategories(req, res) {
  const categories = await Product.distinct("category");
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
  listProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
  listCategories,
};
