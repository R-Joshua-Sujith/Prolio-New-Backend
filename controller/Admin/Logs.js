const { sendResponse } = require("../../utils/responseHandler");
const log = require("../../models/Logs");
const mongoose = require("mongoose");

const getAdminLogs = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { search = "", page = 1, limit = 10 } = req.query;

    // Set pagination options
    const skip = (page - 1) * limit;
    const query = {
      userId,
      userModel: "Admin",
      action: { $regex: search, $options: "i" }, // Case-insensitive search
    };

    // Fetch logs with pagination, search, and populate targetId with customer name
    const logs = await log
      .find(query)
      .skip(skip)
      .limit(Number(limit))
      .populate("targetId", "name");

    const totalLogs = await log.countDocuments(query);

    if (!logs.length) {
      return sendResponse(res, 404, false, "No logs found for this admin");
    }

    // Send paginated and searched logs in response
    return sendResponse(res, 200, true, "Logs retrieved successfully", {
      logs,
      totalLogs,
      currentPage: Number(page),
      totalPages: Math.ceil(totalLogs / limit),
    });
  } catch (error) {
    console.error("Error retrieving logs:", error);
    return sendResponse(res, 500, false, "Internal Server Error");
  }
};

module.exports = {
  getAdminLogs,
};
