const connectDatabase = require("../config/database");
const Invoice = require("../models/Invoice");
const Product = require("../models/Product");
const logger = require("../config/logger");

async function run() {
  await connectDatabase();

  const locations = [
    "01-BAHAN BAKU-KTP",
    "02-BAHAN BAKU-DPK",
    "03-BAHAN BAKU-BGR",
  ];

  // Ambil 20 produk pertama sebagai sample
  const products = await Product.find({})
    .sort({ updatedAt: -1 })
    .limit(20)
    .lean();

  if (!products.length) {
    logger.warn("Tidak ada produk untuk dised");
    process.exit(0);
  }

  for (const location of locations) {
    const suffix = location.split("-").slice(-1)[0] || "LOC";
    const invoiceNumber = `SEED-${suffix}-STOCK`;

    const items = [];
    let totalQuantity = 0;

    // Naikkan stok per lokasi dan buat item invoice
    // eslint-disable-next-line no-restricted-syntax
    for (const p of products) {
      const quantity = 20;
      // eslint-disable-next-line no-await-in-loop
      const doc = await Product.findById(p._id);
      if (!doc) continue;

      const stocks = Array.isArray(doc.stocks) ? doc.stocks : [];
      let entry = stocks.find((s) => s.location === location);
      const currentQty = entry && typeof entry.quantity === "number" ? entry.quantity : 0;
      const nextQty = currentQty + quantity;

      if (!entry) {
        entry = { location, quantity: nextQty };
        stocks.push(entry);
      } else {
        entry.quantity = nextQty;
      }

      doc.stocks = stocks;
      doc.stock = stocks.reduce(
        (sum, s) => sum + (typeof s.quantity === "number" ? s.quantity : 0),
        0,
      );
      // eslint-disable-next-line no-await-in-loop
      await doc.save();

      items.push({
        product: doc._id,
        productCode: doc.code,
        productName: doc.name,
        quantity,
      });
      totalQuantity += quantity;
    }

    if (!items.length) {
      logger.warn({ location }, "Lewati lokasi karena tidak ada item");
      // eslint-disable-next-line no-continue
      continue;
    }

    // Upsert invoice per lokasi
    // eslint-disable-next-line no-await-in-loop
    await Invoice.findOneAndUpdate(
      { invoiceNumber },
      {
        invoiceNumber,
        type: "in",
        location,
        date: new Date(),
        items,
        totalQuantity,
      },
      { upsert: true, new: true },
    );

    logger.info({ invoiceNumber, location }, "Invoice stok per lokasi dised");
  }

  process.exit(0);
}

run().catch((error) => {
  logger.error({ err: error }, "Gagal seed stok per lokasi");
  process.exit(1);
});
