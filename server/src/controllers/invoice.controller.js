const createError = require("http-errors");
const Invoice = require("../models/Invoice");
const Product = require("../models/Product");

function parsePagination(query) {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 10));
  return { page, limit };
}

async function listInvoices(req, res) {
  const { page, limit } = parsePagination(req.query);
  const search = (req.query.search || "").trim();
  const typeQuery = (req.query.type || "").toLowerCase();
  const filter = {};

  if (typeQuery === "in" || typeQuery === "out") {
    filter.type = typeQuery;
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

  for (const item of payload.items) {
    const productCode = item.productCode.trim().toUpperCase();
    // eslint-disable-next-line no-await-in-loop
    const product = await Product.findOne({ code: productCode });
    if (!product) {
      return next(createError(404, `Produk dengan kode ${productCode} tidak ditemukan`));
    }

    const quantity = item.quantity;
    if (payload.type === "out" && product.stock < quantity) {
      return next(
        createError(
          400,
          `Stok produk ${productCode} tidak mencukupi. Stok tersedia: ${product.stock}`,
        ),
      );
    }

    product.stock = payload.type === "in" ? product.stock + quantity : product.stock - quantity;
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
    const invoice = await Invoice.create({
      invoiceNumber,
      type: payload.type,
      date: invoiceDate,
      items: itemsWithProducts,
      totalQuantity,
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

module.exports = {
  listInvoices,
  getInvoice,
  createInvoice,
};
