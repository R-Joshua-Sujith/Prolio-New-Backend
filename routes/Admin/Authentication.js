const express = require("express");
const router = express.Router();
const adminAuthContoller = require("../../controller/Admin/Authentication");
const adminVerify = require("../../controller/Admin/Middleware/auth");

router.post("/register", adminAuthContoller.register);
router.post("/login", adminAuthContoller.login);

module.exports = router;
