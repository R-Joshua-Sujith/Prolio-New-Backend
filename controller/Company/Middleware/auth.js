const jwt = require("jsonwebtoken");
const dotenv = require("dotenv");
const CustomerModel = require("../../../models/Customer");
const CompanyUser = require("../../../models/CompanyUser");

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

// const companyVerify = (req, res, next) => {
//   const authHeader = req.headers.authorization;

//   if (!authHeader) {
//     return res.status(403).json({ error: "You are not authenticated" });
//   }

//   const token = authHeader.split(" ")[1];

//   jwt.verify(token, process.env.JWT_SECRET_KEY, async (err, decodedToken) => {
//     if (err) {
//       return res.status(401).json({
//         error:
//           err.name === "TokenExpiredError"
//             ? "Token has expired"
//             : "Invalid token",
//         action: "logout",
//       });
//     }

//     try {
//       const user = await CustomerModel.findById(decodedToken.id);

//       if (!user) {
//         next();
//         return res.status(403).json({ error: "User not found" });
//       }

//       if (user?.status === "Blocked") {
//         return res.status(403).json({
//           error: "User account is Blocked",
//           action: "logout",
//         });
//       }

//       if (user?.status === "UnVerified") {
//         return res.status(403).json({ error: "Please Verify Your Account" });
//       }

//       if (user?.isCompany?.verified === false) {
//         return res.status(403).json({
//           error: "Account has to be verified as Company to perform this action",
//         });
//       }

//       req.user = user;
//       req.userType = "Customer"
//       next();
//     } catch (error) {
//       console.error("Error finding user:", error);
//       res.status(500).json({ error: "Internal Server Error" });
//     }
//   });
// };

const companyVerify = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(403).json({ error: "You are not authenticated" });
  }

  const token = authHeader.split(" ")[1];

  jwt.verify(token, process.env.JWT_SECRET_KEY, async (err, decodedToken) => {
    if (err) {
      return res.status(401).json({
        error: err.name === "TokenExpiredError"
          ? "Token has expired"
          : "Invalid token",
        action: "logout",
      });
    }

    try {
      // First try to find a company owner
      const companyOwner = await CustomerModel.findById(decodedToken.id);

      if (companyOwner) {
        // Company owner checks
        if (companyOwner.status === "Blocked") {
          return res.status(403).json({
            error: "User account is Blocked",
            action: "logout",
          });
        }

        if (companyOwner.status === "UnVerified") {
          return res.status(403).json({
            error: "Please Verify Your Account"
          });
        }

        if (companyOwner?.isCompany?.verified === false) {
          return res.status(403).json({
            error: "Account has to be verified as Company to perform this action",
          });
        }

        req.user = companyOwner;
        req.userType = "companyOwner";
        return next();
      }

      // If not a company owner, try to find a company user
      const companyUser = await CompanyUser.findById(decodedToken.id);
     
      if (!companyUser) {
        return res.status(403).json({ error: "User Not Found" });
      }

      if (companyUser.status === "Blocked") {
        return res.status(403).json({
          error: "User Account is Blocked",
          action: "logout"
        });
      }

      req.user = companyUser;
      req.userType = "companyUser";
      return next();

    } catch (error) {
      console.error("Error finding user:", error);
      return res.status(500).json({ error: "Internal Server Error" });
    }
  });
};

module.exports = { companyVerify, looseVerify };
