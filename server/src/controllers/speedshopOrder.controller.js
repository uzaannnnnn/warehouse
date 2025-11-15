const createError = require("http-errors");
const SpeedshopOrder = require("../models/SpeedshopOrder");
const Product = require("../models/Product");
const { normalizeLocation, getNameForLocation } = require("../utils/stockUtils");

const STATUS_FLOW = ["draft", "pending_payment", "completed"];

function parsePagination(query) {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(50, Math.max(1, Number(query.limit) || 10));
  return { page, limit };
}

function buildSearchFilter(search) {
  if (!search) return {};
  const regex = { $regex: search, $options: "i" };
  return {
    $or: [
      { orderId: regex },
      { customerName: regex },
      { customerPhone: regex },
      { invoiceNumber: regex },
      { vehiclePlate: regex },
      { mechanicName: regex },
    ],
  };
}

function sanitizeOrderDate(raw) {
  if (!raw) {
    return new Date();
  }
  const parsed = raw instanceof Date ? raw : new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    throw createError(400, "Tanggal order tidak valid");
  }
  return parsed;
}

function buildUserMeta(user) {
  if (!user) return undefined;
  return {
    userId: user._id,
    name: user.name,
  };
}

function computeTotals(parts = [], services = []) {
  const partsTotal = parts.reduce((sum, part) => sum + (part.subtotal || 0), 0);
  const servicesTotal = services.reduce((sum, svc) => sum + (svc.cost || 0), 0);
  return {
    parts: partsTotal,
    services: servicesTotal,
    grand: partsTotal + servicesTotal,
  };
}

function canTransitionStatus(current, next) {
  if (!next) return true;
  if (!current) return true;
  if (current === next) return true;
  const currentIndex = STATUS_FLOW.indexOf(current);
  const nextIndex = STATUS_FLOW.indexOf(next);
  if (nextIndex === -1) {
    return false;
  }
  if (currentIndex === -1) {
    return true;
  }
  return nextIndex >= currentIndex;
}

function appendStatusHistory(order, status, note, userMeta) {
  if (!status) {
    return;
  }
  if (!order.statusHistory) {
    order.statusHistory = [];
  }
  order.statusHistory.push({
    status,
    note,
    user: userMeta,
    createdAt: new Date(),
  });
}

async function generateOrderId() {
  const date = new Date();
  const datePart = date.toISOString().slice(0, 10).replace(/-/g, "");
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const sequence = Math.floor(Math.random() * 1000)
      .toString()
      .padStart(3, "0");
    const candidate = `SPD-${datePart}-${sequence}`;
    const exists = await SpeedshopOrder.exists({ orderId: candidate });
    if (!exists) {
      return candidate;
    }
  }
  return `SPD-${Date.now().toString(36).toUpperCase()}`;
}

async function resolveParts(parts = [], location) {
  if (!Array.isArray(parts) || parts.length === 0) {
    return [];
  }
  const normalizedLocation = normalizeLocation(location);
  if (!normalizedLocation) {
    throw createError(400, "Lokasi Speedshop tidak valid");
  }

  const resolved = [];
  for (const part of parts) {
    // eslint-disable-next-line no-await-in-loop
    const product = await Product.findById(part.productId);
    if (!product) {
      throw createError(404, "Produk tidak ditemukan");
    }
    const stockEntry = (product.stocks || []).find(
      (entry) => entry.location === normalizedLocation,
    );
    const available = typeof stockEntry?.quantity === "number" ? stockEntry.quantity : 0;
    if (available === 0) {
      throw createError(
        400,
        `Stok produk ${product.code} di lokasi ${normalizedLocation} tidak tersedia`,
      );
    }
    if (part.quantity > available) {
      throw createError(
        400,
        `Jumlah ${product.code} melebihi stok (${available}) di lokasi ${normalizedLocation}`,
      );
    }

    const locationName = getNameForLocation(product, normalizedLocation);
    const productName =
      (typeof part.productName === "string" && part.productName.trim().length
        ? part.productName.trim()
        : null) ||
      locationName ||
      product.name;
    resolved.push({
      product: product._id,
      productCode: product.code,
      productName,
      quantity: part.quantity,
      unitPrice: part.unitPrice,
      subtotal: part.quantity * part.unitPrice,
      maxQuantity: available,
    });
  }
  return resolved;
}

