const Banner = require("../../models/banner");
const { uploadToS3, deleteFromS3 } = require("../../utils/s3FileUploader");
const { sendResponse } = require("../../utils/responseHandler");

exports.createBanner = async (req, res) => {
  try {
    // Check if files exist
    if (!req.files || req.files.length === 0) {
      return sendResponse(res, 400, false, "Banner images are required");
    }

    let { description, colors, status = "active" } = req.body;

    try {
      // Handle optional description and colors
      if (description) {
        description =
          typeof description === "string"
            ? JSON.parse(description)
            : description;
        description = Array.isArray(description) ? description[0] : description;
      }

      if (colors) {
        colors = typeof colors === "string" ? JSON.parse(colors) : colors;
        colors = Array.isArray(colors) ? colors[0] : colors;
        // Ensure color has # prefix if provided
        colors = colors.startsWith("#") ? colors : `#${colors}`;
      }
    } catch (parseError) {
      console.error("Error parsing data:", parseError);
      return sendResponse(res, 400, false, "Invalid data format");
    }

    // Upload files to S3
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
      ...(description && { description }), // Only include if provided
      ...(colors && { descriptionColor: colors }), // Only include if provided
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

    // Find the banner by ID
    const banner = await Banner.findById(bannerId);
    if (!banner) {
      return sendResponse(res, 404, false, "Banner not found");
    }

    // If banner has multiple images, iterate and delete each one from S3 by publicId
    if (banner.bannerImg && banner.bannerImg.length > 0) {
      for (let img of banner.bannerImg) {
        // Delete each image from S3 by its publicId
        await deleteFromS3(img.publicId);
      }
    }

    // Delete the banner document from the database
    await Banner.findByIdAndDelete(bannerId);

    sendResponse(
      res,
      200,
      true,
      "Banner and all associated images deleted successfully"
    );
  } catch (error) {
    console.error("Error deleting banner:", error);
    sendResponse(res, 500, false, "Error deleting banner", error.message);
  }
};

// Get all banners
exports.getAllBanners = async (req, res) => {
  try {
    const banners = await Banner.find();
    res.status(200).json({
      success: true,
      message: "Banners retrieved successfully",
      data: banners,
    });
  } catch (error) {
    // Catch and handle any errors
    res.status(500).json({
      success: false,
      message: "Server Error",
      error: error.message,
    });
  }
};

// Toggle banner status between 'active' and 'inactive'
exports.toggleBannerStatus = async (req, res) => {
  const { bannerId } = req.params;
  try {
    console.log("Attempting to toggle banner status for ID:", bannerId);

    // Use findByIdAndUpdate to directly update only the status field
    const updatedBanner = await Banner.findByIdAndUpdate(
      bannerId,
      [
        {
          $set: {
            status: {
              $cond: [{ $eq: ["$status", "active"] }, "inactive", "active"],
            },
          },
        },
      ],
      { new: true }
    );

    if (!updatedBanner) {
      console.log("Banner not found with ID:", bannerId);
      return sendResponse(res, 404, false, "Banner not found");
    }

    console.log(
      `Banner status successfully updated to: ${updatedBanner.status}`
    );
    return sendResponse(
      res,
      200,
      true,
      `Banner status updated to ${updatedBanner.status}`,
      updatedBanner
    );
  } catch (error) {
    console.error("Error in toggleBannerStatus:", error);
    return sendResponse(res, 500, false, "Server Error", error.message);
  }
};
