const Notification = require("../../models/Notification");
const sendResponse = require("../../utils/responseHandler");
const Message = require("../../models/message");
const Forum = require("../../models/Forum");

// Get paginated notifications
exports.getNotifications = async (req, res) => {
  const { page = 1, limit = 10 } = req.query;
  const pageNumber = parseInt(page);
  const limitNumber = parseInt(limit);

  try {
    const skip = (pageNumber - 1) * limitNumber;
    const notifications = await Notification.find({ userId: req.user.userId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNumber);

    const totalNotifications = await Notification.countDocuments({
      userId: req.user.userId,
    });

    sendResponse(res, 200, {
      notifications,
      totalNotifications,
      currentPage: pageNumber,
      totalPages: Math.ceil(totalNotifications / limitNumber),
    });
  } catch (error) {
    sendResponse(res, 500, null, "Error fetching notifications");
  }
};

// Mark a notification as read
exports.markNotificationAsRead = async (req, res) => {
  const notificationId = req.params.id;
  try {
    const notification = await Notification.findByIdAndUpdate(
      notificationId,
      { isRead: true },
      { new: true }
    );

    if (!notification) {
      return sendResponse(res, 404, null, "Notification not found");
    }
    sendResponse(res, 200, notification, "Notification marked as read");
  } catch (error) {
    sendResponse(res, 500, null, "Error marking notification as read");
  }
};

// Mark a message as read
exports.markMessageAsRead = async (req, res) => {
  const userId = req.user?.id;
  const { messageId } = req.params;

  if (!userId) {
    return sendResponse(res, 400, null, "User ID is required");
  }
  try {
    const message = await Message.findById(messageId);
    if (!message) {
      return sendResponse(res, 404, null, "Message not found");
    }

    const userReadEntry = message.readBy.find(
      (entry) => entry.userId.toString() === userId
    );
    if (userReadEntry) {
      userReadEntry.isRead = true;
    } else {
      message.readBy.push({ userId, isRead: true });
    }

    await message.save();
    sendResponse(res, 200, message, "Message marked as read");
  } catch (error) {
    sendResponse(res, 500, null, "Error marking message as read");
  }
};

// Fetch unread message notifications
exports.getUnreadMessageNotifications = async (req, res) => {
  const userId = req.user?.id;

  try {
    const userForums = await Forum.find({ members: userId }).distinct("_id");

    if (!userForums.length) {
      return sendResponse(res, 200, []);
    }

    const unreadMessages = await Message.find({
      userId: { $ne: userId },
      forumId: { $in: userForums },
      $or: [
        { "readBy.userId": { $ne: userId } },
        { "readBy.userId": userId, "readBy.isRead": false },
      ],
    })
      .populate("userId", "firstName lastName email")
      .sort({ createdAt: -1 });

    const populatedMessages = await Promise.all(
      unreadMessages.map(async (message) => {
        const companyDetails = await companyDetailsModel.findOne({
          userId: message.userId._id,
        });

        return {
          ...message.toObject(),
          companyName: companyDetails ? companyDetails.companyName : null,
        };
      })
    );

    sendResponse(res, 200, populatedMessages);
  } catch (error) {
    sendResponse(res, 500, null, "Error fetching unread messages");
  }
};
