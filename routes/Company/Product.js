const express = require("express");
const router = express.Router();
const companyOpportunityController = require("../../controller/Company/Opportunity");
const companyProductController = require("../../controller/Company/Product");
const {
  companyVerify,
  looseVerify,
} = require("../../controller/Company/Middleware/auth");
const multer = require("multer");
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

router.get("/test", companyProductController.test);

router.get("/test-verify", companyVerify, companyProductController.test);

router.post(
  "/create-product",
  upload.array("images"),
  companyVerify,
  companyProductController.createProduct
);

// router.get(
//   "/all-Products",
//   looseVerify,
//   companyProductController.getAllProducts
// );

router.get(
  "/get-product/:productId",
  companyVerify,
  companyProductController.getProductById
);

router.delete(
  "/delete-product/:id",
  // companyVerify,
  companyProductController.deleteProduct
);

router.get("/check-unique-slug", companyProductController.checkSlugUnique);

router.get("/check-unique-id", companyProductController.checkProductIdUnique);

router.get(
  "/get-all-products",
  companyVerify,
  companyProductController.getAllCompanyProducts
);

router.get(
  "/comapny-products/:productId",
  // looseVerify,
  companyProductController.getCompanyProducts
);

module.exports = router;
