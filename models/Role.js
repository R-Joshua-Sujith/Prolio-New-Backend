const mongoose = require("mongoose");
const CompanyUser = require("./CompanyUser");

const permissionSchema = new mongoose.Schema(
  {
    customer: [{ type: String }],
    CompanyUser: [{ type: String }],
    role: [{ type: String }],
    analytics: [{ type: String }],
    logs: [{ type: String }],
    enquiry: [{ type: String }],
    privacy: [{ type: String }],
    terms: [{ type: String }],
    contact: [{ type: String }],
    promo: [{ type: String }],
  },
  { _id: false }
);

const roleSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  permissions: permissionSchema,
});

const Role = mongoose.model("Role", roleSchema);
module.exports = Role;
