
const CustomerModel = require("../../models/Customer");
const ProductModel = require("../../models/Product");

exports.test = async (req, res) => {
    try {
        res.status(200).json({ message: "Product Success" })
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Internal Server Error" })
    }
}

exports.getProduct = async (req, res) => {
    const { slug } = req.params
    try {
        const product = await ProductModel.findOne({ "basicDetails.slug": slug }).populate("ownerId", "companyDetails.companyInfo companyDetails.contactInfo")
        if (!product) {
            return res.status(400).json({ error: "Product Not Found" })
        }
        res.status(200).json(product);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Internal Server Error" })
    }
}