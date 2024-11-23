const express = require("express");
const router = express.Router();

const companyOpportunityController = require("../../controller/Company/Opportunity");

const { companyVerify } = require("../../controller/Company/Middleware/auth");

// View Opportunity for specific Producct
router.get(
  "/view-product-opportunities",
  companyVerify,
  companyOpportunityController.viewProductOpportunities
);

// View SingleOppurtunity
router.get(
  "/view-single-opportunity",
  companyVerify,
  companyOpportunityController.viewSingleOpportunityOwner
);

router.get(
  "/Update-status-opportunity/:opportnityId",
  companyVerify,
  companyOpportunityController.updateOpportunityStatus
);

router.get(
  "/getOpportunityCountsByOwner",
  companyVerify,
  companyOpportunityController.getOpportunityCountsByOwner
);

router.get(
  "/getAllOpportunitiesForUser",
  companyVerify,
  companyOpportunityController.getAllOpportunitiesForUser
);

module.exports = router;
