const express = require("express");
const router = express.Router();

const customerAuthenticationContoller = require("../../controller/Customer/Authentication");
const { customerVerify } = require("../../controller/Customer/Middleware/auth");



router.post("/register", customerAuthenticationContoller.register);

router.post("/login", customerAuthenticationContoller.login);


router.get("/test", customerVerify, async (req, res) => {
    try {
        return res.status({ message: "Success" })
    } catch (error) {
        return res.status(500).json({
            success: false,
            error: "Server Error"
        })
    }
})

module.exports = router;