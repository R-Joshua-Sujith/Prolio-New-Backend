const Message = require("../../models/message");
const { sendResponse } = require("../../utils/responseHandler");
const mongoose = require("mongoose");
const ForumModel = require("../../models/Forum");
const { deleteFromS3 } = require("../../utils/s3FileUploader");

// Get messages for a specific forum
exports.getMessages = async (req, res) => {
  const { forumId } = req.params;
  try {
    const messages = await Message.find({ forumId, deleted: false })
      .populate("ownerId", "name profile")
      .sort({ createdAt: 1 });

    if (!messages || messages.length === 0) {
      return sendResponse(res, 404, "No messages found for this forum");
    }

    sendResponse(res, 200, messages);
  } catch (error) {
    console.error("Error fetching messages:", error);
    sendResponse(res, 500, "Error fetching messages", error.message);
  }
};

exports.deleteMessage = async (req, res) => {
  try {
    const { id } = req.params;
    const ownerId = req.user?.id;

    // Find the message by ID
    const message = await Message.findById(id);
    if (!message) {
      return sendResponse(res, 404, false, "Message not found");
    }
    console.log(message);
    if (message.ownerId.toString() !== ownerId) {
      return sendResponse(
        res,
        403,
        false,
        "You are not authorized to delete this message"
      );
    }

    if (message.deleted) {
      return sendResponse(res, 410, false, "Message already deleted");
    }

    // Soft delete the message (mark it as deleted)
    message.deleted = true;
    message.deletedAt = new Date();

    // If the message has an attachment, delete it from S3
    if (message.attachment) {
      const fileUrl = message.attachment;
      await deleteFromS3(fileUrl);
    }

    await message.save();

    return sendResponse(res, 204, true, "Message deleted successfully");
  } catch (error) {
    console.error("Error deleting message:", error);
    return sendResponse(res, 500, false, "Failed to delete message", {
      error: error.message,
    });
  }
};
