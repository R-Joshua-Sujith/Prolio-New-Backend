const express = require("express");
const router = express.Router();
const companyEnquiryController = require("../../controller/Company/Enquiry");
const { companyVerify } = require("../../controller/Company/Middleware/auth");

router.get("/test", companyEnquiryController.test);
router.get("/test-verify", companyVerify, companyEnquiryController.test);

// Company routes
router.post(
  "/reply/:enquiryId",
  companyVerify,
  companyEnquiryController.replyToEnquiry
);
router.get(
  "/myProduct-enquiry",
  companyVerify,
  companyEnquiryController.getMyProductEnquiries
);
router.get(
  "/messages/:enquiryId",
  companyVerify,
  companyEnquiryController.getEnquiryMessages
);
router.get(
  "/customer-profile/:enquiryId",
  companyEnquiryController.getCustomerDetailsByEnquiryId
);

router.get(
  "/count-all-enquiries",
  companyVerify,
  companyEnquiryController.getOwnerEnquiriesCount
);


module.exports = router;
