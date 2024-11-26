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

    const wishlist = await Wishlist.findOne({ customerId }).populate({
      path: "products.productId",
      select: "name price images", // Customize fields as needed
    });

    if (!wishlist) {
      return res.status(404).json({ message: "Wishlist not found" });
    }

    res.status(200).json(wishlist);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Remove a product from wishlist
const removeWishlistItem = async (req, res) => {
  try {
    const { customerId, productId } = req.params;

    const wishlist = await Wishlist.findOne({ customerId });

    if (!wishlist) {
      return res.status(404).json({ message: "Wishlist not found" });
    }

    wishlist.products = wishlist.products.filter(
      (p) => p.productId.toString() !== productId
    );

    await wishlist.save();
    res.status(200).json(wishlist);
  } catch (error) {
    res.status(500).json({ message: error.message });
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
