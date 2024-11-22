const express = require("express");
const router = express.Router();
const { customerVerify } = require("../../controller/Customer/Middleware/auth");
const bannerController = require("../../controller/Customer/banner");

// Route to update the banner status
router.get("/active-banner", bannerController.getActiveBanners);

module.exports = router;
