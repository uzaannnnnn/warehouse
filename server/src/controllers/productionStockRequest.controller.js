const createError = require("http-errors");
const ProductionStockRequest = require("../models/ProductionStockRequest");
const Product = require("../models/Product");
const ProductionResultStock = require("../models/ProductionResultStock");
const Invoice = require("../models/Invoice");
const { cloneStocks, sumStocks, normalizeLocation } = require("../utils/stockUtils");

function parsePagination(query) {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 10));
  return { page, limit };
}

function generateRequestNumber() {
  const random = Math.floor(Math.random() * 1_000_000)
    .toString(36)
    .toUpperCase()
    .padStart(4, "0");
  return `PSR-${Date.now().toString(36).toUpperCase()}-${random}`;
}

function buildMirrorInvoiceNumber(base, suffix) {
  const cleanedBase =
    typeof base === "string" && base.trim().length
      ? base.trim().toUpperCase().replace(/[^A-Z0-9-]/g, "")
      : `PSR-${Date.now().toString(36).toUpperCase()}`;
  const random = Math.floor(Math.random() * 1_000_000)
    .toString(36)
    .toUpperCase()
    .padStart(4, "0");
  return `${cleanedBase}-${suffix}-${random}`;
}

function resolveItemsForApproval(requestItems, overrideItems) {
  const normalizedRequestItems = Array.isArray(requestItems) ? requestItems : [];
  const payloadItems = Array.isArray(overrideItems) ? overrideItems : [];

  if (!payloadItems.length) {
    return normalizedRequestItems;
  }

  const referenceMap = new Map();
  normalizedRequestItems.forEach((item) => {
    const code = String(item.productCode || "").trim().toUpperCase();
    if (!code) return;
    referenceMap.set(code, {
      productCode: code,
      productName: item.productName || code,
      quantity: Number(item.quantity || 0) || 0,
    });
  });

  if (!referenceMap.size) {
    return normalizedRequestItems;
  }

  const aggregated = new Map();
  payloadItems.forEach((item) => {
    const code = String(item.productCode || "").trim().toUpperCase();
    const quantity = Number(item.quantity || 0);
    if (!code || !Number.isFinite(quantity) || quantity <= 0) {
      return;
    }
    const current = aggregated.get(code) || 0;
    aggregated.set(code, current + quantity);
  });

  if (!aggregated.size) {
    throw createError(400, "Pilih minimal 1 produk untuk disetujui");
  }

  const normalized = [];
  aggregated.forEach((quantity, code) => {
    const ref = referenceMap.get(code);
    if (!ref) {
      throw createError(
        400,
        `Produk ${code} tidak valid atau tidak ada dalam permintaan`,
      );
    }
    if (quantity > ref.quantity) {
      throw createError(
        400,
        `Jumlah ${code} (${quantity}) melebihi permintaan (${ref.quantity})`,
      );
    }
    normalized.push({
      productCode: ref.productCode,
      productName: ref.productName,
      quantity,
    });
  });

  return normalized;
}

async function createMirrorInvoicesForStockRequest({
  request,
  items,
  totalQuantity,
  user,
}) {
  if (!request || !Array.isArray(items) || !items.length || !totalQuantity) {
    return;
  }

  const base = request.requestNumber || request._id?.toString() || "";
  const createdBy =
    user && user._id
      ? {
          userId: user._id,
          name: user.name,
        }
      : undefined;
  const now = new Date();

  const buildItems = () =>
    items.map((item) => ({
      product: item.product,
      productCode: item.productCode,
      productName: item.productName,
      quantity: item.quantity,
    }));

  const productionInvoiceNumber = buildMirrorInvoiceNumber(base, "PROD-OUT");
  const productInvoiceNumber = buildMirrorInvoiceNumber(base, "PROD-IN");
  const baseMeta = {
    source: "production-stock-request",
    requestId: request._id,
    requestNumber: request.requestNumber,
  };

  await Invoice.create([
    {
      invoiceNumber: productionInvoiceNumber,
      type: "out",
      location: request.targetLocation,
      segment: "raw",
      date: now,
      items: buildItems(),
      totalQuantity,
      createdBy,
      productionClaimed: true,
      meta: {
        ...baseMeta,
        mode: "production-out",
      },
    },
    {
      invoiceNumber: productInvoiceNumber,
      type: "in",
      location: request.originLocation,
      segment: "finished",
      date: now,
      items: buildItems(),
      totalQuantity,
      createdBy,
      meta: {
        ...baseMeta,
        mode: "product-in",
      },
    },
  ]);
}

