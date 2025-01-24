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

router.put(
  "/edit-product/:id",
  companyVerify,
  companyProductController.updateProduct
);
router.get(
  "/price-graph/:id",
  // companyVerify,
  companyProductController.getPriceHistoryGraph
);

router.get(
  "/comapny-products/:ownerId",
  // looseVerify,
  companyProductController.getCompanyProducts
);

router.get(
  "/get-product/:productId",
  companyVerify,
  companyProductController.getProductById
);

router.delete(
  "/delete-product/:id",
  companyVerify,
  companyProductController.deleteProduct
);

router.get("/check-unique-slug", companyProductController.checkSlugUnique);

router.get("/check-unique-id", companyProductController.checkProductIdUnique);

router.get(
  "/get-all-products",
  looseVerify,
  companyProductController.getAllCompanyProducts
);

router.get(
  "/comapny-products/:ownerId",
  // looseVerify,
  companyProductController.getCompanyProducts
);

router.post(
  "/add-image/:productId",
  companyVerify,
  upload.single("image"),
  companyProductController.addProductImage
);

router.delete(
  "/delete-image/:productId/:imageId",
  companyVerify,
  companyProductController.deleteProductImage
);

router.get(
  "/getTotalViewsAndNewVisits",
  companyVerify,
  companyProductController.getTotalViewsAndNewVisits
);

router.get(
  "/getSingleProductViewsAndVisits/:productId",
  companyVerify,
  companyProductController.getSingleProductViewsAndVisits
);

router.get(
  "/getVisitorInsights",
  companyVerify,
  companyProductController.getVisitorInsights
);

router.get(
  "/getOwnerProductViewLocations",
  companyVerify,
  companyProductController.getOwnerProductViewLocations
);

router.get(
  "/product-names",
  companyVerify,
  companyProductController.getProductNames
);

router.patch(
  "/:id/toggle-visibility",
  companyVerify,
  companyProductController.toggleVisibility
);
router.get(
  "/:id/stats",
  // companyVerify,
  companyProductController.getProductStats
);

router.post(
  "/assign-products",
  companyVerify,
  companyProductController.assignProducts
);

module.exports = router;

//test
