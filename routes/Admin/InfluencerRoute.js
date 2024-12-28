const express = require("express");
const router = express.Router();
const { adminVerify } = require("../../controller/Admin/Middleware/auth");

const InfluencerController = require("../../controller/Admin/Influencer");
const { looseVerify } = require("../../controller/Customer/Middleware/auth");

// Route to get all influencers
router.get("/all-influencers", InfluencerController.getInfluencers);

router.get(
  "/badges-applications",
  adminVerify,
  InfluencerController.getInfluencersWithBadgeApplications
);

router.patch(
  "/updateInfluencer-status/:influencerId",
  adminVerify,
  InfluencerController.updateInfluencerStatus
);
router.patch(
  "/updateBadges-status/:influencerId",
  adminVerify,
  InfluencerController.updateInfluencerBadgesStatus
);

module.exports = router;
