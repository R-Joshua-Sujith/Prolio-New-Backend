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

    // Extract query parameters
    const {
      page = 1,
      pageSize = 10,
      search = "",
      status = "pending",
    } = req.query;

    // Convert page and pageSize to numbers
    const pageNum = parseInt(page);
    const limit = parseInt(pageSize);
    const skip = (pageNum - 1) * limit;

    // Find the company's products
    const products = await ProductModel.find({ ownerId: companyId }).select(
      "_id productRequests"
    );

    if (!products.length) {
      return sendResponse(res, 404, "No products found for this company.");
    }

    // Get all product IDs
    const productIds = products.map((product) => product._id);

    // Build the search query
    const searchQuery = search
      ? {
          $or: [
            { "influencerId.name": { $regex: search, $options: "i" } },
            { "influencerId.email": { $regex: search, $options: "i" } },
          ],
        }
      : {};

    // Aggregate to get filtered and paginated results
    const aggregationPipeline = [
      // Match products owned by the company
      { $match: { _id: { $in: productIds } } },

      // Unwind the productRequests array
      { $unwind: "$productRequests" },

      // Lookup to get influencer details
      {
        $lookup: {
          from: "customers",
          localField: "productRequests.influencerId",
          foreignField: "_id",
          as: "influencerDetails",
        },
      },

      // Unwind the looked up influencer
      { $unwind: "$influencerDetails" },

      // Match status and search criteria
      {
        $match: {
          "productRequests.status": status,
          ...searchQuery,
        },
      },

      // Project the required fields
      {
        $project: {
          productId: "$_id",
          influencerId: "$influencerDetails",
          status: "$productRequests.status",
          requestedDate: "$productRequests.requestedDate",
          rejectedReason: "$productRequests.rejectedReason",
        },
      },
    ];

    // Execute aggregation for total count
    const totalItems = await ProductModel.aggregate([
      ...aggregationPipeline,
      { $count: "total" },
    ]);

    // Add pagination to the pipeline
    const paginatedPipeline = [
      ...aggregationPipeline,
      { $skip: skip },
      { $limit: limit },
    ];

    // Execute the paginated aggregation
    const requests = await ProductModel.aggregate(paginatedPipeline);

    // Calculate status counts
    const statusCounts = {
      pending: 0,
      accepted: 0,
      rejected: 0,
    };

    requests.forEach((request) => {
      statusCounts[request.status]++;
    });

    return sendResponse(
      res,
      200,
      "Promotion requests retrieved successfully.",
      {
        promotionRequests: requests,
        pagination: {
          currentPage: pageNum,
          totalPages: Math.ceil((totalItems[0]?.total || 0) / limit),
          totalItems: totalItems[0]?.total || 0,
          pageSize: limit,
        },
        statusCounts,
      }
    );
  } catch (error) {
    console.error(error);
    return sendResponse(res, 500, "Server error.");
  }
};

// Function to handle accepting or rejecting influencer requests
// exports.toggleRequestStatus = async (req, res) => {
//   const { productId, influencerId } = req.params;
//   const { action, rejectedReason } = req.body;

//   try {
//     // Find the product by ID
//     const product = await ProductModel.findById(productId);
//     if (!product) {
//       return res.status(404).json({ message: "Product not found" });
//     }
//     const requestIndex = product.productRequests.findIndex(
//       (req) => req.influencerId.toString() === influencerId
//     );
//     if (requestIndex === -1) {
//       return res.status(404).json({ message: "Request not found" });
//     }

//     // Get the influencer's request
//     const request = product.productRequests[requestIndex];

//     if (action === "accepted") {
//       // If the request is accepted, check if it's already accepted
//       if (request.status === "accepted") {
//         // If it's already accepted, reject the request and remove the influencer from the company
//         product.productRequests[requestIndex].status = "rejected";
//         product.productRequests[requestIndex].rejectedReason = rejectedReason;

//         // Remove influencer from companyInfluencers in Customer model
//         const company = await Customer.findOne({
//           _id: product.ownerId,
//           "companyInfluencers.influencerId": influencerId,
//         });

//         if (company) {
//           const influencerIndex = company.companyInfluencers.findIndex(
//             (inf) => inf.influencerId.toString() === influencerId
//           );

//           if (influencerIndex !== -1) {
//             company.companyInfluencers.splice(influencerIndex, 1); // Remove the influencer
//             await company.save();
//           }
//         }

//         await product.save();

//         return res.status(200).json({
//           message: "Request rejected and influencer removed from company.",
//         });
//       }

