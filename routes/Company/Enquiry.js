const express = require("express");
const router = express.Router();
const companyEnquiryController = require("../../controller/Company/Enquiry");
const { companyVerify } = require("../../controller/Company/Middleware/auth");

router.get("/test", companyEnquiryController.test);
router.get("/test-verify", companyVerify, companyEnquiryController.test);

// Company routes
router.post(
  "/reply/:enquiryId",
  //   companyVerify,
  companyEnquiryController.replyToEnquiry
);
router.get(
  "/messages/:enquiryId",
  //   companyVerify,
  companyEnquiryController.getEnquiryMessages
);

module.exports = router;
