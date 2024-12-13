const mongoose = require("mongoose");

const faqSchema = new mongoose.Schema(
  {
    question: {
      type: String,
      required: true,
      trim: true,
    },
    answer: {
      type: String,
      default: "",
      trim: true,
    },
    productSlug: {
      type: String,
      ref: "Product",
      required: true,
    },
    askedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
    },
    answeredBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
    },
    status: {
      type: String,
      enum: ["pending", "rejected", "answered", "published"],
      default: "pending",
    },
    rejectionReason: {
      type: String,
      trim: true,
      default: "",
      required:false
    },
    isPublished: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for better query performance
faqSchema.index({ productSlug: 1, status: 1 });
faqSchema.index({ status: 1, createdAt: -1 });

const FAQ = mongoose.model("FAQ", faqSchema);
module.exports = FAQ;
