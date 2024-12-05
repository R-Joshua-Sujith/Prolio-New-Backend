const express = require("express");
const router = express.Router();
const ConnectionController = require("../../controller/Company/Connection");

const {
  companyVerify,
  looseVerify,
} = require("../../controller/Company/Middleware/auth");

router.post(
  "/create-connection",
  companyVerify,
  ConnectionController.createConnection
);

router.get(
  "/get-forum-connections/:forumId",
  companyVerify,
  ConnectionController.getForumConnections
);

router.get(
  "/getOwnerConnections",
  companyVerify,
  ConnectionController.getOwnerConnections
);

router.delete(
  "/remove-connection/:connectionId",
  companyVerify,
  ConnectionController.deleteConnection
);

router.get(
  "/check-status/:userId",
  companyVerify,
  ConnectionController.checkConnectionStatus
);
module.exports = router;
