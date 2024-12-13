// Controller: productTipsController.js
const ProductTips = require("../../models/ProductTips");
const Product = require("../../models/Product");
const { sendResponse } = require("../../utils/responseHandler");

exports.createProductTips = async (req, res) => {
  try {
    const { productId, tips } = req.body;
    const CustomerId = req.user?.id;

    const createData = new ProductTips({
      productId,
      CustomerId,
      tips,
    });
    await createData.save();

    sendResponse(res, 200, "Product Buying Tips Created", createData);
  } catch (error) {
    console.error(error.message);
    sendResponse(res, 400, "Error creating Product Buying Tips");
  }
};

exports.getAllTips = async (req, res) => {
  try {
    const ownerId = req.user?.id;

    // Fetch products owned by the user
    const products = await Product.find({ ownerId }).select("_id images");
    if (!products || products.length === 0) {
      return sendResponse(res, 400, "No products found for this user");
    }

    const productIds = products.map((product) => product._id);

    // Destructure query parameters with default values
    const { search = "", page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;

    // Define search query
    const searchQuery = {
      productId: { $in: productIds },
      $or: [
        { "productId.basicDetails.name": { $regex: search, $options: "i" } }, // Search in product name
        { "CustomerId.name": { $regex: search, $options: "i" } }, // Search in customer name
      ],
    };

    // Fetch product tips with pagination and search
    const tips = await ProductTips.find({ productId: { $in: productIds } })
      .populate("productId", "basicDetails images")
      .populate("CustomerId", "name")
      .exec();

    const total = await ProductTips.countDocuments(searchQuery);

    // Response with pagination info
    sendResponse(res, 200, "Product Buying Tips Retrieved", {
      tips,
      total,
      page: parseInt(page),
      limit: parseInt(limit),
    });
  } catch (error) {
    console.error("Error getting product buying tips:", error.message);
    sendResponse(
      res,
      500,
      "Internal server error while fetching product buying tips"
    );
  }
};

exports.getPublishedTipsByProduct = async (req, res) => {
  try {
    const { productId } = req.params;
    const tips = await ProductTips.find({
      productId,
      status: "published",
    }).populate("productId", "name price");

    if (!tips || tips.length === 0) {
      return sendResponse(res, 200, "No published tips found for this product");
    }

    sendResponse(res, 200, "Published Tips Retrieved for Product", tips);
  } catch (error) {
    console.error(error.message);
    sendResponse(res, 500, "Error getting published tips for product");
  }
};

exports.changeTipStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!["published", "rejected"].includes(status)) {
      return sendResponse(res, 400, "Invalid status value.");
    }

    const updatedTip = await ProductTips.findByIdAndUpdate(
      id,
      { status },
      { new: true }
    );

    if (!updatedTip) {
      return sendResponse(res, 404, "Product Tip not found.");
    }

    sendResponse(
      res,
      200,
      `Product Tip status updated to ${status}`,
      updatedTip
    );
  } catch (error) {
    console.error(error.message);
    sendResponse(res, 500, "Error occurred while updating Product Tip status");
  }
};
