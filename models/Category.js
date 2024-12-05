const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const subCategorySchema = new Schema({
    name: {
        type: String,
        trim: true
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, { _id: true });

const CategorySchema = new mongoose.Schema({
    "categoryName": { type: String, required: true, unique: true },
    "steps": { type: mongoose.Schema.Types.Mixed },
    "subCategories": [subCategorySchema],
    "isActive": {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

const CategoryModel = mongoose.model("Category", CategorySchema)

module.exports = CategoryModel;