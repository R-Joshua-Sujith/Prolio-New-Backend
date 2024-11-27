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
    // Fetch all active forums and populate customer details for owner and members
    const forums = await ForumModel.find({ isActive: true })
      .populate({
        path: "ownerId", // Populate the ownerId field
        select: "companyDetails", // Assuming the Customer model has companyDetails
      })
      .populate({
        path: "members", // Populate the members field
        select: "name", // Select relevant fields for members
      })
      .lean()
      .exec();

    // Add members count to each forum
    const forumsWithDetails = forums.map((forum) => ({
      ...forum,
      membersCount: forum.members.length,
    }));

    // Send response with forums data
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
