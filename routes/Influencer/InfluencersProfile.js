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

// Route definition
router.get(
  "/my-companies",
  influencerVerify,
  influencerController.getMyCompanies
);

router.put(
  "/:companyId/accept-reject",
  influencerVerify,
  influencerController.acceptRejectInvitation
);

router.get(
  "/pending-invitations",
  influencerVerify,
  influencerController.getAllInvitations
);

router.get(
  "/influencer-products/:id",
  influencerVerify,
  influencerController.getInfluencerAssignedProducts
);


module.exports = router;
