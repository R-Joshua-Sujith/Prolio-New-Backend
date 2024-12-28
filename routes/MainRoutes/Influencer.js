const router = require("express").Router();
const influencerProfileRoutes = require("../Influencer/InfluencersProfile");

router.use("/profile", influencerProfileRoutes);

module.exports = router;
