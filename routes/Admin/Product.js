const express = require("express");
const router = express.Router();
const adminProductController = require("../../controller/Admin/Product");
const { adminVerify } = require("../../controller/Admin/Middleware/auth");

router.get(
  "/get-all-products/:ownerId",
  // adminVerify,
  adminProductController.getAllProducts
);

router.get(
  "/get-by-slug/:slug",
  adminVerify,
  adminProductController.getProductBySlug
);

router.put(
  "/update-product-status/:productId",
  adminVerify,
  adminProductController.updateProductStatus
);

module.exports = router;
