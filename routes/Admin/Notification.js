const express = require("express");
const router = express.Router();
const { adminVerify } = require("../../controller/Admin/Middleware/auth");
const notificationController = require("../../controller/Admin/Notification");

router.patch(
  "/mark-all-read",
  adminVerify,
  notificationController.markNotificationAsRead
);

router.get(
  "/notifications",
  adminVerify,
  notificationController.getNotifications
);

module.exports = router;
