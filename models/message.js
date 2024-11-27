const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
  {
    forumId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Forum",
      required: true,
    },
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
    },
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
    },
    text: {
      type: String,
    },
    attachment: {
      type: String,
    },
    fileName: {
      type: String,
    },
    publicId: {
      type: String,
    },
    productLink: {
      type: String,
    },
    videoUrl: {
      type: String,
    },
    videoName: {
      type: String,
    },
    videoFormat: {
      type: String,
    },
    videoPublicId: {
      type: String,
    },
    deleted: {
      type: Boolean,
      default: false,
    },
    deletedAt: {
      type: Date,
    },
    readBy: [
      {
        customerId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Customer",
        },
        isRead: {
          type: Boolean,
          default: false,
        },
      },
    ],
  },
  { timestamps: true }
);

const Message = mongoose.model("Message", messageSchema);

module.exports = Message;
