const mongoose = require("mongoose");

const productionBufferItemSchema = new mongoose.Schema(
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
      default: 0,
      min: 0,
    },
  },
  { _id: false },
);

const productionBufferSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    items: {
      type: [productionBufferItemSchema],
      default: [],
    },
  },
  {
    timestamps: true,
  },
);

productionBufferSchema.index({ user: 1 }, { unique: true });

module.exports = mongoose.model("ProductionBuffer", productionBufferSchema);

