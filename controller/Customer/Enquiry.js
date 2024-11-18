const EnquiryModel = require("../../models/Enquiry");
const CustomerModel = require("../../models/Customer");
const CompanyUserModel = require("../../models/CompanyUser");
const ProductModel = require("../../models/Product");
const { apiResponse } = require("../../utils/responseHandler");

const enquiryController = {
  /**
   * Test endpoint
   */
  test: async (req, res) => {
    try {
      return apiResponse.success(res, 200, "Enquiry Success");
    } catch (error) {
      return apiResponse.error(res, 500, "Internal Server Error", error);
    }
  },

  /**
   * Initiate a new enquiry or add a reply to an existing enquiry.
   * If no previous enquiry exists, a new enquiry will be created.
   * @route POST /customer/enquiry/initiate
   * @param {string} productId -  ID of the product being enquired.
   * @param {string} message - The initial message from the customer.
   * @returns {Object} - Returns the created or updated enquiry object response.
   */

  initiateEnquiry: async (req, res) => {
    try {
      const { productId, message } = req.body;
      const userId = req.user.id;

      const [isCustomer, isCompanyUser] = await Promise.all([
        CustomerModel.findById(userId),
        CompanyUserModel.findById(userId),
      ]);

      const userModel = isCustomer
        ? "Customer"
        : isCompanyUser
        ? "CompanyUser"
        : null;

      if (!userModel) {
        return apiResponse.error(res, 404, "User not found in any model");
      }
      const product = await ProductModel.findById(productId);
      if (!product) {
        return apiResponse.error(res, 404, "Product not found");
      }
      let enquiry = await EnquiryModel.findOne({
        customerId: userId,
        productId,
      });

      const newMessage = {
        content: message,
        role: "customer",
        id: userId,
        userModel,
      };

      if (enquiry) {
        enquiry.messages.push(newMessage);
      } else {
        enquiry = new EnquiryModel({
          customerId: userId,
          ownerId: product.ownerId,
          productId,
          messages: [newMessage],
        });
      }

      await enquiry.save();

      const responseMessage =
        enquiry.messages.length > 1
          ? "Reply added to existing enquiry"
          : "Enquiry initiated successfully";

      return apiResponse.success(
        res,
        enquiry.messages.length > 1 ? 200 : 201,
        responseMessage,
        enquiry
      );
    } catch (error) {
      console.error("Error initiating enquiry:", error);
      return apiResponse.error(res, 500, "Error initiating enquiry", error);
    }
  },

  /**
   * Get messages for an enquiry
   * @route GET /customer/enquiry/messages/:enquiryId
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
