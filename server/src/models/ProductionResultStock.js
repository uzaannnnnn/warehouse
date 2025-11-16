const mongoose = require("mongoose");

const productionResultStockSchema = new mongoose.Schema(
  {
    location: {
      type: String,
      required: true,
      trim: true,
    },
    productCode: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    productName: {
      type: String,
      trim: true,
    },
    okRemaining: {
      type: Number,
      default: 0,
      min: 0,
    },
    rejectRemaining: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalOk: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalReject: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: true,
  },
);

productionResultStockSchema.index(
  { location: 1, productCode: 1 },
  { unique: true },
);

module.exports = mongoose.model(
  "ProductionResultStock",
  productionResultStockSchema,
);

