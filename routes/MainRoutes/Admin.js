const router = require("express").Router();
const adminAuthRoutes = require("../Admin/Authentication");
const adminCategoryRoutes = require("../Admin/Category");

router.use("/auth", adminAuthRoutes);
router.use("/category", adminCategoryRoutes);

module.exports = router;
