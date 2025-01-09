const mongoose = require("mongoose");

const bannerSchema = new mongoose.Schema(
  {
    bannerImg: [
      {
        url: String,
        publicId: String,
      },
    ],
    description: {
      type: String,
      default: "", // Made optional with empty string default
    },
    descriptionColor: {
      type: String,
      default: "#000000", // Made optional with default black color
    },
    status: {
      type: String,
      default: "active",
    },
  },
  { timestamps: true }
);

const Banner = mongoose.model("Banner", bannerSchema);
module.exports = Banner;
