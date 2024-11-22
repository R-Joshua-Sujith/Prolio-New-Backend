// models/banner.js
const mongoose = require("mongoose");

const bannerSchema = new mongoose.Schema({
  bannerImg: [
    {
      url: { type: String },
      publicId: { type: String },
    },
  ],
  status: { type: String, default: "active" },
  description: { type: String, trim: true },
  descriptionColor: { type: String },
});

const Banner = mongoose.model("Banner", bannerSchema);

module.exports = Banner;
