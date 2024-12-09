const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const LogsSchema = new mongoose.Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      required: true,
      refPath: "userModel",
    },
    userModel: {
      type: String,
      required: true,
      enum: ["Customer", "CompanyUser"],
    },
    targetId: {
      type: Schema.Types.ObjectId,
      required: true,
      refPath: "targetModel",
    },
    targetModel: {
      type: String,
      required: true,
      enum: [
        "Customer",
        "CompanyUser",
        "Role",
        "Enquiry",
        "Product",
        "Forum",
        "log",
      ],
    },
    action: { type: String, required: true },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Log", LogsSchema);
