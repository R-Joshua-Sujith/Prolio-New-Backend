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
          influencerCompanies: 1,
          invitedInfluencers: 1,
          sentRequests: 1,
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
    const { action, rejectedReason } = req.body;
    const adminId = req.user?.id;

    if (!["verified", "rejected"].includes(action)) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid action. Allowed actions are 'verified' or 'rejected'.",
      });
    }
    // Validate rejectedReason for rejected status
    if (action === "rejected" && !rejectedReason) {
      return res.status(400).json({
        success: false,
        message: "Rejection reason is required when the status is 'rejected'.",
      });
    }

    const updatedInfluencer = await CustomerModel.findByIdAndUpdate(
      influencerId,
      {
        $set: {
          "isInfluencer.verified": action === "verified",
          "isInfluencer.rejected": action === "rejected",
          "isInfluencer.rejectedReason":
            action === "rejected" ? rejectedReason : null,
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
    const { action, rejectedReason } = req.body;
    const adminId = req.user?.id;

    // Validate action
    if (!["verified", "rejected"].includes(action)) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid action. Allowed actions are 'verified' or 'rejected'.",
      });
    }

    // Validate rejectedReason for rejected status
    if (action === "rejected" && !rejectedReason) {
      return res.status(400).json({
        success: false,
        message: "Rejection reason is required when the status is 'rejected'.",
      });
    }

    // Prepare update data
    const updateData = {
      "isInfluencer.badgeStatus.verified": action === "verified",
      "isInfluencer.badgeStatus.rejected": action === "rejected",
      "isInfluencer.badgeStatus.rejectedReason":
        action === "rejected" ? rejectedReason : null,
    };

    // Update influencer
    const updatedInfluencer = await CustomerModel.findByIdAndUpdate(
      influencerId,
      { $set: updateData },
      { new: true }
    );

    if (!updatedInfluencer) {
      return res.status(404).json({
        success: false,
        message: "Influencer not found",
      });
    }

    // Create log
    await createLogs({
      userId: adminId,
      userModel: "Admin",
      targetId: influencerId,
      targetModel: "Influencer",
      action: `Influencer status updated to ${action}`,
    });

    // Create notification message
    const message =
      action === "verified"
        ? "Congrats! Your badge application has been verified by Prolio. Welcome aboard!"
        : `Your badge application was rejected by Prolio. Please Contact support for details.`;
    // Send notification
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
