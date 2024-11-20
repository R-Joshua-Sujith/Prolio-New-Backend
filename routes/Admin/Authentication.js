const express = require("express");
const router = express.Router();
const adminAuthContoller = require("../../controller/Admin/Authentication");
const { adminVerify } = require("../../controller/Admin/Middleware/auth");

router.post("/create-admin", adminAuthContoller.create);

router.post("/login", adminAuthContoller.login);



router.delete("/removeLoggedInDevice/:deviceId", adminVerify, adminAuthContoller.removeLoggedInDevice);

router.delete("/logout", adminVerify, adminAuthContoller.logout);

router.get("/profile", adminVerify, adminAuthContoller.getProfile);

module.exports = router;
