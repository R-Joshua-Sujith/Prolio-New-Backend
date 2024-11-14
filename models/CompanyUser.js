const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const companySchema = new Schema({
    ownerId: { type: Schema.Types.ObjectId, ref: "Customer" },
    email: { type: String, unique: true },
    password: { type: String },
    phone: { type: String },
    department: { type: Schema.Types.ObjectId },
    access: { type: mongoose.Schema.Types.Mixed }
}, {
    timestamps: true
})

module.exports = mongoose.model("CompanyUser", companySchema);