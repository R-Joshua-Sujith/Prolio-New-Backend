// routes/bannerRoutes.js
const express = require("express");
const multer = require("multer");
const bannerController = require("../../controller/Admin/banner");
const { adminVerify } = require("../../controller/Admin/Middleware/auth");
const router = express.Router();
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

router.post(
  "/create-banner",
  upload.array("bannerImgs", 10),
  //   adminVerify,
  bannerController.createBanner
);

router.put(
  "/update-banner/:id",
  upload.array("bannerImgs", 5),
  adminVerify,
  bannerController.updateBanner
);

// Route to delete a banner
router.delete(
  "/delete-banner/:id",
  // adminVerify,
  bannerController.deleteBanner
);

// Route to update the banner status
router.patch(
  "/update-banner-status/:id",
  adminVerify,
  bannerController.updateBannerStatus
);

module.exports = router;
