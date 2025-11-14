const ProductionBuffer = require("../models/ProductionBuffer");

async function getProductionBuffer(req, res) {
  const userId = req.user?._id;
  if (!userId) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }

  const buffer = await ProductionBuffer.findOne({ user: userId }).lean();
  res.json({
    success: true,
    data: buffer?.items || [],
  });
}

async function saveProductionBuffer(req, res) {
  const userId = req.user?._id;
  if (!userId) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }

  const rawItems = Array.isArray(req.body.items) ? req.body.items : [];

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
      const productCode = String(code || "").trim().toUpperCase();
      if (!productCode || quantity <= 0) return null;
      return {
        productCode,
        productName: name,
        quantity,
      };
    })
    .filter(Boolean);

  const buffer = await ProductionBuffer.findOneAndUpdate(
    { user: userId },
    { user: userId, items: normalized },
    { upsert: true, new: true },
  );

  res.json({
    success: true,
    data: buffer.items || [],
  });
}

module.exports = {
  getProductionBuffer,
  saveProductionBuffer,
};

