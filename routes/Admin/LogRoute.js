const express = require("express");
const router = express.Router();
const { adminVerify } = require("../../controller/Admin/Middleware/auth");
const LogController = require("../../controller/Admin/Logs");

// Route to get all influencers
router.get("/our-logs", adminVerify, LogController.getAdminLogs);

module.exports = router;
