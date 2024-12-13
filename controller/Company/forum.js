const express = require("express");
const mongoose = require("mongoose");
const ForumModel = require("../../models/Forum");
const ProductModel = require("../../models/Product");
const { uploadToS3 } = require("../../utils/s3FileUploader");
const { sendResponse } = require("../../utils/responseHandler");
const Message = require("../../models/message");
const CustomerModel = require("../../models/Customer");
const socketIo = require("socket.io");
const http = require("http");
const app = express();
const server = http.createServer(app);
const NotificationService = require("../../utils/notificationService");

exports.createForum = async (req, res) => {
  const {
    forumName,
    forumDescription,
    objective,
    inviteEmails = [],
  } = req.body;

  try {
    const ownerId = req.user?.id;

    if (!ownerId || !mongoose.Types.ObjectId.isValid(ownerId)) {
      return sendResponse(res, 400, "Invalid owner ID");
    }

    // Check if forum with the same name already exists
    const existingForum = await ForumModel.findOne({ forumName });
    if (existingForum) {
      return sendResponse(res, 409, "Forum already exists");
    }

    // Handle forum image upload
    let forumImageUrl = null;
    let forumImageKey = null;
    if (req.file) {
      const uploadResult = await uploadToS3(
        req.file.buffer,
        req.file.originalname,
        req.file.mimetype,
        "forum-images"
      );
      forumImageUrl = uploadResult.url;
      forumImageKey = uploadResult.filename;
    }

    // Create the new forum
    const newForum = new ForumModel({
      forumName,
      forumDescription,
      objective,
      forumImage: forumImageUrl,
      forumImagePublicId: forumImageKey,
      ownerId,
      members: [ownerId],
    });
    await newForum.save();

    // Notify the forum creator using NotificationService
    await NotificationService.createNotification({
      userId: ownerId,
      message: `You have successfully created the forum ${forumName}`,
      type: "creation",
      io: req.io,
    });

    // Handle invitations for other users
    if (inviteEmails.length > 0) {
      const invitedUsers = await CustomerModel.find({
        email: { $in: inviteEmails },
      });

      // Update forum with invited users
      newForum.invitedUsers = invitedUsers.map((user) => user._id);
      await newForum.save();

      // Send notifications to invited users using NotificationService
      const notificationsData = invitedUsers.map((invitee) => ({
        userId: invitee._id,
        message: `You have been invited to join the forum ${forumName}`,
        type: "invite",
      }));

      await NotificationService.createBatchNotifications(
        notificationsData,
        req.io
      );
    }

    return sendResponse(res, 201, "Forum created successfully", { newForum });
  } catch (error) {
    console.error("Error creating forum:", error);
    return sendResponse(res, 500, "Error creating forum", {
      error: error.message,
    });
  }
};

exports.deleteForum = async (req, res) => {
  const { forumId } = req.params;
  const ownerId = req.user?.id;
  console.log("forumId", forumId);

  try {
    if (!forumId || !ownerId) {
      return res.status(400).json({ message: "Invalid request" });
    }

    // Find the forum by its ID
    const forum = await ForumModel.findById(forumId);
    if (!forum) {
      return res.status(404).json({ message: "Forum not found" });
    }

    // Check if the user is authorized to delete the forum
    if (forum.ownerId.toString() !== ownerId.toString()) {
      return res
        .status(403)
        .json({ message: "User is not authorized to delete this forum" });
    }

    // Delete the forum
    await ForumModel.findByIdAndDelete(forumId);
    res.status(200).json({ message: "Forum deleted successfully" });
  } catch (error) {
    console.error("Error deleting forum:", error);
    res
      .status(500)
      .json({ message: "Error deleting forum", error: error.message });
  }
};

/**
 * Toggle active/inactive status for a forum
 * @route PATCH /company/forum/:id/toggle-active
 * @access Private
 */
exports.toggleForumActiveStatus = async (req, res) => {
  const { id } = req.params;

  try {
    // Find the forum by ID
    const forum = await ForumModel.findById(id);

    if (!forum) {
      return sendResponse(res, 404, false, "Forum not found");
    }
    forum.isActive = !forum.isActive;
    await forum.save();

    return sendResponse(res, 200, true, "Forum status updated successfully", {
      forumId: forum._id,
      isActive: forum.isActive,
    });
  } catch (error) {
    console.error("Error toggling forum status:", error);
    return sendResponse(
      res,
      500,
      false,
      "An error occurred while toggling forum status"
    );
  }
};

