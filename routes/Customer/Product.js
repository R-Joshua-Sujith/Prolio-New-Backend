const express = require("express");
const router = express.Router();
const customerProductController = require("../../controller/Customer/Product");
const { customerVerify } = require("../../controller/Customer/Middleware/auth");

router.get("/test", customerProductController.test);
router.get("/test-verify", customerVerify, customerProductController.test);

router.get(
  "/get-single-product/:slug",
  customerVerify,
  customerProductController.getProduct
);

router.get(
  "/my-single-product/:slug",
  // customerVerify,
  customerProductController.getMySingleProduct
);

router.get("/all-Products", customerProductController.getAllProducts);

router.get("/get-search-products", customerProductController.getSearchProducts);

module.exports = router;
