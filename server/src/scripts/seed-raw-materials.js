const fs = require("fs");
const path = require("path");
const { parse } = require("csv-parse");
const connectDatabase = require("../config/database");
const RawMaterial = require("../models/RawMaterial");
const logger = require("../config/logger");

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

async function upsertRawMaterial(payload) {
  if (!payload.code) {
    return "skipped";
  }

  const existing = await RawMaterial.findOne({ code: payload.code });
  if (existing) {
    existing.set(payload);
    await existing.save();
    return "updated";
  }

  await RawMaterial.create(payload);
  return "created";
}

async function run() {
  const args = parseArgs();
  const csvPath = args.file
    ? path.resolve(process.cwd(), args.file)
    : path.join(__dirname, "../../data/raw-materials.csv");

  if (!fs.existsSync(csvPath)) {
    throw new Error(`CSV file not found at ${csvPath}`);
  }

  const rows = await loadCsv(csvPath);
  if (!rows.length) {
    logger.warn("Raw materials CSV file is empty");
    process.exit(0);
  }

  await connectDatabase();

  const stats = {
    created: 0,
    updated: 0,
    skipped: 0,
  };

  for (const row of rows) {
    const payload = mapRow(row);
    // eslint-disable-next-line no-await-in-loop
    const result = await upsertRawMaterial(payload);
    stats[result] += 1;
  }

  logger.info({ stats }, "Raw materials seed completed");
  process.exit(0);
}

run().catch((error) => {
  logger.error({ err: error }, "Failed to seed raw materials");
  process.exit(1);
});
