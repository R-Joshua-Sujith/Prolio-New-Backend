const Banner = require("../../models/banner");
const { uploadToS3, deleteFromS3 } = require("../../utils/s3FileUploader");
const { sendResponse } = require("../../utils/responseHandler");

exports.createBanner = async (req, res) => {
  try {
    const { description, descriptionColor, status = "active" } = req.body;

    // Upload multiple files to S3
    const uploadPromises = req.files.map((file) =>
      uploadToS3(file.buffer, file.originalname, file.mimetype, "banners")
    );

    const uploadedFiles = await Promise.all(uploadPromises);
    const bannerImg = uploadedFiles.map(({ url, filename }) => ({
      url,
      publicId: filename,
    }));

    const newBanner = new Banner({
      bannerImg,
      description,
      descriptionColor,
      status,
    });

    await newBanner.save();

    sendResponse(res, 201, true, "Banner created successfully", newBanner);
  } catch (error) {
    console.error("Error creating banner:", error);
    sendResponse(res, 500, false, "Error creating banner", error.message);
  }
};

// Controller to update an existing banner's
exports.updateBanner = async (req, res) => {
  try {
    const bannerId = req.params.id;
    const { description, descriptionColor, status } = req.body;

    let updatedData = { description, descriptionColor, status };

    if (req.files) {
      const banner = await Banner.findById(bannerId);
      if (banner) {
        await deleteFromS3(banner.bannerImg.url);
        const uploadPromises = req.files.map((file) =>
          uploadToS3(file.buffer, file.originalname, file.mimetype, "banners")
        );

        const uploadedFiles = await Promise.all(uploadPromises);
        updatedData.bannerImg = uploadedFiles.map(({ filename, url }) => ({
          url,
          publicId: filename,
        }));
      }
    }
    const updatedBanner = await Banner.findByIdAndUpdate(
      bannerId,
      updatedData,
      { new: true }
    );
    sendResponse(res, 200, true, "Banner updated successfully", updatedBanner);
  } catch (error) {
    console.error("Error updating banner:", error);
    sendResponse(res, 500, false, "Error updating banner", error.message);
  }
};

// Controller to delete a banner
exports.deleteBanner = async (req, res) => {
  try {
    const bannerId = req.params.id;
    console.log("bannerId", bannerId);
    const banner = await Banner.findById(bannerId);
    if (!banner) {
      return sendResponse(res, 404, false, "Banner not found");
    }

    // Delete the image from S3
    await deleteFromS3(banner.bannerImg[0].url);
    await Banner.findByIdAndDelete(bannerId);
    sendResponse(res, 200, true, "Banner deleted successfully");
  } catch (error) {
    console.error("Error deleting banner:", error);
    sendResponse(res, 500, false, "Error deleting banner", error.message);
  }
};

// Controller to change the banner status
exports.updateBannerStatus = async (req, res) => {
  try {
    const bannerId = req.params.id;
    const { status } = req.body;
    if (!["active", "inactive"].includes(status)) {
      return sendResponse(
        res,
        400,
        false,
        'Invalid status. Only "active" or "inactive" are allowed.'
      );
    }
    // Update the banner's status
    const updatedBanner = await Banner.findByIdAndUpdate(
      bannerId,
      { status },
      { new: true }
    );
    sendResponse(
      res,
      200,
      true,
      "Banner status updated successfully",
      updatedBanner
    );
  } catch (error) {
    console.error("Error updating banner status:", error);
    sendResponse(
      res,
      500,
      false,
      "Error updating banner status",
      error.message
    );
  }
};
