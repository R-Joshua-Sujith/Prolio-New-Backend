const EnquiryModel = require("../../models/Enquiry");
const CustomerModel = require("../../models/Customer");
const { sendResponse, apiResponse } = require("../../utils/responseHandler");

const enquiryController = {
  /**
   * Test function to verify API is working
   * @route GET /enquiry/test
   */
  test: async (req, res) => {
    try {
      return sendResponse(res, 200, true, "Company Enquiry Success");
    } catch (error) {
      console.error(error);
      return sendResponse(res, 500, false, "Internal Server Error");
    }
  },

  /**
   * Reply to an enquiry (Company only)
   * @route POST /company/enquiry/reply/:enquiryId
   * @param {string} enquiryId - ID of the enquiry
   * @param {string} message - Reply message content
   * @returns {Object} Updated enquiry object
   */
  replyToEnquiry: async (req, res) => {
    try {
      const { enquiryId } = req.params;
      const { message } = req.body;
      const companyUserId = req.user.id;
      //   const companyUserId = "6735e1fe6fc1600f43aea060";
      const enquiry = await EnquiryModel.findById(enquiryId);
      if (!enquiry) {
        return sendResponse(res, 404, false, "Enquiry not found");
      }
      if (enquiry.ownerId.toString() !== companyUserId.toString()) {
        return sendResponse(
          res,
          403,
          false,
          "Unauthorized to reply to this enquiry"
        );
      }
      // Add the new message to the enquiry
      enquiry.messages.push({
        content: message,
        role: "company",
        id: companyUserId,
        userModel: "CompanyUser",
      });

      await enquiry.save();

      return sendResponse(res, 200, true, "Reply sent successfully", enquiry);
    } catch (error) {
      console.error(error);
      return sendResponse(
        res,
        500,
        false,
        "Error sending reply",
        error.message
      );
    }
  },

  /**
   * Get messages for an enquiry
   * @route GET /company/enquiry/messages/:enquiryId
   * @param {string} enquiryId - ID of the enquiry
   * @param {number} limit - Number of messages per page (default: 10)
   * @returns {Object} Paginated messages and metadata
   */
  getEnquiryMessages: async (req, res) => {
    try {
      const { enquiryId } = req.params;
      const page = parseInt(req.query.page, 10) || 1;
      const limit = parseInt(req.query.limit, 10) || 10;
      const skip = (page - 1) * limit;

      // Fetch the enquiry by ID
      const enquiry = await EnquiryModel.findById(enquiryId);
      if (!enquiry) {
        return apiResponse.error(res, 404, "Enquiry not found");
      }
      const userId = req.user.id;
      //   const userId = "6735e1de6fc1600f43aea05d";
      const customerId = enquiry.customerId.toString();
      const ownerId = enquiry.ownerId.toString();

      if (![customerId, ownerId].includes(userId.toString())) {
        return apiResponse.error(res, 403, "Unauthorized access to enquiry");
      }

      const totalMessages = enquiry.messages.length;
      const messages = enquiry.messages
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(skip, skip + limit);
      return apiResponse.success(res, 200, "Messages retrieved successfully", {
        messages,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(totalMessages / limit),
          totalMessages,
          hasMore: skip + limit < totalMessages,
        },
      });
    } catch (error) {
      console.error("Error retrieving messages:", error);
      return apiResponse.error(res, 500, "Error retrieving messages", error);
    }
  },
};

module.exports = enquiryController;
