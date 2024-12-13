const express = require("express");
const router = express.Router();
const FAQ = require("../../models/FAQ's");
const companyFAQController = require("../../controller/Company/FAQ's");
const {
  customerVerify,
  looseVerify,
  companyVerify,
} = require("../../controller/Company/Middleware/auth");

// Owner routes
router.get(
  "/pending-question",
  companyVerify,
  companyFAQController.getPendingQuestions
);

router.post(
  "/answer/:faqId",
  companyVerify,
  companyFAQController.answerQuestion
);

router.patch(
  "/publishFAQ/:faqId",
  companyVerify,
  companyFAQController.publishFAQ
);

router.get("/product-faqs", companyVerify, companyFAQController.getProductFAQs);

router.patch(
  "/reject-faq/:faqId",
  companyVerify,
  companyFAQController.rejectFAQ
);

router.patch(
  "/edit-question/:faqId",
  companyVerify,
  companyFAQController.editFaqQuestion
);

router.get(
  "/rejected-faqs",
  companyVerify,
  companyFAQController.getRejectedFAQs
);

module.exports = router;
