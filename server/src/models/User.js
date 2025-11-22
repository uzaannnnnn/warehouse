const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const roles = ["admin", "manager", "bahanbaku", "kemasan", "produksi", "speedshop", "warehouse"];

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
      minlength: 8,
      select: false,
    },
    location: {
      type: String,
      trim: true,
    },
    role: {
      type: String,
      enum: roles,
      default: "warehouse",
    },
    avatarUrl: String,
    status: {
      type: String,
      enum: ["active", "suspended"],
      default: "active",
    },
    lastLoginAt: Date,
    failedLoginAttempts: {
      type: Number,
      default: 0,
    },
    lastFailedLoginAt: Date,
  },
  {
    timestamps: true,
  },
);

userSchema.pre("save", async function hashPassword(next) {
  if (!this.isModified("password")) return next();

  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  return next();
});

userSchema.methods.comparePassword = function comparePassword(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.recordFailedLogin = function recordFailedLogin() {
  this.failedLoginAttempts += 1;
  this.lastFailedLoginAt = new Date();
  return this.save();
};

userSchema.methods.recordSuccessfulLogin = function recordSuccessfulLogin() {
  this.failedLoginAttempts = 0;
  this.lastFailedLoginAt = undefined;
  this.lastLoginAt = new Date();
  return this.save();
};

userSchema.methods.toSafeObject = function toSafeObject() {
  return {
    id: this._id.toString(),
    name: this.name,
    email: this.email,
    role: this.role,
    status: this.status,
    avatarUrl: this.avatarUrl,
    location: this.location,
    lastLoginAt: this.lastLoginAt,
    createdAt: this.createdAt,
  };
};

module.exports = mongoose.model("User", userSchema);
