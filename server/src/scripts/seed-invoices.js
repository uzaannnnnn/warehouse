const fs = require("fs");
const path = require("path");
const connectDatabase = require("../config/database");
const Invoice = require("../models/Invoice");
const Product = require("../models/Product");
const logger = require("../config/logger");

function parseArgs() {
  return process.argv.slice(2).reduce((acc, arg) => {
    const [rawKey, ...rest] = arg.split("=");
    const key = rawKey.replace(/^--/, "");
    acc[key] = rest.join("=") || true;
    return acc;
  }, {});
}

function loadSeedData(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Invoice seed file not found at ${filePath}`);
  }
  const raw = fs.readFileSync(filePath, "utf-8");
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) {
    throw new Error("Invoice seed file must contain an array");
  }
  return parsed;
}

async function run() {
  const args = parseArgs();
  const file = args.file
    ? path.resolve(process.cwd(), args.file)
    : path.join(__dirname, "../../data/invoices.json");

  const invoices = loadSeedData(file);
  if (!invoices.length) {
    logger.warn("No invoice data in seed file");
    process.exit(0);
  }

  await connectDatabase();

  for (const invoice of invoices) {
    // eslint-disable-next-line no-await-in-loop
    const items = await Promise.all(
      invoice.items.map(async (item) => {
        const productCode = item.productCode.trim().toUpperCase();
        const product = await Product.findOne({ code: productCode });
        if (!product) {
          logger.warn({ productCode }, "Skipping item because product was not found");
          return null;
        }
        return {
          product: product._id,
          productCode,
          productName: product.name,
          quantity: item.quantity,
        };
      }),
    );

    const filteredItems = items.filter(Boolean);
    if (!filteredItems.length) {
      logger.warn({ invoiceNumber: invoice.invoiceNumber }, "Skipping invoice without valid items");
      // eslint-disable-next-line no-continue
      continue;
    }

    const payload = {
      invoiceNumber: invoice.invoiceNumber,
      type: invoice.type,
      date: invoice.date ? new Date(invoice.date) : undefined,
      items: filteredItems,
      totalQuantity: filteredItems.reduce((sum, item) => sum + item.quantity, 0),
    };

    // eslint-disable-next-line no-await-in-loop
    await Invoice.findOneAndUpdate(
      { invoiceNumber: payload.invoiceNumber },
      payload,
      { upsert: true, new: true },
    );
    logger.info({ invoiceNumber: payload.invoiceNumber }, "Invoice seeded");
  }

  process.exit(0);
}

run().catch((error) => {
  logger.error({ err: error }, "Failed to seed invoices");
  process.exit(1);
});
