const express = require("express");
const mongoose = require("mongoose");
const ForumModel = require("../../models/Forum");
const CustomerModel = require("../../models/Customer");
const {
  companyVerify,
  looseVerify,
} = require("../../controller/Company/Middleware/auth");
const router = express.Router();
const ProductModel = require("../../models/Product");
const socketIo = require("socket.io");
const { uploadToS3 } = require("../../utils/s3FileUploader");
const { sendResponse } = require("../../utils/responseHandler");
const app = express();
const multer = require("multer");
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});
// Create a forum

router.post(
  "/create-forum",
  upload.single("forumImage"),
  looseVerify,
  async (req, res) => {
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
  }
);

// router.post("/create-forum", upload.single("forumImage"), async (req, res) => {
//   const { forumName, forumDescription, objective, inviteEmails, customerId } =
//     req.body;

//   try {
//     // Validate `customerId`
//     if (!mongoose.Types.ObjectId.isValid(customerId)) {
//       return sendResponse(res, 400, "Invalid customer ID");
//     }

//     // Check if the forum name already exists
//     const existingForum = await Forum.findOne({ forumName });
//     if (existingForum) {
//       return sendResponse(res, 409, "Forum already exists");
//     }

//     // Handle forum image upload with S3
//     let forumImageUrl = null;
//     let forumImageKey = null;

//     if (req.file) {
//       const uploadResult = await uploadToS3(
//         req.file.buffer, // File buffer from multer
//         req.file.originalname, // Original file name
//         req.file.mimetype, // File mimetype
//         "forum-images" // Folder name in S3
//       );
//       forumImageUrl = uploadResult.url; // S3 public URL
//       forumImageKey = uploadResult.filename; // S3 key
//     }

//     // Create the new forum
//     const newForum = new Forum({
//       forumName,
//       forumDescription,
//       objective,
//       forumImage: forumImageUrl,
//       publicId: forumImageKey,
//       customerId,
//       members: [customerId], // Add creator as a member
//     });

//     await newForum.save();
//     console.log("New forum created:", newForum);

//     // Send notification to the forum creator
//     const creatorNotification = new Notification({
//       userId: customerId,
//       message: `You have successfully created the forum ${forumName}`,
//       forumId: newForum._id,
//       type: "creation",
//     });

//     await creatorNotification.save();
//     console.log("Notification created for forum creator:", creatorNotification);
//     if (req.io) {
//       req.io
//         .to(customerId.toString())
//         .emit("notification", creatorNotification);
//       console.log(`Notification sent to forum creator: ${customerId}`);
//     }

//     // Handle invited users and send notifications
//     if (inviteEmails && inviteEmails.length > 0) {
//       const invitedUsers = await User.find({ email: { $in: inviteEmails } });
//       newForum.invitedUsers = invitedUsers.map((user) => user._id);

//       await newForum.save();

//       for (const invitee of invitedUsers) {
//         const notification = new Notification({
//           userId: invitee._id,
//           message: `You have been invited to join the forum ${forumName}`,
//           forumId: newForum._id,
//           type: "invite",
//         });

//         await notification.save();
//         console.log(
//           `Notification created for user ${invitee._id}:`,
//           notification
//         );

//         // Emit notification to the user if online
//         if (req.io) {
//           req.io.to(invitee._id.toString()).emit("notification", notification);
//           console.log(`Notification sent to user ${invitee._id.toString()}`);
//         }
//       }
//     }

//     // Send a success response
//     sendResponse(res, 201, "Forum created successfully", { newForum });
//   } catch (error) {
//     console.error("Error creating forum:", error);
//     sendResponse(res, 500, "Error creating forum", { error: error.message });
//   }
// });

