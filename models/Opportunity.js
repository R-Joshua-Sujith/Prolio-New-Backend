const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const opportunitySchema = new Schema({
    customerId: { type: Schema.Types.ObjectId, ref: "Customer" },
    ownerId: { type: Schema.Types.ObjectId, ref: "Customer" },
    productId: { type: Schema.Types.ObjectId, ref: "Product" },
    opportunity_role: [{ type: String }],
    address: { type: String },
    yearsOfExp: { type: String },
    memo: { type: String },
    documents: [{
        url: { type: String },
        publicId: { type: String }
    }],
    status: { type: String, enum: ["Processing", "Approved", "Rejected"] },
    remarks: { type: String }
})

module.exports = mongoose.model("Opportunity", opportunitySchema);