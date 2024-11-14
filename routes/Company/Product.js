const express = require("express");
const router = express.Router();

const companyOpportunityController = require("../../controller/Company/Opportunity");

const companyProductController = require("../../controller/Company/Product")

const { companyVerify } = require("../../controller/Company/Middleware/auth")

router.get("/test", companyProductController.test);

router.get("/test-verify", companyVerify, companyProductController.test);


module.exports = router;