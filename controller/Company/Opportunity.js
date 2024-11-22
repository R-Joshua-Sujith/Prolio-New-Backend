const OpportunityModel = require("../../models/Opportunity");
const CustomerModel = require("../../models/Customer");
const ProductModel = require("../../models/Product");
const mongoose = require("mongoose");

// View Opportunity for specific Producct
const viewProductOpportunities = async (req, res) => {
  try {
    // Simulate getting the logged-in owner's ID (replace with actual auth method)
    const ownerId = "6735e1fe6fc1600f43aea060"; // Replace with actual auth method

    // Get productId from params or query
    const productId = "67364cf9106f770f98c275bf"; // Replace with req.params.productId or req.query.productId

    // Verify the product belongs to the owner
    const product = await ProductModel.findOne({
      _id: productId,
      ownerId: ownerId,
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message:
          "Product not found or you don't have permission to view its opportunities",
      });
    }

    // Parse query parameters with defaults
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const status = req.query.status;

    // Build query for opportunities
    const query = {
      productId: productId,
      ownerId: ownerId,
    };

    // Add status filter if provided
    if (status && ["Processing", "Approved", "Rejected"].includes(status)) {
      query.status = status;
    }

    // Calculate skip value for pagination
    const skip = (page - 1) * limit;

    // Get total count for pagination
    const totalCount = await OpportunityModel.countDocuments(query);

    // Get opportunities
    const opportunities = await OpportunityModel.find(query)
      .populate({
        path: "customerId",
        select: "name email phone profilePicture",
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .exec();

    // Get statistics for this product
    const statistics = await OpportunityModel.aggregate([
      {
        $match: {
          productId: new mongoose.Types.ObjectId(productId), // Fixed: Added 'new' keyword
          ownerId: new mongoose.Types.ObjectId(ownerId), // Fixed: Added 'new' keyword
        },
      },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
          averageExperience: {
            $avg: {
              $convert: {
                input: "$yearsOfExp",
                to: "double",
                onError: null,
                onNull: null,
              },
            },
          },
        },
      },
    ]);

    // Format statistics
    const formattedStats = {
      total: totalCount,
      byStatus: {
        Processing: 0,
        Approved: 0,
        Rejected: 0,
      },
      averageExperience: 0,
    };

    let totalExpYears = 0;
    let validExpCount = 0;

    statistics.forEach((stat) => {
      formattedStats.byStatus[stat._id] = stat.count;
      if (stat.averageExperience) {
        totalExpYears += stat.averageExperience * stat.count;
        validExpCount += stat.count;
      }
    });

    if (validExpCount > 0) {
      formattedStats.averageExperience = (
        totalExpYears / validExpCount
      ).toFixed(1);
    }

    // Calculate pagination info
    const totalPages = Math.ceil(totalCount / limit);

    // Return response
    return res.status(200).json({
      success: true,
      data: {
        opportunities: opportunities,
        statistics: formattedStats,
        pagination: {
          currentPage: page,
          totalPages: totalPages,
          totalItems: totalCount,
          itemsPerPage: limit,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1,
        },
      },
    });
  } catch (error) {
    console.error("Error fetching product opportunities:", error);
    return res.status(500).json({
      success: false,
      message: "An error occurred while fetching product opportunities",
      error: error.message,
    });
  }
};

// View SingleOppurtunity
const viewSingleOpportunityOwner = async (req, res) => {
  try {
    // Simulate getting the logged-in owner's ID (replace with actual auth method)
    const ownerId = "67371e8a425771ce15f098df"; // Replace with actual auth logic

    // Get opportunityId from params
    const opportunityId = "673722b052d03f444f697ec6"; // Replace with req.params.opportunityId

    // Find the opportunity and populate necessary fields
    const opportunity = await OpportunityModel.findOne({
      _id: opportunityId,
      ownerId: ownerId, // Add owner verification
    })
      .populate({
        path: "customerId",
        select: "name email phone profilePicture",
      })
      .populate({
        path: "productId",
        select: "name description price",
      })
      .exec();

    // If no opportunity found or doesn't belong to owner
    if (!opportunity) {
      return res.status(404).json({
        success: false,
        message:
          "Opportunity not found or you don't have permission to view it",
      });
    }

    // Return the opportunity with verified ownership
    res.status(200).json({
      success: true,
      data: {
        opportunity: {
          _id: opportunity._id,
          customer: opportunity.customerId,
          product: opportunity.productId,
          opportunity_role: opportunity.opportunity_role,
          address: opportunity.address,
          yearsOfExp: opportunity.yearsOfExp,
          memo: opportunity.memo,
          status: opportunity.status,
          remarks: opportunity.remarks,
          createdAt: opportunity.createdAt,
          updatedAt: opportunity.updatedAt,
          ownerId: opportunity.ownerId, // Include ownerId in response for transparency
        },
      },
    });
  } catch (error) {
    console.error("Error fetching single opportunity:", error);
    res.status(500).json({
      success: false,
      message: "An error occurred while fetching the opportunity",
      error: error.message,
    });
  }
};

