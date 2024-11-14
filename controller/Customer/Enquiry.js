const Enquiry = require("../../models/Enquiry");

exports.test = async (req, res) => {
    try {
        res.status(200).json({ message: "Success" })
    } catch (error) {
        console.error(error)
        res.status(500).json({ error: "Internal Server Error" })
    }
}