const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const departmentSchema = new Schema(
  {
    name: { type: String, required: true },
    users: [
      {
        type: Schema.Types.ObjectId,
        ref: "CompanyUser",
      },
    ],
  },
  {
    timestamps: true,
    _id: true,
  }
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
      reApplied: { type: Boolean, default: false },
    },
    isInfluencer: {
      applied: { type: Boolean, default: false },
      verified: { type: Boolean, default: false },
      rejected: { type: Boolean, default: false },
      rejectedReason: { type: String, default: null }, // New field to store rejection reason
      badgeStatus: {
        applied: { type: Boolean, default: false },
        rejected: { type: Boolean, default: false },
        verified: { type: Boolean, default: false },
        rejectedReason: { type: String, default: null }, // New field to store rejection reason
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
    story: {
      content: { type: String },
      images: [
        {
          url: { type: String },
          publicId: { type: String },
        },
      ],
    },
    influencerDetails: { type: mongoose.Schema.Types.Mixed },
    // List of influencers the company has invited
    invitedInfluencers: [
      {
        influencerId: { type: Schema.Types.ObjectId, ref: "Customer" },
        status: {
          type: String,
          enum: ["pending", "accepted", "rejected"],
          default: "pending",
        },
        invitationDate: { type: Date, default: Date.now },
      },
    ],
    // Add the companyInfluencers field back to store accepted influencers
    companyInfluencers: [
      {
        influencerId: { type: Schema.Types.ObjectId, ref: "Customer" },
        status: {
          type: String,
          enum: ["pending", "accepted", "rejected"],
          default: "pending",
        },
        assignedDate: { type: Date },
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
