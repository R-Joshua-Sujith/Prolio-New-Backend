const express = require("express");
const router = express.Router();
const CompanyForumController = require("../../controller/Admin/CompanyForum");
const { adminVerify } = require("../../controller/Admin/Middleware/auth");

router.get(
  "/all-CompanyForums/:customerId",
    adminVerify,
  CompanyForumController.getAllCompanyForums
);

router.patch(
  "/toggle-block/:forumId/toggle-block",
  CompanyForumController.toggleBlockUnblockForum
);

// router.delete(
//   "/product-reports/:id",
//   adminVerify,
//   productReportController.deleteReport
// );

// router.patch(
//   "/block-product/:productId",
//   adminVerify,
//   productReportController.toggleProductBlock
// );
module.exports = router;
