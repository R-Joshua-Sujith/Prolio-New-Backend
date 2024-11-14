const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const subCategorySchema = new Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, { _id: true });

const categorySchema = new Schema({
    categoryName: {
        type: String,
        required: true,
        trim: true,
        unique: true
    },
    subCategories: [subCategorySchema],
    isActive: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});


module.exports = mongoose.model("Category", categorySchema);