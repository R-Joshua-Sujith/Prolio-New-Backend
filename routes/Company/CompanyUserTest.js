const express = require("express");
const router = express.Router();
const companyUserTestController = require("../../controller/Company/CompanyUserTest");
const { companyUserVerify } = require("../../controller/Company/Middleware/companyUserAuth")
router.get("/test", companyUserVerify, companyUserTestController.test)



module.exports = router;