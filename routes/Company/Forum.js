const express = require("express");
const mongoose = require("mongoose");
const multer = require("multer");
const CustomerModel = require("../../models/Customer");
const {
  companyVerify,
  looseVerify,
} = require("../../controller/Company/Middleware/auth");
const OpportunityModel = require("../../models/Opportunity");
const router = express.Router();
const forumController = require("../../controller/Company/forum");

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

// Define the forum creation route
router.post(
  "/create-forum",
  upload.single("forumImage"),
  looseVerify,
  forumController.createForum
);

// Route for sending invitations
router.post(
  "/send-invitations/:forumId",
  companyVerify,
  forumController.sendInvitations
);

// Route for leaving a forum
router.post("/leave-forum/:forumId", companyVerify, forumController.leaveForum);

// Route to check if the logged-in user is the owner of the forum
router.get(
  "/check-forum-owner/:forumId",
  companyVerify,
  forumController.checkForumOwnership
);

// Route to get own forums
router.get("/own-forums", companyVerify, forumController.getOwnForums);

// Route to get all active forums excluding ownner's Forum
router.get("/all-forums", looseVerify, forumController.getAllForums);

// Route to get forums where the user is a creator or a member
router.get("/get-forums", looseVerify, forumController.getForums);

// Route to get a single forum by ID
router.get("/get-forum/:forumId", looseVerify, forumController.getForumById);

// Route to delete a forum
router.delete("/delete/:forumId", forumController.deleteForum);

// Route to send a join request to a forum
router.post(
  "/join-forum/:forumId",
  looseVerify,
  forumController.sendJoinRequest
);

// Accept the Request
router.post(
  "/accept-request/:forumId/:userId",
  companyVerify,
  forumController.acceptJoinRequest
);

// GET endpoint for received forum requests
router.get(
  "/received-requests",
  companyVerify,
  forumController.getReceivedRequestsForOwner
);

module.exports = router;