function sanitizeServices(services = []) {
  if (!Array.isArray(services)) {
    return [];
  }
  return services
    .map((service) => {
      const name =
        typeof service.name === "string" ? service.name.trim() : undefined;
      if (!name) {
        return null;
      }
      const cost =
        typeof service.cost === "number" && Number.isFinite(service.cost)
          ? service.cost
          : 0;
      return { name, cost };
    })
    .filter(Boolean);
}

async function listSpeedshopOrders(req, res) {
  const { page, limit } = parsePagination(req.query);
  const search = (req.query.search || "").trim();
  const locationQuery = (req.query.location || "").trim();
  const statusQuery = (req.query.status || "").trim().toLowerCase();
  const filter = buildSearchFilter(search);
  if (locationQuery) {
    filter.location = locationQuery;
  }
  if (statusQuery && STATUS_FLOW.includes(statusQuery)) {
    filter.status = statusQuery;
  }

  const [items, total] = await Promise.all([
    SpeedshopOrder.find(filter)
      .sort({ orderDate: -1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    SpeedshopOrder.countDocuments(filter),
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

async function getSpeedshopOrder(req, res, next) {
  const { id } = req.params;
  const order = await SpeedshopOrder.findById(id).lean();
  if (!order) {
    return next(createError(404, "Order Speedshop tidak ditemukan"));
  }
  return res.json({
    success: true,
    data: order,
  });
}

async function createSpeedshopOrder(req, res, next) {
  const payload = req.validatedBody || {};
  const userMeta = buildUserMeta(req.user);
  const location = payload.location;
  const orderDate = sanitizeOrderDate(payload.orderDate);
  const resolvedParts = await resolveParts(payload.parts, location);
  const sanitizedServices = sanitizeServices(payload.services);
  const totals = computeTotals(resolvedParts, sanitizedServices);
  const status = payload.status || "draft";

  try {
    const order = await SpeedshopOrder.create({
      orderId: await generateOrderId(),
      orderDate,
      location,
      orderType: payload.orderType,
      invoiceNumber: payload.invoiceNumber,
      customerName: payload.customerName,
      customerPhone: payload.customerPhone,
      customerAddress: payload.customerAddress,
      customerNote: payload.customerNote,
      vehiclePlate: payload.vehiclePlate,
      vehicleType: payload.vehicleType,
      vehicleKm: payload.vehicleKm,
      vehicleYear: payload.vehicleYear,
      mechanicName: payload.mechanicName,
      paymentMethod: payload.paymentMethod,
      status,
      parts: resolvedParts,
      services: sanitizedServices,
      totals,
      statusHistory: [
        {
          status,
          note: undefined,
          user: userMeta,
          createdAt: new Date(),
        },
      ],
      createdBy: userMeta,
      updatedBy: userMeta,
    });
    return res.status(201).json({
      success: true,
      data: order,
    });
  } catch (error) {
    if (error.code === 11000) {
      return next(createError(409, "Order ID sudah digunakan, coba lagi"));
    }
    return next(error);
  }
}

async function updateSpeedshopOrder(req, res, next) {
  const { id } = req.params;
  const payload = req.validatedBody || {};
  const order = await SpeedshopOrder.findById(id);
  if (!order) {
    return next(createError(404, "Order Speedshop tidak ditemukan"));
  }
  if (order.status === "completed") {
    return next(createError(400, "Order yang sudah selesai tidak dapat diubah"));
  }

  const userMeta = buildUserMeta(req.user);
  const locationChanged = Boolean(payload.location);
  if (locationChanged) {
    order.location = payload.location;
  }
  if (payload.orderType !== undefined) {
    order.orderType = payload.orderType;
  }
  if (payload.invoiceNumber !== undefined) {
    order.invoiceNumber = payload.invoiceNumber;
  }
  if (payload.customerName !== undefined) {
    order.customerName = payload.customerName;
  }
  if (payload.customerPhone !== undefined) {
    order.customerPhone = payload.customerPhone;
  }
  if (payload.customerAddress !== undefined) {
    order.customerAddress = payload.customerAddress;
  }
  if (payload.customerNote !== undefined) {
    order.customerNote = payload.customerNote;
  }
  if (payload.vehiclePlate !== undefined) {
    order.vehiclePlate = payload.vehiclePlate;
  }
  if (payload.vehicleType !== undefined) {
    order.vehicleType = payload.vehicleType;
  }
  if (payload.vehicleKm !== undefined) {
    order.vehicleKm = payload.vehicleKm;
  }
  if (payload.vehicleYear !== undefined) {
    order.vehicleYear = payload.vehicleYear;
  }
  if (payload.mechanicName !== undefined) {
    order.mechanicName = payload.mechanicName;
  }
  if (payload.paymentMethod !== undefined) {
    order.paymentMethod = payload.paymentMethod;
  }
  if (payload.orderDate) {
    order.orderDate = sanitizeOrderDate(payload.orderDate);
  }

  if (payload.parts) {
    order.parts = await resolveParts(payload.parts, order.location);
  }
  if (!payload.parts && locationChanged && Array.isArray(order.parts) && order.parts.length) {
    return next(
      createError(
        400,
        "Silakan pilih ulang parts setelah mengubah lokasi Speedshop",
      ),
    );
  }
  if (payload.services) {
    order.services = sanitizeServices(payload.services);
  }
  if (payload.parts || payload.services) {
    order.totals = computeTotals(order.parts, order.services);
  }

  const nextStatus = payload.status;
  if (nextStatus && nextStatus !== order.status) {
    if (!canTransitionStatus(order.status, nextStatus)) {
      return next(
        createError(
          400,
          `Perpindahan status dari ${order.status} ke ${nextStatus} tidak diizinkan`,
        ),
      );
    }
    order.status = nextStatus;
    appendStatusHistory(order, nextStatus, undefined, userMeta);
  }

  order.updatedBy = userMeta;
  await order.save();

  return res.json({
    success: true,
    data: order,
  });
}

async function updateSpeedshopOrderStatus(req, res, next) {
  const { id } = req.params;
  const payload = req.validatedBody || {};
  const order = await SpeedshopOrder.findById(id);
  if (!order) {
    return next(createError(404, "Order Speedshop tidak ditemukan"));
  }
  if (order.status === payload.status) {
    return res.json({
      success: true,
      data: order,
    });
  }
  if (!canTransitionStatus(order.status, payload.status)) {
    return next(
      createError(
        400,
        `Perpindahan status dari ${order.status} ke ${payload.status} tidak diizinkan`,
      ),
    );
  }
  const userMeta = buildUserMeta(req.user);
  order.status = payload.status;
  appendStatusHistory(order, payload.status, payload.note, userMeta);
  order.updatedBy = userMeta;
  await order.save();
  return res.json({
    success: true,
    data: order,
  });
}

async function listSpeedshopServices(req, res) {
  const rawNames = await SpeedshopOrder.distinct("services.name");
  const options = rawNames
    .filter((name) => typeof name === "string" && name.trim().length)
    .map((name) => name.trim())
    .sort((a, b) => a.localeCompare(b));
  const unique = [...new Set(options)];
  res.json({
    success: true,
    data: unique.map((name) => ({ _id: name, name })),
  });
}

module.exports = {
  listSpeedshopOrders,
  getSpeedshopOrder,
  createSpeedshopOrder,
  updateSpeedshopOrder,
  updateSpeedshopOrderStatus,
  listSpeedshopServices,
};