exports.getOwnForums = async (req, res) => {
  try {
    const ownerId = req.user?.id; // Assuming req.user contains the authenticated user's details
    const { search = "", page = 1, limit = 10 } = req.query;

    // Pagination options
    const currentPage = parseInt(page, 10) || 1;
    const perPage = parseInt(limit, 10) || 10;
    const skip = (currentPage - 1) * perPage;

    // Build the search query
    const searchQuery = search
      ? {
          forumName: { $regex: search, $options: "i" },
        }
      : {};

    // Fetch forums with search, pagination, and populate
    const ownForums = await ForumModel.find({
      ownerId,
      ...searchQuery,
    })
      .skip(skip)
      .limit(perPage)
      .populate({
        path: "ownerId",
        select: "companyDetails name",
      });

    // Get total count for pagination metadata
    const totalForums = await ForumModel.countDocuments({
      ownerId,
      ...searchQuery,
    });

    // Response with forums and pagination metadata
    res.status(200).json({
      forums: ownForums,
      total: totalForums,
      page: currentPage,
      totalPages: Math.ceil(totalForums / perPage),
    });
  } catch (error) {
    console.error("Error fetching own forums:", error);
    res
      .status(500)
      .json({ message: "Error fetching own forums", error: error.message });
  }
};

exports.getAllForums = async (req, res) => {
  try {
    const requestingUserId = req.user.id;
    const { page = 1, limit = 10, search = "" } = req.query;

    // Ensure page and limit are integers
    const currentPage = parseInt(page, 10) || 1;
    const pageSize = parseInt(limit, 10) || 10;

    // Search filter
    const searchFilter = search
      ? {
          $or: [
            { forumName: { $regex: search, $options: "i" } },
            { forumDescription: { $regex: search, $options: "i" } },
            {
              "ownerId.companyDetails.companyInfo.companyName": {
                $regex: search,
                $options: "i",
              },
            },
          ],
        }
      : {};
    // Query to fetch forums excluding user's own
    const query = {
      isActive: true,
      isBlocked: false,
      ownerId: { $ne: requestingUserId },
      ...searchFilter,
    };

    // Count total matching documents
    const totalCount = await ForumModel.countDocuments(query);

    // Fetch paginated forums
    const forums = await ForumModel.find(query)
      .populate({
        path: "ownerId",
        select: "profile companyDetails",
      })
      .skip((currentPage - 1) * pageSize)
      .limit(pageSize)
      .lean()
      .exec();

    // Add request status and member count for each forum
    const forumsWithDetails = forums.map((forum) => ({
      ...forum,
      membersCount: forum.members?.length || 0,
      requestStatus: forum.pendingRequests?.some(
        (id) => id.toString() === requestingUserId
      )
        ? "pending"
        : "none",
      isMember:
        forum.members?.some((id) => id.toString() === requestingUserId) ||
        false,
    }));

    // Response with pagination details
    sendResponse(res, 200, "Forums retrieved successfully", {
      forums: forumsWithDetails,
      totalCount,
      page: currentPage,
      limit: pageSize,
    });
  } catch (error) {
    console.error("Error fetching forums:", error);
    sendResponse(res, 500, "Error fetching forums", { error: error.message });
  }
};

exports.getUserForums = async (req, res) => {
  try {
    const ownerId = req.user?.id;
    console.log("Decoded user from token:", ownerId);

    // Validate if the user ID is present
    if (!ownerId) {
      return sendResponse(res, 400, "Invalid token: User ID not found");
    }

    console.log("Fetching forums for user ID:", ownerId);

    // Fetch forums where the user is a creator or a member
    const forums = await ForumModel.find({
      $or: [{ ownerId: ownerId }, { members: ownerId }],
      isActive: true,
    });

    console.log("Forums retrieved successfully:", forums);

    // Send the forums data
    sendResponse(res, 200, "Forums retrieved successfully", forums);
  } catch (error) {
    console.error("Error retrieving forums:", error);
    sendResponse(res, 500, "Error retrieving forums", {
      error: error.message,
    });
  }
};

exports.getForumById = async (req, res) => {
  try {
    const { forumId } = req.params;

    // Validate if the forum ID is provided
    if (!forumId) {
      return sendResponse(res, 400, "Forum ID is required");
    }

    console.log("Fetching forum with ID:", forumId);

    // Fetch the forum by its ID and populate members
    const forum = await ForumModel.findById(forumId).populate({
      path: "members",
      select: "name",
    });

    // Check if the forum exists
    if (!forum) {
      return sendResponse(res, 404, "Forum not found");
    }

    // Respond with the forum details
    sendResponse(res, 200, "Forum retrieved successfully", { forum });
  } catch (error) {
    console.error("Error retrieving forum:", error);
    sendResponse(res, 500, "Error retrieving forum", { error: error.message });
  }
};

/**
 * Sends a join request to a forum.
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 */

