const express = require("express");
const router = express.Router();
const { customerVerify } = require("../../controller/Customer/Middleware/auth");
const companyController = require("../../controller/Customer/Company");

// Route to update the banner status
router.post(
  "/register-company",
  //   customerVerify,
  companyController.registerCompany
);

module.exports = router;
