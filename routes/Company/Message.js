const express = require("express");
const router = express.Router();
const messageController = require("../../controller/Company/Message");
const {
  companyVerify,
  looseVerify,
} = require("../../controller/Company/Middleware/auth");

router.get("/:forumId/messages", messageController.getMessages);

module.exports = router;
