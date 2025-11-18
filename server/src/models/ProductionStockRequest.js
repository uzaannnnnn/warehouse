const mongoose = require("mongoose");

const requestItemSchema = new mongoose.Schema(
  {
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
    quantity: {
      type: Number,
      required: true,
      min: 1,
    },
  },
  { _id: false },
);

const productionStockRequestSchema = new mongoose.Schema(
  {
    requestNumber: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },
    originLocation: {
      type: String,
      required: true,
      trim: true,
    },
    targetLocation: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    items: {
      type: [requestItemSchema],
      validate: [(val) => val.length > 0, "Minimal 1 item produk"],
    },
    requestedBy: {
      userId: mongoose.Schema.Types.ObjectId,
      name: String,
    },
    processedBy: {
      userId: mongoose.Schema.Types.ObjectId,
      name: String,
    },
    processedAt: {
      type: Date,
    },
    responseNote: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  },
);

productionStockRequestSchema.index({ targetLocation: 1, status: 1 });
productionStockRequestSchema.index({ originLocation: 1, status: 1 });

module.exports = mongoose.model(
  "ProductionStockRequest",
  productionStockRequestSchema,
);
