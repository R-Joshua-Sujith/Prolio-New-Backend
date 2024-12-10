const router = require("express").Router();
const adminAuthRoutes = require("../Admin/Authentication");
const adminCategoryRoutes = require("../Admin/Category");
const adminCompanyRoutes = require("../Admin/Company");
const adminBannerRoutes = require("../Admin/Banner");
const adminReportProductRoutes = require("../Admin/ReportProduct");
const adminAnalyticsRoutes = require("../Admin/Analytics");
const adminProductsRoutes = require("../Admin/Product");

router.use("/auth", adminAuthRoutes);
router.use("/banner", adminBannerRoutes);
router.use("/category", adminCategoryRoutes);
router.use("/company", adminCompanyRoutes);
router.use("/report-product", adminReportProductRoutes);
router.use("/analytics", adminAnalyticsRoutes);
router.use("/products", adminProductsRoutes);

module.exports = router;
