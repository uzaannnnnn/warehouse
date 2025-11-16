const mongoose = require("mongoose");

const productionItemSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: "productModel",
    },
    productModel: {
      type: String,
      enum: ["Product", "RawMaterial"],
    },
    productCode: String,
    productName: String,
    quantity: {
      type: Number,
      required: true,
      min: 1,
    },
    direction: {
      type: String,
      enum: ["in", "out"],
      required: true,
    },
  },
  { _id: false },
);

const productionSchema = new mongoose.Schema(
  {
    invoiceNumber: {
      type: String,
      trim: true,
      default: "",
    },

    productionNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    location: {
      type: String,
      trim: true,
      required: true,
    },

    date: {
      type: Date,
      default: Date.now,
    },
    items: {
      type: [productionItemSchema],
      validate: [(val) => val.length > 0, "Produksi harus memiliki item"],
    },
    totalOutQuantity: {
      type: Number,
      default: 0,
    },
    totalInQuantity: {
      type: Number,
      default: 0,
    },
    createdBy: {
      userId: mongoose.Schema.Types.ObjectId,
      name: String,
    },
  },
  {
    timestamps: true,
  },
);

productionSchema.index({ productionNumber: 1 }, { unique: true });
productionSchema.index({ invoiceNumber: 1 });
productionSchema.index({ location: 1, date: -1 });

module.exports = mongoose.model("Production", productionSchema);
