const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const productTipsSchema = new mongoose.Schema(
  {
    productId: {
      type: Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    CustomerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
    },
    tips: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      default: "processing",
    },
  },
  {
    timestamps: true,
  }
);
module.exports = mongoose.model("ProductTips", productTipsSchema);
