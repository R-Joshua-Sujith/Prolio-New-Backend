const CustomerModel = require("../../models/Customer");
const ForumModel = require("../../models/Forum");
const { sendResponse } = require("../../utils/responseHandler");

exports.getVerifiedCompanyUsers = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const totalVerifiedCompanies = await CustomerModel.countDocuments({
      "isCompany.verified": true,
    });

    const verifiedCompanies = await CustomerModel.find({
      "isCompany.verified": true,
    })
      .select("-password -refreshToken -otp -otpExpiry")
      .limit(limit)
      .skip(skip);

    res.status(200).json({
      success: true,
      count: verifiedCompanies.length,
      total: totalVerifiedCompanies,
      totalPages: Math.ceil(totalVerifiedCompanies / limit),
      currentPage: page,
      data: verifiedCompanies,
      hasNextPage: page * limit < totalVerifiedCompanies,
      hasPrevPage: page > 1,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching verified companies",
      error: error.message,
    });
  }
};

exports.getRejectedCompanyUsers = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const totalRejectedCompanies = await CustomerModel.countDocuments({
      "isCompany.rejected": true,
    });

    const rejectedCompanies = await CustomerModel.find({
      "isCompany.rejected": true,
    })
      .select("-password -refreshToken -otp -otpExpiry")
      .limit(limit)
      .skip(skip);

    res.status(200).json({
      success: true,
      count: rejectedCompanies.length,
      total: totalRejectedCompanies,
      totalPages: Math.ceil(totalRejectedCompanies / limit),
      currentPage: page,
      data: rejectedCompanies,
      hasNextPage: page * limit < totalRejectedCompanies,
      hasPrevPage: page > 1,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching rejected companies",
      error: error.message,
    });
  }
};

exports.getPendingCompanyUsers = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const totalPendingCompanies = await CustomerModel.countDocuments({
      "isCompany.applied": true,
      "isCompany.verified": false,
      "isCompany.rejected": false,
    });

    const pendingCompanies = await CustomerModel.find({
      "isCompany.applied": true,
      "isCompany.verified": false,
      "isCompany.rejected": false,
    })
      .select("-password -refreshToken -otp -otpExpiry")
      .limit(limit)
      .skip(skip);

    res.status(200).json({
      success: true,
      count: pendingCompanies.length,
      total: totalPendingCompanies,
      totalPages: Math.ceil(totalPendingCompanies / limit),
      currentPage: page,
      data: pendingCompanies,
      hasNextPage: page * limit < totalPendingCompanies,
      hasPrevPage: page > 1,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching pending companies",
      error: error.message,
    });
  }
};

(exports.updateCompanyStatus = async (req, res) => {
  try {
    const { companyId } = req.params;
    const { status } = req.body;

    if (!companyId || !status) {
      return res.status(400).json({
        success: false,
        message: "Company ID and status are required",
      });
    }

    if (!["verified", "rejected"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status. Status must be 'verified' or 'rejected'",
      });
    }

    const updateFields = {
      "isCompany.verified": status === "verified",
      "isCompany.rejected": status === "rejected",
    };

    const company = await CustomerModel.findByIdAndUpdate(
      companyId,
      { $set: updateFields },
      { new: true }
    ).select("-password -refreshToken -otp -otpExpiry");

    if (!company) {
      return res.status(404).json({
        success: false,
        message: "Company not found",
      });
    }

    res.status(200).json({
      success: true,
      message: `Company ${status} successfully`,
      data: company,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error updating company status",
      error: error.message,
    });
  }
}),
  // Controller to get verified companies with forum count
  (exports.getAllCompanies = async (req, res) => {
    try {
      const { page = 1, limit = 10, search = "" } = req.query;
      const skip = (page - 1) * limit;
      const paginationLimit = parseInt(limit);

      const customers = await CustomerModel.aggregate([
        // Match customers with verified companies
        {
          $match: {
            "isCompany.verified": true,
            $or: [
              { name: { $regex: search, $options: "i" } },
              { email: { $regex: search, $options: "i" } },
            ],
          },
        },
        {
          $lookup: {
            from: "forums",
            localField: "_id",
            foreignField: "ownerId",
            as: "forums",
          },
        },
        // Add forum count for each company
        {
          $addFields: {
            totalForums: { $size: "$forums" },
          },
        },
        // Project fields for the response, including influencer details
        {
          $project: {
            name: 1,
            email: 1,
            status: 1,
            companyDetails: 1,
            totalForums: 1, // Include the forum count in the response
            isInfluencer: 1, // Add influencer status
            influencerDetails: 1, // Add influencer details
          },
        },
        // Pagination stage: Skip and limit the results
        {
          $skip: skip,
        },
        {
          $limit: paginationLimit,
        },
      ]);

      if (!customers || customers.length === 0) {
        return sendResponse(res, 404, "No verified companies found");
      }

      // Count the total number of verified companies for pagination
      const totalCompanies = await CustomerModel.countDocuments({
        "isCompany.verified": true,
        $or: [
          { name: { $regex: search, $options: "i" } },
          { email: { $regex: search, $options: "i" } },
        ],
      });

      // Return the data under a single `message` field
      return sendResponse(
        res,
        200,
        "Verified company list fetched successfully",
        {
          customers,
          totalCompanies,
          totalPages: Math.ceil(totalCompanies / paginationLimit),
          currentPage: parseInt(page),
        }
      );
    } catch (error) {
      console.error(error);
      return sendResponse(res, 500, "Server error");
    }
  });
