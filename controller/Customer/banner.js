const Banner = require("../../models/banner");
const { sendResponse } = require("../../utils/responseHandler");

exports.getActiveBanners = async (req, res) => {
  try {
    const activeBanners = await Banner.find({ status: "active" });

    if (activeBanners.length === 0) {
      return sendResponse(res, 404, false, "No active banners found");
    }

    sendResponse(
      res,
      200,
      true,
      "Active banners fetched successfully",
      activeBanners
    );
  } catch (error) {
    console.error("Error fetching active banners:", error);
    sendResponse(
      res,
      500,
      false,
      "Error fetching active banners",
      error.message
    );
  }
};
