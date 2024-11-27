const mongoose = require("mongoose");

const socketIo = require("socket.io");

const ForumModel = require("../../models/Forum");
const ProductModel = require("../../models/Product");

const { uploadToS3 } = require("../../utils/s3FileUploader");
const { sendResponse } = require("../../utils/responseHandler");

exports.createForum = async (req, res) => {
  const { forumName, forumDescription, objective } = req.body;

  try {
    const ownerId = req.user?.id;

    if (!ownerId || !mongoose.Types.ObjectId.isValid(ownerId)) {
      return sendResponse(res, 400, "Invalid customer ID");
    }

    const existingForum = await ForumModel.findOne({ forumName });
    if (existingForum) {
      return sendResponse(res, 409, "Forum already exists");
    }

    // Handle forum image upload with S3
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
      publicId: forumImageKey,
      ownerId,
      members: [ownerId],
    });

    await newForum.save();
    console.log("New forum created:", newForum);

    // Send a success response
    sendResponse(res, 201, "Forum created successfully", { newForum });
  } catch (error) {
    console.error("Error creating forum:", error);
    sendResponse(res, 500, "Error creating forum", { error: error.message });
  }
};

exports.sendInvitations = async (req, res) => {
  const { forumId } = req.params;
  const { inviteEmails } = req.body;

  try {
    // Validate the input
    if (!forumId || !Array.isArray(inviteEmails) || inviteEmails.length === 0) {
      return res.status(400).json({ message: "Invalid request" });
    }

    // Find the forum by ID
    const forum = await Forum.findById(forumId);
    if (!forum) {
      return res.status(404).json({ message: "Forum not found" });
    }

    // Fetch invited users
    const invitedUsers = await User.find({ email: { $in: inviteEmails } });
    const invitedUserIds = invitedUsers.map((user) => user._id);

    // Update the forum's invited users
    forum.invitedUsers.push(...invitedUserIds);
    await forum.save();

    // Send notifications to invited users
    for (const invitee of invitedUsers) {
      const notification = new Notification({
        userId: invitee._id,
        message: `You have been invited to join the forum: ${forum.forumName}`,
        forumId: forum._id,
        type: "invite",
      });
      await notification.save();

      // Emit notification to the user if they are online
      if (req.io) {
        req.io.to(invitee._id.toString()).emit("notification", notification);
      }
    }

    res.status(200).json({
      message: "Invitations sent successfully",
      invitedUsers: invitedUsers,
    });
  } catch (error) {
    console.error("Error sending invitations:", error);
    res
      .status(500)
      .json({ message: "Error sending invitations", error: error.message });
  }
};

exports.leaveForum = async (req, res) => {
  const { forumId } = req.params;
  const userId = req.user?.userId;

  try {
    if (!forumId || !userId) {
      return res.status(400).json({ message: "Invalid request" });
    }

    // Find the forum
    const forum = await Forum.findById(forumId);
    if (!forum) {
      return res.status(404).json({ message: "Forum not found" });
    }

    // Check if the user is a member of the forum
    if (!forum.members.includes(userId)) {
      return res
        .status(400)
        .json({ message: "User is not a member of the forum" });
    }

    // Remove the user from the forum's members array
    forum.members = forum.members.filter(
      (memberId) => memberId.toString() !== userId.toString()
    );

    await forum.save();

    res.status(200).json({
      message: "Successfully left the forum",
      forum: forum,
    });
  } catch (error) {
    console.error("Error leaving forum:", error);
    res
      .status(500)
      .json({ message: "Error leaving forum", error: error.message });
  }
};

exports.checkForumOwnership = async (req, res) => {
  const { forumId } = req.params;
  const userId = req.user?.userId; // Extract user ID from the middleware

  try {
    // Find the forum by its ID
    const forum = await Forum.findById(forumId);

    // Check if the forum exists
    if (!forum) {
      return res.status(404).json({ message: "Forum not found" });
    }

    // Check ownership
    const isOwner = forum.userId.toString() === userId.toString();

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

exports.deleteForum = async (req, res) => {
  const { forumId } = req.params;
  const userId = req.user?.userId;

  try {
    if (!forumId || !userId) {
      return res.status(400).json({ message: "Invalid request" });
    }

    // Find the forum by its ID
    const forum = await Forum.findById(forumId);
    if (!forum) {
      return res.status(404).json({ message: "Forum not found" });
    }

    // Check if the user is authorized to delete the forum
    if (forum.userId.toString() !== userId.toString()) {
      return res
        .status(403)
        .json({ message: "User is not authorized to delete this forum" });
    }

    // Delete the forum
    await Forum.findByIdAndDelete(forumId);
    res.status(200).json({ message: "Forum deleted successfully" });
  } catch (error) {
    console.error("Error deleting forum:", error);
    res
      .status(500)
      .json({ message: "Error deleting forum", error: error.message });
  }
};

exports.getOwnForums = async (req, res) => {
  try {
    const userId = req.user?.userId;

    // Fetch forums owned by the logged-in user
    const ownForums = await Forum.find({ userId });

    res.status(200).json(ownForums);
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

    // Fetch forums excluding user's own
    const forums = await ForumModel.find({
      isActive: true,
      ownerId: { $ne: requestingUserId },
    })
      .populate({
        path: "ownerId",
        select: "profile companyDetails",
      })
      .lean()
      .exec();

    // Add request status for each forum
    const forumsWithDetails = Array.isArray(forums)
      ? forums.map((forum) => ({
          ...forum,
          membersCount: forum.members?.length || 0,
          // Explicitly check pendingRequests to maintain status
          requestStatus: forum.pendingRequests?.some(
            (id) => id.toString() === requestingUserId
          )
            ? "pending"
            : "none",
          isMember:
            forum.members?.some((id) => id.toString() === requestingUserId) ||
            false,
        }))
      : [];

    sendResponse(res, 200, "Forums retrieved successfully", forumsWithDetails);
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
      select: "name", // Select only the necessary fields
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
  const userId = req.user.id; // Assuming the user is added to req.user via authentication middleware.

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

    // Notify the forum owner (optional placeholder for notification logic)
    // Example: sendNotification(forum.ownerId, `${req.user.name} wants to join your forum.`);

    // Return the updated forum information, including the request status
    const updatedForum = await ForumModel.findById(forumId).lean();

    // Returning the updated forum data including the request status
    return res.status(200).json({
      message: "Join request sent successfully.",
      updatedForum: {
        ...updatedForum,
        requestStatus: "pending", // Add request status explicitly
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
  const { forumId, userId } = req.params; // Extract forumId and userId from route parameters.
  const ownerId = req.user.id; // Assuming the authenticated owner is added to req.user.

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

    // Optionally, notify the user that their request has been approved
    // Example: sendNotification(userId, `Your request to join the forum '${forum.forumName}' has been approved.`);

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

exports.getReceivedRequestsForOwner = async (req, res) => {
  try {
    const ownerId = req.user.id; // Authenticated owner's ID

    // Find forums owned by the user
    const ownedForums = await ForumModel.find({ ownerId })
      .populate([
        {
          path: "pendingRequests",
          select: "_id firstName lastName email",
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
