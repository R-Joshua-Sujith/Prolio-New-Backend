const router = require("express").Router();
const adminAuthRoutes = require("../Admin/Authentication");
const adminCategoryRoutes = require("../Admin/Category");
const adminCompanyRoutes = require("../Admin/Company");
const adminBannerRoutes = require("../Admin/Banner");
const adminReportProductRoutes = require("../Admin/ReportProduct");
const adminCompanyForumRoutes = require("../Admin/CompanyForum");

router.use("/auth", adminAuthRoutes);
router.use("/banner", adminBannerRoutes);
router.use("/category", adminCategoryRoutes);
router.use("/company", adminCompanyRoutes);
router.use("/company-forum", adminCompanyForumRoutes);
router.use("/report-product", adminReportProductRoutes);

module.exports = router;
