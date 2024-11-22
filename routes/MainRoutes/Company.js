const router = require("express").Router();
const companyEnquiryRoutes = require("../Company/Enquiry");
const companyOpportunityRoutes = require("../Company/Opportunity");
const companyProductRoutes = require("../Company/Product");
const companyCategoryRoutes = require("../Company/Category");

router.use("/enquiry", companyEnquiryRoutes);
router.use("/opportunity", companyOpportunityRoutes);
router.use("/product", companyProductRoutes);
router.use("/category", companyCategoryRoutes);

module.exports = router;
