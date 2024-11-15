const express = require("express");
const router = express.Router();
const customerEnquiryController = require("../../controller/Customer/Enquiry");
const { customerVerify } = require("../../controller/Customer/Middleware/auth");

router.get("/test", customerEnquiryController.test);
router.get("/test-verify", customerVerify, customerEnquiryController.test);

// Customer routes
router.post(
  "/initiateEnquiry",
  customerVerify,
  customerEnquiryController.initiateEnquiry
);
router.get(
  "/messages/:enquiryId",
  customerVerify,
  customerEnquiryController.getEnquiryMessages
);

module.exports = router;
