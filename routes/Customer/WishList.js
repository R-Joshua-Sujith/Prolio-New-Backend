const express = require("express");
const router = express.Router();
const WishListController = require("../../controller/Customer/WishList");
const { customerVerify } = require("../../controller/Customer/Middleware/auth");

// Create a new wishlist item
router.post(
  "/Add-wishlist/:productId",
  customerVerify,
  WishListController.createWishlistItem
);

// Get customer's wishlist
router.get(
  "/get-customer-wishlist",
  customerVerify,
  WishListController.getCustomerWishlist
);

// Remove a product from wishlist
router.delete(
  "/remove-from-wishlist/:productId",
  customerVerify,
  WishListController.removeWishlistItem
);

// Update wishlist status
router.patch(
  "/:customerId/status",
  customerVerify,
  WishListController.updateWishlistStatus
);

// Check if product exists in wishlist
router.get(
  "/check-wishlist/:productId",
  customerVerify,
  WishListController.checkWishlistStatus
);

// Get wishlist
router.get("/get-wishlist", customerVerify, WishListController.getWishlist);

// Clear entire wishlist
router.delete("/:customerId", customerVerify, WishListController.clearWishlist);

module.exports = router;
