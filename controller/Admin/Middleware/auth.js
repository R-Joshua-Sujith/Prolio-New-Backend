const jwt = require("jsonwebtoken");
const dotenv = require("dotenv");
const AdminModel = require("../../../models/Admin");
const { apiResponse } = require("../../../utils/responseHandler");

dotenv.config();

const adminVerify = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return apiResponse.error(res, 403, "You are not authenticated");
  }
  const token = authHeader.split(" ")[1];
  try {
    const decodedToken = jwt.verify(token, process.env.JWT_SECRET_KEY);
    const admin = await AdminModel.findById(decodedToken.id);
    if (!admin) {
      return apiResponse.error(res, 403, "Admin not found");
    }
    if (admin.status === "Blocked") {
      return apiResponse.error(res, 403, "Admin account is blocked", {
        action: "logout",
      });
    }
    req.admin = admin;
    next();
  } catch (err) {
    return apiResponse.error(
      res,
      401,
      err.name === "TokenExpiredError" ? "Token has expired" : "Invalid token",
      { action: "logout" }
    );
  }
};

module.exports = { adminVerify };
