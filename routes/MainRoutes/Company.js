const router = require("express").Router();
const companyEnquiryRoutes = require("../Company/Enquiry");
const companyOpportunityRoutes = require("../Company/Opportunity");
const companyProductRoutes = require("../Company/Product");
const companyCategoryRoutes = require("../Company/Category");
const companyForumRoutes = require("../Company/Forum");
const companyMessageRoutes = require("../Company/Message");
const companyConnectionRoutes = require("../Company/Connection");
const companyLogsRoutes = require("../Company/Logs");
const companyFAQRoutes = require("../Company/FAQ's.js");
const companyDepartmentRoutes = require("../Company/Department.js");
const companyUserRoutes = require("../Company/companyUser.js");
const companyUserAuthRoutes = require("../Company/companyUserAuth")
const companyinfluencersRoutes = require("../Company/Influencer");

router.use("/enquiry", companyEnquiryRoutes);
router.use("/forum", companyForumRoutes);
router.use("/message", companyMessageRoutes);
router.use("/opportunity", companyOpportunityRoutes);
router.use("/product", companyProductRoutes);
router.use("/category", companyCategoryRoutes);
router.use("/connection", companyConnectionRoutes);
router.use("/logs", companyLogsRoutes);
router.use("/faqs", companyFAQRoutes);
router.use("/department", companyDepartmentRoutes);
router.use("/companyUser", companyUserRoutes);
router.use("/companyUserAuth", companyUserAuthRoutes);

router.use("/influencers", companyinfluencersRoutes);

module.exports = router;
