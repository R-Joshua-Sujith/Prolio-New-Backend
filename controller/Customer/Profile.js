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
    const isInfluencerVerified = user.isInfluencer?.verified || false;
    console.log("isInfluencerVerified", isInfluencerVerified);

    return sendResponse(res, 200, true, "Company status fetched successfully", {
      status: user.status,
      isCompanyVerified,
      isInfluencerVerified,
    });
  } catch (error) {
    console.error("Error fetching company status:", error.message);
    return sendResponse(res, 500, false, "Error fetching company status");
  }
};
