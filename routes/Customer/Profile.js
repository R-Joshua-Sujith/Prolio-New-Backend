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
router.delete(
  "/delete-profile-image",
  customerVerify,
  profileContoller.deleteProfileImage
);

router.get(
  "/customer-profile",
  customerVerify,
  profileContoller.getCustomerProfile
);

router.get(
  "/customer-status",
  customerVerify,
  profileContoller.checkCustomerStatus
);
module.exports = router;
