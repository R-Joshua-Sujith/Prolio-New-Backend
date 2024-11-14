const express = require("express");
const router = express.Router();

const customerProductController = require("../../controller/Customer/Product");

const { customerVerify } = require("../../controller/Customer/Middleware/auth");

router.get("/test", customerProductController.test)

router.get("/test-verify", customerVerify, customerProductController.test);

module.exports = router;