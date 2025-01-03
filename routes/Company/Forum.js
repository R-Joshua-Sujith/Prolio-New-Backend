const express = require("express");
const mongoose = require("mongoose");
const multer = require("multer");
const CustomerModel = require("../../models/Customer");
const {
  companyVerify,
  looseVerify,
} = require("../../controller/Company/Middleware/auth");
const { customerVerify } = require("../../controller/Customer/Middleware/auth");
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
  customerVerify,
  forumController.createForum
);

// Route for sending invitations
router.post(
  "/send-invitations/:forumId",
  customerVerify,
  forumController.sendInvitations
);

// Route for leaving a forum
router.post(
  "/leave-forum/:forumId",
  customerVerify,
  forumController.leaveForum
);

// Route to check if the logged-in user is the owner of the forum
router.get(
  "/check-forum-owner/:forumId",
  customerVerify,
  forumController.checkForumOwnership
);

// Route to get own forums
router.get("/own-forums", customerVerify, forumController.getOwnForums);

// Route to get all active forums excluding ownner's Forum
router.get("/all-forums", customerVerify, forumController.getAllForums);

// Route to get forums where the user is a creator or a member
router.get("/get-forums", customerVerify, forumController.getForums);

// Route to get a single forum by ID
router.get("/get-forum/:forumId", customerVerify, forumController.getForumById);

// Route to delete a forum
router.delete("/delete/:forumId", customerVerify, forumController.deleteForum);

// Toggle active/inactive status for a forum
router.patch("/:id/toggle-active", forumController.toggleForumActiveStatus);

router.get("/check-forum-owner/:forumId", forumController.checkForumOwnership);

// Route to send a join request to a forum
router.post(
  "/join-forum/:forumId",
  customerVerify,
  forumController.sendJoinRequest
);

// Accept the Request
router.post(
  "/accept-request/:forumId/:userId",
  customerVerify,
  forumController.acceptJoinRequest
);

router.post(
  "/reject-request/:forumId/:userId",
  customerVerify,
  forumController.rejectJoinRequest
);

// Endpoint to get shared products
router.post("/share-products", companyVerify, forumController.shareProducts);

// Endpoint to get all customers
router.get("/all-users", looseVerify, forumController.getAllCustomers);

// Route to check the invited users for a specific forum
router.get(
  "/check-invitedUsers-request/:forumId",
  companyVerify,
  forumController.checkInvitedUsers
);

router.get(
  "/all-productbyforum/:forumId",
  forumController.getProductsByForumId
);

// route for fetching participants details in a forum
router.get(
  "/participants-details/:forumId",
  forumController.getParticipantsDetails
);

// GET endpoint for received forum requests
router.get(
  "/received-requests",
  companyVerify,
  forumController.getReceivedRequestsForOwner
);

router.post("/leave-forum/:forumId", companyVerify, forumController.leaveForum);

router.get(
  "/getForumInvites",
  companyVerify,
  forumController.getOwnerForumInvites
);

router.post("/cancel-invite", companyVerify, forumController.cancelForumInvite);

router.get(
  "/user-sent-requests",
  customerVerify,
  forumController.getUserSentRequests
);

router.delete(
  "/user-cancel-request/:forumId", // Add :forumId parameter
  customerVerify,
  forumController.cancelUserRequest
);

router.get(
  "/user-received-requests",
  customerVerify,
  forumController.getUserReceivedRequests
);

router.post(
  "/accept-forum-invitation/:forumId",
  customerVerify,
  forumController.acceptForumInvitation
);

router.post(
  "/reject-forum-invitation/:forumId",
  customerVerify,
  forumController.rejectForumInvitation
);

module.exports = router;
