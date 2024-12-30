const express = require("express");
const router = express.Router();
const companyUserAuthenticationController = require("../../controller/Company/companyUserAuth");


router.get("/test", async (req, res) => {
    res.status(200).json({ message: "TEST" })
})

router.post("/login", companyUserAuthenticationController.login);


module.exports = router;