const express = require("express");
const router = express.Router();
const analyticsController = require("../../controller/Admin/Analytics");
const { adminVerify } = require("../../controller/Admin/Middleware/auth");

// Use the optimized version
router.get(
  "/dashboard-stats",
  // adminVerify,
  analyticsController.getDashboardStatsOptimized
);

module.exports = router;
