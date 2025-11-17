const createError = require("http-errors");
const Production = require("../models/Production");
const RawMaterial = require("../models/RawMaterial");
const Product = require("../models/Product");
const Packaging = require("../models/Packaging");
const ProductionResultStock = require("../models/ProductionResultStock");
const { normalizeLocation, cloneStocks, sumStocks } = require("../utils/stockUtils");
const ProductionBuffer = require("../models/ProductionBuffer");

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

  const statusQuery = (req.query.status || "").trim().toLowerCase();
  if (["completed", "produced"].includes(statusQuery)) {
    filter.status = statusQuery;
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

  const productionNumber = String(payload.productionNumber || "").trim();
  const rawLocation = String(payload.location || "").trim(); // lokasi bahan baku / produksi
  const invoiceNumberRaw = String(payload.invoiceNumber || "")
    .trim()
    .toUpperCase(); // opsional
  const packagingPayload = payload.packaging || null;

  if (!productionNumber) {
    return next(createError(400, "Nomor produksi wajib diisi"));
  }

  if (!rawLocation) {
    return next(
      createError(400, "Lokasi bahan baku / produksi wajib diisi"),
    );
  }

  const rawItemsPayload = Array.isArray(payload.rawItems)
    ? payload.rawItems
    : [];
  const finishedItemsPayload = Array.isArray(payload.finishedItems)
    ? payload.finishedItems
    : [];

  if (!rawItemsPayload.length) {
    return next(createError(400, "Minimal 1 bahan baku pada produksi"));
  }

  if (!finishedItemsPayload.length) {
    return next(createError(400, "Minimal 1 produk jadi pada produksi"));
  }

  const normalizedLocation = normalizeLocation(rawLocation);
  const locationKey = normalizedLocation || "GLOBAL";

  // Buffer bahan baku
  const buffer = await ProductionBuffer.findOne({
    user: req.user._id,
    location: normalizedLocation,
  }).lean();

  const bufferItems = Array.isArray(buffer?.items) ? buffer.items : [];

  const availableByCode = new Map();
  bufferItems.forEach((item) => {
    const code = String(item.productCode || "").trim().toUpperCase();
    if (!code) return;
    const qty = Number(item.quantity || 0);
    if (!Number.isFinite(qty) || qty <= 0) return;
    const current = availableByCode.get(code) || 0;
    availableByCode.set(code, current + qty);
  });

  const items = [];
  let totalOutQuantity = 0;
  let totalInQuantity = 0;
  let packagingSummary = null;

  // === BAHAN BAKU KELUAR ===
  for (const item of rawItemsPayload) {
    const productCode = String(item.productCode || item.kode || "")
      .trim()
      .toUpperCase();
    const quantity =
      typeof item.quantity === "number"
        ? item.quantity
        : Number(item.qty ?? item.jumlah ?? 0) || 0;

    if (!productCode || quantity <= 0) {
      return next(
        createError(
          400,
          "Setiap bahan baku wajib memiliki kode dan jumlah > 0",
        ),
      );
    }

    // eslint-disable-next-line no-await-in-loop
    const material = await RawMaterial.findOne({ code: productCode });
    if (!material) {
      return next(
        createError(
          404,
          `Bahan baku dengan kode ${productCode} tidak ditemukan`,
        ),
      );
    }

    const available = availableByCode.get(productCode) || 0;
    if (quantity > available) {
      return next(
        createError(
          400,
          `Jumlah penggunaan bahan baku ${productCode} (${quantity}) melebihi jumlah di buffer produksi (${available})`,
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

  // === PRODUK JADI MASUK (update Product.stocks) ===
  for (const item of finishedItemsPayload) {
    const productCode = String(item.productCode || item.kode || "")
      .trim()
      .toUpperCase();
    const quantity =
      typeof item.quantity === "number"
        ? item.quantity
        : Number(item.qty ?? item.jumlah ?? 0) || 0;

    if (!productCode || quantity <= 0) {
      return next(
        createError(
          400,
          "Setiap produk jadi wajib memiliki kode dan jumlah > 0",
        ),
      );
    }

    // eslint-disable-next-line no-await-in-loop
    const product = await Product.findOne({ code: productCode });
    if (!product) {
      return next(
        createError(
          404,
          `Produk jadi dengan kode ${productCode} tidak ditemukan`,
        ),
      );
    }

    const stocks = cloneStocks(product.stocks);
    let entry = stocks.find(
      (stockEntry) => stockEntry.location === locationKey,
    );
    const currentQty =
      entry &&
      typeof entry.quantity === "number" &&
      Number.isFinite(entry.quantity)
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

  // === KEMASAN DUMMY (TANPA CEK STOK) ===
  if (packagingPayload) {
    const packagingCode = String(
      packagingPayload.productCode || packagingPayload.code || "",
    )
      .trim()
      .toUpperCase();
    const packagingQty =
      typeof packagingPayload.quantity === "number"
        ? packagingPayload.quantity
        : Number(packagingPayload.qty || 0) || 0;

    const packagingLocation =
      normalizeLocation(packagingPayload.location) || locationKey;

    if (packagingCode && packagingQty > 0) {
      // Hanya simpan sebagai ringkasan, TIDAK menyentuh stok kemasan
      packagingSummary = {
        productCode: packagingCode,
        productName: packagingPayload.name || "", // optional dari frontend
        quantity: packagingQty,
        location: packagingLocation,
      };
    }
  }

  const productionDate = payload.date ? new Date(payload.date) : new Date();

  try {
    const production = await Production.create({
      invoiceNumber: invoiceNumberRaw || undefined,
      productionNumber,
      location: normalizedLocation || undefined,
      date: productionDate,
      items,
      totalOutQuantity,
      totalInQuantity,
      packaging: packagingSummary || undefined,
      createdBy: req.user
        ? {
            userId: req.user._id,
            name: req.user.name,
          }
        : undefined,
    });

    return res.status(201).json({
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

async function updateProductionQc(req, res, next) {
  const { id } = req.params;

  const production = await Production.findById(id);
  if (!production) {
    return next(createError(404, "Produksi tidak ditemukan"));
  }

  if (production.status === "completed") {
    return next(
      createError(
        400,
        "QC untuk produksi ini sudah selesai dan tidak dapat diubah lagi",
      ),
    );
  }

  const body = req.body || {};
  const qcItemsPayload = Array.isArray(body.qcItems) ? body.qcItems : [];

  if (!qcItemsPayload.length) {
    return next(
      createError(
        400,
        "Data QC kosong. Minimal 1 produk jadi harus diisi QC-nya",
      ),
    );
  }

  const finishedItems = (production.items || []).filter(
    (it) => it.direction === "in",
  );

  if (!finishedItems.length) {
    return next(
      createError(
        400,
        "Produksi ini tidak memiliki produk jadi untuk di-QC",
      ),
    );
  }

  const totalByCode = new Map();
  finishedItems.forEach((it) => {
    const code = String(it.productCode || "").trim().toUpperCase();
    if (!code) return;
    const qty = Number(it.quantity || 0) || 0;
    const current = totalByCode.get(code) || 0;
    totalByCode.set(code, current + qty);
  });

  const allCodes = Array.from(totalByCode.keys());
  const qcMap = new Map();

  qcItemsPayload.forEach((raw) => {
    const code = String(raw.productCode || raw.kode || "")
      .trim()
      .toUpperCase();
    const okQty = Number(raw.okQuantity ?? raw.okQty ?? 0);

    if (!code) return;

    if (!Number.isFinite(okQty) || okQty < 0) {
      return next(
        createError(
          400,
          `Jumlah OK untuk produk ${code} harus berupa angka >= 0`,
        ),
      );
    }

    if (!totalByCode.has(code)) {
      return next(
        createError(
          400,
          `Produk ${code} tidak ditemukan di daftar produk jadi produksi ini`,
        ),
      );
    }

    const total = totalByCode.get(code);
    if (okQty > total) {
      return next(
        createError(
          400,
          `Jumlah OK untuk produk ${code} (${okQty}) tidak boleh melebihi total (${total})`,
        ),
      );
    }

    qcMap.set(code, okQty);
  });

  for (const code of allCodes) {
    if (!qcMap.has(code)) {
      return next(
        createError(
          400,
          `Produk ${code} belum diisi jumlah OK pada QC`,
        ),
      );
    }
  }

  const qcItems = allCodes.map((code) => {
    const total = totalByCode.get(code);
    const okQty = qcMap.get(code);
    const rejectQty = total - okQty;

    return {
      productCode: code,
      okQuantity: okQty,
      rejectQuantity: rejectQty,
    };
  });

  production.status = "completed";
  production.qcItems = qcItems;

  await production.save();

  const normalizedLocation = normalizeLocation(production.location) || "GLOBAL";
  const finishedNameMap = new Map();
  finishedItems.forEach((item) => {
    const code = String(item.productCode || "").trim().toUpperCase();
    if (!code) return;
    finishedNameMap.set(code, item.productName || "");
  });
  await Promise.all(
    qcItems.map((qc) => {
      const code = String(qc.productCode || "").trim().toUpperCase();
      if (!code) return Promise.resolve();
      const productName = finishedNameMap.get(code) || "";
      return ProductionResultStock.findOneAndUpdate(
        { location: normalizedLocation, productCode: code },
        {
          $set: { productName },
          $inc: {
            okRemaining: qc.okQuantity,
            totalOk: qc.okQuantity,
            rejectRemaining: qc.rejectQuantity,
            totalReject: qc.rejectQuantity,
          },
        },
        { upsert: true, new: true },
      );
    }),
  );

  return res.json({
    success: true,
    data: production,
  });
}

module.exports = {
  listProductions,
  getProduction,
  createProduction,
  updateProductionQc,
};