exports.sendJoinRequest = async (req, res) => {
  const { forumId } = req.params;
  const userId = req.user.id;

  try {
    // Find the forum by ID
    const forum = await ForumModel.findById(forumId);

    if (!forum) {
      return res.status(404).json({ message: "Forum not found." });
    }

    if (!forum.isActive) {
      return res.status(400).json({ message: "This forum is not active." });
    }

    // Check if the user is already a member
    if (forum.members.includes(userId)) {
      return res
        .status(400)
        .json({ message: "You are already a member of this forum." });
    }

    // Check if the user has already sent a join request
    if (forum.pendingRequests.includes(userId)) {
      return res.status(400).json({
        message: "You have already sent a join request to this forum.",
      });
    }

    // Check if the user has been invited
    if (forum.invitedUsers.includes(userId)) {
      return res
        .status(400)
        .json({ message: "You have already been invited to this forum." });
    }

    // Add the user to the pending requests
    forum.pendingRequests.push(userId);

    // Save the forum document
    await forum.save();

    const updatedForum = await ForumModel.findById(forumId).lean();

    // Get the user's company name or use the user's name
    const sender = await CustomerModel.findById(userId).populate(
      "companyDetails"
    );
    const companyName =
      sender?.companyDetails?.companyInfo?.companyName ||
      sender.name ||
      "Individual";

    // Notify the forum admin or relevant members about the join request
    const adminNotificationData = {
      userId: forum.ownerId, // Assuming forum.userId is the admin or owner
      message: `${companyName} has sent a request to join your forum ${forum.forumName}`,
      type: "join-request",
    };
    await NotificationService.createNotification(adminNotificationData, req.io);

    // Returning the updated forum data including the request status
    return res.status(200).json({
      message: "Join request sent successfully.",
      updatedForum: {
        ...updatedForum,
        requestStatus: "pending",
      },
    });
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ message: "An error occurred. Please try again later." });
  }
};

/**
 * Accepts a join request and adds the user to the forum members list.
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 */

exports.acceptJoinRequest = async (req, res) => {
  const { forumId, userId } = req.params;
  const ownerId = req.user.id;

  try {
    // Find the forum by ID
    const forum = await ForumModel.findById(forumId);

    if (!forum) {
      return res.status(404).json({ message: "Forum not found." });
    }

    // Check if the logged-in user is the owner of the forum
    if (forum.ownerId.toString() !== ownerId) {
      return res
        .status(403)
        .json({ message: "You are not authorized to perform this action." });
    }

    // Check if the user is in the pending requests
    if (!forum.pendingRequests.includes(userId)) {
      return res
        .status(400)
        .json({ message: "The user has not requested to join this forum." });
    }

    // Add the user to the members list
    forum.members.push(userId);

    // Remove the user from the pending requests
    forum.pendingRequests = forum.pendingRequests.filter(
      (id) => id.toString() !== userId
    );

    // Save the forum document
    await forum.save();

    // Get the user's company name or use the user's name
    const sender = await CustomerModel.findById(userId).populate(
      "companyDetails"
    );
    const companyName =
      sender?.companyDetails?.companyInfo?.companyName ||
      sender.name ||
      "Individual";

    // Notify the user that their join request has been accepted
    const userNotificationData = {
      userId: userId,
      message: `Your request to join ${forum.forumName} has been accepted by ${companyName}.`,
      type: "join-request-accepted",
    };
    await NotificationService.createNotification(userNotificationData, req.io);

    return res
      .status(200)
      .json({ message: "User has been added to the forum successfully." });
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ message: "An error occurred. Please try again later." });
  }
};

exports.rejectJoinRequest = async (req, res) => {
  const { forumId, userId } = req.params;
  const ownerId = req.user.id;
  try {
    const forum = await ForumModel.findById(forumId);

    if (!forum) {
      return res.status(404).json({ message: "Forum not found." });
    }

    // Check if the logged-in user is the owner of the forum
    if (forum.ownerId.toString() !== ownerId) {
      return res
        .status(403)
        .json({ message: "You are not authorized to perform this action." });
    }

    // Check if the user is in the pending requests
    if (!forum.pendingRequests.includes(userId)) {
      return res
        .status(400)
        .json({ message: "The user has not requested to join this forum." });
    }

    // Remove the user from the pending requests
    forum.pendingRequests = forum.pendingRequests.filter(
      (id) => id.toString() !== userId
    );

    await forum.save();

    // Get the forum owner's company name
    const owner = await CustomerModel.findById(ownerId).populate(
      "companyDetails"
    );
    const companyName =
      owner?.companyDetails?.companyInfo?.companyName || "Individual";

    // Send notification to the user whose request was declined
    const notificationData = {
      userId: userId,
      message: `Your request to join ${forum.forumName} has been declined by ${companyName}.`,
      type: "join-request-declined",
    };
    await NotificationService.createNotification(notificationData, req.io);

    return res.status(200).json({
      message: "The user's request to join the forum has been rejected.",
    });
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ message: "An error occurred. Please try again later." });
  }
};

/**
 * Get forums created by the user or where the user is a member.
 */
exports.getForums = async (req, res) => {
  try {
    const ownerId = req.user?.id;
    console.log("Decoded user from token:", ownerId);

    // Validate if the user ID is present
    if (!ownerId) {
      return sendResponse(res, 400, "Invalid token: User ID not found");
    }

    console.log("Fetching forums for user ID:", ownerId);

    // Fetch forums where the user is a creator or a member
    const forums = await ForumModel.find({
      $or: [{ ownerId: ownerId }, { members: ownerId }],
      isActive: true,
      isBlocked: false,
    });

    console.log("Forums retrieved successfully:", forums);

    // Send the forums data
    sendResponse(res, 200, "Forums retrieved successfully", forums);
  } catch (error) {
    console.error("Error retrieving forums:", error);
    sendResponse(res, 500, "Error retrieving forums", {
      error: error.message,
    });
  }
};

