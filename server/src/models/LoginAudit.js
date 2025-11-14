const mongoose = require("mongoose");

const loginAuditSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    email: String,
    ipAddress: String,
    userAgent: String,
    success: {
      type: Boolean,
      default: false,
    },
    reason: String,
    metadata: mongoose.Schema.Types.Mixed,
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model("LoginAudit", loginAuditSchema);
