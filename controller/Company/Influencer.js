const Customer = require("../../models/Customer");
const ProductModel = require("../../models/Product");
const { sendResponse } = require("../../utils/responseHandler");
const NotificationService = require("../../utils/notificationService");
const mongoose = require("mongoose");

/**
 * Invite an Influencer
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */

exports.inviteInfluencer = async (req, res) => {
  const { influencerId } = req.body;
  try {
    // Extract companyId from req.user
    const companyId = req.user?.id;

    // Validate required fields
    if (!companyId || !influencerId) {
      return sendResponse(
        res,
        400,
        "Company ID (from user) and Influencer ID are required."
      );
    }

    // Find the company (must exist)
    const company = await Customer.findById(companyId);
    if (!company) {
      return sendResponse(res, 404, "Company not found.");
    }

    // Find the influencer (must exist)
    const influencer = await Customer.findById(influencerId);
    if (!influencer) {
      return sendResponse(res, 404, "Influencer not found.");
    }

    // Check if influencer has already been invited
    const existingInviteIndex = company.invitedInfluencers.findIndex(
      (invite) => invite.influencerId.toString() === influencerId
    );

    let notificationMessage = "";
    let notificationType = "";

    // If invitation is pending, remove it
    if (existingInviteIndex !== -1) {
      const existingInvite = company.invitedInfluencers[existingInviteIndex];
      if (existingInvite.status === "pending") {
        // Remove the invitation
        company.invitedInfluencers.splice(existingInviteIndex, 1);
        await company.save();
        const companyName = company.companyDetails.companyInfo.companyName;

        // Notification Message for removing invitation
        notificationMessage = `${companyName} has canceled your invitation.`;
        notificationType = "invitation_cancelled";
        await NotificationService.createNotification({
          userId: influencerId,
          message: notificationMessage,
          type: notificationType,
        });

        return sendResponse(res, 200, "Invitation removed successfully.");
      } else {
        return sendResponse(res, 400, "Influencer already has a response.");
      }
    }

    // Add invitation to the company's invitedInfluencers if not already invited
    company.invitedInfluencers.push({
      influencerId,
      status: "pending",
      invitationDate: new Date(),
    });

    // Save the updated company document
    await company.save();

    // Notification Message for sending invitation
    const companyName = company.companyDetails.companyInfo.companyName;
    notificationMessage = `🎉 You're invited! ${companyName} wants to collaborate with you.`;
    notificationType = "invitation_sent";
    await NotificationService.createNotification({
      userId: influencerId,
      message: notificationMessage,
      type: notificationType,
    });

    return sendResponse(res, 201, "Invitation sent successfully.");
  } catch (error) {
    console.error("Error inviting influencer:", error);
    return sendResponse(res, 500, "Internal server error.", error.message);
  }
};

exports.getCompanyPromotionRequests = async (req, res) => {
  try {
    const companyId = req.user?.id;
    if (!companyId) {
      return sendResponse(res, 400, "User not authenticated.");
    }

    // Step 1: Find the company's products
    const products = await ProductModel.find({ ownerId: companyId }).select(
      "_id productRequests"
    );
    if (!products.length) {
      return sendResponse(res, 404, "No products found for this company.");
    }

    // Initialize global status counts
    let globalStatusCounts = {
      pending: 0,
      accepted: 0,
      rejected: 0,
    };

    // Step 2: Extract promotion requests from each product and populate influencer details
    const productRequestsPromises = products.map(async (product) => {
      const productRequests = await ProductModel.findById(product._id).populate(
        {
          path: "productRequests.influencerId",
          model: "Customer",
        }
      );

      // Calculate the counts of "pending", "accepted", and "rejected" statuses for this product
      const statusCounts = productRequests.productRequests.reduce(
        (acc, request) => {
          if (request.status === "pending") acc.pending++;
          if (request.status === "accepted") acc.accepted++;
          if (request.status === "rejected") acc.rejected++;

          // Update global status counts
          globalStatusCounts.pending += request.status === "pending" ? 1 : 0;
          globalStatusCounts.accepted += request.status === "accepted" ? 1 : 0;
          globalStatusCounts.rejected += request.status === "rejected" ? 1 : 0;

          return acc;
        },
        { pending: 0, accepted: 0, rejected: 0 }
      );

      // Return the populated product requests along with status counts
      return {
        productId: product._id,
        influencerRequests: productRequests.productRequests.map((request) => ({
          influencerId: request.influencerId, // Full influencer document
          status: request.status,
          requestedDate: request.requestedDate,
          rejectedReason: request.rejectedReason,
          influencerName: request.influencerId.name,
        })),
        statusCounts, // Adding the counts for this product
      };
    });

    // Use Promise.all to fetch all requests concurrently
    const productRequestsArrays = await Promise.all(productRequestsPromises);

    // Flatten the array to get all promotion requests in one array
    const promotionRequests = productRequestsArrays.flat();

    // Step 3: Check if there are any promotion requests
    if (!promotionRequests.length) {
      return sendResponse(
        res,
        404,
        "No promotion requests found for the company's products."
      );
    }

    // Step 4: Return the promotion requests with full influencer details, status counts for each product,
    // and global status counts
    return sendResponse(
      res,
      200,
      "Promotion requests retrieved successfully.",
      {
        promotionRequests,
        globalStatusCounts, // Include the global status counts
      }
    );
  } catch (error) {
    console.error(error);
    return sendResponse(res, 500, "Server error.");
  }
};

