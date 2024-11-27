const Customer = require("../../models/Customer"); // Adjust the path
const { uploadToS3, deleteFromS3 } = require("../../utils/s3FileUploader");
const { sendResponse } = require("../../utils/responseHandler");
const bcrypt = require("bcryptjs");

/**
 * Update Customer Profile
 */
exports.updateCustomerProfile = async (req, res) => {
  const customerId = req.user?.id; // Assuming JWT middleware attaches user info
  const updates = req.body;
  const file = req.file;

  try {
    // Fetch the customer by ID
    const customer = await Customer.findById(customerId);
    if (!customer) {
      return sendResponse(res, 404, false, null, "Customer not found.");
    }

    // Handle profile image update
    if (file) {
      // Delete old profile image if exists
      if (customer.profile?.url) {
        await deleteFromS3(customer.profile.url);
      }
      // Upload the new profile image to S3
      const uploadedImage = await uploadToS3(
        file.buffer,
        file.originalname,
        file.mimetype,
        "customer-profiles"
      );
      updates.profile = {
        url: uploadedImage.url,
        publicId: uploadedImage.filename,
      };
    }

    // Update password if provided
    if (updates.password) {
      const salt = await bcrypt.genSalt(10);
      updates.password = await bcrypt.hash(updates.password, salt);
    }

    // Update only allowed fields
    const allowedFields = ["name", "email", "phone", "profile", "password"];
    allowedFields.forEach((field) => {
      if (updates[field] !== undefined) {
        customer[field] = updates[field];
      }
    });

    // Save the updated customer document
    await customer.save();

    // Return the updated customer
    return sendResponse(
      res,
      200,
      true,
      customer,
      "Profile updated successfully."
    );
  } catch (error) {
    console.error("Error updating profile:", error);
    return sendResponse(res, 500, false, null, "Internal server error.");
  }
};

exports.getCustomerProfile = async (req, res) => {
  try {
    const userId = req.user?.id;

    // Exclude password field when fetching profile
    const customer = await Customer.findById(userId).select("-password");

    if (!customer) {
      return sendResponse(res, 404, false, null, "Customer not found");
    }

    sendResponse(
      res,
      200,
      true,
      customer,
      "Customer profile fetched successfully"
    );
  } catch (error) {
    sendResponse(
      res,
      500,
      false,
      null,
      "An error occurred while fetching customer profile"
    );
  }
};
