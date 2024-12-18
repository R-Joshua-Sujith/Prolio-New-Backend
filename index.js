const express = require("express");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const http = require("http");
const { Server } = require("socket.io");
const { uploadToS3 } = require("./utils/s3FileUploader");
const { getServerStatusMessage } = require("./utils/serverStatus");
const customerRoutes = require("./routes/MainRoutes/Customer");
const companyRoutes = require("./routes/MainRoutes/Company");
const adminRoutes = require("./routes/MainRoutes/Admin");
const influencerRoutes = require("./routes/MainRoutes/Influencer");
const { socketConnection, socketAuthMiddleware } = require("./utils/socket");

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
    origin: "*",
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
app.use("/influencer", influencerRoutes);

// Root endpoint for server status
app.get("/", (req, res) => {
  res.send(getServerStatusMessage());
});

// Use the authentication middleware for socket connection
// Use the socket connection handler
io.use(socketAuthMiddleware);
socketConnection(io);

// Start the server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Backend Server is Running on Port ${PORT}`);
});
