const ProductionBuffer = require("../models/ProductionBuffer");

async function getProductionBuffer(req, res) {
  const userId = req.user?._id;
  if (!userId) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }

  const rawLocation = (req.query.location || "").trim();
  const query = { user: userId };
  if (rawLocation) {
    query.location = rawLocation;
  }

  const buffer = await ProductionBuffer.findOne(query).lean();
  res.json({
    success: true,
    data: {
      items: buffer?.items || [],
      invoiceNumber: buffer?.invoiceNumber || "",
    },
  });
}

async function saveProductionBuffer(req, res) {
  const userId = req.user?._id;
  if (!userId) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }

  const rawLocation = (req.body.location || "").trim();
  if (!rawLocation) {
    return res
      .status(400)
      .json({ success: false, message: "Lokasi bahan baku wajib diisi" });
  }

  const rawItems = Array.isArray(req.body.items) ? req.body.items : [];
  const invoiceNumberRaw = (req.body.invoiceNumber || "").trim().toUpperCase();

  const normalized = rawItems
    .map((item) => {
      const code =
        item.productCode ||
        item.kode ||
        item.code ||
        item.product_code ||
        "";
      const quantity =
        typeof item.quantity === "number"
          ? item.quantity
          : Number(item.qty ?? item.jumlah ?? 0) || 0;
      const name = item.productName || item.name || item.nama || "";
      const category = item.productCategory || item.category || "";
      const productCode = String(code || "").trim().toUpperCase();
      if (!productCode || quantity <= 0) return null;
      return {
        productCode,
        productName: name,
        productCategory: category,
        quantity,
      };
    })
    .filter(Boolean);

  const updatePayload = {
    user: userId,
    location: rawLocation,
    items: normalized,
  };
  if (invoiceNumberRaw) {
    updatePayload.invoiceNumber = invoiceNumberRaw;
  }

  const buffer = await ProductionBuffer.findOneAndUpdate(
    { user: userId, location: rawLocation },
    updatePayload,
    {
      upsert: true,
      new: true,
    },
  );

  res.json({
    success: true,
    data: {
      items: buffer.items || [],
      invoiceNumber: buffer.invoiceNumber || "",
    },
  });
}

module.exports = {
  getProductionBuffer,
  saveProductionBuffer,
};
