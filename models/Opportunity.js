const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const opportunitySchema = new Schema(
  {
    customerId: {
      type: Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
    },
    ownerId: {
      type: Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
    },
    productId: {
      type: Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
    },
    opportunity_role: {
      type: String,
      required: true,
      trim: true,
    },
    mobileNumber: {
      type: String,
      required: true,
      trim: true,
      match: /^[0-9]{10}$/, // Validates for a 10-digit number
    },

    address: {
      type: String,
      required: true,
      trim: true,
    },
    yearsOfExp: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, // Validates for a basic email format
    },
    productsDealtWith: {
      type: String,
      required: true,
      trim: true,
    },
    memo: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: ["Processing", "Approved", "Rejected"],
      default: "Processing",
    },
    remarks: {
      type: String,
      trim: true,
    },
    documents: [
      {
        url: { type: String, required: true }, // URL of the document
        publicId: { type: String, required: true }, // Identifier for the file (e.g., from cloud storage)
      },
    ],

    // Optional, as documents may not always be uploaded
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes for better query performance
opportunitySchema.index({ customerId: 1, status: 1 });
opportunitySchema.index({ ownerId: 1, status: 1 });
opportunitySchema.index({ productId: 1 });

module.exports = mongoose.model("Opportunity", opportunitySchema);
