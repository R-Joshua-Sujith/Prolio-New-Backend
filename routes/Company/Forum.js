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

router.get("/check-forum-owner/:forumId", forumController.checkForumOwnership);

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

router.post(
  "/reject-request/:forumId/:userId",
  companyVerify, // Middleware to authenticate and authorize the user
  forumController.rejectJoinRequest // Controller handling the rejection
);

// GET endpoint for received forum requests
router.get(
  "/received-requests",
  companyVerify,
  forumController.getReceivedRequestsForOwner
);

// Endpoint to get shared products
router.post("/share-products", companyVerify, forumController.shareProducts);

// Endpoint to get all customers
router.get("/all-users", companyVerify, forumController.getAllCustomers);

// Route to check the invited users for a specific forum
router.get(
  "/check-invitedUsers-request/:forumId",
  companyVerify,
  forumController.checkInvitedUsers
);

router.post("/leave-forum/:forumId", companyVerify, forumController.leaveForum);

// router.get(
//   "/all-productbyforum/:forumId",
//   forumController.getProductsByForumId
// );

router.get(
  "/getForumInvites",
  companyVerify,
  forumController.getOwnerForumInvites
);

router.post("/cancel-invite", companyVerify, forumController.cancelForumInvite);

router.get(
  "/user-sent-requests",
  looseVerify,
  forumController.getUserSentRequests
);

router.delete(
  "/user-cancel-request/:forumId", // Add :forumId parameter
  looseVerify,
  forumController.cancelUserRequest
);

router.get(
  "/user-received-requests",
  looseVerify,
  forumController.getUserReceivedRequests
);

router.post(
  "/accept-forum-invitation/:forumId",
  looseVerify,
  forumController.acceptForumInvitation
);

router.post(
  "/reject-forum-invitation/:forumId",
  looseVerify,
  forumController.rejectForumInvitation
);

module.exports = router;
