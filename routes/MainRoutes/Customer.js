const router = require("express").Router();
const customerAuthRoutes = require("../Customer/Authentication");
const customerEnquiryRoutes = require("../Customer/Enquiry");
const customerOpportunityRoutes = require("../Customer/Opportunity");
const customerProductRoutes = require("../Customer/Product");
const customerCompanyRoutes = require("../Customer/Company");
const customerBannerRoutes = require("../Customer/Banner");
const customerProfileRoutes = require("../Customer/Profile");
const customerWishListRoutes = require("../Customer/WishList");


router.use("/auth", customerAuthRoutes);
router.use("/profile", customerProfileRoutes);
router.use("/company", customerCompanyRoutes);
router.use("/banner", customerBannerRoutes);
router.use("/enquiry", customerEnquiryRoutes);
router.use("/opportunity", customerOpportunityRoutes);
router.use("/product", customerProductRoutes);
router.use("/wishlist", customerWishListRoutes);

module.exports = router;
