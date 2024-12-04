const express = require("express");
const router = express.Router();
const { customerVerify } = require("../../controller/Customer/Middleware/auth");
const notificationController = require("../../controller/Customer/Notification");

router.patch(
  "/:messageId/read",
  customerVerify,
  notificationController.markMessageAsRead
);

router.get(
  "/message-notifications",
  customerVerify,
  notificationController.getUnreadMessageNotifications
);

router.get(
  "/notifications",
  customerVerify,
  notificationController.getNotifications
);

router.patch(
  "/:id/read",
  customerVerify,
  notificationController.markNotificationAsRead
);
module.exports = router;
