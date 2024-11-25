const express = require("express");
const router = express.Router();
const customerEnquiryController = require("../../controller/Customer/Enquiry");
const {
  customerVerify,
  looseVerify,
} = require("../../controller/Customer/Middleware/auth");

router.get("/test", customerEnquiryController.test);
router.get("/test-verify", customerVerify, customerEnquiryController.test);

// Customer routes
router.post(
  "/initiate-enquiry",
  customerVerify,
  customerEnquiryController.initiateEnquiry
);
router.get(
  "/messages/:productId",
  looseVerify,
  customerEnquiryController.getCustomerEnquiryMessages
);

router.get(
  "/my-enquiry",
  customerVerify,
  customerEnquiryController.getMyEnquiries
);

module.exports = router;
