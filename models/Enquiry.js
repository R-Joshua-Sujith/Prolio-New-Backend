const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const enquirySchema = new Schema({
    customerId: { type: Schema.Types.ObjectId, ref: "Customer" },
    ownerId: { type: Schema.Types.ObjectId, ref: "Customer" },
    productId: { type: Schema.Types.ObjectId, ref: "Product" },
    messages: [{
        content: { type: String },
        role: { type: String, enum: ["customer", "company"] },
        id: { type: Schema.Types.ObjectId, refPath: 'messages.userModel' },
        userModel: { type: String, enum: ["Customer", "CompanyUser"] }
    }]
})


module.exports = mongoose.model("Enquiry", enquirySchema);