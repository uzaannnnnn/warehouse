const createError = require("http-errors");
const Production = require("../models/Production");
const RawMaterial = require("../models/RawMaterial");
const Product = require("../models/Product");
const Invoice = require("../models/Invoice");
const { normalizeLocation, cloneStocks, sumStocks } = require("../utils/stockUtils");

function parsePagination(query) {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 10));
  return { page, limit };
}

async function listProductions(req, res) {
  const { page, limit } = parsePagination(req.query);
  const search = (req.query.search || "").trim();
  const filter = {};

  if (search) {
    filter.$or = [
      { productionNumber: { $regex: search, $options: "i" } },
      { "items.productCode": { $regex: search, $options: "i" } },
    ];
  }

  const location = (req.query.location || "").trim();
  if (location) {
    filter.location = location;
  }

  const [items, total] = await Promise.all([
    Production.find(filter)
      .sort({ date: -1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Production.countDocuments(filter),
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

async function getProduction(req, res, next) {
  const { id } = req.params;
  const production = await Production.findById(id);
  if (!production) {
    return next(createError(404, "Produksi tidak ditemukan"));
  }
  return res.json({
    success: true,
    data: production,
  });
}

async function createProduction(req, res, next) {
  const payload = req.validatedBody;
  const productionNumber = payload.productionNumber.trim();
  const invoiceNumber = payload.invoiceNumber.trim().toUpperCase();

  const invoice = await Invoice.findOne({ invoiceNumber });
  if (!invoice) {
    return next(createError(404, `Invoice ${invoiceNumber} tidak ditemukan`));
  }
  if (invoice.type !== "out" || invoice.segment !== "raw") {
    return next(
      createError(
        400,
        "Invoice harus bertipe stok keluar dan berasal dari bahan baku",
      ),
    );
  }

  const normalizedLocation = normalizeLocation(invoice.location);
  const locationKey = normalizedLocation || "GLOBAL";

  const availableByCode = new Map();
  invoice.items.forEach((item) => {
    const code = String(item.productCode || "").trim().toUpperCase();
    if (!code) return;
    const current = availableByCode.get(code) || 0;
    availableByCode.set(code, current + Number(item.quantity || 0));
  });

  const items = [];
  let totalOutQuantity = 0;
  let totalInQuantity = 0;

  for (const item of payload.rawItems) {
    const productCode = item.productCode.trim().toUpperCase();
    // eslint-disable-next-line no-await-in-loop
    const material = await RawMaterial.findOne({ code: productCode });
    if (!material) {
      return next(
        createError(404, `Bahan baku dengan kode ${productCode} tidak ditemukan`),
      );
    }

    const quantity = item.quantity;
    const available = availableByCode.get(productCode) || 0;
    if (quantity > available) {
      return next(
        createError(
          400,
          `Jumlah penggunaan bahan baku ${productCode} (${quantity}) melebihi jumlah di invoice (${available})`,
        ),
      );
    }
    availableByCode.set(productCode, available - quantity);

    items.push({
      product: material._id,
      productModel: "RawMaterial",
      productCode,
      productName: material.name,
      quantity,
      direction: "out",
    });
    totalOutQuantity += quantity;
  }

  // Tambah stok produk jadi
  for (const item of payload.finishedItems) {
    const productCode = item.productCode.trim().toUpperCase();
    // eslint-disable-next-line no-await-in-loop
    const product = await Product.findOne({ code: productCode });
    if (!product) {
      return next(
        createError(404, `Produk jadi dengan kode ${productCode} tidak ditemukan`),
      );
    }

    const quantity = item.quantity;

    const stocks = cloneStocks(product.stocks);
    let entry = stocks.find((stockEntry) => stockEntry.location === locationKey);
    const currentQty =
      entry && typeof entry.quantity === "number" && Number.isFinite(entry.quantity)
        ? entry.quantity
        : 0;
    const nextQty = currentQty + quantity;

    if (!entry) {
      entry = { location: locationKey, quantity: nextQty };
      stocks.push(entry);
    } else {
      entry.quantity = nextQty;
    }

    product.stocks = stocks;
    product.stock = sumStocks(stocks);
    // eslint-disable-next-line no-await-in-loop
    await product.save();

    items.push({
      product: product._id,
      productModel: "Product",
      productCode,
      productName: product.name,
      quantity,
      direction: "in",
    });
    totalInQuantity += quantity;
  }

  const productionDate = payload.date ? new Date(payload.date) : new Date();

  try {
    const production = await Production.create({
      invoiceNumber,
      productionNumber,
      location: normalizedLocation || undefined,
      date: productionDate,
      items,
      totalOutQuantity,
      totalInQuantity,
      createdBy: req.user
        ? {
            userId: req.user._id,
            name: req.user.name,
          }
        : undefined,
    });


    res.status(201).json({
      success: true,
      data: production,
    });
  } catch (error) {
    if (error.code === 11000) {
      return next(createError(409, "Nomor produksi sudah digunakan"));
    }
    return next(error);
  }
}

module.exports = {
  listProductions,
  getProduction,
  createProduction,
};
