const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const reportSchema = new Schema(
  {
    productId: {
      type: Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    reportedBy: {
      type: Schema.Types.ObjectId,
      ref: "Customer", // Changed from "User" to "Customer"
      required: true,
    },
    reason: {
      type: String,
      required: true,
      enum: ["inappropriate", "fake", "misleading", "spam", "other"],
    },
    description: {
      type: String,
      required: true,
      maxLength: 500,
    },
    attachments: [
      {
        url: { type: String },
        publicId: { type: String },
        fileType: { type: String },
        fileName: { type: String },
      },
    ],
    status: {
      type: String,
      enum: ["pending", "reviewed", "resolved", "rejected"],
      default: "pending",
    },
    reviewedBy: {
      type: Schema.Types.ObjectId,
      ref: "Admin",
    },
    reviewNotes: { type: String },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Report", reportSchema);
