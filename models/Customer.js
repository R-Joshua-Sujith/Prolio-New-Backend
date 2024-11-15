const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const departmentSchema = new Schema(
  {
    name: { type: String },
  },
  { _id: true }
);

const customerSchema = new Schema(
  {
    status: {
      type: String,
      enum: ["Blocked", "Verified", "UnVerified"],
      default: "UnVerified",
    },
    email: { type: String },
    name: { type: String },
    password: { type: String },
    phone: { type: String },
    profile: {
      url: String,
      publicId: String,
    },
    isCompany: {
      applied: { type: Boolean, default: false },
      verified: { type: Boolean, default: false },
    },
    isInfluencer: {
      applied: { type: Boolean, default: false },
      verified: { type: Boolean, default: false },
    },
    companyDetails: { type: mongoose.Schema.Types.Mixed },
    influencerDetails: { type: mongoose.Schema.Types.Mixed },
    wishList: [
      {
        type: Schema.Types.ObjectId,
        ref: "Product",
      },
    ],
    ownProducts: [
      {
        type: Schema.Types.ObjectId,
        ref: "Product",
      },
    ],
    departments: [departmentSchema],
    otp: { type: Number },
    otpExpiry: { type: Date },
    refreshToken: { type: String },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Customer", customerSchema);
