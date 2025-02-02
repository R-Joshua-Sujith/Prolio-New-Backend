const Logs = require("../../models/Logs");
const { sendResponse } = require("../../utils/responseHandler");
const mongoose = require("mongoose");

const createLogs = async (logData) => {
  try {
    // Make sure priceValue is included in logData
    const logEntry = new Logs({
      userId: logData.userId,
      userModel: logData.userModel,
      targetId: logData.targetId,
      targetModel: logData.targetModel,
      action: logData.action,
      priceValue: logData.priceValue, // Add priceValue to log
    });

    await logEntry.save();
    console.log("log created successfully");
  } catch (error) {
    console.log("Error creating Log:", error);
  }
};

const getLogs = async (req, res) => {
  try {
    // Aggregate logs with user details and company name
    const logs = await Logs.aggregate([
      {
        $lookup: {
          from: "customers",
          localField: "userId",
          foreignField: "_id",
          as: "userDetails",
        },
      },
      {
        $unwind: "$userDetails",
      },
      {
        $lookup: {
          from: "companydetails",
          localField: "userDetails.companyDetails",
          foreignField: "_id",
          as: "companyDetails",
        },
      },
      {
        $unwind: {
          path: "$companyDetails",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $project: {
          _id: 1,
          action: 1,
          timestamp: 1,
          customerName: "$userDetails.name",
          customerEmail: "$userDetails.email", // Extract user email
          companyName: {
            $ifNull: [
              "$userDetails.companyDetails.companyInfo.companyName",
              "N/A", // Default to "N/A" if company name is missing
            ],
          },
        },
      },
      {
        $sort: { timestamp: -1 }, // Sort by timestamp (most recent first)
      },
    ]);

    if (!logs || logs.length === 0) {
      return sendResponse(res, 404, false, "No logs found");
    }

    // Send formatted response
    return sendResponse(res, 200, true, "Logs fetched successfully", logs);
  } catch (error) {
    console.error("Error fetching logs:", error);
    return sendResponse(res, 500, false, "Error fetching logs", {
      details: error.message,
    });
  }
};

// Function to get logs by targetId
const getLogsByTargetId = async (req, res) => {
  const { page = 1, pageSize = 5 } = req.query;
  const skip = (page - 1) * pageSize;
  const targetId = req.params.id;
  const query = { targetId };

  try {
    const logs = await Logs.find(query)
      .populate("userId", "username email userRole") // Populate user details
      .skip(skip)
      .limit(parseInt(pageSize))
      .sort({ createdAt: -1 });

    const totalLogs = await Logs.countDocuments(query);
    res.json({ logs, count: totalLogs });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server Error" });
  }
};

// Function to get logs by userId
const getLogsByUserId = async (req, res) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.user?.id);
    console.log("Decoded user from token:", userId);
    const { search, startDate, endDate, page = 1, pageSize = 10 } = req.query;

    // Construct match criteria with helper function
    const buildMatchCriteria = () => {
      const criteria = { userId };

      if (search) {
        const searchRegex = new RegExp(search, "i");
        criteria.$or = [
          { "userDetails.name": searchRegex },
          { action: searchRegex },
        ];
      }

      if (startDate || endDate) {
        criteria.timestamp = {
          ...(startDate && { $gte: new Date(startDate) }),
          ...(endDate && { $lte: new Date(endDate) }),
        };
      }

      return criteria;
    };

    // Pagination setup
    const pagination = {
      skip: (page - 1) * pageSize,
      limit: parseInt(pageSize, 10),
    };

    // Aggregation pipeline
    const aggregationPipeline = [
      { $match: buildMatchCriteria() },
      {
        $lookup: {
          from: "customers",
          localField: "userId",
          foreignField: "_id",
          as: "userDetails",
        },
      },
      { $unwind: "$userDetails" },
      {
        $lookup: {
          from: "companydetails",
          localField: "userDetails.companyDetails",
          foreignField: "_id",
          as: "companyDetails",
        },
      },
      {
        $unwind: {
          path: "$companyDetails",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $project: {
          _id: 1,
          action: 1,
          timestamp: 1,
          targetModel: 1,
          createdAt: 1, // Include createdAt in the projection
          customerName: "$userDetails.name",
          customerEmail: "$userDetails.email",
        },
      },
      { $skip: pagination.skip },
      { $limit: pagination.limit },
      { $sort: { timestamp: -1 } },
    ];

    // Parallel execution of logs and total count
    const [logs, totalLogs] = await Promise.all([
      Logs.aggregate(aggregationPipeline),
      Logs.countDocuments(buildMatchCriteria()),
    ]);

    // Check if logs exist
    if (!logs.length) {
      return sendResponse(res, 404, false, "No logs found");
    }

    // Prepare response with pagination metadata
    return sendResponse(res, 200, true, "Logs fetched successfully", {
      logs,
      totalLogs,
      page: parseInt(page),
      pageSize: pagination.limit,
      totalPages: Math.ceil(totalLogs / pagination.limit),
    });
  } catch (error) {
    console.error("Error fetching logs:", error);
    return sendResponse(res, 500, false, "Error fetching logs", {
      details: error.message,
    });
  }
};

