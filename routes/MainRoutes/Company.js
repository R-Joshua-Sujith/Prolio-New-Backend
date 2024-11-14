const router = require('express').Router();

const companyEnquiryRoutes = require("../Company/Enquiry")
const companyOpportunityRoutes = require("../Company/Opportunity");
const companyProductRoutes = require("../Company/Product");

router.use("/enquiry", companyEnquiryRoutes);
router.use("/opportunity", companyOpportunityRoutes);
router.use("/product", companyProductRoutes);


module.exports = router;