const EnquiryModel = require("../../models/Enquiry");
const CustomerModel = require("../../models/Customer");
const { sendResponse, apiResponse } = require("../../utils/responseHandler");
const ProductModel = require("../../models/Product");

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
      const companyUserId = req.user?.id;
      const enquiry = await EnquiryModel.findById(enquiryId);
      if (!enquiry) {
        return sendResponse(res, 404, false, "Enquiry not found");
      }

      // Check if the user is the owner of the enquiry
      if (enquiry.ownerId.toString() !== companyUserId.toString()) {
        return sendResponse(
          res,
          403,
          false,
          "Unauthorized to reply to this enquiry"
        );
      }

      // Push the new message into the enquiry's messages array
      enquiry.messages.push({
        content: message,
        role: "company",
        id: companyUserId,
        userModel: "Customer",
      });

      // If it's the first reply, change the status to 'Connection Established'
      if (enquiry.status === "Pending") {
        enquiry.status = "Connection Established";
      }

      // Save the enquiry with the updated status and messages
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

  getMyProductEnquiries: async (req, res) => {
    try {
      const userId = req.user?.id;
      const userProducts = await ProductModel.find({ ownerId: userId }).select(
        "_id"
      );

      if (!userProducts || userProducts.length === 0) {
        return sendResponse(
          res,
          404,
          false,
          null,
          "No products found for the user."
        );
      }

      // Extract the product IDs
      const productIds = userProducts.map((product) => product._id);

      // Query the enquiries related to the user's products
      const enquiries = await EnquiryModel.find({
        productId: { $in: productIds },
      })
        .populate({
          path: "productId",
          select: "basicDetails",
        })
        .populate("ownerId", "name")
        .populate("customerId", "name")
        .select("productId ownerId status messages createdAt");

      // Format the response data
      const formattedEnquiries = enquiries.map((enquiry) => ({
        enquiryId: enquiry._id,
        product: {
          id: enquiry.productId?._id || null,
          basicDetails: enquiry.productId?.basicDetails || null,
        },
        vendor: {
          id: enquiry.customerId?._id || null,
          name: enquiry.customerId?.name || null, // Vendor name
        },
        status: enquiry.status || "Unknown",
        appliedDtae:
          enquiry.messages?.[enquiry.messages.length - 1]?.createdAt || null,
        createdAt: enquiry.createdAt,
      }));

      // Send the formatted data as a response
      sendResponse(
        res,
        200,
        true,
        formattedEnquiries,
        "Enquiries fetched successfully"
      );
    } catch (error) {
      // Handle any errors
      sendResponse(
        res,
        500,
        false,
        null,
        error.message || "Internal Server Error"
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

      const enquiry = await EnquiryModel.findById(enquiryId);
      if (!enquiry) {
        return apiResponse.error(res, 404, "Enquiry not found");
      }
      const userId = req.user.id;
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
