const CategoryModel = require("../../models/Category");

exports.createCategory = async (req, res) => {

    const { categoryName, steps, subCategories } = req.body;
    if (!categoryName) {
        return res.status(400).json({ error: "Category Name is required" })
    }
    const newCategory = new CategoryModel({
        categoryName: categoryName,
        steps: steps,
        subCategories
    })
    try {
        await newCategory.save();
        res.status(201).json({ message: "Category Added Successfully" })
    } catch (error) {
        console.error(error)
        res.status(500).json({ error: error.message })
    }
}

exports.editCategory = async (req, res) => {
    try {
        const categoryId = req.params.id;
        const { categoryName, steps, subCategories, isActive } = req.body;

        if (!categoryName) {
            return res.status(400).json({ error: "Category Name is required" });
        }

        const updateData = {
            categoryName,
            steps,
            subCategories,
            isActive
        }

        const updatedCategory = await CategoryModel.findByIdAndUpdate(
            categoryId,
            updateData,
            { new: true, runValidators: true }
        );

        if (!updatedCategory) {
            return res.status(404).json({ error: "Category not found" });
        }

        res.status(200).json({
            message: "Category Updated Successfully",
            category: updatedCategory
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
}

exports.findCategory = async (req, res) => {
    try {
        const categories = await CategoryModel.find();
        res.status(200).json({ categories })
    } catch (error) {
        res.status(500).json({ error: "Server Error" })
    }
}
