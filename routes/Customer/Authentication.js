const express = require("express");
const router = express.Router();

const customerAuthenticationContoller = require("../../controller/Customer/Authentication");
const { customerVerify } = require("../../controller/Customer/Middleware/auth");



router.post("/register", customerAuthenticationContoller.register);

router.post("/login", customerAuthenticationContoller.login);


router.get("/test", customerAuthenticationContoller.test)

router.get("/test-verify", customerVerify, customerAuthenticationContoller.test)

module.exports = router;