exports.getReceivedRequestsForOwner = async (req, res) => {
  try {
    const ownerId = req.user.id;

    // Find forums owned by the user
    const ownedForums = await ForumModel.find({ ownerId })
      .populate([
        {
          path: "pendingRequests",
          select: "_id name email companyDetails",
        },
      ])
      .select(
        "forumName forumDescription forumImage objective pendingRequests"
      );

    // Check if the owner has any forums
    if (!ownedForums.length) {
      return res.status(404).json({
        message: "No forums found for this owner",
      });
    }

    // Format the response with forums and their pending requests
    const formattedRequests = ownedForums.map((forum) => ({
      forumId: forum._id,
      forumName: forum.forumName,
      forumDescription: forum.forumDescription,
      forumImage: forum.forumImage,
      objective: forum.objective,
      pendingRequests: forum.pendingRequests,
    }));

    res.status(200).json({
      message: "Received requests for owned forums fetched successfully",
      forums: formattedRequests,
    });
  } catch (error) {
    console.error("Error fetching received requests for owner:", error);
    res.status(500).json({
      message: "Failed to fetch received requests",
      error: error.message,
    });
  }
};

// Check if the logged-in user is the owner of the forum
exports.checkForumOwnership = async (req, res) => {
  const { forumId } = req.params;
  const ownerId = req.user?.id;

  try {
    // Find the forum by its ID
    const forum = await ForumModel.findById(forumId);

    // Check if the forum exists
    if (!forum) {
      return res.status(404).json({ message: "Forum not found" });
    }

    // Check ownership
    const isOwner = forum.ownerId.toString() === ownerId.toString();

    // Respond with ownership status
    res.status(200).json({ isOwner });
  } catch (error) {
    console.error("Error checking forum ownership:", error);
    res.status(500).json({
      message: "Error checking forum ownership",
      error: error.message,
    });
  }
};

exports.shareProducts = async (req, res) => {
  const { forumId, products } = req.body;
  const ownerId = req.user?.id;
  if (
    !forumId ||
    !products ||
    !Array.isArray(products) ||
    products.length === 0
  ) {
    return res.status(400).json({
      success: false,
      message: "Forum ID and a non-empty products array are required.",
    });
  }

  try {
    // Loop through the products and create messages for each valid product
    const messages = await Promise.all(
      products.map(async (product) => {
        if (
          !product.name ||
          !product.productImage ||
          !product.shareableLink ||
          !product._id
        ) {
          console.warn(`Skipping invalid product: ${JSON.stringify(product)}`);
          return null;
        }

        const newMessage = new Message({
          forumId,
          ownerId,
          text: `Check out this product: ${product.name}\n${product.shareableLink}`,
          attachment: product.productImage || image,
          productId: product._id,
        });

        const savedMessage = await newMessage.save();

        // Log the saved message
        console.log("Saved Message:", savedMessage);

        return {
          productId: product._id,
          message: savedMessage,
        };
      })
    );

    const validMessages = messages.filter((msg) => msg !== null);
    if (validMessages.length === 0) {
      return sendResponse(res, 400, false, "No valid products");
    }
    return sendResponse(
      res,
      201,
      true,
      "Products shared successfully!",
      validMessages
    );
  } catch (error) {
    // Log the error details
    console.error("Error sharing products:", error);
    return sendResponse(res, 500, false, "Error sharing products.", {
      error: error.message,
    });
  }
};

exports.getAllCustomers = async (req, res) => {
  try {
    const { search = "", page = 1, limit = 10 } = req.query;
    const pageNumber = parseInt(page, 10);
    const limitNumber = parseInt(limit, 10);

    // Create a dynamic search filter
    const searchFilter = search
      ? {
          $or: [
            { email: { $regex: search, $options: "i" } },
            { name: { $regex: search, $options: "i" } },
            {
              "companyDetails.companyInfo.companyName": {
                $regex: search,
                $options: "i",
              },
            }, // Search in company name
            {
              "companyDetails.companyInfo.ownerName": {
                $regex: search,
                $options: "i",
              },
            }, // Search in owner name
          ],
        }
      : {};
    // Exclude the authenticated user
    if (req.user && req.user?.id) {
      searchFilter._id = { $ne: req.user?.id };
    }
    // Calculate the number of documents to skip
    const skip = (pageNumber - 1) * limitNumber;

    // Fetch customers with pagination and search
    const customers = await CustomerModel.find(searchFilter)
      .skip(skip)
      .limit(limitNumber)
      .sort({ createdAt: -1 }); // Sort by creation date

    // Get the total count for the given search filter
    const totalCustomers = await CustomerModel.countDocuments(searchFilter);

    return sendResponse(res, 200, true, "Customers fetched successfully", {
      customers,
      pagination: {
        totalCustomers,
        currentPage: pageNumber,
        totalPages: Math.ceil(totalCustomers / limitNumber),
        pageSize: customers.length,
      },
    });
  } catch (error) {
    console.error("Error fetching customers:", error);
    return sendResponse(res, 500, false, "Failed to fetch customers", {
      error: error.message,
    });
  }
};

