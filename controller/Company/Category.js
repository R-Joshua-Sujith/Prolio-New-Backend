const CategoryModel = require("../../models/Category.js");
const mongoose = require("mongoose");
const Product = require("../../models/Product.js");

// Fetch all categories
const getCategories = async (req, res) => {
  try {
    // Extract query parameters
    const { isActive, search } = req.query;

    // Build the filter dynamically
    const filter = {};
    if (isActive) filter.isActive = isActive === "true"; // Convert to boolean
    if (search) filter.categoryName = { $regex: search, $options: "i" }; // Case-insensitive search

    // Fetch categories based on the filter
    const categories = await CategoryModel.find(filter)
      .select("categoryName steps subCategories isActive createdAt updatedAt")
      .lean();

    // Return the result
    res.status(200).json({
      success: true,
      data: categories,
    });
  } catch (error) {
    console.error("Error fetching categories:", error.message);
    res.status(500).json({
      success: false,
      message: "An error occurred while fetching categories.",
      error: error.message,
    });
  }
};

const getProductsByCategory = async (req, res) => {
  try {
    const { categoryId } = req.params;
    const ownerId = req.user._id; // Adjust based on your auth setup

    console.log("Searching for categoryId:", categoryId);
    console.log("Owner ID:", ownerId);

    // Debug query to see all products
    const allProducts = await Product.find()
      .select("category.categoryId basicDetails.name status ownerId")
      .populate({
        path: "ownerId",
        select: "name email",
      });

    console.log(
      "All products with details:",
      allProducts.map((p) => ({
        id: p._id,
        categoryId: p.category?.categoryId,
        owner: p.ownerId,
        name: p.basicDetails?.name,
        status: p.status,
      }))
    );

    // Fetch all products by categoryId and ownerId without filtering by status
    const filteredProducts = await Product.find({
      "category.categoryId": categoryId,
      ownerId: ownerId,
    })
      .select("basicDetails.name _id ownerId")
      .populate({
        path: "ownerId",
        select: "name email",
      });

    console.log("Filtered products:", filteredProducts);

    res.status(200).json({
      success: true,
      data: filteredProducts.map((product) => ({
        _id: product._id,
        productName: product.basicDetails.name,
        owner: product.ownerId,
      })),
    });
  } catch (error) {
    console.error("Error details:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching products",
      error: error.message,
    });
  }
};

const getOpportunityRoles = async (req, res) => {
  try {
    const { categoryId, productId } = req.params;

    const product = await Product.findOne({
      _id: productId,
      "category.categoryId": categoryId,
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    res.status(200).json({
      success: true,
      data: product.opportunities || [],
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching opportunity roles",
      error: error.message,
    });
  }
};

module.exports = {
  getCategories,
  getProductsByCategory,
  getOpportunityRoles,
};
