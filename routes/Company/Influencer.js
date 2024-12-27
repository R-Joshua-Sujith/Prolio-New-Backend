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

module.exports = router;
