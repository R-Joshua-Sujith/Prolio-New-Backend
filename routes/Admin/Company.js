const express = require("express");
const router = express.Router();
const adminCompanyController = require("../../controller/Admin/Company");
const adminVerify = require("../../controller/Admin/Middleware/auth");

router.get("/all-companies", adminCompanyController.getAllCompanies);
router.get("/verified", adminCompanyController.getVerifiedCompanyUsers);

router.get("/un-verified", adminCompanyController.getPendingCompanyUsers);

router.get("/rejected", adminCompanyController.getRejectedCompanyUsers);

router.put(
  "/change-status/:companyId",
  adminCompanyController.updateCompanyStatus
);

module.exports = router;
