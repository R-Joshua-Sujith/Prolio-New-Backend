const CustomerModel = require("../../models/Customer");
const { sendResponse } = require("../../utils/responseHandler");
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

const updateInfluencerStatus = async (req, res) => {
  try {
    const { influencerId } = req.params;
    const { action } = req.body; // 'verified' or 'rejected'

    // Validate action input
    // if (!["verified", "rejected"].includes(action)) {
    //   return res.status(400).json({
    //     success: false,
    //     message: "Invalid action. Use 'verified' or 'rejected'.",
    //   });
    // }

    // Update the influencer's status
    const updatedInfluencer = await CustomerModel.findByIdAndUpdate(
      influencerId,
      {
        $set: {
          "isInfluencer.verified": action === "verified",
          "isInfluencer.rejected": action === "rejected",
        },
      },
      { new: true } // Return the updated document
    );

    // Check if the influencer exists
    if (!updatedInfluencer) {
      return res.status(404).json({
        success: false,
        message: "Influencer not found",
      });
    }

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
};
