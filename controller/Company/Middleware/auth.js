const jwt = require("jsonwebtoken");
const dotenv = require("dotenv");
const CustomerModel = require("../../../models/Customer");

dotenv.config();

const looseVerify = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(403).json({ error: "You are not authenticated" });
  }

  const token = authHeader.split(" ")[1];

  jwt.verify(token, process.env.JWT_SECRET_KEY, async (err, decodedToken) => {
    if (err) {
      return res.status(401).json({
        error:
          err.name === "TokenExpiredError"
            ? "Token has expired"
            : "Invalid token",
        action: "logout",
      });
    }

    try {
      const user = await CustomerModel.findById(decodedToken.id);

      if (!user) {
        return res.status(403).json({ error: "User not found" });
      }
      req.user = user;
      next();
    } catch (error) {
      console.error("Error finding user:", error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  });
};

const companyVerify = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(403).json({ error: "You are not authenticated" });
  }

  const token = authHeader.split(" ")[1];

  jwt.verify(token, process.env.JWT_SECRET_KEY, async (err, decodedToken) => {
    if (err) {
      return res.status(401).json({
        error:
          err.name === "TokenExpiredError"
            ? "Token has expired"
            : "Invalid token",
        action: "logout",
      });
    }

    try {
      const user = await CustomerModel.findById(decodedToken.id);

      if (!user) {
        return res.status(403).json({ error: "User not found" });
      }

      if (user?.status === "Blocked") {
        return res.status(403).json({
          error: "User account is Blocked",
          action: "logout",
        });
      }

      if (user?.status === "UnVerified") {
        return res.status(403).json({ error: "Please Verify Your Account" });
      }

      if (user?.isCompany?.verified === false) {
        return res.status(403).json({
          error: "Account has to be verified as Company to perform this action",
        });
      }

      req.user = user;
      next();
    } catch (error) {
      console.error("Error finding user:", error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  });
};

module.exports = { companyVerify, looseVerify };