async function listProductionStockRequests(req, res, next) {
  try {
    const { page, limit } = parsePagination(req.query);
    const search = (req.query.search || "").trim();
    const statusQuery = (req.query.status || "").trim().toLowerCase();
    const allowedStatuses = ["pending", "approved", "rejected"];
    const filter = {};

    if (allowedStatuses.includes(statusQuery)) {
      filter.status = statusQuery;
    }

    const targetLocation = normalizeLocation(req.query.targetLocation);
    if (targetLocation) {
      filter.targetLocation = targetLocation;
    }

    const originLocation = normalizeLocation(req.query.originLocation);
    if (originLocation) {
      filter.originLocation = originLocation;
    }

    if (search) {
      const regex = new RegExp(search, "i");
      filter.$or = [
        { requestNumber: regex },
        { "items.productCode": regex },
        { "items.productName": regex },
      ];
    }

    const [items, total] = await Promise.all([
      ProductionStockRequest.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      ProductionStockRequest.countDocuments(filter),
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

async function createProductionStockRequest(req, res, next) {
  try {
    const payload = req.validatedBody;
    const originLocation = normalizeLocation(payload.originLocation);
    const targetLocation = normalizeLocation(payload.targetLocation);

    if (!originLocation || !targetLocation) {
      throw createError(400, "Lokasi asal dan tujuan wajib diisi");
    }

    if (originLocation === targetLocation) {
      throw createError(400, "Lokasi asal dan tujuan tidak boleh sama");
    }

    const aggregated = new Map();
    payload.items.forEach((item) => {
      const code = String(item.productCode || "").trim().toUpperCase();
      const qty = Number(item.quantity || 0);
      if (!code || !Number.isFinite(qty) || qty <= 0) {
        return;
      }
      const current = aggregated.get(code) || 0;
      aggregated.set(code, current + qty);
    });

    if (!aggregated.size) {
      throw createError(400, "Minimal 1 produk diajukan");
    }

    const normalizedItems = [];
    for (const [code, quantity] of aggregated.entries()) {
      // eslint-disable-next-line no-await-in-loop
      const productDoc = await Product.findOne({ code });
      normalizedItems.push({
        productCode: code,
        productName: productDoc?.name || code,
        quantity,
      });
    }

    const requestNumber = generateRequestNumber();

    const request = await ProductionStockRequest.create({
      requestNumber,
      originLocation,
      targetLocation,
      status: "pending",
      items: normalizedItems,
      requestedBy: req.user
        ? {
            userId: req.user._id,
            name: req.user.name,
          }
        : undefined,
    });

    return res.status(201).json({
      success: true,
      data: request,
    });
  } catch (err) {
    return next(err);
  }
}

async function approveProductionStockRequest(req, res, next) {
  try {
    const { id } = req.params;
    const payload = req.validatedBody || {};

    const request = await ProductionStockRequest.findById(id);
    if (!request) {
      return next(createError(404, "Permintaan tidak ditemukan"));
    }
    if (request.status !== "pending") {
      return next(createError(400, "Permintaan sudah diproses"));
    }

    const originLocation = normalizeLocation(request.originLocation);
    const targetLocation = normalizeLocation(request.targetLocation);
    if (!originLocation || !targetLocation) {
      return next(
        createError(
          400,
          "Lokasi asal dan produksi pada permintaan tidak valid",
        ),
      );
    }

    const requestItems = Array.isArray(request.items) ? request.items : [];
    let items;
    try {
      items = resolveItemsForApproval(requestItems, payload.items);
    } catch (validationErr) {
      return next(validationErr);
    }

    if (!items.length) {
      request.status = "approved";
      request.processedAt = new Date();
      request.processedBy = req.user
        ? { userId: req.user._id, name: req.user.name }
        : undefined;
      request.responseNote = payload.note;
      await request.save();
      return res.json({ success: true, data: request });
    }

    const productUpdates = [];
    const decrementedStocks = [];
    const invoiceItems = [];
    let totalInvoiceQuantity = 0;

    try {
      for (const item of items) {
        const productCode = String(item.productCode || "")
          .trim()
          .toUpperCase();
        const quantity = Number(item.quantity || 0);
        if (!productCode || !Number.isFinite(quantity) || quantity <= 0) {
          // eslint-disable-next-line no-continue
          continue;
        }

        // eslint-disable-next-line no-await-in-loop
        const productDoc = await Product.findOne({ code: productCode });
        if (!productDoc) {
          throw createError(404, `Produk ${productCode} tidak ditemukan`);
        }

        const stocks = cloneStocks(productDoc.stocks);
        let entry = stocks.find((s) => s.location === originLocation);
        if (!entry) {
          entry = { location: originLocation, quantity: 0 };
          stocks.push(entry);
        }
        const currentQty =
          typeof entry.quantity === "number" && Number.isFinite(entry.quantity)
            ? entry.quantity
            : 0;
        entry.quantity = currentQty + quantity;

        productUpdates.push({
          doc: productDoc,
          stocks,
          totalStock: sumStocks(stocks),
        });

        invoiceItems.push({
          product: productDoc._id,
          productCode,
          productName: productDoc.name || productCode,
          quantity,
        });
        totalInvoiceQuantity += quantity;

        // eslint-disable-next-line no-await-in-loop
        const updatedStock = await ProductionResultStock.findOneAndUpdate(
          {
            location: targetLocation,
            productCode,
            okRemaining: { $gte: quantity },
          },
          { $inc: { okRemaining: -quantity } },
        );

        if (!updatedStock) {
          throw createError(
            400,
            `Stok produksi ${productCode} di lokasi ${targetLocation} tidak mencukupi`,
          );
        }

        decrementedStocks.push({ productCode, quantity });
      }

      await Promise.all(
        productUpdates.map(({ doc, stocks, totalStock }) => {
          doc.stocks = stocks;
          doc.stock = totalStock;
          return doc.save();
        }),
      );

      await createMirrorInvoicesForStockRequest({
        request,
        items: invoiceItems,
        totalQuantity: totalInvoiceQuantity,
        user: req.user,
      });
    } catch (error) {
      if (decrementedStocks.length) {
        await Promise.all(
          decrementedStocks.map(({ productCode, quantity }) =>
            ProductionResultStock.findOneAndUpdate(
              {
                location: targetLocation,
                productCode,
              },
              { $inc: { okRemaining: quantity } },
            ),
          ),
        );
      }
      throw error;
    }

    if (payload.items && payload.items.length) {
      request.items = items;
    }

    request.status = "approved";
    request.processedAt = new Date();
    request.processedBy = req.user
      ? { userId: req.user._id, name: req.user.name }
      : undefined;
    request.responseNote = payload.note;
    await request.save();

    return res.json({
      success: true,
      data: request,
    });
  } catch (err) {
    return next(err);
  }
}

async function rejectProductionStockRequest(req, res, next) {
  try {
    const { id } = req.params;
    const payload = req.validatedBody || {};
    const request = await ProductionStockRequest.findById(id);
    if (!request) {
      return next(createError(404, "Permintaan tidak ditemukan"));
    }
    if (request.status !== "pending") {
      return next(createError(400, "Permintaan sudah diproses"));
    }

    request.status = "rejected";
    request.responseNote = payload.note;
    request.processedAt = new Date();
    request.processedBy = req.user
      ? { userId: req.user._id, name: req.user.name }
      : undefined;
    await request.save();

    return res.json({
      success: true,
      data: request,
    });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  listProductionStockRequests,
  createProductionStockRequest,
  approveProductionStockRequest,
  rejectProductionStockRequest,
};
