const express = require("express");
const router = express.Router();

const customerOpportunityController = require("../../controller/Customer/Opportunity");
const { customerVerify } = require("../../controller/Customer/Middleware/auth");

router.get("/test", customerOpportunityController.test);

router.get("/test-verify", customerVerify, customerOpportunityController.test);


module.exports = router;