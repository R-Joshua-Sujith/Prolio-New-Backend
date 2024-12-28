const express = require("express");
const router = express.Router();
const {
  influencerVerify,
} = require("../../controller/Influencer/Middleware/auth");
const influencerController = require("../../controller/Influencer/InfluencerProfile");
const multer = require("multer");
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Define the route to register an influencer, including file uploads
router.post(
  "/register-influencer",
  influencerVerify,
  upload.fields([
    { name: "pan_document", maxCount: 1 },
    { name: "aadhar_document", maxCount: 1 },
    { name: "other_documents", maxCount: 5 },
    { name: "profile_photo", maxCount: 1 },
  ]),
  influencerController.registerInfluencer
);

router.patch(
  "/updateInfluencer",
  upload.array("documents", 5),
  influencerVerify,
  influencerController.updateInfluencer
);

router.patch(
  "/apply-badge",
  influencerVerify,
  influencerController.applyForBadge
);

router.delete(
  "/delete-documents/:docId",
  influencerVerify,
  influencerController.deleteInfluencerDoc
);

router.post(
  "/send-promotionRequest",
  influencerVerify,
  influencerController.sendPromotionRequest
);
router.get(
  "/promotion-status/:productId",
  influencerVerify,
  influencerController.getPromotionStatus
);

module.exports = router;
