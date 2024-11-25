const Customer = require("../../models/Customer"); // Adjust the path
const { uploadToS3, deleteFromS3 } = require("../../utils/s3FileUploader");
const { sendResponse } = require("../../utils/responseHandler");

/**
 * Update Customer Profile
 */
exports.updateCustomerProfile = async (req, res) => {
  const customerId = req.user?.id;
  //   const customerId = req.user?.id;
  const updates = req.body;
  const file = req.file;
  try {
    const customer = await Customer.findById(customerId);
    if (!customer) {
      return sendResponse(res, 404, false, null, "Customer not found.");
    }
    if (file) {
      if (customer.profile?.url) {
        await deleteFromS3(customer.profile.url);
      }
      // Upload the new image to S3
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
    // Update only the provided fields
    for (const key in updates) {
      if (updates[key] !== undefined) {
        customer[key] = updates[key];
      }
    }
    // Save the updated customer document
    await customer.save();

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

exports.getCustomerDetails = async (req, res) => {
  try {
    const userId = req.user?.id;
    // const userId = req.user.id;
    const user = await Customer.findById(userId, "email name status profile");
    if (!user) {
      return sendResponse(res, 404, false, "Customer not found");
    }
    return sendResponse(
      res,
      200,
      true,
      "Customer details retrieved successfully",
      { customer: user }
    );
  } catch (error) {
    console.error("Error fetching customer details:", error);
    return sendResponse(
      res,
      500,
      false,
      "Failed to fetch customer details",
      error.message
    );
  }
};