// Function to fetch influencers
exports.getMyInfluencers = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = "" } = req.query;
    const userId = req.user?.id;
    const skip = (page - 1) * limit;

    if (!userId) {
      return sendResponse(res, 400, false, "User ID is required");
    }

    const influencers = await Customer.aggregate([
      {
        $match: {
          _id: new mongoose.Types.ObjectId(userId),
        },
      },
      {
        $unwind: "$companyInfluencers",
      },
      {
        $lookup: {
          from: "customers",
          localField: "companyInfluencers.influencerId",
          foreignField: "_id",
          as: "influencerData",
        },
      },
      {
        $unwind: "$influencerData",
      },
      {
        $match: {
          "influencerData.isInfluencer.applied": true,
          $or: [
            { "influencerData.email": { $regex: search, $options: "i" } },
            { "influencerData.name": { $regex: search, $options: "i" } },
            { "influencerData.phone": { $regex: search, $options: "i" } },
          ],
        },
      },
      {
        $project: {
          _id: "$influencerData._id",
          email: "$influencerData.email",
          name: "$influencerData.name",
          phone: "$influencerData.phone",
          profile: "$influencerData.profile",
          isInfluencer: "$influencerData.isInfluencer",
          influencerDetails: "$influencerData.influencerDetails",
          status: "$companyInfluencers.status",
          assignedDate: "$companyInfluencers.assignedDate",
        },
      },
      {
        $sort: { assignedDate: -1 },
      },
      {
        $skip: parseInt(skip),
      },
      {
        $limit: parseInt(limit),
      },
    ]);

    const totalCount = await Customer.aggregate([
      {
        $match: {
          _id: new mongoose.Types.ObjectId(userId),
        },
      },
      {
        $unwind: "$companyInfluencers",
      },
      {
        $lookup: {
          from: "customers",
          localField: "companyInfluencers.influencerId",
          foreignField: "_id",
          as: "influencerData",
        },
      },
      {
        $unwind: "$influencerData",
      },
      {
        $match: {
          "influencerData.isInfluencer.applied": true,
          $or: [
            { "influencerData.email": { $regex: search, $options: "i" } },
            { "influencerData.name": { $regex: search, $options: "i" } },
            { "influencerData.phone": { $regex: search, $options: "i" } },
          ],
        },
      },
      {
        $count: "total",
      },
    ]);

    const total = totalCount[0]?.total || 0;

    const data = {
      influencers: influencers || [],
      pagination: {
        totalItems: total,
        totalPages: Math.ceil(total / limit),
        currentPage: parseInt(page),
        perPage: parseInt(limit),
      },
    };

    return sendResponse(
      res,
      200,
      true,
      "Company influencers fetched successfully",
      data
    );
  } catch (error) {
    console.error("Error fetching company influencers:", error);
    return sendResponse(res, 500, false, "Internal Server Error");
  }
};
