const mongoose = require("mongoose");

const rawMaterialSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      trim: true,
      unique: true,
      uppercase: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: String,
      trim: true,
    },
    stock: {
      type: Number,
      default: 0,
      min: 0,
    },
    stocks: [
      {
        location: {
          type: String,
          trim: true,
        },
        quantity: {
          type: Number,
          default: 0,
          min: 0,
        },
      },
    ],
    purchasePrice: {
      type: Number,
      default: 0,
      min: 0,
    },
    sellingPrice: {
      type: Number,
      default: 0,
      min: 0,
    },
    metadata: {
      sourceRow: Number,
    },
  },
  {
    timestamps: true,
    collection: "bahan_baku",
  },
);

rawMaterialSchema.index({ code: 1 }, { unique: true });

module.exports = mongoose.model("RawMaterial", rawMaterialSchema);
