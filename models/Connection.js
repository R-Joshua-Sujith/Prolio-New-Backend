// models/OwnerConnections.js
const mongoose = require("mongoose");

const ConnectionSchema = new mongoose.Schema({
  participant: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Customer",
    required: true,
  },
  forum: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Forum", 
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const OwnerConnectionsSchema = new mongoose.Schema(
  {
    forumOwner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer", // Changed to "User" instead of "users"
      required: true,
      unique: true,
    },
    connections: [ConnectionSchema],
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("OwnerConnections", OwnerConnectionsSchema);
