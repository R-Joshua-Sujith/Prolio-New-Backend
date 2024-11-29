const mongoose = require("mongoose");
const socketIo = require("socket.io");
const ForumModel = require("../../models/Forum");
const ProductModel = require("../../models/Product");
const { uploadToS3 } = require("../../utils/s3FileUploader");
const { sendResponse } = require("../../utils/responseHandler");
const Message = require("../../models/message");
const CustomerModel = require("../../models/Customer");
const Notification = require("../../models/Notification");

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

    // Remove the user from the pending requests
    forum.pendingRequests = forum.pendingRequests.filter(
      (id) => id.toString() !== userId
    );

    // Save the forum document
    await forum.save();

    // Optionally, notify the user that their request has been rejected
    // Example: sendNotification(userId, `Your request to join the forum '${forum.forumName}' has been rejected.`);

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

// exports.getReceivedRequestsForOwner = async (req, res) => {
//   try {
//     const ownerId = req.user.id; // Authenticated owner's ID

//     // Find forums owned by the user
//     const ownedForums = await ForumModel.find({ ownerId })
//       .populate([
//         {
//           path: "pendingRequests",
//           select: "_id name email companyDetails",
//         },
//       ])
//       .select(
//         "forumName forumDescription forumImage objective pendingRequests"
//       );

//     // Check if the owner has any forums
//     if (!ownedForums.length) {
//       return res.status(404).json({
//         message: "No forums found for this owner",
//       });
//     }

//     // Format the response with forums and their pending requests
//     const formattedRequests = ownedForums.map((forum) => ({
//       forumId: forum._id,
//       forumName: forum.forumName,
//       forumDescription: forum.forumDescription,
//       forumImage: forum.forumImage,
//       objective: forum.objective,
//       pendingRequests: forum.pendingRequests,
//     }));

//     res.status(200).json({
//       message: "Received requests for owned forums fetched successfully",
//       forums: formattedRequests,
//     });
//   } catch (error) {
//     console.error("Error fetching received requests for owner:", error);
//     res.status(500).json({
//       message: "Failed to fetch received requests",
//       error: error.message,
//     });
//   }
// };

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
        {
          path: "invitedUsers",
          select: "_id name email companyDetails",
        },
      ])
      .select(
        "forumName forumDescription forumImage objective pendingRequests invitedUsers"
      );

    // Check if the owner has any forums
    if (!ownedForums.length) {
      return res.status(404).json({
        message: "No forums found for this owner",
      });
    }

    // Format the response with forums, their pending requests, and invited users
    const formattedRequests = ownedForums.map((forum) => ({
      forumId: forum._id,
      forumName: forum.forumName,
      forumDescription: forum.forumDescription,
      forumImage: forum.forumImage,
      objective: forum.objective,
      pendingRequests: forum.pendingRequests,
      invitedUsers: forum.invitedUsers,
    }));

    res.status(200).json({
      message:
        "Received requests and invited users for owned forums fetched successfully",
      forums: formattedRequests,
    });
  } catch (error) {
    console.error("Error fetching received requests for owner:", error);
    res.status(500).json({
      message: "Failed to fetch received requests and invited users",
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
  console.log("forumID", "--------->", forumId);

  try {
    // Validate the input
    if (!forumId || !Array.isArray(inviteEmails) || inviteEmails.length === 0) {
      return sendResponse(res, 400, false, "Invalid request");
    }

    const forum = await getForumById(forumId);
    if (!forum) {
      return sendResponse(res, 404, false, "Forum not found");
    }

    const invitedUsers = await CustomerModel.find({
      email: { $in: inviteEmails },
    });
    const invitedUserIds = invitedUsers.map((owner) => owner._id);
    forum.invitedUsers.push(...invitedUserIds);
    await forum.save();

    // Send notifications to the invited users
    for (const invitee of invitedUsers) {
      const notification = new Notification({
        ownerId: invitee._id,
        message: `You have been invited to join the forum: ${forum.forumName}`,
        forumId: forum._id,
        type: "invite",
      });
      await notification.save();
      console.log(
        `Notification created for user ${invitee._id}:`,
        notification
      );

      // Emit notification to the user if they are online (via socket.io)
      if (req.io) {
        req.io.to(invitee._id.toString()).emit("notification", notification);
        console.log(`Notification sent to user ${invitee._id.toString()}`);
      } else {
        console.log(
          `Socket.io not available for user ${invitee._id.toString()}`
        );
      }
    }

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