//       // If the request was pending, accept it
//       product.productRequests[requestIndex].status = "accepted";
//       product.productRequests[requestIndex].assignedDate = new Date();

//       // Add influencer to companyInfluencers array in Customer model
//       const company = await Customer.findById(product.ownerId);
//       if (!company) {
//         return res.status(404).json({ message: "Company not found" });
//       }

//       // Check if the influencer is already in companyInfluencers
//       const influencerExists = company.companyInfluencers.some(
//         (inf) => inf.influencerId.toString() === influencerId
//       );
//       if (!influencerExists) {
//         // If influencer doesn't already exist, add to the companyInfluencers array
//         company.companyInfluencers.push({
//           influencerId: influencerId,
//           status: "accepted",
//           assignedDate: new Date(),
//         });

//         await company.save();
//       }

//       await product.save();

//       return res
//         .status(200)
//         .json({ message: "Request accepted, influencer added to company" });
//     }

//     if (action === "rejected") {
//       // Reject the request and store the rejection reason
//       product.productRequests[requestIndex].status = "rejected";
//       product.productRequests[requestIndex].rejectedReason = rejectedReason;

//       // Remove influencer from companyInfluencers if exists
//       const company = await Customer.findOne({
//         _id: product.ownerId,
//         "companyInfluencers.influencerId": influencerId,
//       });

//       if (company) {
//         const influencerIndex = company.companyInfluencers.findIndex(
//           (inf) => inf.influencerId.toString() === influencerId
//         );

//         if (influencerIndex !== -1) {
//           company.companyInfluencers.splice(influencerIndex, 1); // Remove the influencer
//           await company.save();
//         }
//       }

//       await product.save();

//       return res.status(200).json({
//         message: "Request rejected and influencer removed from company.",
//       });
//     }

//     return res.status(400).json({ message: "Invalid action" });
//   } catch (error) {
//     console.error(error);
//     return res.status(500).json({ message: "Server error" });
//   }
// };

exports.toggleRequestStatus = async (req, res) => {
  const { productId, influencerId } = req.params;
  const { action, rejectedReason } = req.body;

  try {
    // Find the product by ID
    const product = await ProductModel.findById(productId);
    if (!product) return res.status(404).json({ message: "Product not found" });

    const requestIndex = product.productRequests.findIndex(
      (req) => req.influencerId.toString() === influencerId
    );
    if (requestIndex === -1)
      return res.status(404).json({ message: "Request not found" });

    const request = product.productRequests[requestIndex];

    const company = await Customer.findById(product.ownerId);
    if (!company) return res.status(404).json({ message: "Company not found" });

    // Reusable logic to remove influencer from companyInfluencers
    const removeInfluencerFromCompany = async () => {
      const companyUpdate = await Customer.findOne({
        _id: product.ownerId,
        "companyInfluencers.influencerId": influencerId,
      });
      if (companyUpdate) {
        const influencerIndex = companyUpdate.companyInfluencers.findIndex(
          (inf) => inf.influencerId.toString() === influencerId
        );
        if (influencerIndex !== -1) {
          companyUpdate.companyInfluencers.splice(influencerIndex, 1); // Remove the influencer
          await companyUpdate.save();
        }
      }
    };

    // Process action
    if (action === "accepted") {
      // If the request is already accepted, reject it and remove influencer
      request.status = request.status === "accepted" ? "rejected" : "accepted";
      request.rejectedReason =
        request.status === "rejected" ? rejectedReason : undefined;
      request.status === "rejected" && (await removeInfluencerFromCompany());
      request.status === "accepted" && (request.assignedDate = new Date());

      // Add influencer to companyInfluencers only if accepting the request
      if (request.status === "accepted") {
        const influencerExists = company.companyInfluencers.some(
          (inf) => inf.influencerId.toString() === influencerId
        );
        if (!influencerExists) {
          company.companyInfluencers.push({
            influencerId: influencerId,
            status: "accepted",
            assignedDate: new Date(),
          });
          await company.save();
        }
      }

      await product.save();
      return res.status(200).json({
        message:
          request.status === "accepted"
            ? "Request accepted, influencer added to company"
            : "Request rejected and influencer removed from company.",
      });
    }

    if (action === "rejected") {
      request.status = "rejected";
      request.rejectedReason = rejectedReason;
      await removeInfluencerFromCompany();
      await product.save();

      return res.status(200).json({
        message: "Request rejected and influencer removed from company.",
      });
    }

    return res.status(400).json({ message: "Invalid action" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Server error" });
  }
};
