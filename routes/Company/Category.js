const express = require("express");
const router = express.Router();
const companyCategoryController = require("../../controller/Company/Category");
const { companyVerify } = require("../../controller/Company/Middleware/auth");

router.get(
  "/getAllCategories",
  //   companyVerify,
  companyCategoryController.getCategories
);

router.get(
  "/getProductsByCategory/:categoryId",
  companyVerify,
  companyCategoryController.getProductsByCategory
);

router.get(
    '/getOpportunityRoles/:categoryId/:productId', 
    companyVerify, 
    companyCategoryController.getOpportunityRoles
  );



module.exports = router;
