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
    documents: {
      type: [String], // Array of strings (for file paths or URLs)
      required: false, // Optional, as it may not always have files
    },
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
