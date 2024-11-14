const router = require("express").Router();

const customerAuthRoutes = require("../Customer/Authentication");
const customerEnquiryRoutes = require("../Customer/Enquiry");

router.use("/auth", customerAuthRoutes);
router.use("/enquiry", customerEnquiryRoutes);

module.exports = router;