router.post("/send-invitations/:forumId", companyVerify, async (req, res) => {
  const { forumId } = req.params;
  const { inviteEmails } = req.body;
  console.log("forumID", "--------->", forumId);

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
      await notification.save(); // Save the notification to the database
      console.log(
        `Notification created for user ${invitee._id}:`,
        notification
      );

      // Emit notification to the user if they are online
      if (req.io) {
        req.io.to(invitee._id.toString()).emit("notification", notification);
        console.log(`Notification sent to user ${invitee._id.toString()}`);
      } else {
        console.log(
          `Socket.io not available for user ${invitee._id.toString()}`
        );
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
});

router.post("/leave-forum/:forumId", companyVerify, async (req, res) => {
  const { forumId } = req.params;
  const userId = req.user?.userId;
  try {
    if (!forumId || !userId) {
      return res.status(400).json({ message: "Invalid request" });
    }
    const forum = await Forum.findById(forumId);
    if (!forum) {
      return res.status(404).json({ message: "Forum not found" });
    }
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
});

// Route to check if the logged-in user is the owner of the forum
router.get("/check-forum-owner/:forumId", companyVerify, async (req, res) => {
  const { forumId } = req.params;
  const userId = req.user?.userId; // Extract the user ID from the token (set by companyVerify middleware)

  try {
    // Find the forum by its ID
    const forum = await Forum.findById(forumId);

    // Check if the forum exists
    if (!forum) {
      return res.status(404).json({ message: "Forum not found" });
    }

    // Check if the user making the request is the owner of the forum
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
});

router.delete("/delete/:forumId", companyVerify, async (req, res) => {
  const { forumId } = req.params;
  const userId = req.user?.userId;
  try {
    if (!forumId || !userId) {
      return res.status(400).json({ message: "Invalid request" });
    }
    const forum = await Forum.findById(forumId);
    if (!forum) {
      return res.status(404).json({ message: "Forum not found" });
    }
    if (forum.userId.toString() !== userId.toString()) {
      return res
        .status(403)
        .json({ message: "User is not authorized to delete this forum" });
    }
    await Forum.findByIdAndDelete(forumId);
    res.status(200).json({ message: "Forum deleted successfully" });
  } catch (error) {
    console.error("Error deleting forum:", error);
    res
      .status(500)
      .json({ message: "Error deleting forum", error: error.message });
  }
});

// Get own forums
router.get("/own-forums", companyVerify, async (req, res) => {
  try {
    const ownForums = await Forum.find({ userId: req.user?.userId });
    res.status(200).json(ownForums);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error fetching own forums", error: error.message });
  }
});

router.get("/all-forums", async (req, res) => {
  try {
    const forums = await ForumModel.find({ isActive: true })
      .populate({
        path: "customerId",
        select: "companyDetails",
      })
      .lean()
      .exec();

    const forumsWithDetails = forums.map((forum) => ({
      ...forum,
      membersCount: forum.members.length,
    }));

    // Send the response using sendResponse
    sendResponse(res, 200, "Forums retrieved successfully", forumsWithDetails);
  } catch (error) {
    console.error("Error fetching forums:", error);
    sendResponse(res, 500, "Error fetching forums", { error: error.message });
  }
});

// Get forums where the user is a member or creator
router.get("/get-forums", companyVerify, async (req, res) => {
  try {
    const ownerId = req.user?.id;
    console.log("Decoded user from token:", ownerId);

    if (!ownerId) {
      return sendResponse(res, 400, "Invalid token: User ID not found");
    }

    console.log("Fetching forums for user ID:", ownerId);

    const forums = await ForumModel.find({
      $or: [{ ownerId: ownerId }, { members: ownerId }],
      isActive: true,
    });

    console.log("Forums retrieved successfully:", forums);

    sendResponse(res, 200, "Forums retrieved successfully", forums);
  } catch (error) {
    console.error("Error retrieving forums:", error);
    sendResponse(res, 500, "Error retrieving forums", {
      error: error.message,
    });
  }
});

router.get("/get-forum/:forumId", async (req, res) => {
  try {
    const { forumId } = req.params;
    if (!forumId) {
      return res.status(400).json({ message: "Forum ID is required" });
    }
    console.log("Fetching forum with ID:", forumId);
    const forum = await ForumModel.findById(forumId).populate({
      path: "members",
      select: "name",
    });
    if (!forum) {
      return res.status(404).json({ message: "Forum not found" });
    }
    res.status(200).json({ forum });
  } catch (error) {
    console.error("Error retrieving forum:", error);
    res
      .status(500)
      .json({ message: "Error retrieving forum", error: error.message });
  }
});

//////////////// <--------------> ////////////////////
router.get("/all-users", companyVerify, async (req, res) => {
  const { search = "", page = 1, limit = 20 } = req.query;
  try {
    const userId = req.user?.userId;
    if (!userId) {
      console.log("User ID is not available.");
      return res
        .status(400)
        .json({ message: "User ID is not available for testing." });
    }
    const skip = (page - 1) * limit;
    console.log(
      `Fetching users with search: ${search}, page: ${page}, limit: ${limit}`
    );
    const searchQuery = {
      $or: [
        { firstName: { $regex: search, $options: "i" } },
        { lastName: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ],
    };
    const users = await User.find({
      _id: { $ne: userId },
      ...searchQuery,
    })
      .skip(skip)
      .limit(Number(limit));
    const userIds = users.map((user) => user._id);
    const companies = await CompanyModel.find({
      userId: { $in: userIds },
    });
    const companyMap = {};
    companies.forEach((company) => {
      companyMap[company.userId] = company.companyName;
    });
    const usersWithCompanies = users.map((user) => ({
      ...user.toObject(),
      companyName: companyMap[user._id] || null,
    }));
    const totalUsers = await User.countDocuments({
      _id: { $ne: userId },
      ...searchQuery,
    });
    const totalPages = Math.ceil(totalUsers / limit);
    res.status(200).json({
      users: usersWithCompanies,
      totalPages,
      currentPage: Number(page),
    });
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ message: "Server error while fetching users" });
  }
});

// Get pending requests
router.get("/pending-requests", companyVerify, async (req, res) => {
  try {
    const forums = await Forum.find({
      pendingRequests: req.user?.userId,
    })
      .populate("userId", "firstName lastName email")
      .populate("invitedUsers", "firstName lastName email");

    if (forums.length === 0) {
      return res.status(404).json({ message: "No pending requests found." });
    }

    return res.status(200).json(forums);
  } catch (error) {
    res.status(500).json({ message: "Server error." });
  }
});

// Get received requests
router.get("/received-requests", companyVerify, async (req, res) => {
  try {
    const userId = req.user?.userId;

    // Find forums where the user is invited
    const invitedForums = await Forum.find({
      invitedUsers: userId,
    })
      .populate("userId", "firstName lastName email")
      .populate("invitedUsers", "firstName lastName email");

    // Find forums owned by the user and have pending requests
    const ownedForumsWithRequests = await Forum.find({
      userId: userId,
      pendingRequests: { $exists: true, $ne: [] },
    })
      .populate("userId", "firstName lastName email")
      .populate("pendingRequests", "firstName lastName email");

    // Get the unique user IDs from both invited and owned forums
    const userIds = [
      ...new Set([
        ...invitedForums.map((forum) => forum.userId._id),
        ...ownedForumsWithRequests.flatMap((forum) =>
          forum.pendingRequests.map((request) => request._id)
        ),
      ]),
    ];

    // Fetch the company details for these users
    const companyDetails = await CompanyModel.find({
      userId: { $in: userIds },
    });

    // Function to map company name to users
    const mapCompanyName = (user) => {
      const company = companyDetails.find((cd) => cd.userId.equals(user._id));
      return {
        ...user._doc,
        companyName: company ? company.companyName : "No company details",
      };
    };

    // Add company name to users in invitedForums
    const updatedInvitedForums = invitedForums.map((forum) => ({
      ...forum._doc,
      userId: mapCompanyName(forum.userId),
      invitedUsers: forum.invitedUsers.map(mapCompanyName),
    }));

    // Add company name to users in ownedForumsWithRequests
    const updatedOwnedForumsWithRequests = ownedForumsWithRequests.map(
      (forum) => ({
        ...forum._doc,
        userId: mapCompanyName(forum.userId),
        pendingRequests: forum.pendingRequests.map(mapCompanyName),
      })
    );

    return res.status(200).json({
      invitedForums: updatedInvitedForums,
      ownedForumsWithRequests: updatedOwnedForumsWithRequests,
    });
  } catch (error) {
    console.error("Error fetching forums:", error);
    res.status(500).json({ message: "Server error." });
  }
});

router.delete("/delete-forum/:forumId", companyVerify, async (req, res) => {
  const { forumId } = req.params;
  try {
    const deletedForum = await Forum.findByIdAndDelete({
      _id: forumId,
      userId: req.user?.userId,
    });
    if (!deletedForum) {
      return res.status(404).json({ message: "Forum not found" });
    }

    if (deletedForum.forumImage) {
      try {
        const publicId = deletedForum.forumImage
          .split("/")
          .slice(-1)[0]
          .split(".")[0];
        await cloudinary.uploader.destroy(publicId);
      } catch (cloudinaryError) {
        console.error("Error deleting image from Cloudinary:", cloudinaryError);
      }
    }

    res
      .status(200)
      .json({ message: "Forum deleted successfully", deletedForum });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error deleting forum", error: error.message });
  }
});

router.post("/join-request/:forumId", companyVerify, async (req, res) => {
  const { forumId } = req.params;
  console.log(
    `received for forum ID: ${forumId} by user ID: ${req.user?.userId}`
  );
  try {
    const forum = await Forum.findById(forumId);
    if (!forum) {
      return res.status(404).json({ message: "Forum not found" });
    }
    if (forum.members.includes(req.user?.userId)) {
      return res
        .status(400)
        .json({ message: "You are already a member of this forum" });
    }

    // Check if the user has already sent a join request
    if (forum.pendingRequests.includes(req.user?.userId)) {
      return res.status(400).json({
        message: "You have already sent a join request to this forum",
      });
    }
    forum.pendingRequests.push(req.user?.userId);
    await forum.save();
    console.log(
      `${req.user?.userId} added to pending requests for forum: ${forum.forumName}`
    );
    const user = await User.findById(req.user?.userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    const company = await CompanyModel.findOne({ userId: user._id });
    if (!company) {
      return res
        .status(404)
        .json({ message: "Company not found for this user" });
    }
    const companyName = company.companyName;
    const notification = new Notification({
      userId: forum.userId, // Use forum's owner ID
      message: `${user.firstName} ${user.lastName} from company ${companyName} has requested to join your forum: ${forum.forumName}`,
      forumId: forum._id,
      type: "join_request",
    });
    await notification.save();
    console.log(
      `Notification created for forum owner ${forum.userId}:`,
      notification
    );
    if (req.io) {
      req.io.to(forum.userId.toString()).emit("notification", notification);
      console.log(
        `Notification sent to forum owner ${forum.userId.toString()}`
      );
    } else {
      console.log(
        `Socket.io not available for forum owner ${forum.userId.toString()}`
      );
    }
    res.status(200).json({ message: "Join request sent successfully" });
  } catch (error) {
    console.error("Error sending join request:", error);
    res
      .status(500)
      .json({ message: "Error sending join request", error: error.message });
  }
});

// Cancel a join request
router.post("/cancel-request", companyVerify, async (req, res) => {
  const { forumId } = req.body;

  try {
    const forum = await Forum.findById(forumId);
    if (!forum) {
      return res.status(404).json({ message: "Forum not found" });
    }

    const pendingIndex = forum.pendingRequests.indexOf(req.user?.userId);
    if (pendingIndex === -1) {
      return res
        .status(400)
        .json({ message: "User has not requested to join this forum" });
    }

    forum.pendingRequests.splice(pendingIndex, 1);
    await forum.save();

    return res.status(200).json({ message: "Request successfully canceled" });
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// Reject Request
router.post("/reject-invitation/:forumId", companyVerify, async (req, res) => {
  const { forumId } = req.params;
  const { reason } = req.body;

  try {
    const forum = await Forum.findById(forumId);
    if (!forum) {
      return res.status(404).json({ message: "Forum not found" });
    }

    // Check if the user is in the invitedUsers array
    const invitedIndex = forum.invitedUsers.indexOf(req.user?.userId);
    if (invitedIndex === -1) {
      return res
        .status(400)
        .json({ message: "User was not invited to this forum" });
    }

    // Store the rejection reason
    forum.rejectionReasons.push({
      userId: req.user?.userId,
      reason: reason,
      createdAt: Date.now(),
    });

    // Remove the user ID from invitedUsers
    forum.invitedUsers.splice(invitedIndex, 1);
    await forum.save();

    res.status(200).json({ message: "Invitation rejected successfully" });
  } catch (error) {
    console.error("Error rejecting the invitation:", error);
    res.status(500).json({
      message: "Error rejecting the invitation",
      error: error.message,
    });
  }
});

// GET: Check invited users for a specific forum
router.get(
  "/check-invitedUsers-request/:forumId",
  companyVerify,
  async (req, res) => {
    const { forumId } = req.params;

    try {
      // Find the forum by ID
      const forum = await Forum.findById(forumId).populate("invitedUsers");
      if (!forum) {
        return res.status(404).json({ message: "Forum not found" });
      }

      // Fetch all users related to the current context (optional)
      const allUsers = await User.find({});

      // Create an array of invited users with their status
      const invitedUsersWithStatus = allUsers.map((user) => ({
        email: user.email,
        invited: forum.invitedUsers.some((invitedUser) =>
          invitedUser._id.equals(user._id)
        ),
      }));

      res.status(200).json({
        message: "Invited users retrieved successfully",
        invitedUsers: invitedUsersWithStatus,
      });
    } catch (error) {
      console.error("Error checking invited users:", error);
      res.status(500).json({
        message: "Error checking invited users",
        error: error.message,
      });
    }
  }
);

// Check if user has sent join request or is a member
router.get("/check-join-request/:forumId", companyVerify, async (req, res) => {
  try {
    const forum = await Forum.findById(req.params.forumId);
    if (!forum) {
      return res.status(404).json({ message: "Forum not found" });
    }

    const hasRequestedJoin = forum.pendingRequests.includes(req.user?.userId);
    const isMember = forum.members.includes(req.user?.userId);

    res.json({ hasRequestedJoin, isMember });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

// Accept a forum request
router.post("/accept-forum-request", companyVerify, async (req, res) => {
  try {
    const { forumId, requestUserId, actionType } = req.body; // Added actionType to identify 'pending' or 'invited'
    const forumOwnerId = req.user?.userId;

    // Fetch the forum to verify ownership or user invitation status
    const forum = await Forum.findOne({ _id: forumId });

    if (!forum) {
      return res.status(404).json({ message: "Forum not found" });
    }

    // Check if the action is to accept a pending request
    if (actionType === "acceptPendingRequest") {
      // Only the forum owner can accept pending requests
      if (forum.userId.toString() !== forumOwnerId) {
        return res.status(403).json({
          message:
            "You don't have permission to accept requests for this forum",
        });
      }

      // Check if the requestUserId is in the pendingRequests array
      if (!forum.pendingRequests.includes(requestUserId)) {
        return res
          .status(400)
          .json({ message: "No pending request found for this user" });
      }

      // Update the forum: remove requestUserId from pendingRequests and add to members
      const updatedForum = await Forum.findOneAndUpdate(
        { _id: forumId },
        {
          $pull: { pendingRequests: requestUserId },
          $addToSet: { members: requestUserId },
        },
        { new: true }
      ).populate("members pendingRequests");

      return res.status(200).json({
        message: "Pending request accepted successfully",
        updatedForum,
      });
    } else if (actionType === "acceptInvite") {
      // Check if the user is in the invitedUsers array
      if (!forum.invitedUsers.includes(forumOwnerId)) {
        return res.status(403).json({
          message:
            "You are not invited to this forum or your invitation was already accepted",
        });
      }

      // Update the forum: remove the user from invitedUsers and add to members
      const updatedForum = await Forum.findOneAndUpdate(
        { _id: forumId },
        {
          $pull: { invitedUsers: forumOwnerId },
          $addToSet: { members: forumOwnerId },
        },
        { new: true }
      ).populate("members invitedUsers");

      return res
        .status(200)
        .json({ message: "Invitation accepted successfully", updatedForum });
    } else {
      return res.status(400).json({ message: "Invalid action type" });
    }
  } catch (error) {
    res.status(500).json({
      message: "Error accepting request or invitation",
      error: error.message,
    });
  }
});

router.post("/share-products", companyVerify, async (req, res) => {
  const { forumId, products } = req.body;

  // Hardcoded user ID (this should come from token middleware)
  const userId = req.user?.userId;
  console.log("userId", userId);

  // Validate the input
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

  // Log the products received for debugging
  console.log("Received products:", JSON.stringify(products, null, 2));

  try {
    const messages = await Promise.all(
      products.map(async (product, index) => {
        // Validate each product
        if (!product || !product._id) {
          console.error(`Product at index ${index} is invalid:`, product);
          throw new Error(`Invalid product at index ${index}`);
        }

        // Increment the share count in the Product model
        const updatedProduct = await Product.findByIdAndUpdate(
          product._id,
          { $inc: { shareCount: 1 } }, // Increment shareCount by 1
          { new: true } // Return the updated product
        );

        if (!updatedProduct) {
          throw new Error(`Product with ID ${product._id} not found`);
        }

        // Create a new message and include productId
        const newMessage = new Message({
          forumId,
          userId, // Use hardcoded user ID
          text: `Check out this product: ${product.name}\n${product.shareableLink}`,
          attachment: product.productImage,
          cloudinaryId: product._id,
          productId: product._id, // Store product ID in the database
        });

        // Save the message and return the promise
        const savedMessage = await newMessage.save();
        return {
          productId: product._id, // Include product ID in the response
          message: savedMessage,
          updatedShareCount: updatedProduct.shareCount, // Return the updated share count
        };
      })
    );

    // Return success response with saved messages
    res.status(201).json({
      success: true,
      message: "Products shared successfully!",
      data: messages, // Include the saved messages and product IDs in the response
    });
  } catch (error) {
    // Log the error details for debugging
    console.error("Error sharing products:", error.stack);

    // Return error response
    res.status(500).json({
      success: false,
      message: "Error sharing products.",
      error: error.message,
    });
  }
});

router.get("/getParticipantsDetails/:forumId", async (req, res) => {
  try {
    const { forumId } = req.params;

    // Retrieve the forum and its members
    const forum = await Forum.findById(forumId);
    const members = forum.members;

    let items = [];

    // Loop through each member in the forum
    for (let member of members) {
      let item = {};

      // Fetch user details for the member
      const user = await User.findById(member).select(
        "firstName lastName email userImg contactNumber"
      );

      // Check if user exists
      if (!user) {
        console.warn(`User with ID ${member} not found.`);
        continue; // Skip this member if user doesn't exist
      }

      // Combine firstName and lastName to form the userName without space
      const userName = `${user.firstName}${user.lastName}`;

      // Fetch product IDs from messages associated with this user in the current forum
      const messageProducts = await Message.find({
        userId: member,
        forumId: forumId,
        productId: { $ne: null }, // Ensure productId is not null
      }).select("productId");

      // Extract unique product IDs
      const productIds = messageProducts.map((msg) => msg.productId.trim());

      // Fetch products related to this member using the product IDs
      const participantsProduct = await Product.find({
        _id: { $in: productIds },
      });

      // Transform product data as required
      const transformedData = participantsProduct.map((product) => {
        const productDetailsStep = product.questions.steps.find(
          (step) => step.name === "Product Details"
        );

        // Find specific product details from the questions
        const productNameQuestion = productDetailsStep?.questions.find(
          (q) => q.description === "Product Name"
        );
        const productIdQuestion = productDetailsStep?.questions.find(
          (q) => q.description === "Product ID"
        );
        const brandNameQuestion = productDetailsStep?.questions.find(
          (q) => q.description === "Brand Name"
        );
        const productImageQuestion = productDetailsStep?.questions.find(
          (q) => q.description === "Product Image"
        );

        // Extract necessary data
        const localCreatedAt = new Date(product.createdAt).toLocaleString();

        let primaryImage = "";
        if (productImageQuestion && productImageQuestion.images.length > 0) {
          primaryImage =
            productImageQuestion.images[0].base64 ||
            productImageQuestion.images[0].url;
        }

        // Return the transformed data for each product
        return {
          id: product._id,
          productName: productNameQuestion ? productNameQuestion.value : "",
          productId: productIdQuestion ? productIdQuestion.value : "",
          brandName: brandNameQuestion ? brandNameQuestion.value : "",
          productImage: primaryImage,
          status: product.status,
          createdAt: localCreatedAt,
          userName: userName,
        };
      });

      // Fetch company details using userId from companyDetails model
      const companyDetails = await CompanyModel.findOne({
        userId: member,
      }).select("companyName contactNumber companyEmail companyAbout");

      // Get companyName or set a default value if not found
      const companyName = companyDetails
        ? companyDetails.companyName
        : "No Company";
      const companyAbout = companyDetails ? companyDetails.companyAbout : "";
      const contactNumber = companyDetails ? companyDetails.contactNumber : "";
      const companyEmail = companyDetails ? companyDetails.companyEmail : "";

      // Add user and company data along with products to the item
      item.user = {
        ...user.toObject(),
        userName, // Adding userName property by joining firstName and lastName without space
        companyName,
        companyAbout,
        companyEmail,
        contactNumber,
      };
      item.products = transformedData;

      // Push the item to the result array
      items.push(item);
    }

    // Return the result
    res.status(200).json(items);
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// Express.js example
router.get("/notifications", companyVerify, async (req, res) => {
  const { page = 1, limit = 10 } = req.query;

  const pageNumber = parseInt(page); // Convert to integer
  const limitNumber = parseInt(limit); // Convert to integer

  try {
    const skip = (pageNumber - 1) * limitNumber;

    const notifications = await Notification.find({ userId: req.user.userId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNumber);

    const totalNotifications = await Notification.countDocuments({
      userId: req.user.userId,
    });

    res.json({
      notifications,
      totalNotifications,
      currentPage: pageNumber,
      totalPages: Math.ceil(totalNotifications / limitNumber),
    });
  } catch (error) {
    res.status(500).send("Error fetching notifications");
  }
});

// PATCH route to mark a notification as read
router.patch("/notifications/:id/read", companyVerify, async (req, res) => {
  const notificationId = req.params.id;
  try {
    const notification = await Notification.findByIdAndUpdate(
      notificationId,
      { isRead: true },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({ message: "Notification not found" });
    }
    res.status(200).json(notification);
  } catch (error) {
    console.error("Error marking notification as read:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Route to toggle the `isActive` field of a forum
router.patch("/toggle-active/:forumId", async (req, res) => {
  const { forumId } = req.params;
  try {
    const forum = await Forum.findById(forumId).populate("userId forumName");
    if (!forum) {
      return res.status(404).json({ message: "Forum not found." });
    }
    const previousStatus = forum.isActive;
    forum.isActive = !forum.isActive;
    await forum.save();
    const forumName = forum.forumName || "Untitled Forum";
    const message = forum.isActive
      ? `Prolio Admin has activated your forum ${forumName}`
      : `Prolio Admin has deactivated your forum ${forumName}`;

    const newNotification = new Notification({
      userId: forum.userId._id,
      message: message,
      relatedForum: forum._id,
      createdAt: new Date(),
    });
    // Save the notification
    await newNotification.save();
    res.status(200).json({
      message: `Forum is now ${forum.isActive ? "active" : "inactive"}.`,
      forum,
      notification: newNotification,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error." });
  }
});

router.post("/increaseShare/:productId", companyVerify, async (req, res) => {
  const { productId } = req.params;

  try {
    // Find the product by its ID
    const product = await Product.findById(productId);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    // Increment the shareCount
    product.shareCount += 1;

    // Save the updated product document
    await product.save();

    return res.status(200).json({
      success: true,
      message: "Product share count updated successfully!",
      shareCount: product.shareCount, // Returning the updated share count
    });
  } catch (error) {
    console.error("Error updating share count:", error);
    return res.status(500).json({
      success: false,
      message: "Error updating share count",
      error: error.message,
    });
  }
});

router.get("/share-count/:productId", companyVerify, async (req, res) => {
  const { productId } = req.params; // Get productId from URL parameters

  try {
    // Find the product by its ID
    const product = await Product.findById(productId);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    // Return the share count as the response
    return res.status(200).json({
      success: true,
      shareCount: product.shareCount, // Send the current share count
    });
  } catch (error) {
    console.error("Error fetching share count:", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching share count",
      error: error.message,
    });
  }
});

module.exports = router;
