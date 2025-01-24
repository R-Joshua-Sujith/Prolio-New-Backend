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
router.post("/send-otp", customerAuthenticationContoller.resendOTP);
router.post("/verify-otp", customerAuthenticationContoller.verifyOTP);
router.delete("/logout", customerAuthenticationContoller.logout);

router.post(
  "/forgot-password",
  customerAuthenticationContoller.requestPasswordReset
);
router.post(
  "/verify-reset-otp",
  customerAuthenticationContoller.verifyPasswordResetOTP
);
router.post("/reset-password", customerAuthenticationContoller.resetPassword);

module.exports = router;
