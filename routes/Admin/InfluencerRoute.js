const express = require("express");
const router = express.Router();
const { adminVerify } = require("../../controller/Admin/Middleware/auth");

const InfluencerController = require("../../controller/Admin/Influencer");
const { looseVerify } = require("../../controller/Customer/Middleware/auth");

// Route to get all influencers
router.get(
  "/all-influencers",
  looseVerify,
  InfluencerController.getInfluencers
);

router.patch(
  "/updateInfluencer-status/:influencerId",
  adminVerify,
  InfluencerController.updateInfluencerStatus
);

module.exports = router;
