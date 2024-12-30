const express = require("express");
const router = express.Router();
const adminDepartmentController = require("../../controller/Company/department");
const {
    companyVerify,
} = require("../../controller/Company/Middleware/auth");

router.post("/create-department", companyVerify, adminDepartmentController.createDepartment);

router.get("/get-all-department", companyVerify, adminDepartmentController.getAllDepartments);

router.get("/get-department/:departmentId", companyVerify, adminDepartmentController.getDepartment);

router.put("/update-department/:departmentId", companyVerify, adminDepartmentController.updateDepartment);

router.delete("/delete-department/:departmentId", companyVerify, adminDepartmentController.deleteDepartment);








module.exports = router;