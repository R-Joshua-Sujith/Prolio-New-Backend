const express = require("express");
const router = express.Router();
const ConnectionController = require("../../controller/Company/Connection");
const { companyVerify } = require("../../controller/Company/Middleware/auth");
const { customerVerify } = require("../../controller/Customer/Middleware/auth");

router.post(
  "/create-connection",
  customerVerify,
  ConnectionController.createConnection
);

router.get(
  "/get-forum-connections/:forumId",
  customerVerify,
  ConnectionController.getForumConnections
);

router.get(
  "/getOwnerConnections",
  customerVerify,
  ConnectionController.getOwnerConnections
);

router.delete(
  "/remove-connection/:connectionId",
  customerVerify,
  ConnectionController.deleteConnection
);

router.get(
  "/check-status/:userId",
  customerVerify,
  ConnectionController.checkConnectionStatus
);
module.exports = router;
