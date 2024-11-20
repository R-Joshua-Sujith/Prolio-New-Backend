const express = require("express");
const router = express.Router();
const adminCategoryController = require("../../controller/Admin/Category")
const adminVerify = require("../../controller/Admin/Middleware/auth");

router.post("/add-category", adminCategoryController.createCategory);

router.put("/edit-category/:id", adminCategoryController.editCategory);

router.get("/fetch-category", adminCategoryController.findCategory);

module.exports = router;