const bcrypt = require("bcrypt");
const CustomerModel = require("../../models/Customer");
const { uploadToS3, deleteFromS3 } = require("../../utils/s3FileUploader");
const { sendResponse } = require("../../utils/responseHandler");

const fetchUserDetails = async (req, res) => {
  try {
    const { userId } = req.user;
    const userData = await CustomerModel.findById(userId);
    if (!userData) {
      return sendResponse(res, 404, false, "User not found");
    }
    sendResponse(
      res,
      200,
      true,
      "User details fetched successfully",
      userData.toObject()
    );
  } catch (error) {
    console.error("Error fetching user details:", error.message);
    sendResponse(res, 500, false, "Error fetching user details", {
      details: error.message,
    });
  }
};

const fetchAllUserDetails = async (req, res) => {
  try {
    const users = await CustomerModel.find();
    if (!users || users.length === 0) {
      return sendResponse(res, 404, false, "No users found");
    }
    sendResponse(
      res,
      200,
      true,
      "All user details fetched successfully",
      users
    );
  } catch (error) {
    console.error("Error fetching all user details:", error.message);
    sendResponse(res, 500, false, "Error fetching all user details", {
      details: error.message,
    });
  }
};

const checkUserRole = async (req, res) => {
  try {
    const { userId } = req.user;
    const user = await CustomerModel.findById(userId);
    if (!user) {
      return sendResponse(res, 404, false, "User not found");
    }
    if (!user.role) {
      return sendResponse(res, 404, false, "Role not found for this user");
    }
    sendResponse(res, 200, true, "User role found successfully", {
      role: user.role,
    });
  } catch (error) {
    console.error("Error checking user role:", error.message);
    sendResponse(res, 500, false, "Error checking user role", {
      details: error.message,
    });
  }
};

const updateUserProfile = async (req, res) => {
  try {
    const { userId } = req.user;
    const { name, email, phone, password } = req.body;

    const updatedFields = {};
    if (name) updatedFields.name = name;
    if (email) updatedFields.email = email;
    if (phone) updatedFields.phone = phone;

    if (password) {
      const hashedPassword = await bcrypt.hash(password, 10);
      updatedFields.password = hashedPassword;
    }

    if (req.file) {
      const s3Response = await uploadToS3(req.file);
      if (!s3Response || !s3Response.url || !s3Response.publicId) {
        return sendResponse(res, 500, false, "Image upload to S3 failed");
      }

      const user = await CustomerModel.findById(userId);
      if (!user) {
        return sendResponse(res, 404, false, "User not found");
      }

      // Delete the previous image from S3 (if exists)
      if (user.profile?.publicId) {
        await deleteFromS3(user.profile.publicId);
      }
      updatedFields.profile = {
        url: s3Response.url,
        publicId: s3Response.publicId,
      };
    }
    const updatedUser = await CustomerModel.findByIdAndUpdate(
      userId,
      updatedFields,
      { new: true }
    );
    if (!updatedUser) {
      return sendResponse(res, 404, false, "User not found");
    }
    sendResponse(
      res,
      200,
      true,
      "User profile updated successfully",
      updatedUser
    );
  } catch (error) {
    console.error("Error updating user profile:", error.message);
    sendResponse(res, 500, false, "Error updating user profile", {
      details: error.message,
    });
  }
};

module.exports = {
  fetchUserDetails,
  fetchAllUserDetails,
  checkUserRole,
  updateUserProfile,
};
