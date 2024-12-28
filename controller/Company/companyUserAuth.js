const CompanyUser = require("../../models/CompanyUser");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const dotenv = require("dotenv");


dotenv.config();

const login = async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({
                error: "Email and Password are required"
            })
        }
        const user = await CompanyUser.findOne({ email });

        if (!user) {
            return res.status(401).json({ error: "User Not Found" });
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);

        if (!isPasswordValid) {
            return res.status(400).json({ error: "Invalid Password" })
        }

        const accessToken = jwt.sign({
            id: user._id,
        },
            process.env.JWT_SECRET_KEY
        )

        return res.status(200).json({
            message: "Login Successful",
            accessToken,
            userType: "CompanyUser"
        })

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Internal Server Error" })
    }
}


module.exports = {
    login
}