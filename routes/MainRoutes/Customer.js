const router = require("express").Router();
const customerAuthRoutes = require("../Customer/Authentication");
const customerEnquiryRoutes = require("../Customer/Enquiry");
const customerOpportunityRoutes = require("../Customer/Opportunity");
const customerProductRoutes = require("../Customer/Product");

router.use("/auth", customerAuthRoutes);
router.use("/enquiry", customerEnquiryRoutes);
router.use("/opportunity", customerOpportunityRoutes);
router.use("/product", customerProductRoutes);

module.exports = router;
