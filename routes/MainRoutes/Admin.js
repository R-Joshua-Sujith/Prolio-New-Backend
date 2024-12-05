const router = require("express").Router();
const adminAuthRoutes = require("../Admin/Authentication");
const adminCategoryRoutes = require("../Admin/Category");
const adminCompanyRoutes = require("../Admin/Company");
const adminBannerRoutes = require("../Admin/Banner");

router.use("/auth", adminAuthRoutes);
router.use("/banner", adminBannerRoutes);
router.use("/category", adminCategoryRoutes);
router.use("/company", adminCompanyRoutes);

module.exports = router;
