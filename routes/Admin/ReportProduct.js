const express = require("express");
const router = express.Router();
const productReportController = require("../../controller/Admin/ReportProduct");
const { adminVerify } = require("../../controller/Admin/Middleware/auth");

router.get(
  "/get-all-products-reports",
  adminVerify,
  productReportController.getAllReports
);

router.get(
  "/product-reports/:id",
  adminVerify,
  productReportController.getSingleReport
);

router.patch(
  "/product-reports/:id",
  adminVerify,
  productReportController.updateReportStatus
);

router.delete(
  "/product-reports/:id",
  adminVerify,
  productReportController.deleteReport
);

router.patch(
  "/block-product/:productId",
  adminVerify,
  productReportController.toggleProductBlock
);
module.exports = router;
