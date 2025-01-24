const CompanyUser = require("../../models/CompanyUser");

const test = async (req, res) => {
    try {
        console.log(req.userType)
        res.status(200).json({ message: "COMPANY USER TEST SUCCESS" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Internal Server Error" })
    }
}

module.exports = {
    test
}