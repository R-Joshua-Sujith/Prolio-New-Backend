const Wishlist = require("../../models/WishList"); // Adjust the path as needed
const mongoose = require("mongoose");
const Product = require("../../models/Product");

// Create a new wishlist item
const createWishlistItem = async (req, res) => {
  try {
    const { productId } = req.params;
    const customerId = req.user.id;

    // Validate input
    if (!customerId || !productId) {
      return res.status(400).json({
        success: false,
        message: "Customer ID and Product ID are required.",
      });
    }

    // Validate if product exists
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found.",
      });
    }

    // Find existing wishlist or create a new one
    let wishlist = await Wishlist.findOne({ customerId });

    if (!wishlist) {
      // Create a new wishlist if none exists
      wishlist = new Wishlist({
        customerId,
        products: [{ productId }],
      });
    } else {
      // Check if the product already exists in the wishlist
      const isProductInWishlist = wishlist.products.some(
        (p) => p.productId.toString() === productId
      );

      if (isProductInWishlist) {
        return res.status(409).json({
          success: false,
          message: "Product is already in the wishlist.",
        });
      }

      // Add the product to the wishlist
      wishlist.products.push({ productId });
    }

    // Save and populate the wishlist with product details
    await wishlist.save();
    await wishlist.populate("products.productId");

    res.status(201).json({
      success: true,
      message: "Product added to wishlist successfully.",
      data: wishlist,
    });
  } catch (error) {
    console.error("Error in createWishlistItem:", error);

    // Handle specific error types
    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: "Invalid data.",
        details: error.errors,
      });
    }

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
        model: "Customer",
        select:
          "companyDetails.companyInfo.companyName companyDetails.companyInfo.logo",
      },
    });

    if (!wishlist) {
      return res.status(200).json({
        products: [],
        message: "No items in wishlist",
      });
    }

    // Transform the wishlist and filter out null products
    const transformedWishlist = {
      ...wishlist.toObject(),
      products: wishlist.products
        .filter((item) => item && item.productId) // Filter out null/undefined products
        .map((item) => {
          try {
            const productObj = item.toObject();
            const productData = productObj.productId || {};

            return {
              ...productObj,
              productId: {
                ...productData,
                ownerCompanyName:
                  productData.ownerId?.companyDetails?.companyInfo
                    ?.companyName || null,
                ownerCompanyLogo:
                  productData.ownerId?.companyDetails?.companyInfo?.logo ||
                  null,
              },
            };
          } catch (err) {
            console.error("Error transforming wishlist item:", err);
            return null;
          }
        })
        .filter(Boolean), // Remove any null items from transformation errors
    };

    res.status(200).json({
      success: true,
      message: "Wishlist fetched successfully",
      data: transformedWishlist,
    });
  } catch (error) {
    console.error("Error in getCustomerWishlist:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Remove a product from wishlist
const removeWishlistItem = async (req, res) => {
  try {
    const { productId } = req.params;
    const customerId = req.user.id;

    if (!productId) {
      return res.status(400).json({
        success: false,
        message: "Product ID is required",
      });
    }

    // Find and update the wishlist in one operation
    const wishlist = await Wishlist.findOneAndUpdate(
      { customerId },
      { $pull: { products: { productId } } },
      {
        new: true,
        runValidators: true,
      }
    ).populate("products.productId");

    // If no wishlist found
    if (!wishlist) {
      return res.status(404).json({
        success: false,
        message: "Wishlist not found",
      });
    }

    // Check if product was actually removed with null check
    const wasProductRemoved = wishlist.products.every((p) => {
      if (!p || !p.productId) return true; // Skip null/undefined products
      return (
        p.productId &&
        typeof p.productId.toString === "function" &&
        p.productId.toString() !== productId
      );
    });

    if (!wasProductRemoved) {
      return res.status(404).json({
        success: false,
        message: "Product not found in wishlist",
      });
    }

    // Filter out any null products before sending response
    const cleanWishlist = {
      ...wishlist.toObject(),
      products: wishlist.products.filter((p) => p && p.productId),
    };

    res.status(200).json({
      success: true,
      message: "Product removed from wishlist successfully",
      data: cleanWishlist,
    });
  } catch (error) {
    console.error("Error removing wishlist item:", error);
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

const checkWishlistStatus = async (req, res) => {
  try {
    const { productId } = req.params;
    const customerId = req.user.id;

    // Find wishlist and check if product exists
    const wishlist = await Wishlist.findOne({
      customerId,
      "products.productId": productId,
    });

    res.status(200).json({
      success: true,
      isWishlisted: !!wishlist,
      message: wishlist
        ? "Product is in wishlist"
        : "Product is not in wishlist",
    });
  } catch (error) {
    console.error("Error checking wishlist status:", error);
    res.status(500).json({
      success: false,
      message: "Error checking wishlist status",
      details: error.message,
    });
  }
};

const getWishlist = async (req, res) => {
  try {
    const customerId = req.user.id;

    // Find wishlist and populate product details
    const wishlist = await Wishlist.findOne({ customerId }).populate({
      path: "products.productId",
      select: "name price images basicDetails", // Select only necessary fields
    });

    if (!wishlist) {
      return res.status(404).json({
        success: false,
        message: "No wishlist found",
        data: [],
      });
    }

    res.status(200).json({
      success: true,
      message: "Wishlist retrieved successfully",
      data: wishlist.products,
    });
  } catch (error) {
    console.error("Error retrieving wishlist:", error);
    res.status(500).json({
      success: false,
      message: "Error retrieving wishlist",
      details: error.message,
    });
  }
};

module.exports = {
  createWishlistItem,
  getCustomerWishlist,
  removeWishlistItem,
  updateWishlistStatus,
  clearWishlist,
  checkWishlistStatus,
  getWishlist,
};
