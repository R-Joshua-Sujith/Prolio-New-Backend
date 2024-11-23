const express = require("express");
const router = express.Router();
const {
  customerVerify,
  looseVerify,
} = require("../../controller/Customer/Middleware/auth");
const companyController = require("../../controller/Customer/Company");

// Route to update the banner status
router.post(
  "/register-company",
  //   customerVerify,
  companyController.registerCompany
);
router.get(
  "/company-status",
  looseVerify,
  companyController.checkCompanyStatus
);

module.exports = router;
