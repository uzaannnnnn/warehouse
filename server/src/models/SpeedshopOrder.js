const mongoose = require("mongoose");

const { Schema } = mongoose;

const partSchema = new Schema(
  {
    product: {
      type: Schema.Types.ObjectId,
      ref: "Product",
    },
    productCode: {
      type: String,
      trim: true,
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
    unitPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    subtotal: {
      type: Number,
      required: true,
      min: 0,
    },
    maxQuantity: {
      type: Number,
      min: 0,
    },
  },
  { _id: false },
);

const serviceSchema = new Schema(
  {
    name: {
      type: String,
      trim: true,
    },
    cost: {
      type: Number,
      min: 0,
      default: 0,
    },
  },
  { _id: false },
);

const statusHistorySchema = new Schema(
  {
    status: {
      type: String,
      enum: ["draft", "pending_payment", "completed"],
      required: true,
    },
    note: {
      type: String,
      trim: true,
    },
    user: {
      userId: {
        type: Schema.Types.ObjectId,
        ref: "User",
      },
      name: String,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false },
);

const speedshopOrderSchema = new Schema(
  {
    orderId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    orderDate: {
      type: Date,
      default: Date.now,
    },
    location: {
      type: String,
      required: true,
      trim: true,
    },
    orderType: {
      type: String,
      enum: ["parts-only", "service"],
      required: true,
    },
    invoiceNumber: {
      type: String,
      trim: true,
    },
    customerName: {
      type: String,
      required: true,
      trim: true,
    },
    customerPhone: {
      type: String,
      trim: true,
    },
    customerAddress: {
      type: String,
      trim: true,
    },
    customerNote: {
      type: String,
      trim: true,
    },
    vehiclePlate: {
      type: String,
      trim: true,
    },
    vehicleType: {
      type: String,
      trim: true,
    },
    vehicleKm: {
      type: Number,
      min: 0,
    },
    vehicleYear: {
      type: Number,
      min: 1900,
    },
    mechanicName: {
      type: String,
      trim: true,
    },
    paymentMethod: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: ["draft", "pending_payment", "completed"],
      default: "draft",
    },
    parts: [partSchema],
    services: [serviceSchema],
    totals: {
      parts: {
        type: Number,
        default: 0,
        min: 0,
      },
      services: {
        type: Number,
        default: 0,
        min: 0,
      },
      grand: {
        type: Number,
        default: 0,
        min: 0,
      },
    },
    statusHistory: [statusHistorySchema],
    createdBy: {
      userId: {
        type: Schema.Types.ObjectId,
        ref: "User",
      },
      name: String,
    },
    updatedBy: {
      userId: {
        type: Schema.Types.ObjectId,
        ref: "User",
      },
      name: String,
    },
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model("SpeedshopOrder", speedshopOrderSchema);

