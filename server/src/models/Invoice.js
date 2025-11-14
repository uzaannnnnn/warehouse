const mongoose = require("mongoose");

const invoiceItemSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
    },
    productCode: String,
    productName: String,
    quantity: {
      type: Number,
      required: true,
      min: 1,
    },
  },
  { _id: false },
);

const invoiceSchema = new mongoose.Schema(
  {
    invoiceNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    type: {
      type: String,
      enum: ["in", "out"],
      required: true,
    },
    location: {
      type: String,
      trim: true,
    },
    segment: {
      type: String,
      enum: ["finished", "raw"],
      default: "finished",
    },
    productionClaimed: {
      type: Boolean,
      default: false,
    },
    date: {
      type: Date,
      default: Date.now,
    },
    items: {
      type: [invoiceItemSchema],
      validate: [(val) => val.length > 0, "Invoice harus memiliki item"],
    },
    totalQuantity: {
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

invoiceSchema.index({ invoiceNumber: 1 }, { unique: true });

module.exports = mongoose.model("Invoice", invoiceSchema);
