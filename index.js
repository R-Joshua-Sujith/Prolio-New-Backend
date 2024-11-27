const express = require("express");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const Message = require("./models/message");
const http = require("http");
const { Server } = require("socket.io");
const { uploadToS3 } = require("./utils/s3FileUploader"); // Import your S3 upload function
const { getServerStatusMessage } = require("./utils/serverStatus");
const customerRoutes = require("./routes/MainRoutes/Customer");
const companyRoutes = require("./routes/MainRoutes/Company");
const adminRoutes = require("./routes/MainRoutes/Admin");
const jwt = require("jsonwebtoken");

dotenv.config();
const app = express();
app.use(express.json());
app.use(cors());
app.use(cookieParser());

// Connect to MongoDB
mongoose
  .connect(process.env.MONGO_URL)
  .then(() => console.log("DB Connection Successful"))
  .catch((err) => console.log(err));

// Create HTTP server for socket connection
const server = http.createServer(app);
const io = new Server(server, {
  maxHttpBufferSize: 1e7, // 10 MB buffer size for messages
  cors: {
    origin: "*", // Allow all origins (for development, restrict it for production)
    methods: ["GET", "POST"],
  },
});

// Middleware to attach io instance to the request object
app.use((req, res, next) => {
  req.io = io;
  next();
});

// Routes
app.use("/customer", customerRoutes);
app.use("/company", companyRoutes);
app.use("/admin", adminRoutes);

// Root endpoint for server status
app.get("/", (req, res) => {
  res.send(getServerStatusMessage());
});

// Socket.io authentication middleware
io.use((socket, next) => {
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
});

// Socket.IO event handling
io.on("connection", (socket) => {
  console.log(`User connected: ${socket.user?.id}`);

  // User joins the forum
  socket.on("joinForum", (forumId) => {
    socket.join(forumId);
    console.log(`User ${socket.user?.id} joined forum: ${forumId}`);
  });

  // Handle sending a message
  socket.on("sendMessage", async (data) => {
    try {
      console.log("Received data from client:", data);
      const { text, attachment, forumId } = data;
      const ownerId = socket.user?.id;
      console.log("ownerId:", ownerId);
      let attachmentUrl = null;
      let fileKey = null;
      let fileName = null;

      // If attachment exists, upload it to S3
      if (attachment) {
        fileName = attachment.name || "unknown_file_name";
        console.log("Received attachment:", attachment);

        if (attachment.data) {
          console.log("Attachment has data:", attachment.data);
        } else {
          console.error("Attachment data is missing!");
        }

        // Convert base64 data to Buffer
        const fileBuffer = Buffer.from(attachment.data, "base64");

        // Upload to S3 and get the URL and file key
        const uploadResult = await uploadToS3(
          fileBuffer,
          fileName,
          attachment.mimeType, // You can pass mimetype if needed
          "forum_uploads"
        );

        attachmentUrl = uploadResult.url;
        fileKey = uploadResult.filename;

        console.log("Uploaded file URL:", attachmentUrl);
        console.log("S3 file key:", fileKey);
      } else {
        console.warn("No attachment found in the message.");
      }

      // Save the message to the database
      const newMessage = new Message({
        forumId,
        ownerId,
        text,
        attachment: attachmentUrl,
        fileName: fileName,
        cloudinaryId: fileKey,
      });

      await newMessage.save();

      // Populate user details before sending back to clients
      const populatedMessage = await Message.findById(newMessage._id).populate(
        "ownerId",
        "firstName lastName email"
      );

      console.log("Emitting new message to forum:", forumId);
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

// Start the server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Backend Server is Running on Port ${PORT}`);
});
