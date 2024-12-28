const express = require("express");
const router = express.Router();
const {
  customerVerify,
  looseVerify,
} = require("../../controller/Customer/Middleware/auth");
const companyController = require("../../controller/Customer/Company");
const multer = require("multer");
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Define fields for file uploads
const uploadFields = upload.fields([
  { name: "documents", maxCount: 10 },
  { name: "companyLogo", maxCount: 5 },
]);

// Register company route
router.post(
  "/register-company",
  uploadFields,
  customerVerify,
  companyController.registerCompany
);

router.get(
  "/company-status",
  looseVerify,
  companyController.checkCompanyStatus
);

router.get("/company-details/:productId", companyController.getCompanyDetails);

router.post("/update-files", uploadFields, companyController.updateFiles);

module.exports = router;
