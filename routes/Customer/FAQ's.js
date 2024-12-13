const express = require("express");
const router = express.Router();
const FAQ = require("../../models/FAQ's");
const customerFAQController = require("../../controller/Customer/FAQ's");
const {
  customerVerify,
  looseVerify,
} = require("../../controller/Customer/Middleware/auth");

router.post(
  "/create-question/:slug",
  looseVerify,
  customerFAQController.postQuestion
);

router.get(
  "/product-faqs/:slug",
  looseVerify,
  customerFAQController.getFAQsByProduct
);

module.exports = router;
