const express = require("express");
const multer = require("multer");
const profileContoller = require("../../controller/Customer/Profile");
const {
  customerVerify,
  looseVerify,
} = require("../../controller/Customer/Middleware/auth");
const router = express.Router();

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

// Route to update customer profile
router.patch(
  "/update-profile",
  upload.single("profileImage"),
  customerVerify,
  profileContoller.updateCustomerProfile
);

router.get(
  "/customer-details",
  looseVerify,
  profileContoller.getCustomerDetails
);

router.get("/profile", customerVerify, profileContoller.getCustomerProfile);

module.exports = router;
