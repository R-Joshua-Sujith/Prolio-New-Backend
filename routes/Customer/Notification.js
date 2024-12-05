const express = require("express");
const router = express.Router();
const { customerVerify } = require("../../controller/Customer/Middleware/auth");
const notificationController = require("../../controller/Customer/Notification");

router.patch(
  "/mark-all-read",
  customerVerify,
  notificationController.markNotificationAsRead
);

router.get(
  "/message-notifications",
  customerVerify,
  notificationController.getUnreadMessageNotifications
);
router.get(
  "/message-notifications-count",
  customerVerify,
  notificationController.getUnreadMessageNotificationsCount
);

router.get(
  "/notifications",
  customerVerify,
  notificationController.getNotifications
);

router.patch(
  "/mark-Message-read",
  customerVerify,
  notificationController.markAllMessagesAsRead
);
module.exports = router;
