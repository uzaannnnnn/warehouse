const createError = require("http-errors");
const Invoice = require("../models/Invoice");
const Product = require("../models/Product");
const RawMaterial = require("../models/RawMaterial");

function parsePagination(query) {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 10));
  return { page, limit };
}

async function listInvoices(req, res) {
  const { page, limit } = parsePagination(req.query);
  const search = (req.query.search || "").trim();
  const typeQuery = (req.query.type || "").toLowerCase();
  const segmentQuery = (req.query.segment || "").toLowerCase();
  const locationQuery = (req.query.location || "").trim();
  const filter = {};

  if (typeQuery === "in" || typeQuery === "out") {
    filter.type = typeQuery;
  }
  if (segmentQuery === "finished" || segmentQuery === "raw") {
    filter.segment = segmentQuery;
  }
  if (locationQuery) {
    filter.location = locationQuery;
  }
  if (search) {
    filter.$or = [
      { invoiceNumber: { $regex: search, $options: "i" } },
      { "items.productCode": { $regex: search, $options: "i" } },
    ];
  }

  const [items, total] = await Promise.all([
    Invoice.find(filter)
      .sort({ date: -1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Invoice.countDocuments(filter),
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

async function getInvoice(req, res, next) {
  const { id } = req.params;
  const invoice = await Invoice.findById(id);
  if (!invoice) {
    return next(createError(404, "Invoice tidak ditemukan"));
  }
  return res.json({
    success: true,
    data: invoice,
  });
}

async function createInvoice(req, res, next) {
  const payload = req.validatedBody;
  const invoiceNumber =
    payload.invoiceNumber?.trim() || `AUTO-${Date.now().toString(36).toUpperCase()}`;

  const itemsWithProducts = [];
  let totalQuantity = 0;
  let hasRaw = false;
  let hasFinished = false;
  const locationKey = payload.location ? String(payload.location).trim() : "GLOBAL";

  for (const item of payload.items) {
    const productCode = item.productCode.trim().toUpperCase();
    // eslint-disable-next-line no-await-in-loop
    let product = await Product.findOne({ code: productCode });

    if (product) {
      hasFinished = true;
    } else {
      // eslint-disable-next-line no-await-in-loop
      product = await RawMaterial.findOne({ code: productCode });
      if (product) {
        hasRaw = true;
      }
    }

    if (!product) {
      return next(createError(404, `Produk dengan kode ${productCode} tidak ditemukan`));
    }

    const quantity = item.quantity;

    const stocks = Array.isArray(product.stocks) ? product.stocks : [];
    let entry = stocks.find((s) => s.location === locationKey);
    const currentQty = entry && typeof entry.quantity === "number" ? entry.quantity : 0;

    if (payload.type === "out" && currentQty < quantity) {
      return next(
        createError(
          400,
          `Stok produk ${productCode} di lokasi ${locationKey} tidak mencukupi. Stok tersedia: ${currentQty}`,
        ),
      );
    }

    const nextQty = payload.type === "in" ? currentQty + quantity : currentQty - quantity;

    if (!entry) {
      entry = { location: locationKey, quantity: nextQty };
      stocks.push(entry);
    } else {
      entry.quantity = nextQty;
    }

    product.stocks = stocks;
    product.stock = stocks.reduce(
      (sum, s) => sum + (typeof s.quantity === "number" ? s.quantity : 0),
      0,
    );
    // eslint-disable-next-line no-await-in-loop
    await product.save();

    itemsWithProducts.push({
      product: product._id,
      productCode,
      productName: product.name,
      quantity,
    });
    totalQuantity += quantity;
  }

  const invoiceDate = payload.date ? new Date(payload.date) : new Date();

  try {
    const segment = hasRaw && !hasFinished ? "raw" : "finished";

    const invoice = await Invoice.create({
      invoiceNumber,
      type: payload.type,
      location: payload.location ? String(payload.location).trim() : undefined,
      date: invoiceDate,
      items: itemsWithProducts,
      totalQuantity,
      segment,
      createdBy: req.user
        ? {
            userId: req.user._id,
            name: req.user.name,
          }
        : undefined,
    });

    res.status(201).json({
      success: true,
      data: invoice,
    });
  } catch (error) {
    if (error.code === 11000) {
      return next(createError(409, "Nomor invoice sudah digunakan"));
    }
    return next(error);
  }
}

async function claimInvoiceForProduction(req, res, next) {
  const rawNumber = req.params.invoiceNumber || "";
  const invoiceNumber = rawNumber.trim().toUpperCase();
  if (!invoiceNumber) {
    return next(createError(400, "Nomor invoice tidak valid"));
  }

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

  if (invoice.productionClaimed) {
    return next(
      createError(400, `Invoice ${invoiceNumber} sudah diklaim untuk produksi`),
    );
  }

  invoice.productionClaimed = true;
  await invoice.save();

  return res.json({
    success: true,
    data: invoice,
  });
}

module.exports = {
  listInvoices,
  getInvoice,
  createInvoice,
  claimInvoiceForProduction,
};
