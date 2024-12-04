const router = require("express").Router();
const companyEnquiryRoutes = require("../Company/Enquiry");
const companyOpportunityRoutes = require("../Company/Opportunity");
const companyProductRoutes = require("../Company/Product");
const companyCategoryRoutes = require("../Company/Category");
const companyForumRoutes = require("../Company/Forum");
const companyMessageRoutes = require("../Company/Message");
const companyConnectionRoutes = require("../Company/Connection");
const companyLogsRoutes = require("../Company/Logs");

router.use("/enquiry", companyEnquiryRoutes);
router.use("/forum", companyForumRoutes);
router.use("/message", companyMessageRoutes);
router.use("/opportunity", companyOpportunityRoutes);
router.use("/product", companyProductRoutes);
router.use("/category", companyCategoryRoutes);
router.use("/connection", companyConnectionRoutes);
router.use("/logs", companyLogsRoutes);

module.exports = router;
