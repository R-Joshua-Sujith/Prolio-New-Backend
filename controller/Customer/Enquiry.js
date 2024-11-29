const EnquiryModel = require("../../models/Enquiry");
const CustomerModel = require("../../models/Customer");
const CompanyUserModel = require("../../models/CompanyUser");
const ProductModel = require("../../models/Product");
const { apiResponse, sendResponse } = require("../../utils/responseHandler");
const mongoose = require("mongoose");

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
   * @route GET /customer/enquiry/messages/:productId
   * @param {string} enquiryId - ID of the enquiry
   * @param {number} limit - Number of messages per page (default: 10)
   * @returns {Object} Paginated messages and metadata
   */

  getCustomerEnquiryMessages: async (req, res) => {
    try {
      const { productId } = req.params;
      const customerId = req.user?.id;

      // Validate productId and customerId format
      if (
        !mongoose.Types.ObjectId.isValid(productId) ||
        !mongoose.Types.ObjectId.isValid(customerId)
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid product ID or customer ID format",
        });
      }

      // Find enquiry with matching productId and customerId
      const enquiry = await EnquiryModel.findOne({
        productId: productId,
        $or: [{ customerId: customerId }, { ownerId: customerId }],
      });

      // If no enquiry found
      if (!enquiry) {
        return res.status(404).json({
          success: false,
          message: "No enquiry found for this product and customer",
        });
      }

      // Return all messages from the enquiry
      return res.status(200).json({
        success: true,
        data: {
          enquiryId: enquiry._id,
          status: enquiry.status,
          messages: enquiry.messages, // No filtering, all messages are returned
        },
      });
    } catch (error) {
      console.error("Error in getCustomerEnquiryMessages:", error);
      return res.status(500).json({
        success: false,
        message: "Internal server error",
        error: error.message,
      });
    }
  },

  getMyEnquiries: async (req, res) => {
    try {
      const customerId = req.user.id;
      // Query the database for enquiries
      const enquiries = await EnquiryModel.find({ customerId })
        .populate({
          path: "productId",
          select: "basicDetails",
        })
        .populate("ownerId", "name")
        .select("productId ownerId status messages createdAt");

      // Format the response data
      const formattedEnquiries = enquiries.map((enquiry) => ({
        product: {
          id: enquiry.productId?._id || null,
          basicDetails: enquiry.productId?.basicDetails || null,
        },
        vendor: {
          id: enquiry.ownerId?._id || null,
          name: enquiry.ownerId.name || null,
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
};
module.exports = enquiryController;
