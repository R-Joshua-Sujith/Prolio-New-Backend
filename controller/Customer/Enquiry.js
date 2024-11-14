const EnquiryModel = require("../../models/Enquiry");
const CustomerModel = require("../../models/Customer")

exports.test = async (req, res) => {
    try {
        res.status(200).json({ message: "Enquiry Success" })
    } catch (error) {
        console.error(error)
        res.status(500).json({ error: "Internal Server Error" })
    }
}