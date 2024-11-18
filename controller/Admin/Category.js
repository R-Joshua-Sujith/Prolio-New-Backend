const CategoryModel = require("../../models/Category");


const createCategory = async (req, res) => {
    try {
        res.status(200).json({ message: "Test" })
    } catch (error) {
        res.status(500).json({ error: "Server Error" })
    }
}