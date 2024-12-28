const express = require("express");
const router = express.Router();
const companyUserController = require("../../controller/Company/companyUser");
const { companyVerify } = require("../../controller/Company/Middleware/auth");

router.get("/get-all-details-of-company", companyVerify, companyUserController.getAllDetailsOfCompany);
// Company user routes
router.post("/create-user", companyVerify, companyUserController.createCompanyUser);
router.get("/get-all-users", companyVerify, companyUserController.getAllCompanyUsers);
router.get("/get-user/:userId", companyVerify, companyUserController.getCompanyUser);
router.put("/update-user/:userId", companyVerify, companyUserController.updateCompanyUser);
router.delete("/delete-user/:userId", companyVerify, companyUserController.deleteCompanyUser);

module.exports = router;