const getLogsByCustomerId = async (req, res) => {
  try {
    const customerId = req.params.customerId;
    const {
      search,
      startDate,
      endDate,
      page = 1,
      pageSize = 10,
      sortField = "createdAt",
      sortOrder = -1,
    } = req.query;

    const buildMatchCriteria = () => {
      const criteria = {
        userId: new mongoose.Types.ObjectId(customerId),
      };

      if (search) {
        const searchRegex = new RegExp(search, "i");
        criteria.$or = [{ action: searchRegex }];
      }

      if (startDate || endDate) {
        criteria.createdAt = {};
        if (startDate) criteria.createdAt.$gte = new Date(startDate);
        if (endDate) criteria.createdAt.$lte = new Date(endDate);
      }

      return criteria;
    };

    const allowedSortFields = ["createdAt", "action", "targetModel"];
    const validSortField = allowedSortFields.includes(sortField)
      ? sortField
      : "createdAt";
    const validSortOrder = sortOrder === "1" ? 1 : -1;

    const pagination = {
      skip: (parseInt(page) - 1) * parseInt(pageSize),
      limit: parseInt(pageSize),
    };

    const aggregationPipeline = [
      { $match: buildMatchCriteria() },
      {
        $lookup: {
          from: "customers",
          localField: "userId",
          foreignField: "_id",
          as: "userDetails",
        },
      },
      { $unwind: "$userDetails" },
      {
        $lookup: {
          from: "companydetails",
          localField: "userDetails.companyDetails",
          foreignField: "_id",
          as: "companyDetails",
        },
      },
      {
        $unwind: {
          path: "$companyDetails",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $project: {
          _id: 1,
          action: 1,
          targetModel: 1,
          customerName: "$userDetails.name",
          customerEmail: "$userDetails.email",
          createdAt: 1,
        },
      },
      { $sort: { [validSortField]: validSortOrder } },
      { $skip: pagination.skip },
      { $limit: pagination.limit },
    ];

    const [logs, totalLogs] = await Promise.all([
      Logs.aggregate(aggregationPipeline),
      Logs.countDocuments(buildMatchCriteria()),
    ]);

    const formattedLogs = logs.map((log) => ({
      ...log,
      createdAt: log.createdAt ? new Date(log.createdAt).toISOString() : null,
    }));

    if (!formattedLogs.length) {
      return res.status(404).json({
        success: false,
        message: "No logs found for this customer",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Logs fetched successfully",
      data: {
        logs: formattedLogs,
        totalLogs,
        page: parseInt(page),
        pageSize: pagination.limit,
        totalPages: Math.ceil(totalLogs / pagination.limit),
        sortField: validSortField,
        sortOrder: validSortOrder,
      },
    });
  } catch (error) {
    console.error("Error fetching logs:", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching logs",
      error: error.message,
    });
  }
};
module.exports = {
  createLogs,
  getLogs,
  getLogsByTargetId,
  getLogsByUserId,
  getLogsByCustomerId,
};
