const express = require("express");
const { companyVerify } = require("../../controller/Company/Middleware/auth");
const InfluencerController = require("../../controller/Company/Influencer");
const router = express.Router();

router.post(
  "/invite-influencer",
  companyVerify,
  InfluencerController.inviteInfluencer
);

router.get(
  "/promotion-requests",
  companyVerify,
  InfluencerController.getCompanyPromotionRequests
);

router.patch(
  "/:productId/request/:influencerId",
  companyVerify,
  InfluencerController.toggleRequestStatus
);

router.get(
  "/my-influencers",
  companyVerify,
  InfluencerController.getMyInfluencers
);

// Route to get all influencers
router.get(
  "/all-influencers",
  companyVerify,
  InfluencerController.getAllInfluencers
);

router.get(
  "/invited-influencers",
  companyVerify,
  InfluencerController.getCompanyInfluencersAndInvites
);

router.get(
  "/company-products",
  companyVerify,
  InfluencerController.getCompanyActiveProducts
);

router.post(
  "/remove-assigned-product",
  companyVerify,
  InfluencerController.removeAssignedProduct
);
module.exports = router;