/**
 * Function to validate and fetch the forum using the forumId param.
 * @param {string} forumId - The ID of the forum.
 * @returns {Promise<Forum|null>} - The forum document if found, or null if not.
 */

const getForumById = async (forumId) => {
  const forum = await ForumModel.findById(forumId);
  return forum;
};

/**
 * Function to send invitations to users.
 */

exports.sendInvitations = async (req, res) => {
  const { forumId } = req.params;
  const { inviteEmails } = req.body;
  const senderId = req.user?.id;

  console.log("forumID", "--------->", forumId);

  try {
    // Validate the input
    if (!forumId || !Array.isArray(inviteEmails) || inviteEmails.length === 0) {
      return sendResponse(res, 400, false, "Invalid request");
    }

    const forum = await ForumModel.findById(forumId);
    if (!forum) {
      return sendResponse(res, 404, false, "Forum not found");
    }

    const invitedUsers = await CustomerModel.find({
      email: { $in: inviteEmails },
    });

    const invitedUserIds = invitedUsers.map((owner) => owner._id);
    forum.invitedUsers.push(...invitedUserIds);
    await forum.save();

    // Get the company name of the user sending the invitation
    const sender = await CustomerModel.findById(senderId).populate(
      "companyDetails"
    ); // Assuming companyDetails is populated
    const companyName =
      sender?.companyDetails?.companyInfo?.companyName || "Individual"; // Use "Individual" if company name is not available

    // Send notifications to invited users
    const notificationsData = invitedUsers.map((user) => {
      return {
        userId: user._id,
        message: `You have been invited by ${companyName} to join the forum ${forum.forumName}.`,
        type: "forum-invitation",
      };
    });

    // Create notifications in batch
    await NotificationService.createBatchNotifications(
      notificationsData,
      req.io
    );

    return sendResponse(
      res,
      200,
      true,
      "Invitations sent successfully",
      invitedUsers
    );
  } catch (error) {
    console.error("Error sending invitations:", error);
    return sendResponse(res, 500, false, "Error sending invitations", {
      error: error.message,
    });
  }
};
/**
 * Controller function to check the invited users for a specific forum.
 *
 * @param {Object} req -request data.
 * @param {Object} res -The response object used to send the response.
 *
 * - Fetches all users in the database and compares them to the invitedUsers of the forum.
 */
exports.checkInvitedUsers = async (req, res) => {
  const { forumId } = req.params;
  try {
    const forum = await ForumModel.findById(forumId).populate("invitedUsers");
    if (!forum) {
      return sendResponse(res, 404, false, "Forum not found");
    }
    const allUsers = await CustomerModel.find({});

    // Map each user to an object containing their email and their invitation status
    const invitedUsersWithStatus = allUsers.map((user) => ({
      email: user.email,
      invited: forum.invitedUsers.some((invitedUser) =>
        invitedUser._id.equals(user._id)
      ),
    }));

    return sendResponse(
      res,
      200,
      true,
      "Invited users retrieved successfully",
      invitedUsersWithStatus
    );
  } catch (error) {
    console.error("Error checking invited users:", error);
    return sendResponse(res, 500, false, "Error checking invited users", {
      error: error.message,
    });
  }
};

exports.leaveForum = async (req, res) => {
  const { forumId } = req.params;
  const ownerId = req.user?.id;

  try {
    if (!forumId || !ownerId) {
      return sendResponse(res, 400, false, "Invalid request");
    }

    const forum = await ForumModel.findById(forumId);
    if (!forum) {
      return sendResponse(res, 404, false, "Forum not found");
    }

    if (!forum.members.includes(ownerId)) {
      return sendResponse(res, 400, false, "User is not a member of the forum");
    }

    // Remove the user from the forum's members array
    forum.members = forum.members.filter(
      (memberId) => memberId.toString() !== ownerId.toString()
    );
    await forum.save();

    return sendResponse(res, 200, true, "Successfully left the forum", {
      forum,
    });
  } catch (error) {
    console.error("Error leaving forum:", error);
    return sendResponse(res, 500, false, "Error leaving forum", {
      error: error.message,
    });
  }
};

