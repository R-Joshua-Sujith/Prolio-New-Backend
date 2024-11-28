const Message = require("../../models/message");
const { sendResponse } = require("../../utils/responseHandler");
const mongoose = require("mongoose");
const ForumModel = require("../../models/Forum");

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
