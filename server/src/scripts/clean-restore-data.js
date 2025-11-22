const fs = require("fs");
const path = require("path");
const { parse } = require("csv-parse");

const HEADERS = [
  "No.",
  "Kode Produk",
  "Nama Produk",
  "Kategori",
  "Jumlah",
  "Harga Pembelian (Rp)",
  "Harga Jual (Rp)",
];

const DEFAULT_INPUT = path.join(__dirname, "../../data/restore-data-EDF024MNB-GOLD.csv");
const DEFAULT_OUTPUT = path.join(__dirname, "../../data/restore-data-EDF024MNB-GOLD.cleaned.csv");
const DEFAULT_REJECT = path.join(__dirname, "../../data/restore-data-EDF024MNB-GOLD.rejected.csv");

function parseArgs() {
  return process.argv.slice(2).reduce((acc, arg) => {
    const [rawKey, ...rest] = arg.split("=");
    const key = rawKey.replace(/^--/, "");
    acc[key] = rest.length ? rest.join("=") : true;
    return acc;
  }, {});
}

function toCsvLine(fields) {
  const escaped = fields.map((value) => {
    const safe = value === undefined || value === null ? "" : String(value);
    if (/[",\n]/.test(safe)) {
      return `"${safe.replace(/"/g, '""')}"`;
    }
    return safe;
  });
  return escaped.join(",");
}

function parseInteger(value) {
  if (value === undefined || value === null || value === "") return null;
  const normalized = String(value).replace(/[^\d-]/g, "");
  if (normalized === "") return null;
  const parsed = Number.parseInt(normalized, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

function validateRow(row, options) {
  const reasons = [];

  const code = (row["Kode Produk"] || "").trim().toUpperCase();
  const name = (row["Nama Produk"] || "").trim();
  const category = (row["Kategori"] || "").trim();
  const qty = parseInteger(row["Jumlah"]);
  const purchasePrice = parseInteger(row["Harga Pembelian (Rp)"]);
  const sellingPrice = parseInteger(row["Harga Jual (Rp)"]);

  if (!code) reasons.push("missing_code");
  if (!name) reasons.push("missing_name");
  if (qty === null) reasons.push("invalid_quantity");
  if (purchasePrice === null) reasons.push("invalid_purchase_price");
  if (sellingPrice === null) reasons.push("invalid_selling_price");

  if (qty !== null && qty < 0) reasons.push("negative_quantity");
  if (purchasePrice !== null && purchasePrice < 0) reasons.push("negative_purchase_price");
  if (sellingPrice !== null && sellingPrice < 0) reasons.push("negative_selling_price");
  if (!options.allowNegativeMargin && purchasePrice !== null && sellingPrice !== null && sellingPrice < purchasePrice) {
    reasons.push("selling_below_purchase");
  }
  if (options.dropZeroQuantity && qty === 0) {
    reasons.push("zero_quantity");
  }

  const isValid = reasons.length === 0;

  const cleanedRow = {
    "No.": (row["No."] || "").trim(),
    "Kode Produk": code,
    "Nama Produk": name,
    Kategori: category,
    Jumlah: qty ?? "",
    "Harga Pembelian (Rp)": purchasePrice ?? "",
    "Harga Jual (Rp)": sellingPrice ?? "",
  };

  return { isValid, reasons, code, cleanedRow };
}

async function cleanCsv(options) {
  const {
    inputPath = DEFAULT_INPUT,
    outputPath = DEFAULT_OUTPUT,
    rejectPath = DEFAULT_REJECT,
    allowNegativeMargin = false,
    dropZeroQuantity = false,
    chunkSize = 0,
  } = options;

  const resolvedInput = path.resolve(inputPath);
  if (!fs.existsSync(resolvedInput)) {
    throw new Error(`Input file not found at ${resolvedInput}`);
  }

  const validRows = new Map();
  const stats = {
    total: 0,
    kept: 0,
    rejected: 0,
    invalid: 0,
    duplicates: 0,
    rejectedReasons: {},
  };

  const rejectStream = fs.createWriteStream(rejectPath);
  rejectStream.write(toCsvLine([...HEADERS, "reason", "source_line"]) + "\n");

  const parser = fs
    .createReadStream(resolvedInput)
    .pipe(
      parse({
        columns: true,
        skip_empty_lines: true,
        trim: true,
      }),
    );

  let lineNumber = 1; // starts after header

  for await (const row of parser) {
    lineNumber += 1;
    stats.total += 1;
    const validation = validateRow(row, { allowNegativeMargin, dropZeroQuantity });

    if (!validation.isValid) {
      stats.invalid += 1;
      stats.rejected += 1;
      validation.reasons.forEach((reason) => {
        stats.rejectedReasons[reason] = (stats.rejectedReasons[reason] || 0) + 1;
      });
      rejectStream.write(
        toCsvLine([
          row["No."],
          row["Kode Produk"],
          row["Nama Produk"],
          row["Kategori"],
          row["Jumlah"],
          row["Harga Pembelian (Rp)"],
          row["Harga Jual (Rp)"],
          validation.reasons.join("|"),
          lineNumber,
        ]) + "\n",
      );
      continue;
    }

    const existing = validRows.get(validation.code);
    if (existing) {
      stats.duplicates += 1;
      stats.rejected += 1;
      stats.rejectedReasons.duplicate = (stats.rejectedReasons.duplicate || 0) + 1;
      rejectStream.write(
        toCsvLine([
          existing.row["No."],
          existing.row["Kode Produk"],
          existing.row["Nama Produk"],
          existing.row.Kategori,
          existing.row.Jumlah,
          existing.row["Harga Pembelian (Rp)"],
          existing.row["Harga Jual (Rp)"],
          `duplicate_superseded_by_line_${lineNumber}`,
          existing.line,
        ]) + "\n",
      );
    }

    validRows.set(validation.code, { row: validation.cleanedRow, line: lineNumber });
  }

  rejectStream.end();

  const outputStream = fs.createWriteStream(outputPath);
  outputStream.write(toCsvLine(HEADERS) + "\n");

  let chunkStream = null;
  let rowsInChunk = 0;
  let chunkIndex = 0;

  const shouldChunk = Number.isInteger(chunkSize) && Number(chunkSize) > 0;
  const normalizedChunkSize = shouldChunk ? Number(chunkSize) : 0;
  const chunkBase =
    outputPath.endsWith(".csv") && shouldChunk
      ? outputPath.replace(/\.csv$/i, "")
      : outputPath;

  function rotateChunkWriter() {
    if (!shouldChunk) return;
    if (chunkStream) {
      chunkStream.end();
    }
    chunkIndex += 1;
    rowsInChunk = 0;
    const chunkPath = `${chunkBase}.chunk-${String(chunkIndex).padStart(2, "0")}.csv`;
    chunkStream = fs.createWriteStream(chunkPath);
    chunkStream.write(toCsvLine(HEADERS) + "\n");
  }

  if (shouldChunk) {
    rotateChunkWriter();
  }

  for (const { row } of validRows.values()) {
    const csvLine = toCsvLine([
      row["No."],
      row["Kode Produk"],
      row["Nama Produk"],
      row.Kategori,
      row.Jumlah,
      row["Harga Pembelian (Rp)"],
      row["Harga Jual (Rp)"],
    ]);
    outputStream.write(`${csvLine}\n`);

    if (shouldChunk) {
      if (rowsInChunk >= normalizedChunkSize) {
        rotateChunkWriter();
      }
      chunkStream.write(`${csvLine}\n`);
      rowsInChunk += 1;
    }

    stats.kept += 1;
  }

  outputStream.end();
  if (chunkStream) {
    chunkStream.end();
  }

  return stats;
}

function parseBoolean(value, defaultValue = false) {
  if (value === undefined) return defaultValue;
  if (value === true) return true;
  const normalized = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "y", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "n", "off"].includes(normalized)) return false;
  return defaultValue;
}

function parseNumber(value, defaultValue = 0) {
  if (value === undefined) return defaultValue;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? defaultValue : parsed;
}

async function run() {
  const args = parseArgs();
  const stats = await cleanCsv({
    inputPath: args.file,
    outputPath: args.out,
    rejectPath: args.reject,
    allowNegativeMargin: parseBoolean(args["allow-negative-margin"], false),
    dropZeroQuantity: parseBoolean(args["drop-zero-qty"], false),
    chunkSize: parseNumber(args["chunk-size"], 0),
  });

  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify(
      {
        total: stats.total,
        kept: stats.kept,
        rejected: stats.rejected,
        invalid: stats.invalid,
        duplicates: stats.duplicates,
        rejectedReasons: stats.rejectedReasons,
      },
      null,
      2,
    ),
  );
}

run().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
