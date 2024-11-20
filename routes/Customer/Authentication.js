const express = require("express");
const router = express.Router();
const customerAuthenticationContoller = require("../../controller/Customer/Authentication");
const { customerVerify } = require("../../controller/Customer/Middleware/auth");

router.get("/test", customerAuthenticationContoller.test);
router.get(
  "/test-verify",
  customerVerify,
  customerAuthenticationContoller.test
);

router.post("/register", customerAuthenticationContoller.register);
router.post("/login", customerAuthenticationContoller.login);
router.delete(
  "/logout",
  customerVerify,
  customerAuthenticationContoller.logout
);

module.exports = router;
