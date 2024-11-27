const Wishlist = require("../../models/WishList"); // Adjust the path as needed
const mongoose = require("mongoose");

// Create a new wishlist item
const createWishlistItem = async (req, res) => {
  try {
    const { productId } = req.params;
    const customerId = req.user.id;

    console.log("Product ID:", productId);
    console.log("Customer ID:", customerId);

    // Validate input
    if (!customerId || !productId) {
      return res.status(400).json({
        success: false,
        message: "Customer ID and Product ID are required.",
      });
    }

    // Find existing wishlist or create a new one
    let wishlist = await Wishlist.findOne({ customerId });

    if (!wishlist) {
      // Create a new wishlist if none exists
      wishlist = new Wishlist({
        customerId,
        products: [
          {
            productId,
          },
        ],
      });
    } else {
      // Check if the product already exists in the wishlist
      const existingProductIndex = wishlist.products.findIndex(
        (p) => p.productId.toString() === productId
      );

      if (existingProductIndex !== -1) {
        return res.status(409).json({
          success: false,
          message: "Product is already in the wishlist.",
        });
      }

      // Add the product to the wishlist
      wishlist.products.push({
        productId,
      });
    }

    await wishlist.save();
    res.status(201).json({
      success: true,
      message: "Product added to wishlist successfully.",
      data: wishlist,
    });
  } catch (error) {
    console.error("Error in createWishlistItem:", error.message);

    // Handle database-related errors
    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: "Invalid data.",
        details: error.errors,
      });
    }

    // Handle other errors
    res.status(500).json({
      success: false,
      message:
        "An unexpected error occurred while adding the product to the wishlist.",
      details: error.message,
    });
  }
};

// Get wishlist for a specific customer
const getCustomerWishlist = async (req, res) => {
  try {
    const customerId = req.user.id;

    // Find the wishlist and populate products along with their owner's company details
    const wishlist = await Wishlist.findOne({ customerId }).populate({
      path: "products.productId",
      select: "basicDetails images colors ownerId",
      populate: {
        path: "ownerId",
        model: "Customer", // Assuming the model is named 'Customer'
        select:
          "companyDetails.companyInfo.companyName companyDetails.companyInfo.logo",
      },
    });

    if (!wishlist) {
      return res.status(404).json({ message: "Wishlist not found" });
    }

    // Transform the wishlist to ensure clean data structure
    const transformedWishlist = {
      ...wishlist.toObject(),
      products: wishlist.products.map((item) => ({
        ...item.toObject(),
        productId: {
          ...item.productId.toObject(),
          ownerCompanyName:
            item.productId.ownerId?.companyDetails?.companyInfo?.companyName ||
            null,
          ownerCompanyLogo:
            item.productId.ownerId?.companyDetails?.companyInfo?.logo || null,
        },
      })),
    };

    res.status(200).json(transformedWishlist);
  } catch (error) {
    console.error("Error in getCustomerWishlist:", error);
    res.status(500).json({
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Remove a product from wishlist
const removeWishlistItem = async (req, res) => {
  try {
    const { productId } = req.params; // Extract productId from the URL params
    const customerId = req.user.id; // Extract customerId from the authenticated user's details

    // Find the wishlist for the given customer
    const wishlist = await Wishlist.findOne({ customerId });

    // If the wishlist does not exist, return a 404 error
    if (!wishlist) {
      return res.status(404).json({
        success: false,
        message: "Wishlist not found",
      });
    }

    // Check if the product exists in the wishlist
    const productExists = wishlist.products.some(
      (p) => p.productId.toString() === productId
    );

    if (!productExists) {
      return res.status(404).json({
        success: false,
        message: "Product not found in wishlist",
      });
    }

    // Filter out the product from the wishlist
    wishlist.products = wishlist.products.filter(
      (p) => p.productId.toString() !== productId
    );

    // Save the updated wishlist
    await wishlist.save();

    // Respond with the updated wishlist and a success message
    res.status(200).json({
      success: true,
      message: "Product removed from wishlist successfully",
      data: wishlist,
    });
  } catch (error) {
    console.error("Error removing wishlist item:", error.message);
    // Handle unexpected server errors
    res.status(500).json({
      success: false,
      message: "Internal server error",
      details: error.message,
    });
  }
};

// Update wishlist item status
const updateWishlistStatus = async (req, res) => {
  try {
    const { customerId } = req.params;
    const { status } = req.body;

    const wishlist = await Wishlist.findOne({ customerId });

    if (!wishlist) {
      return res.status(404).json({ message: "Wishlist not found" });
    }

    wishlist.status = status;
    await wishlist.save();

    res.status(200).json(wishlist);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Clear entire wishlist
const clearWishlist = async (req, res) => {
  try {
    const { customerId } = req.params;

    const wishlist = await Wishlist.findOne({ customerId });

    if (!wishlist) {
      return res.status(404).json({ message: "Wishlist not found" });
    }

    wishlist.products = [];
    await wishlist.save();

    res.status(200).json({ message: "Wishlist cleared successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  createWishlistItem,
  getCustomerWishlist,
  removeWishlistItem,
  updateWishlistStatus,
  clearWishlist,
};
