const router = require("express").Router();
const adminAuthRoutes = require("../Admin/Authentication");
const adminCategoryRoutes = require("../Admin/Category");
const adminCompanyRoutes = require("../Admin/Company");
const adminBannerRoutes = require("../Admin/Banner");
const adminReportProductRoutes = require("../Admin/ReportProduct");
const adminCompanyForumRoutes = require("../Admin/CompanyForum");
const adminAnalyticsRoutes = require("../Admin/Analytics");
const adminProductsRoutes = require("../Admin/Product");
const adminInfluencersRoutes = require("../Admin/InfluencerRoute");
const adminLogsRoutes = require("../Admin/LogRoute");
const adminNotificationRoutes = require("../Admin/Notification");

router.use("/auth", adminAuthRoutes);
router.use("/banner", adminBannerRoutes);
router.use("/category", adminCategoryRoutes);
router.use("/company", adminCompanyRoutes);
router.use("/company-forum", adminCompanyForumRoutes);
router.use("/report-product", adminReportProductRoutes);
router.use("/analytics", adminAnalyticsRoutes);
router.use("/products", adminProductsRoutes);
router.use("/influencers", adminInfluencersRoutes);
router.use("/logs", adminLogsRoutes);
router.use("/notification", adminNotificationRoutes);

module.exports = router;
