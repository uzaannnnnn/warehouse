const mongoose = require("mongoose");
const { LOCATION_TYPES, formatLocationLabel, LOCATION_TYPE_LABELS } = require("../constants/locations");

const locationSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    number: {
      type: Number,
      required: true,
      unique: true,
    },
    type: {
      type: String,
      enum: Object.values(LOCATION_TYPES),
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    label: {
      type: String,
      required: true,
      trim: true,
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

locationSchema.methods.toResponse = function toResponse() {
  return {
    id: this._id.toString(),
    code: this.code,
    label: this.label,
    number: this.number,
    type: this.type,
    typeLabel: LOCATION_TYPE_LABELS[this.type] || this.type,
    name: this.name,
  };
};

locationSchema.statics.buildLabel = function buildLabel(location) {
  return formatLocationLabel(location);
};

module.exports = mongoose.model("Location", locationSchema);
