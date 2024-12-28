const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const productSchema = new Schema(
  {
    status: {
      type: String,
      enum: ["Active", "In_Active", "Draft"],
      default: "Active",
    },
    block: {
      isBlocked: { type: Boolean, default: false },
      reason: { type: String, default: null },
      blockedBy: { type: Schema.Types.ObjectId, ref: "Admin", default: null },
      blockedAt: { type: Date, default: null },
    },

    ownerId: { type: Schema.Types.ObjectId, ref: "Customer" },
    basicDetails: {
      id: { type: String },
      slug: { type: String },
      name: { type: String },
      price: { type: Number },
      description: { type: String },
    },
    images: [
      {
        url: { type: String },
        publicId: { type: String },
      },
    ],
    colors: [
      {
        name: { type: String },
        price: { type: Number },
        images: [
          {
            url: { type: String },
            publicId: { type: String },
          },
        ],
      },
    ],
    attributes: [
      {
        name: { type: String },
        price: { type: Number },
      },
    ],
    category: {
      categoryId: { type: Schema.Types.ObjectId, ref: "Category" },
      subCategoryId: { type: Schema.Types.ObjectId },
    },
    dynamicSteps: { type: mongoose.Schema.Types.Mixed },
    opportunities: [
      {
        type: String,
      },
    ],
    totalViews: { type: Number, default: 0 },
    shareCount: { type: Number, default: 0 },
    // Add productRequests array in Product model
    productRequests: [
      {
        influencerId: { type: Schema.Types.ObjectId, ref: "Customer" },
        status: {
          type: String,
          enum: ["pending", "accepted", "rejected"],
          default: "pending",
        },
        requestedDate: { type: Date, default: Date.now },
        assignedDate: { type: Date },
        rejectedReason: { type: String, default: null },
      },
    ],
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Product", productSchema);
