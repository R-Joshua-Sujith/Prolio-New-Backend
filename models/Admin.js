const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const adminSchema = new Schema(
  {
    username: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    profileImg: {
      url: String,
      publicId: String,
    },
    userRole: { type: mongoose.Schema.Types.ObjectId, ref: "Role" },
    loggedInDevice: [
      {
        deviceID: { type: String },
        date: { type: String },
      },
    ],
    status: { type: String, default: "active" },
    otp: { type: String, default: "" },
    otpExpiry: { type: Date },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Admin", adminSchema);