exports.getOwnerForumInvites = async (req, res) => {
  try {
    const userId = req.user?.id; // Assuming you have auth middleware setting req.user

    // Find all forums owned by the user
    const forums = await ForumModel.find({
      ownerId: userId,
    }).populate({
      path: "invitedUsers",
      select:
        "name email status profile companyDetails.companyInfo.companyName",
      model: "Customer",
    });

    // Transform the data to match UI requirements
    const formattedForumInvites = forums.map((forum) => ({
      forumId: forum._id,
      forumName: forum.forumName,
      forumDescription: forum.forumDescription,
      forumImage: forum.forumImage,
      totalInvites: forum.invitedUsers.length,
      invitedUsers: forum.invitedUsers.map((user) => ({
        id: user._id,
        name: user.name,
        email: user.email,
        status: user.status,
        profileImage: user.profile?.url || null,
        companyDetails: {
          companyInfo: {
            companyName: user.companyDetails?.companyInfo?.companyName || null,
          },
        },
      })),
    }));

    // Segregate forums based on invite status
    const segregatedForumInvites = {
      activeForums: formattedForumInvites.filter(
        (forum) => forum.totalInvites > 0
      ),
      emptyForums: formattedForumInvites.filter(
        (forum) => forum.totalInvites === 0
      ),
    };

    return res.status(200).json({
      success: true,
      data: {
        totalOwnedForums: forums.length,
        ...segregatedForumInvites,
      },
    });
  } catch (error) {
    console.error("Error in getOwnerForumInvites:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Owner Cancels the Request
exports.cancelForumInvite = async (req, res) => {
  try {
    const { forumId, userId } = req.body;
    const ownerId = req.user.id; // From authentication middleware

    // Find the forum and verify the owner
    const forum = await ForumModel.findOne({
      _id: forumId,
      ownerId: ownerId,
    });

    if (!forum) {
      return res.status(404).json({
        success: false,
        message: "Forum not found or you are not the owner",
      });
    }

    // Remove the user from invitedUsers array
    await ForumModel.findByIdAndUpdate(forumId, {
      $pull: { invitedUsers: userId },
    });

    // Create a notification for the user whose invite was canceled
    const invitedUser = await CustomerModel.findById(userId); // Fetch the user details
    const companyName = forum.ownerId
      ? (await CustomerModel.findById(forum.ownerId))?.companyDetails
          ?.companyInfo?.companyName
      : "Individual";

    // Send the notification
    const notificationData = {
      userId: userId,
      message: `${companyName} has canceled your invitation to join the forum ${forum.forumName}.`,
      type: "forum-invite-cancel",
    };
    await NotificationService.createNotification(notificationData, req.io);

    return res.status(200).json({
      success: true,
      message: "Forum invitation cancelled successfully",
    });
  } catch (error) {
    console.error("Error cancelling forum invite:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

exports.getUserSentRequests = async (req, res) => {
  try {
    const userId = req.user.id;

    // Get all forums
    const allForums = await ForumModel.find({
      ownerId: { $ne: userId }, // Exclude user's owned forums
    })
      .populate("ownerId", "name email companyDetails")
      .select(
        "forumName forumDescription objective forumImage isActive createdAt pendingRequests"
      );

    // Filter forums where user has pending request
    const forumsWithPendingRequests = allForums.filter((forum) => {
      return forum.pendingRequests.some(
        (requestId) => requestId.toString() === userId.toString()
      );
    });

    res.status(200).json({
      success: true,
      count: forumsWithPendingRequests.length,
      data: forumsWithPendingRequests,
    });
  } catch (error) {
    console.error("Error fetching user sent requests:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

exports.cancelUserRequest = async (req, res) => {
  try {
    const forumId = req.params.forumId;
    const userId = req.user.id;

    console.log("Attempting to cancel request for:", {
      forumId,
      userId,
    });

    // Find the forum
    const forum = await ForumModel.findById(forumId);
    console.log("Forum search result:", forum ? "Found" : "Not Found");

    if (!forum) {
      console.log("Forum not found for ID:", forumId);
      return res.status(404).json({
        success: false,
        message: "Forum not found",
      });
    }

    // Check if user actually has a pending request
    const hasPendingRequest = forum.pendingRequests.includes(userId);
    console.log("Pending requests status:", {
      hasPendingRequest,
      currentPendingRequests: forum.pendingRequests,
      searchingForUserId: userId,
    });

    if (!hasPendingRequest) {
      console.log("No pending request found for user:", userId);
      return res.status(400).json({
        success: false,
        message: "No pending request found for this forum",
      });
    }

    // Remove user from pendingRequests array
    const originalLength = forum.pendingRequests.length;
    forum.pendingRequests = forum.pendingRequests.filter(
      (requestId) => requestId.toString() !== userId.toString()
    );
    console.log("Pending requests update:", {
      beforeLength: originalLength,
      afterLength: forum.pendingRequests.length,
      removed: originalLength - forum.pendingRequests.length,
    });

    await forum.save();
    console.log("Forum updated successfully");

    res.status(200).json({
      success: true,
      message: "Forum join request cancelled successfully",
    });
  } catch (error) {
    console.error("Error cancelling forum request:", {
      error: error.message,
      stack: error.stack,
      forumId: req.params.forumId,
      userId: req.user?.id,
    });
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

exports.getUserReceivedRequests = async (req, res) => {
  try {
    const userId = req.user.id;

    // Get all forums where the user is in the invitedUsers array
    const forumsWithReceivedRequests = await ForumModel.find({
      invitedUsers: userId,
      ownerId: { $ne: userId }, // Exclude user's owned forums
    })
      .populate("ownerId", "name email companyDetails")
      .select(
        "forumName forumDescription objective forumImage isActive createdAt invitedUsers"
      );

    res.status(200).json({
      success: true,
      count: forumsWithReceivedRequests.length,
      data: forumsWithReceivedRequests,
    });
  } catch (error) {
    console.error("Error fetching user received requests:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

exports.getReceivedRequestsForOwner = async (req, res) => {
  try {
    const ownerId = req.user.id; // Authenticated owner's ID

    // Find forums owned by the user
    const ownedForums = await ForumModel.find({ ownerId })
      .populate([
        {
          path: "pendingRequests",
          select: "_id name email companyDetails",
        },
      ])
      .select(
        "forumName forumDescription forumImage objective pendingRequests"
      );

    // Check if the owner has any forums
    if (!ownedForums.length) {
      return res.status(404).json({
        message: "No forums found for this owner",
      });
    }

    // Format the response with forums and their pending requests
    const formattedRequests = ownedForums.map((forum) => ({
      forumId: forum._id,
      forumName: forum.forumName,
      forumDescription: forum.forumDescription,
      forumImage: forum.forumImage,
      objective: forum.objective,
      pendingRequests: forum.pendingRequests,
    }));

    res.status(200).json({
      message: "Received requests for owned forums fetched successfully",
      forums: formattedRequests,
    });
  } catch (error) {
    console.error("Error fetching received requests for owner:", error);
    res.status(500).json({
      message: "Failed to fetch received requests",
      error: error.message,
    });
  }
};

exports.acceptForumInvitation = async (req, res) => {
  try {
    const userId = req.user.id;
    const { forumId } = req.params;

    // Validate forumId
    if (!mongoose.Types.ObjectId.isValid(forumId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid forum ID format",
      });
    }

    // Find and update the forum
    const forum = await ForumModel.findOneAndUpdate(
      {
        _id: forumId,
        invitedUsers: userId, // Check if user is actually invited
        members: { $ne: userId }, // Make sure user isn't already a member
      },
      {
        $pull: { invitedUsers: userId }, // Remove from invitedUsers
        $addToSet: { members: userId }, // Add to members
      },
      { new: true }
    ).populate("ownerId", "name email companyDetails");

    // If forum not found or user wasn't invited
    if (!forum) {
      return res.status(404).json({
        success: false,
        message: "Forum not found or no invitation exists",
      });
    }
    const forumOwnerId = forum.ownerId?._id.toString();
    const userName = req.user?.name; // Assuming `name` field is available in req.user
    const userCompany = req.user.companyDetails?.companyInfo?.companyName; // Assuming company details are part of req.user

    // Build notification message
    const message = userCompany
      ? `${userName} from ${userCompany} has accepted the invitation to join the forum '${forum.forumName}'.`
      : `${userName} (Individual) has accepted the invitation to join the forum '${forum.forumName}'.`;

    await NotificationService.createNotification({
      userId: forumOwnerId,
      message,
      type: "Forum Invitation",
      io: req.app.get("io"), // Passing Socket.io instance
    });

    res.status(200).json({
      success: true,
      message: "Forum invitation accepted successfully",
      data: forum,
    });
  } catch (error) {
    console.error("Error accepting forum invitation:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

exports.rejectForumInvitation = async (req, res) => {
  try {
    const userId = req.user.id;
    const { forumId } = req.params;
    const { rejectionReason } = req.body; // Optional rejection reason

    // Validate forumId
    if (!mongoose.Types.ObjectId.isValid(forumId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid forum ID format",
      });
    }

    // Find and update the forum
    const forum = await ForumModel.findOneAndUpdate(
      {
        _id: forumId,
        invitedUsers: userId, // Check if user is actually invited
      },
      {
        $pull: { invitedUsers: userId }, // Remove from invitedUsers
        $push: {
          rejectionReasons: {
            userId,
            reason: rejectionReason || "No reason provided",
            createdAt: new Date(),
          },
        },
      },
      { new: true }
    ).populate("ownerId", "name email companyDetails");

    // If forum not found or user wasn't invited
    if (!forum) {
      return res.status(404).json({
        success: false,
        message: "Forum not found or no invitation exists",
      });
    }

    res.status(200).json({
      success: true,
      message: "Forum invitation rejected successfully",
      data: forum,
    });
  } catch (error) {
    console.error("Error rejecting forum invitation:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

exports.getProductsByForumId = async (req, res) => {
  const { forumId } = req.params;
  const { page = 1, limit = 10, search = "" } = req.query;

  try {
    // Fetching messages related to the given forum ID
    const messages = await Message.find({ forumId });

    // Extracting product IDs from messages
    const productIds = messages
      .map((message) => message.productId)
      .filter(Boolean);

    // Constructing the query to find products
    let query = { _id: { $in: productIds } };
    if (search) {
      query.$or = [
        {
          "basicDetails.name": { $regex: search, $options: "i" },
        },
        { "ownerId.companyName": { $regex: search, $options: "i" } },
      ];
    }

    // Pagination setup
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Fetching products from the ProductModel
    const products = await ProductModel.find(query)
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    const totalCount = await ProductModel.countDocuments(query);

    // Initialize an array to store transformed data
    const transformedData = [];
    for (const product of products) {
      const basicDetails = product.basicDetails || {};
      const productImages = product.images || [];

      // Fetch company details using ownerId from the CustomerModel
      const customer = await CustomerModel.findOne(
        { _id: product.ownerId },
        "companyDetails.companyInfo.companyName"
      );

      const companyName =
        customer?.companyDetails?.companyInfo?.companyName || "Unknown Company";

      // Push the transformed product data to the array
      transformedData.push({
        id: product._id,
        ownerId: product.ownerId || null,
        productName: basicDetails.name || "Unknown Product",
        slug: product.basicDetails.slug,
        brandName: basicDetails.brandName || "Unknown Brand",
        price: basicDetails.price || "Price not available",
        description: basicDetails.description || "Description not available",
        productImage: productImages[0]?.url || "No Image Available",
        secondaryProductImage: productImages[1]?.url || "No Secondary Image",
        brandName: companyName || "Unknown Company",
      });
    }

    // Sending the response
    res.status(200).json({
      products: transformedData,
      currentPage: parseInt(page),
      totalPages: Math.ceil(totalCount / parseInt(limit)),
      totalCount,
    });
  } catch (error) {
    console.error("Error fetching product details:", error.message);
    if (error instanceof mongoose.Error) {
      return res
        .status(400)
        .json({ error: "Database Error", details: error.message });
    }
    res
      .status(500)
      .json({ error: "Internal Server Error", details: error.message });
  }
};

exports.getParticipantsDetails = async (req, res) => {
  try {
    const { forumId } = req.params;
    const { page = 1, limit = 10, search = "" } = req.query;

    const parsedLimit = parseInt(limit, 10);
    const parsedPage = parseInt(page, 10);
    const skip = (parsedPage - 1) * parsedLimit;

    // Retrieve the forum and its members with companyDetails
    const forum = await ForumModel.findById(forumId).populate({
      path: "members",
      model: "Customer",
      populate: {
        path: "companyDetails",
        select: "companyName companyLogo contactInfo companyInfo",
      },
    });

    if (!forum) {
      return sendResponse(res, 404, false, null, "Forum not found");
    }

    // Retrieve shared messages with product details
    const sharedMessages = await Message.find({
      forumId,
      productId: { $exists: true },
    }).populate({
      path: "productId",
      select: "basicDetails images",
    });

    // Transform members data with search and pagination
    const filteredParticipants = forum.members
      .filter((member) => {
        const { companyDetails } = member;
        const companyName = companyDetails?.companyInfo?.companyName || "";
        const ownerName = companyDetails?.companyInfo?.ownerName || member.name;
        const email = companyDetails?.contactInfo?.email || "";

        // Check search term in companyName, ownerName, or email
        return (
          companyName.toLowerCase().includes(search.toLowerCase()) ||
          ownerName.toLowerCase().includes(search.toLowerCase()) ||
          email.toLowerCase().includes(search.toLowerCase())
        );
      })
      .map((member) => {
        const { _id, name, companyDetails } = member;

        const uniqueProductIds = new Set(); // Track unique product IDs

        const sharedProducts = sharedMessages
          .filter((msg) => msg.ownerId.toString() === _id.toString())
          .reduce((acc, msg) => {
            const productId = msg.productId?._id?.toString();
            if (!productId || uniqueProductIds.has(productId)) return acc;
            uniqueProductIds.add(productId); // Mark as seen
            acc.push({
              productId,
              productName: msg.productId?.basicDetails?.name,
              productSlug: msg.productId?.basicDetails?.slug,
              productPrice: msg.productId?.basicDetails?.price,
              productDescription: msg.productId?.basicDetails?.description,
              productImages: msg.productId?.images?.map((img) => img.url) || [],
            });
            return acc;
          }, []);

        return {
          user: {
            userId: _id,
            companyDetails: {
              companyName:
                companyDetails?.companyInfo?.companyName || "Individual User",
              ownerName: companyDetails?.companyInfo?.ownerName || name,
              yearEstablished: companyDetails?.companyInfo?.yearEstablishment,
              businessType: companyDetails?.companyInfo?.businessType,
              totalEmployees: companyDetails?.companyInfo?.totalEmployees,
              contactInfo: {
                pincode: companyDetails?.contactInfo?.pincode,
                email: companyDetails?.contactInfo?.email,
                phone: companyDetails?.contactInfo?.phone,
              },
              companyLogo: companyDetails?.companyLogo?.url || null,
            },
            sharedProducts,
          },
        };
      });

    // Pagination
    const totalParticipants = filteredParticipants.length;
    const paginatedParticipants = filteredParticipants.slice(
      skip,
      skip + parsedLimit
    );

    // Response
    sendResponse(res, 200, true, {
      totalParticipants,
      participants: paginatedParticipants,
    });
  } catch (error) {
    console.error("Error in getParticipantsDetails:", error);
    sendResponse(res, 500, false, null, "Internal Server Error", error.message);
  }
};
