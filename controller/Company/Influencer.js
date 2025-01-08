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
        notificationMessage = `${companyName} has declined your invitation.`;
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
    notificationMessage = `You're invited! ${companyName} wants to collaborate with you.`;
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

    const {
      page = 1,
      pageSize = 10,
      search = "",
      status = "pending",
    } = req.query;

    const pageNum = parseInt(page);
    const limit = parseInt(pageSize);
    const skip = (pageNum - 1) * limit;

    const products = await ProductModel.find({ ownerId: companyId }).select(
      "_id"
    );

    if (!products.length) {
      return sendResponse(res, 404, "No products found for this company.");
    }

    const productIds = products.map((product) => product._id);

    const baseMatchStage = { _id: { $in: productIds } };
    const statusMatchStage = { "productRequests.status": status };

    const searchMatchStage = search
      ? {
          $or: [
            { "influencerDetails.name": { $regex: search, $options: "i" } },
            { "influencerDetails.email": { $regex: search, $options: "i" } },
            { "influencerDetails.contact": { $regex: search, $options: "i" } },
          ],
        }
      : {};

    const aggregationPipeline = [
      { $match: baseMatchStage },
      { $unwind: "$productRequests" },
      {
        $lookup: {
          from: "customers",
          localField: "productRequests.influencerId",
          foreignField: "_id",
          as: "influencerDetails",
        },
      },
      { $unwind: "$influencerDetails" },
      {
        $match: {
          $and: [statusMatchStage, searchMatchStage],
        },
      },
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

    const totalItems = await ProductModel.aggregate([
      ...aggregationPipeline,
      { $count: "total" },
    ]);

    const requests = await ProductModel.aggregate([
      ...aggregationPipeline,
      { $skip: skip },
      { $limit: limit },
    ]);

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

exports.getAllInfluencers = async (req, res) => {
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
    const influencers = await Customer.aggregate([
      {
        $match: {
          "isInfluencer.applied": true,
          "isInfluencer.verified": true, // Only verified influencers
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
    const totalInfluencers = await Customer.countDocuments({
      "isInfluencer.applied": true,
      "isInfluencer.verified": true, // Only verified influencers
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

exports.getCompanyInfluencersAndInvites = async (req, res) => {
  try {
    // Extract companyId from req.user
    const companyId = req.user?.id;

    // Validate companyId
    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: "Company ID is required.",
      });
    }

    // Find company with populated influencers
    const company = await Customer.findById(companyId)
      .populate({
        path: "companyInfluencers",
        select: "influencerId status",
      })
      .populate({
        path: "invitedInfluencers",
        select: "influencerId status",
      });

    // Check if the company exists
    if (!company) {
      return res.status(404).json({
        success: false,
        message: "Company not found.",
      });
    }

    // Format the response to include populated details
    const companyInfluencers = company.companyInfluencers.map((item) => ({
      ...item.toObject(),
      influencerDetails: item.influencerId,
    }));

    const invitedInfluencers = company.invitedInfluencers.map((item) => ({
      ...item.toObject(),
      influencerDetails: item.influencerId,
    }));

    // Send response
    res.status(200).json({
      success: true,
      message:
        "Company influencers and invited influencers fetched successfully.",
      data: {
        companyId: company._id,
        companyName: company.companyDetails?.companyInfo?.companyName || "",
        companyInfluencers,
        invitedInfluencers,
      },
    });
  } catch (error) {
    console.error("Error fetching company influencers and invites:", error);
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
};

exports.getCompanyActiveProducts = async (req, res) => {
  try {
    const companyId = req.user?.id;
    const { influencerId } = req.query; // Changed from req.params to req.query

    if (!companyId) {
      return sendResponse(res, 401, false, "User ID not found");
    }

    // Base query for active products
    const query = {
      ownerId: companyId,
      status: "Active",
      "block.isBlocked": false,
    };

    // Add influencer filter if influencerId is provided
    if (influencerId) {
      if (!mongoose.Types.ObjectId.isValid(influencerId)) {
        return sendResponse(res, 400, false, "Invalid influencer ID");
      }

      // Check if influencer exists and is verified
      const influencer = await Customer.findOne({
        _id: influencerId,
        "isInfluencer.verified": true,
      });

      if (!influencer) {
        return sendResponse(
          res,
          404,
          false,
          "Influencer not found or not verified"
        );
      }

      // Add condition to exclude products already assigned to this influencer
      query.productAssign = {
        $not: {
          $elemMatch: {
            influencerId: new mongoose.Types.ObjectId(influencerId),
            status: { $in: ["accepted", "pending"] },
          },
        },
      };
    }

    const activeProducts = await ProductModel.find(query)
      .select("basicDetails images category totalViews shareCount")
      .lean();

    return sendResponse(
      res,
      200,
      true,
      "Active products retrieved successfully",
      activeProducts
    );
  } catch (error) {
    console.error("Error fetching active products:", error);
    return sendResponse(
      res,
      500,
      false,
      "Failed to fetch active products",
      error.message
    );
  }
};

exports.removeAssignedProduct = async (req, res) => {
  try {
    const companyId = req.user?.id;
    const { productId, influencerId } = req.body;

    if (!companyId || !productId || !influencerId) {
      return sendResponse(res, 400, false, "Missing required fields");
    }

    // Validate ObjectIds
    if (
      !mongoose.Types.ObjectId.isValid(productId) ||
      !mongoose.Types.ObjectId.isValid(influencerId)
    ) {
      return sendResponse(res, 400, false, "Invalid product or influencer ID");
    }

    // Find and update the product
    const product = await ProductModel.findOneAndUpdate(
      {
        _id: productId,
        ownerId: companyId,
        "productAssign.influencerId": influencerId,
      },
      {
        $pull: {
          productAssign: {
            influencerId: influencerId,
          },
        },
      },
      { new: true }
    );

    if (!product) {
      return sendResponse(res, 404, false, "Product assignment not found");
    }

    return sendResponse(res, 200, true, "Product unassigned successfully", {
      productId,
      influencerId,
    });
  } catch (error) {
    console.error("Error removing assigned product:", error);
    return sendResponse(res, 500, false, "Failed to remove product assignment");
  }
};
