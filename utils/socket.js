const jwt = require("jsonwebtoken");
const { uploadToS3 } = require("./s3FileUploader");
const Message = require("../models/message");

/**
 * Socket.IO connection handler
 * @param {Object} io - The Socket.IO server instance
 */
const socketConnection = (io) => {
  io.on("connection", (socket) => {
    console.log(`User connected: ${socket.user?.id}`);

    // Join a forum
    socket.on("joinForum", (forumId) => {
      socket.join(forumId);
      console.log(`User ${socket.user?.id} joined forum: ${forumId}`);
    });

    // Handle message sending
    socket.on("sendMessage", async (data) => {
      try {
        const { text, attachment, forumId, publicId } = data;
        const ownerId = socket.user?.id;

        let attachmentUrl = null;
        let fileKey = null;
        let fileName = null;

        // If attachment exists, upload it to S3
        if (attachment) {
          const fileBuffer = attachment.data;
          const fileName = attachment.name || "unknown_file_name";

          const uploadResult = await uploadToS3(
            fileBuffer,
            fileName,
            attachment.mimeType,
            "forum_uploads"
          );

          attachmentUrl = uploadResult.url;
          fileKey = uploadResult.filename;
        }

        // Save the message to the database
        const newMessage = new Message({
          forumId,
          ownerId,
          text,
          attachment: attachmentUrl,
          publicId: publicId || fileKey,
        });

        await newMessage.save();

        // Populate user details before sending back to clients
        const populatedMessage = await Message.findById(
          newMessage._id
        ).populate("ownerId", "firstName lastName email");

        // Emit the new message to all users in the forum
        io.to(forumId).emit("message", populatedMessage);
      } catch (error) {
        console.error("Error processing message:", error);
        socket.emit("messageError", { error: "Failed to save message" });
      }
    });

    // Handle user disconnect
    socket.on("disconnect", () => {
      console.log(`User disconnected: ${socket.user?.userId}`);
    });
  });
};

/**
 * Socket.IO authentication middleware
 * @param {Object} socket - The socket instance
 * @param {Function} next - The next middleware function
 */
const socketAuthMiddleware = (socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) {
    return next(new Error("Authentication error"));
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
    socket.user = decoded;
    next();
  } catch (error) {
    console.error("Socket authentication error:", error);
    next(new Error("Authentication error"));
  }
};

module.exports = {
  socketConnection,
  socketAuthMiddleware,
};
