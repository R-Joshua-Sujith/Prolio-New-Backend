const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const productSchema = new Schema({
    status: [{ type: String, enum: ["Active", "In_Active", "Draft"], default: "Active" }],
    ownerId: { type: Schema.Types.ObjectId, ref: "Customer" },
    basicDetails: {
        id: { type: String },
        slug: { type: String },
        name: { type: String },
        price: { type: Number },
        description: { type: Number }
    },
    images: [{
        url: { type: String },
        publicId: { type: String }
    }],
    colors: [{
        name: { type: String },
        price: { type: Number },
        images: [{
            url: { type: String },
            publicId: { type: String }
        }]
    }],
    attributes: [{
        name: { type: String },
        price: { type: Number }
    }],
    category: {
        categoryId: { type: Schema.Types.ObjectId, ref: "Category" },
        subCategoryId: { type: Schema.Types.ObjectId }
    },
    dynamicSteps: { type: mongoose.Schema.Types.Mixed },
    opportunities: [{
        type: String
    }]
}, {
    timestamps: true
})

module.exports = mongoose.model("Product", productSchema);