const CustomerModel = require("../../models/Customer");
const { sendResponse } = require("../../utils/responseHandler");
const { createLogs } = require("../Company/Log");
const log = require("../../models/Logs");
const NotificationService = require("../../utils/notificationService");
const mongoose = require("mongoose");

// Function to get all customers who have applied as influencers
const getInfluencers = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = "" } = req.query;
    const skip = (page - 1) * limit;
    const searchCondition = {
      $or: [
        { email: { $regex: search, $options: "i" } },
        { name: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } },
      ],
    };

    // Aggregate pipeline for fetching influencers
    const influencers = await CustomerModel.aggregate([
      {
        $match: {
          "isInfluencer.applied": true,
          ...searchCondition,
        },
      },
      {
        $project: {
          _id: 1,
          email: 1,
          name: 1,
          phone: 1,
          profile: 1,
          isInfluencer: 1,
          influencerDetails: 1,
        },
      },
      {
        $skip: skip,
      },
      {
        $limit: parseInt(limit),
      },
    ]);

    // Get the total count of influencers for pagination
    const totalInfluencers = await CustomerModel.countDocuments({
      "isInfluencer.applied": true,
      ...searchCondition,
    });
    res.status(200).json({
      success: true,
      influencers,
      pagination: {
        totalItems: totalInfluencers,
        totalPages: Math.ceil(totalInfluencers / limit),
        currentPage: parseInt(page),
        perPage: parseInt(limit),
      },
    });
  } catch (error) {
    console.error("Error fetching influencers:", error);
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
};

const getInfluencersWithBadgeApplications = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = "" } = req.query;
    const skip = (page - 1) * limit;
    const searchCondition = {
      $or: [
        { email: { $regex: search, $options: "i" } },
        { name: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } },
      ],
    };

    // Aggregate pipeline for fetching influencers who applied for the badge
    const influencers = await CustomerModel.aggregate([
      {
        $match: {
          "isInfluencer.badgeStatus.applied": true, // Only those who applied for the badge
          ...searchCondition,
        },
      },
      {
        $project: {
          _id: 1,
          email: 1,
          name: 1,
          phone: 1,
          profile: 1,
          isInfluencer: 1,
          influencerDetails: 1,
        },
      },
      {
        $skip: skip,
      },
      {
        $limit: parseInt(limit),
      },
    ]);

    // Get the total count of influencers who applied for the badge for pagination
    const totalInfluencers = await CustomerModel.countDocuments({
      "isInfluencer.badgeStatus.applied": true,
      ...searchCondition,
    });

    res.status(200).json({
      success: true,
      influencers,
      pagination: {
        totalItems: totalInfluencers,
        totalPages: Math.ceil(totalInfluencers / limit),
        currentPage: parseInt(page),
        perPage: parseInt(limit),
      },
    });
  } catch (error) {
    console.error("Error fetching influencers:", error);
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
};

const updateInfluencerStatus = async (req, res) => {
  try {
    const { influencerId } = req.params;
    const { action } = req.body;
    const adminId = req.user?.id;

    const updatedInfluencer = await CustomerModel.findByIdAndUpdate(
      influencerId,
      {
        $set: {
          "isInfluencer.verified": action === "verified",
          "isInfluencer.rejected": action === "rejected",
        },
      },
      { new: true }
    );

    if (!updatedInfluencer) {
      return res.status(404).json({
        success: false,
        message: "Influencer not found",
      });
    }

    // Create log for the status change
    await createLogs({
      userId: adminId, // Admin who performed the action
      userModel: "Admin",
      targetId: influencerId, // Influencer affected by the action
      targetModel: "Influencer",
      action: `Influencer status updated to ${action}`,
    });

    // Send notification to the influencer
    const message =
      action === "verified"
        ? "Your influencer application has been verified by Prolio. Welcome aboard!"
        : "Your influencer application was rejected by Prolio. Please Contact support for details.";

    await NotificationService.createNotification({
      userId: influencerId,
      message,
      type: "status-update",
    });

    // Send success response
    res.status(200).json({
      success: true,
      message: `Influencer ${action} successfully`,
      influencer: updatedInfluencer,
    });
  } catch (error) {
    console.error("Error updating influencer status:", error);
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
};

const updateInfluencerBadgesStatus = async (req, res) => {
  try {
    const { influencerId } = req.params;
    const { action } = req.body; // Action should be 'verified', 'rejected', or another status
    const adminId = req.user?.id;

    if (!["verified", "rejected"].includes(action)) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid action. Allowed actions are 'verified' or 'rejected'.",
      });
    }

    // Update the influencer's badge status
    const updatedInfluencer = await CustomerModel.findByIdAndUpdate(
      influencerId,
      {
        $set: {
          "isInfluencer.badgeStatus.verified": action === "verified",
          "isInfluencer.badgeStatus.rejected": action === "rejected",
        },
      },
      { new: true }
    );

    if (!updatedInfluencer) {
      return res.status(404).json({
        success: false,
        message: "Influencer not found",
      });
    }

    // Create log for the status change
    await createLogs({
      userId: adminId, // Admin who performed the action
      userModel: "Admin",
      targetId: influencerId, // Influencer affected by the action
      targetModel: "Influencer",
      action: `Influencer status updated to ${action}`, // Log the action taken
    });

    // Create notification message based on the action
    let message;
    if (action === "verified") {
      message =
        "Congratulations! Your application for influencer badges has been successfully verified by Prolio.. Welcome aboard!";
    } else if (action === "rejected") {
      message =
        "We regret to inform you that your application for influencer badges was not approved by Prolio. Please contact support for details.";
    }

    // Send notification to the influencer
    await NotificationService.createNotification({
      userId: influencerId,
      message,
      type: "status-update",
    });

    // Send success response
    res.status(200).json({
      success: true,
      message: `Influencer ${action} successfully`,
      influencer: updatedInfluencer,
    });
  } catch (error) {
    console.error("Error updating influencer status:", error);
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
};

module.exports = {
  getInfluencers,
  updateInfluencerStatus,
  getInfluencersWithBadgeApplications,
  updateInfluencerBadgesStatus,
};
