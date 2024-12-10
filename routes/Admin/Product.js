const express = require("express");
const router = express.Router();
const adminProductController = require("../../controller/Admin/Product");
const { adminVerify } = require("../../controller/Admin/Middleware/auth");

router.get(
  "/get-all-products",
  adminVerify,
  adminProductController.getAllProducts
);

router.get(
  "/get-by-slug/:slug",
  adminVerify,
  adminProductController.getProductBySlug
);

module.exports = router;