// Accept or Reject opportunity
const updateOpportunityStatus = async (req, res) => {
  try {
    const opportunityId = "673ec7e0bd9b3ed5f160f1d0";
    const ownerId = "6735e1fe6fc1600f43aea060";
    const { status, remarks, force = false } = req.body; // Add force parameter

    // Validate input
    if (!["Approved", "Rejected"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status. Must be either Approved or Rejected",
      });
    }

    // Find the opportunity and verify ownership
    const opportunity = await OpportunityModel.findById(opportunityId).populate(
      "productId",
      "ownerId"
    );

    if (!opportunity) {
      return res.status(404).json({
        success: false,
        message: "Opportunity not found",
      });
    }

    // Verify if the logged-in user is the product owner
    if (opportunity.productId.ownerId.toString() !== ownerId) {
      return res.status(403).json({
        success: false,
        message: "Access denied. Only product owner can update status",
      });
    }

    // Check if opportunity is already processed and force is not enabled
    if (opportunity.status !== "Processing" && !force) {
      return res.status(400).json({
        success: false,
        message: `Cannot update status. Opportunity is already ${opportunity.status}. Use force=true to override.`,
      });
    }

    // Update the opportunity status
    opportunity.status = status;
    if (remarks) {
      opportunity.remarks = remarks;
    }

    // Add status history if you want to track changes
    if (!opportunity.statusHistory) {
      opportunity.statusHistory = [];
    }
    opportunity.statusHistory.push({
      status: status,
      remarks: remarks,
      updatedAt: new Date(),
      updatedBy: ownerId,
    });

    await opportunity.save();

    return res.status(200).json({
      success: true,
      message: `Opportunity successfully ${status.toLowerCase()}`,
      data: {
        opportunityId: opportunity._id,
        status: opportunity.status,
        remarks: opportunity.remarks,
        updatedAt: opportunity.updatedAt,
        statusHistory: opportunity.statusHistory,
      },
    });
  } catch (error) {
    console.error("Error updating opportunity status:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// Get oppurtunity Count for the Owner (Analytics)
const getOpportunityCountsByOwner = async (req, res) => {
  try {
    const ownerId = "6735e1fe6fc1600f43aea060"; // Replace with actual ownerId

    // First, find all products owned by this owner
    const ownerProducts = await ProductModel.find({ ownerId: ownerId }, "_id");
    const productIds = ownerProducts.map((product) => product._id);

    // Get opportunities count grouped by status for all owner's products
    const opportunityCounts = await OpportunityModel.aggregate([
      {
        $match: {
          productId: { $in: productIds },
        },
      },
      {
        $group: {
          _id: {
            status: "$status",
            productId: "$productId",
          },
          count: { $sum: 1 },
        },
      },
      {
        $lookup: {
          from: "products", // Assuming your product collection name
          localField: "_id.productId",
          foreignField: "_id",
          as: "product",
        },
      },
      {
        $unwind: "$product",
      },
      {
        $group: {
          _id: null,
          total: { $sum: "$count" },
          statusCounts: {
            $push: {
              status: "$_id.status",
              count: "$count",
              productId: "$_id.productId",
              productName: "$product.name",
            },
          },
          processingCount: {
            $sum: {
              $cond: [{ $eq: ["$_id.status", "Processing"] }, "$count", 0],
            },
          },
          approvedCount: {
            $sum: {
              $cond: [{ $eq: ["$_id.status", "Approved"] }, "$count", 0],
            },
          },
          rejectedCount: {
            $sum: {
              $cond: [{ $eq: ["$_id.status", "Rejected"] }, "$count", 0],
            },
          },
        },
      },
      {
        $project: {
          _id: 0,
          total: 1,
          processingCount: 1,
          approvedCount: 1,
          rejectedCount: 1,
          detailedCounts: "$statusCounts",
        },
      },
    ]);

    // If no opportunities found
    if (!opportunityCounts.length) {
      return res.status(200).json({
        success: true,
        data: {
          total: 0,
          processingCount: 0,
          approvedCount: 0,
          rejectedCount: 0,
          detailedCounts: [],
        },
      });
    }

    return res.status(200).json({
      success: true,
      data: opportunityCounts[0],
    });
  } catch (error) {
    console.error("Error getting opportunity counts:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

//Get All oppurtunity for the user
const getAllOpportunitiesForUser = async (req, res) => {
  try {
    const userId = req.user.id; // Get the logged-in user's ID

    // Find opportunities where the owner is the same as the logged-in user
    const opportunities = await OpportunityModel.find({ ownerId: userId })
      .populate({
        path: "productId",
        select: "name description price",
      })
      .populate({
        path: "customerId",
        select: "name email phone profilePicture",
      })
      .sort({ createdAt: -1 })
      .exec();

    // Return the opportunities
    res.status(200).json({
      success: true,
      data: {
        opportunities: opportunities,
      },
    });
  } catch (error) {
    console.error("Error fetching user opportunities:", error);
    res.status(500).json({
      success: false,
      message: "An error occurred while fetching user opportunities",
      error: error.message,
    });
  }
};


module.exports = {
  viewProductOpportunities,
  viewSingleOpportunityOwner,
  updateOpportunityStatus,
  getOpportunityCountsByOwner,
  getAllOpportunitiesForUser,
};
