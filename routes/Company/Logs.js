const router = require("express").Router();
const Logs = require("../../models/Logs");
const { companyVerify } = require("../../controller/Company/Middleware/auth");
const logController = require("../../controller/Company/Log");

// Route to view logs by targetId
router.get("/view-logs/:id", companyVerify, logController.getLogsByTargetId);

// Route to view logs by userId
router.get("/own-logs", companyVerify, logController.getLogsByUserId);

router.get("/all-logs", logController.getLogs);

module.exports = router;
