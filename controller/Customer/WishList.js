const Wishlist = require("../../models/WishList"); // Adjust the path as needed
const mongoose = require("mongoose");
const Product = require("../../models/Product");
const { sendResponse } = require("../../utils/responseHandler");

const createWishlistItem = async (req, res) => {
  try {
    // Get productId from both params and body
    const productId = req.params.productId;
    const customerId = req.user?.id;

    console.log("Creating wishlist with:", {
      productId,
      customerId,
      body: req.body,
    });

    if (!customerId) {
      return sendResponse(res, 401, false, "Customer ID is required");
    }

    if (!productId || !mongoose.Types.ObjectId.isValid(productId)) {
      return sendResponse(res, 400, false, "Valid product ID is required");
    }

    // Check if product exists
    const product = await Product.findById(productId);
    if (!product) {
      return sendResponse(res, 404, false, "Product not found");
    }

    // Find or create wishlist
    let wishlist = await Wishlist.findOne({ customerId });

    if (!wishlist) {
      wishlist = new Wishlist({
        customerId,
        products: [
          {
            productId,
            addedAt: new Date(),
          },
        ],
      });
    } else {
      // Check for duplicate
      const exists = wishlist.products.some(
        (item) => item.productId.toString() === productId
      );

      if (exists) {
        return sendResponse(res, 409, false, "Product already in wishlist");
      }

      wishlist.products.push({
        productId,
        addedAt: new Date(),
      });
    }

    await wishlist.save();

    return sendResponse(
      res,
      201,
      true,
      "Product added to wishlist successfully"
    );
  } catch (error) {
    console.error("Wishlist creation error:", error);
    return sendResponse(res, 500, false, "Failed to add product to wishlist");
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
// const removeWishlistItem = async (req, res) => {
//   try {
//     const { productId } = req.params;
//     const customerId = req.user.id;

//     if (!productId) {
//       return res.status(400).json({
//         success: false,
//         message: "Product ID is required",
//       });
//     }

//     // Find and update the wishlist in one operation
//     const wishlist = await Wishlist.findOneAndUpdate(
//       { customerId },
//       { $pull: { products: { productId } } },
//       {
//         new: true,
//         runValidators: true,
//       }
//     ).populate("products.productId");

//     // If no wishlist found
//     if (!wishlist) {
//       return res.status(404).json({
//         success: false,
//         message: "Wishlist not found",
//       });
//     }

//     // Check if product was actually removed with null check
//     const wasProductRemoved = wishlist.products.every((p) => {
//       if (!p || !p.productId) return true; // Skip null/undefined products
//       return (
//         p.productId &&
//         typeof p.productId.toString === "function" &&
//         p.productId.toString() !== productId
//       );
//     });

//     if (!wasProductRemoved) {
//       return res.status(404).json({
//         success: false,
//         message: "Product not found in wishlist",
//       });
//     }

//     // Filter out any null products before sending response
//     const cleanWishlist = {
//       ...wishlist.toObject(),
//       products: wishlist.products.filter((p) => p && p.productId),
//     };

//     res.status(200).json({
//       success: true,
//       message: "Product removed from wishlist successfully",
//       data: cleanWishlist,
//     });
//   } catch (error) {
//     console.error("Error removing wishlist item:", error);
//     res.status(500).json({
//       success: false,
//       message: "Internal server error",
//       details: error.message,
//     });
//   }
// };

const removeWishlistItem = async (req, res) => {
  try {
    const customerId = req.user?.id;
    const productId = req.params.productId; // Changed from id to productId

    console.log("Request params:", req.params);
    console.log("Removing from wishlist:", { productId, customerId });

    // Validate customerId
    if (!customerId) {
      return sendResponse(res, 401, false, "Authentication required");
    }

    // Validate productId
    if (!productId) {
      return sendResponse(res, 400, false, "Product ID is required");
    }

    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return sendResponse(res, 400, false, "Invalid product ID format");
    }

    // Find wishlist and remove product
    const updatedWishlist = await Wishlist.findOneAndUpdate(
      { customerId },
      {
        $pull: {
          products: {
            productId: new mongoose.Types.ObjectId(productId),
          },
        },
      },
      { new: true }
    ).populate({
      path: "products.productId",
      select: "basicDetails images status",
    });

    if (!updatedWishlist) {
      return sendResponse(res, 404, false, "Wishlist not found");
    }

    return sendResponse(
      res,
      200,
      true,
      "Product removed from wishlist successfully",
      updatedWishlist
    );
  } catch (error) {
    console.error("Remove from wishlist error:", error);
    return sendResponse(
      res,
      500,
      false,
      "Failed to remove product from wishlist"
    );
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
