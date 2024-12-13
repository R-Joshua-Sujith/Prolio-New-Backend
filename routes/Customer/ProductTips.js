// Routes: productTipsRoutes.js
const express = require("express");
const router = express.Router();
const customerProductTipsController = require("../../controller/Customer/ProductTips");
const { customerVerify } = require("../../controller/Customer/Middleware/auth");
const { companyVerify } = require("../../controller/Company/Middleware/auth");

router.post(
  "/create",
  customerVerify,
  customerProductTipsController.createProductTips
);

router.get(
  "/all-tips",
  companyVerify,
  customerProductTipsController.getAllTips
);

router.get(
  "/published/:productId",
  customerProductTipsController.getPublishedTipsByProduct
);

router.put("/updateStatus/:id", customerProductTipsController.changeTipStatus);

module.exports = router;
