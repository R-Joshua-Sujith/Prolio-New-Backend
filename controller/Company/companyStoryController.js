const multer = require("multer");
const Customer = require("../../models/Customer");
const { uploadToS3, deleteFromS3 } = require("../../utils/s3FileUploader");
// Configure multer for file uploads

const createCompanyStory = async (req, res) => {
  try {
    const { content } = req.body;
    const files = req.files || [];

    if (!req.user?.id || (!content && files.length === 0)) {
      return res.status(400).json({
        success: false,
        message: "Invalid request data",
      });
    }

    const company = await Customer.findById(req.user.id);
    if (!company) {
      return res.status(404).json({
        success: false,
        message: "Company not found",
      });
    }

    let uploadResults = [];
    if (files.length > 0) {
      try {
        uploadResults = await Promise.all(
          files.map(async (file) => {
            const fileExtension = file.originalname.split(".").pop();
            const uniqueFilename = `${Date.now()}-${Math.random()
              .toString(36)
              .substring(7)}.${fileExtension}`;

            // Pass parameters individually instead of as an object
            const result = await uploadToS3(
              file.buffer,
              uniqueFilename,
              file.mimetype,
              "company_stories"
            );

            return {
              url: result.url,
              publicId: result.filename,
            };
          })
        );
      } catch (uploadError) {
        console.error("S3 Upload Error:", uploadError);
        return res.status(500).json({
          success: false,
          message: "Failed to upload images",
          error: uploadError.message,
        });
      }
    }

    company.story = {
      content: content || "",
      images: uploadResults,
    };

    await company.save();

    res.status(201).json({
      success: true,
      data: company.story,
    });
  } catch (error) {
    console.error("Story Creation Error:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// Update existing company story
const updateCompanyStory = async (req, res) => {
  try {
    const { content, existingImages } = req.body;
    const files = req.files;

    // Parse existingImages back to array if it's a string
    const existingImagesArray = existingImages
      ? JSON.parse(existingImages)
      : [];

    const company = await Customer.findById(req.user.id);
    if (!company || !company.story) {
      return res.status(404).json({
        success: false,
        message: "Company or story not found",
      });
    }

    // Update content if provided
    if (content) {
      company.story.content = content;
    }

    // Replace existing images with the ones that weren't removed
    company.story.images = existingImagesArray;

    // Add new images if any
    if (files && files.length > 0) {
      const uploadPromises = files.map((file) =>
        uploadToS3({
          file: file,
          folder: "company_stories",
          companyId: company._id,
        })
      );

      const uploadResults = await Promise.all(uploadPromises);
      const newImages = uploadResults.map((result) => ({
        url: result.Location,
        publicId: result.Key,
      }));

      company.story.images.push(...newImages);
    }

    await company.save();

    res.status(200).json({
      success: true,
      message: "Company story updated successfully",
      data: company.story,
    });
  } catch (error) {
    console.error("Error in updating company story:", error);
    res.status(500).json({
      success: false,
      message: "Error updating company story",
      error: error.message,
    });
  }
};

// Delete story image
const deleteStoryImage = async (req, res) => {
  try {
    const { imageId } = req.params;

    if (!imageId) {
      return res.status(400).json({
        success: false,
        message: "Image ID is required",
      });
    }

    const company = await Customer.findById(req.user.id);
    if (!company || !company.story) {
      return res.status(404).json({
        success: false,
        message: "Company or story not found",
      });
    }

    // Find the image to delete
    const imageToDelete = company.story.images.find(
      (img) => img.publicId === imageId
    );
    if (!imageToDelete) {
      return res.status(404).json({
        success: false,
        message: "Image not found",
      });
    }

    // Delete from S3
    await deleteFromS3(imageId);

    // Remove image from story
    company.story.images = company.story.images.filter(
      (img) => img.publicId !== imageId
    );

    await company.save();

    res.status(200).json({
      success: true,
      message: "Story image deleted successfully",
      data: company.story,
    });
  } catch (error) {
    console.error("Error in deleting story image:", error);
    res.status(500).json({
      success: false,
      message: "Error deleting story image",
      error: error.message,
    });
  }
};

// Get company story
const getCompanyStory = async (req, res) => {
  try {
    // Validate user authentication
    if (!req.user?.id) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const company = await Customer.findById(req.user.id).select("story");

    if (!company || !company.story) {
      return res.status(404).json({
        success: false,
        message: "Story not found",
      });
    }

    res.status(200).json({
      success: true,
      data: company.story,
    });
  } catch (error) {
    console.error("Error in fetching company story:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch company story",
      error: error.message,
    });
  }
};

const getAllStories = async (req, res) => {
  try {
    // Validate user authentication
    if (!req.user?.id) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const customer = await Customer.findById(req.user.id).select({
      "story.content": 1,
      "story.images": 1,
      createdAt: 1,
      updatedAt: 1,
    });

    if (!customer || !customer.story) {
      return res.status(200).json([]);
    }

    const storyData = {
      id: customer._id,
      content: customer.story.content,
      images: customer.story.images || [],
      createdAt: customer.createdAt,
      updatedAt: customer.updatedAt,
    };

    res.status(200).json([storyData]);
  } catch (error) {
    console.error("Error in getAllStories:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch company stories",
      error: error.message,
    });
  }
};

module.exports = {
  createCompanyStory,
  updateCompanyStory,
  deleteStoryImage,
  getCompanyStory,
  getAllStories,
};
