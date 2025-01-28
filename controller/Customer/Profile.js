const Customer = require("../../models/Customer"); // Adjust the path
const { uploadToS3, deleteFromS3 } = require("../../utils/s3FileUploader");
const { sendResponse } = require("../../utils/responseHandler");
const bcrypt = require("bcryptjs");

/**
 * Update Customer Profile
 */

exports.updateCustomerProfile = async (req, res) => {
  const customerId = req.user?.id;
  const { name, email, phone, newPassword } = req.body;
  console.log("Request Body:", req.body);
  const file = req.file;

  try {
    // Fetch the customer
    const customer = await Customer.findById(customerId);
    console.log("Customer Before Update:", customer);

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer not found.",
        data: null,
      });
    }

    // Password update logic
    if (newPassword) {
      console.log("New Password:", newPassword);
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(newPassword, salt);
      console.log("Hashed Password:", hashedPassword);
      customer.password = hashedPassword;
    }

    // Handle profile image update
    if (file) {
      if (customer.profile?.url) {
        await deleteFromS3(customer.profile.url);
      }
      const uploadedImage = await uploadToS3(
        file.buffer,
        file.originalname,
        file.mimetype,
        "customer-profiles"
      );
      customer.profile = {
        url: uploadedImage.url,
        publicId: uploadedImage.filename,
      };
    }

    // Update other fields
    if (name) customer.name = name;
    if (email) customer.email = email;
    if (phone) customer.phone = phone;

    // Save the updated customer
    const updatedCustomer = await customer.save();
    console.log("Updated Customer:", updatedCustomer);

    const responseData = {
      _id: updatedCustomer._id,
      name: updatedCustomer.name,
      email: updatedCustomer.email,
      phone: updatedCustomer.phone,
      profile: updatedCustomer.profile,
    };

    return res.status(200).json({
      success: true,
      message: "Profile updated successfully.",
      data: responseData,
    });
  } catch (error) {
    console.error("Error updating profile:", error);
    return res.status(500).json({
      success: false,
      message: "An unexpected error occurred while updating the profile.",
    });
  }
};

/**
 * API to delete profile image
 */
exports.deleteProfileImage = async (req, res) => {
  const customerId = req.user?.id; // Assuming user ID is passed in request

  try {
    // Find the customer by ID
    const customer = await Customer.findById(customerId);
    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer not found.",
      });
    }

    // Check if the customer has a profile image
    if (customer.profile?.url) {
      // Delete the image from S3
      await deleteFromS3(customer.profile.url); // Pass the URL directly to deleteFromS3

      // Remove the profile image URL from the customer profile
      customer.profile = null;

      // Save the updated customer profile
      const updatedCustomer = await customer.save();

      return res.status(200).json({
        success: true,
        message: "Profile image deleted successfully.",
        data: updatedCustomer, // Optionally return the updated customer
      });
    } else {
      return res.status(400).json({
        success: false,
        message: "No profile image found to delete.",
      });
    }
  } catch (error) {
    console.error("Error deleting profile image:", error);
    return res.status(500).json({
      success: false,
      message: "An unexpected error occurred while deleting the profile image.",
      error: error.message,
    });
  }
};

exports.getCustomerProfile = async (req, res) => {
  try {
    const userId = req.user?.id;

    // Fetch the customer profile, including the password
    const customer = await Customer.findById(userId);

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
    console.error("Error fetching customer profile:", error);
    sendResponse(
      res,
      500,
      false,
      null,
      "An error occurred while fetching customer profile"
    );
  }
};

exports.checkCustomerStatus = async (req, res) => {
  try {
    const userId = req.user?.id;
    const user = await Customer.findById(
      userId,
      "isCompany isInfluencer status"
    );

    if (!user) {
      return sendResponse(res, 404, false, "User not found");
    }

    const isCompanyVerified = user.isCompany?.verified || false;
    const isCompanyApplied = user.isCompany?.applied || false;
    const isInfluencerVerified = user.isInfluencer?.verified || false;
    const isInfluencerApplied = user.isInfluencer?.applied || false;

    console.log("isInfluencerVerified", isInfluencerVerified);
    console.log("isInfluencerApplied", isInfluencerApplied);

    return sendResponse(
      res,
      200,
      true,
      "Customer status fetched successfully",
      {
        status: user.status,
        isCompanyVerified,
        isCompanyApplied,
        isInfluencerVerified,
        isInfluencerApplied,
      }
    );
  } catch (error) {
    console.error("Error fetching customer status:", error.message);
    return sendResponse(res, 500, false, "Error fetching customer status");
  }
};
