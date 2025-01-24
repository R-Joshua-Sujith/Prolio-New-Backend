const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const companySchema = new Schema({
    ownerId: { type: Schema.Types.ObjectId, ref: "Customer" },
    username: { type: String },
    email: { type: String, unique: true },
    password: { type: String },
    phone: { type: String },
    department: { type: Schema.Types.ObjectId },
    access: {
        productAccess: {
            view: { type: Boolean, default: false },
            create: { type: Boolean, default: false },
            edit: { type: Boolean, default: false },
        },
        enquiryAccess: {
            allAccess: { type: Boolean, default: false },
            productIds: [
                {
                    type: Schema.Types.ObjectId,
                    ref: "Product"
                }
            ]
        },
        opportunityAccess: {
            allAccess: { type: Boolean, default: false },
            productIds: [
                {
                    type: Schema.Types.ObjectId,
                    ref: "Product"
                }
            ]
        },
        forumAccess: {
            allAccess: { type: Boolean, default: false },
            forums: [{
                forumId: { type: Schema.Types.ObjectId, ref: "" },
                edit: { type: Boolean, default: false },
                message: { type: Boolean, default: false },
                invite: { type: Boolean, default: false }
            }],
        },
        influencerAccess: {
            invite: { type: Boolean, default: false },
            accept: { type: Boolean, default: false },
            reject: { type: Boolean, default: false },
            assignProduct: { type: Boolean, default: false }
        }
    },
    status: { type: String, enum: ["Active", "Blocked"] }
}, {
    timestamps: true
})

module.exports = mongoose.model("CompanyUser", companySchema);