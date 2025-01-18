const Notification = require("../../models/Notification");
const Message = require("../../models/message");
const Forum = require("../../models/Forum");
const { sendResponse } = require("../../utils/responseHandler");

// Retrieve User Notifications Endpoint
exports.getNotifications = async (req, res) => {
  const userId = req.user?.id;
  const { page = 1, limit = 5 } = req.query; 

  try {
    const skip = (page - 1) * limit;

    // Fetch notifications with pagination
    const notifications = await Notification.find({ userId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    // Count unread notifications
    const unreadCount = await Notification.countDocuments({
      userId,
      isRead: false,
    });

    // Check if there are more notifications
    const totalNotifications = await Notification.countDocuments({ userId });
    const hasMore = skip + notifications.length < totalNotifications;

    return res.status(200).json({
      success: true,
      data: {
        notifications,
        unreadCount,
        hasMore,
        page: parseInt(page),
      },
      message: "Notifications retrieved successfully",
    });
  } catch (error) {
    console.error("Notification retrieval error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve notifications",
    });
  }
};


// Mark a message as read
exports.markNotificationAsRead = async (req, res) => {
  try {
    const userId = req.user?.id;
    const updatedNotifications = await Notification.updateMany(
      { userId, isRead: false },
      { $set: { isRead: true } }
    );

    if (updatedNotifications.nModified > 0) {
      return res.status(200).json({
        success: true,
        message: `${updatedNotifications.nModified} notifications marked as read`,
      });
    } else {
      return res.status(200).json({
        success: true,
        message: "No unread notifications found",
      });
    }
  } catch (error) {
    console.error("Error updating notifications:", error);
    return res.status(500).json({
      success: false,
      message: "Error marking notifications as read",
    });
  }
};

exports.markAllMessagesAsRead = async (req, res) => {
  try {
    const userId = req.user?.id;
    // Find all forums the user is a member of
    const userForums = await Forum.find({ members: userId }).distinct("_id");
    console.log("User Forums:", userForums);

    // If the user is not a member of any forum, return a success message with no updates
    if (!userForums.length) {
      return res.status(200).json({
        success: true,
        message: "No messages to mark as read.",
      });
    }

    // Find unread messages
    const unreadMessages = await Message.find({
      forumId: { $in: userForums },
      ownerId: { $ne: userId }, // Exclude messages owned by the user
      deleted: { $ne: true }, // Exclude deleted messages
      $or: [
        { readBy: { $size: 0 } }, // Messages with empty readBy array
        { "readBy.customerId": { $ne: userId } }, // User has not read this message
        { readBy: { $elemMatch: { customerId: userId, isRead: false } } }, // User has unread messages
      ],
    });

    // Manually update each message
    const updatePromises = unreadMessages.map(async (message) => {
      // Find the index of the user in readBy array (if exists)
      const userReadIndex = message.readBy.findIndex(
        (rb) => rb.customerId.toString() === userId.toString()
      );

      if (userReadIndex !== -1) {
        // If user exists in readBy, update their isRead status
        message.readBy[userReadIndex].isRead = true;
      } else {
        // If user doesn't exist, add a new entry
        message.readBy.push({
          customerId: userId,
          isRead: true,
        });
      }

      // Save the message
      return message.save();
    });
    const results = await Promise.all(updatePromises);

    return res.status(200).json({
      success: true,
      message: "All messages marked as read.",
      updatedCount: results.length,
    });
  } catch (error) {
    console.error("Error marking all messages as read:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to mark all messages as read.",
      errorDetails: error.message,
    });
  }
};

exports.getUnreadMessageNotificationsCount = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;

    // Find all forums the user is a member of
    const userForums = await Forum.find({ members: userId }).distinct("_id");

    // If userForums is empty, return an empty response
    if (!userForums.length) {
      return res.status(200).json({
        success: true,
        messages: [],
        totalUnreadMessages: 0,
      });
    }

    // Query for unread messages, with additional conditions:
    // 1. Exclude messages owned by the current user
    // 2. Exclude deleted messages
    // 3. Ensure the message is unread by the current user
    const unreadMessagesQuery = {
      forumId: { $in: userForums },
      ownerId: { $ne: userId }, // Exclude messages owned by the current user
      deleted: { $ne: true }, // Exclude deleted messages
      $or: [
        { "readBy.customerId": { $ne: userId } }, // User has not read this message
        { readBy: { $elemMatch: { customerId: userId, isRead: false } } }, // User has unread messages
      ],
    };

    // Total unread message count
    const totalUnreadMessages = await Message.countDocuments(
      unreadMessagesQuery
    );

    // Paginated unread messages
    const unreadMessages = await Message.find(unreadMessagesQuery)
      .populate("forumId", "forumName") // Populate forum details
      .populate("ownerId", "companyDetails.companyInfo.companyName")
      .select("text attachment productLink")
      .sort({ createdAt: -1 }) // Sort by most recent
      .skip(skip) // Skip for pagination
      .limit(parseInt(limit)); // Limit results per page

    // Response
    return res.status(200).json({
      success: true,
      messages: unreadMessages,
      totalUnreadMessages, // Total unread message count
      hasMore: unreadMessages.length + skip < totalUnreadMessages,
    });
  } catch (error) {
    console.error("Error fetching unread messages:", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching unread messages",
    });
  }
};

// Fetch unread message notifications
exports.getUnreadMessageNotifications = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;

    // Find all forums the user is a member of
    const userForums = await Forum.find({ members: userId }).distinct("_id");

    // If userForums is empty, return an empty response
    if (!userForums.length) {
      return res.status(200).json({
        success: true,
        messages: [],
        totalMessages: 0,
      });
    }

    // Query for unread messages, with additional conditions:
    // 1. Exclude messages owned by the current user
    // 2. Exclude deleted messages
    // 3. Ensure the message is unread by the current user
    const messagesQuery = {
      forumId: { $in: userForums },
      ownerId: { $ne: userId }, // Exclude messages owned by the current user
      deleted: { $ne: true }, // Exclude deleted messages
      $or: [
        { "readBy.customerId": { $ne: userId } }, // User has not read this message
        { readBy: { $elemMatch: { customerId: userId } } }, // User has unread messages
      ],
    };

    // Total unread message count
    const totalMessages = await Message.countDocuments(messagesQuery);

    // Paginated unread messages
    const messages = await Message.find(messagesQuery)
      .populate("forumId", "forumName forumImage")
      .populate("ownerId", "companyDetails.companyInfo.companyName")
      .select("text attachment productLink readBy")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    // Add the read status to each message for the current user
    const messagesWithReadStatus = messages.map((message) => {
      // Check if the current user has read this message
      const readStatus = message.readBy.some(
        (readRecord) =>
          readRecord.customerId.toString() === userId.toString() &&
          readRecord.isRead
      );

      return {
        ...message.toObject(),
        isRead: readStatus, // Add read status to the response
      };
    });

    // Response
    return res.status(200).json({
      success: true,
      messages: messagesWithReadStatus,
      totalMessages, // Total unread message count
      hasMore: messagesWithReadStatus.length + skip < totalMessages,
    });
  } catch (error) {
    console.error("Error fetching unread messages:", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching unread messages",
    });
  }
};
