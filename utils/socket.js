const { Server } = require("socket.io");
const Message = require("../model/message"); // Make sure path is correct

let io;

const initializeSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: "*", // Adjust as needed
      methods: ["GET", "POST"],
    },
  });

  io.on("connection", (socket) => {
    console.log("A user connected");

    // Listen for messages from clients
    socket.on("message", async (message) => {
      try {
        const { forumId, userId, text, attachment } = message;
        const newMessage = new Message({
          forum: forumId,
          user: userId,
          text,
          attachment,
        });
        await newMessage.save();
        io.to(forumId).emit("message", newMessage);
      } catch (error) {
        console.error("Error saving message:", error);
        socket.emit("messageError", { error: "Failed to save message" });
      }
    });

    socket.on("joinForum", (forumId) => {
      socket.join(forumId);
      console.log(`User joined forum: ${forumId}`);
    });

    socket.on("disconnect", () => {
      console.log("A user disconnected");
    });
  });

  return io;
};

module.exports = { initializeSocket, io };
