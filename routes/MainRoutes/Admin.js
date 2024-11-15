const router = require("express").Router();
const adminAuthRoutes = require("../Admin/Authentication");

router.use("/auth", adminAuthRoutes);

module.exports = router;
