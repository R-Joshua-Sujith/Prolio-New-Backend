const express = require("express");
const router = express.Router();
const customerAuthenticationContoller = require("../../controller/Customer/Authentication");
const {
  customerVerify,
  looseVerify,
} = require("../../controller/Customer/Middleware/auth");

router.get("/test", customerAuthenticationContoller.test);
router.get(
  "/test-verify",
  customerVerify,
  customerAuthenticationContoller.test
);

router.post("/register", customerAuthenticationContoller.register);
router.post("/login", customerAuthenticationContoller.login);
router.post("/google-login", customerAuthenticationContoller.googleLogin);
router.get(
  "/check-verification",
  looseVerify,
  customerAuthenticationContoller.checkVerificationStatus
);

router.get(
  "/check-company-status",
  looseVerify, // Your authentication middleware
  customerAuthenticationContoller.checkCompanyStatus
);

// Route to send OTP
router.post("/send-otp", customerAuthenticationContoller.sendOTP);
router.post("/verify-otp", customerAuthenticationContoller.verifyOTP);
router.delete("/logout", customerAuthenticationContoller.logout);

module.exports = router;
