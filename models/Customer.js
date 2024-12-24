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
      url: { type: String },
      publicId: { type: String },
    },
    isGoogleLogin: {
      type: Boolean,
      default: false,
    },
    isCompany: {
      applied: { type: Boolean, default: false },
      verified: { type: Boolean, default: false },
      rejected: { type: Boolean, default: false },
    },
    isInfluencer: {
      applied: { type: Boolean, default: false },
      verified: { type: Boolean, default: false },
      rejected: { type: Boolean, default: false },
      badgeStatus: {
        applied: { type: Boolean, default: false },
        rejected: { type: Boolean, default: false },
        verified: { type: Boolean, default: false },
      },
    },
    companyDetails: {
      companyInfo: {
        companyName: { type: String },
        ownerName: { type: String },
        yearEstablishment: { type: String },
        gstNo: { type: String },
        businessType: { type: String },
        companyAbout: { type: String },
        totalEmployees: { type: String },
      },
      contactInfo: {
        address: { type: String },
        city: { type: String },
        state: { type: String },
        pincode: { type: String },
        email: { type: String },
        phone: { type: String },
      },
      companyLogo: {
        url: { type: String },
        publicId: { type: String },
      },
      documents: [
        {
          url: { type: String },
          publicId: { type: String },
        },
      ],
    },
    influencerDetails: { type: mongoose.Schema.Types.Mixed },
    influencerCompanies: [
      {
        companyId: { type: Schema.Types.ObjectId, ref: "Customer" },
        productIds: [
          {
            type: Schema.Types.ObjectId,
            ref: "Product",
          },
        ],
      },
    ],
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
