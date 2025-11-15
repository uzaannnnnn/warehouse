const fs = require("fs");
const path = require("path");
const { parse } = require("csv-parse");
const connectDatabase = require("../config/database");
const Product = require("../models/Product");
const logger = require("../config/logger");
const { setLocationStock, setLocationPricing, sumStocks } = require("../utils/stockUtils");

const DEFAULT_PRODUCT_LOCATION = process.env.SEED_PRODUCT_LOCATION || "04-ONLINE PACKING-KTP";

function parseArgs() {
  return process.argv.slice(2).reduce((acc, arg) => {
    const [rawKey, ...rest] = arg.split("=");
    const key = rawKey.replace(/^--/, "");
    acc[key] = rest.join("=") || true;
    return acc;
  }, {});
}

function parseCurrency(value) {
  if (value === undefined || value === null) return 0;
  const sanitized = String(value).replace(/[^\d,.-]/g, "");
  if (!sanitized) return 0;
  const normalized = sanitized.replace(/\./g, "").replace(",", ".");
  const parsed = Number(normalized);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function parseInteger(value) {
  if (value === undefined || value === null || value === "") return 0;
  const parsed = Number(String(value).replace(/[^\d-]/g, ""));
  return Number.isNaN(parsed) ? 0 : parsed;
}

function loadCsv(filePath) {
  return new Promise((resolve, reject) => {
    const rows = [];
    fs.createReadStream(filePath)
      .pipe(
        parse({
          columns: true,
          skip_empty_lines: true,
          trim: true,
        }),
      )
      .on("data", (row) => rows.push(row))
      .on("error", reject)
      .on("end", () => resolve(rows));
  });
}

function resolveLocationArg(rawValue, fallback) {
  if (typeof rawValue === "string") {
    const trimmed = rawValue.trim();
    if (!trimmed.length) {
      return null;
    }
    const lowered = trimmed.toLowerCase();
    if (lowered === "none" || lowered === "false") {
      return null;
    }
    return trimmed;
  }
  if (rawValue === false) {
    return null;
  }
  return fallback;
}

function mapRow(row) {
  const clean = (value) => (value ? String(value).trim() : "");
  const sourceRow = parseInteger(row["No."]);
  const metadata = {};
  if (sourceRow) {
    metadata.sourceRow = sourceRow;
  }
  return {
    code: clean(row["Kode Produk"]).toUpperCase(),
    name: clean(row["Nama Produk"]),
    category: clean(row["Kategori"]),
    stock: parseInteger(row["Jumlah"]),
    purchasePrice: parseCurrency(row["Harga Pembelian (Rp)"]),
    sellingPrice: parseCurrency(row["Harga Jual (Rp)"]),
    metadata: Object.keys(metadata).length ? metadata : undefined,
  };
}

async function upsertProduct(payload, { location }) {
  if (!payload.code) {
    return "skipped";
  }

  let status = "created";
  let product = await Product.findOne({ code: payload.code });

  if (product) {
    product.set(payload);
    status = "updated";
  } else {
    product = new Product(payload);
  }

  if (location) {
    const locationStock = typeof payload.stock === "number" ? payload.stock : 0;
    setLocationStock(product, location, locationStock);
    setLocationPricing(product, location, {
      purchasePrice:
        typeof payload.purchasePrice === "number" ? payload.purchasePrice : undefined,
      sellingPrice:
        typeof payload.sellingPrice === "number" ? payload.sellingPrice : undefined,
    });
  } else if (Array.isArray(product.stocks) && product.stocks.length) {
    product.stock = sumStocks(product.stocks);
  }

  await product.save();
  return status;
}

async function run() {
  const args = parseArgs();
  const csvPath = args.file
    ? path.resolve(process.cwd(), args.file)
    : path.join(__dirname, "../../data/products.csv");

  if (!fs.existsSync(csvPath)) {
    throw new Error(`CSV file not found at ${csvPath}`);
  }

  const rows = await loadCsv(csvPath);
  if (!rows.length) {
    logger.warn("CSV file is empty");
    process.exit(0);
  }

  await connectDatabase();

  const location = resolveLocationArg(args.location, DEFAULT_PRODUCT_LOCATION);

  const stats = {
    created: 0,
    updated: 0,
    skipped: 0,
  };

  for (const row of rows) {
    const payload = mapRow(row);
    // eslint-disable-next-line no-await-in-loop
    const result = await upsertProduct(payload, { location });
    stats[result] += 1;
  }

  logger.info({ stats, location }, "Product seed completed");
  process.exit(0);
}

run().catch((error) => {
  logger.error({ err: error }, "Failed to seed products");
  process.exit(1);
});
