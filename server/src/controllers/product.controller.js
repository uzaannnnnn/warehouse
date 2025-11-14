const createError = require("http-errors");
const Product = require("../models/Product");

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

async function listProducts(req, res) {
  const { page, limit } = parsePagination(req.query);
  const search = (req.query.search || "").trim();
  const filter = buildSearchFilter(search);

  const [items, total] = await Promise.all([
    Product.find(filter)
      .sort({ updatedAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Product.countDocuments(filter),
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
  try {
    const product = await Product.create(payload);
    res.status(201).json({
      success: true,
      data: product,
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
  try {
    const product = await Product.findByIdAndUpdate(id, payload, {
      new: true,
      runValidators: true,
    });
    if (!product) {
      return next(createError(404, "Produk tidak ditemukan"));
    }
    return res.json({
      success: true,
      data: product,
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
