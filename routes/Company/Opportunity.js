const express = require("express");
const router = express.Router();

const companyOpportunityController = require("../../controller/Company/Opportunity");

const { companyVerify } = require("../../controller/Company/Middleware/auth")

router.get("/test", companyOpportunityController.test);

router.get("/test-verify", companyVerify, companyOpportunityController.test);

module.exports = router;