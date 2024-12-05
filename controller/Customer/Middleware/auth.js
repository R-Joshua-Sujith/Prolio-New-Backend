const jwt = require("jsonwebtoken");
const dotenv = require("dotenv");
const CustomerModel = require("../../../models/Customer");

dotenv.config();

const secretKey = process.env.JWT_SECRET_KEY;

// Middleware (userVerify.js)
// const userVerify = (req, res, next) => {
//     const authHeader = req.headers.authorization;

//     if (!authHeader) {
//         return res.status(403).json({ error: "You are not authenticated" });
//     }

//     const token = authHeader.split(" ")[1];
//     console.log("Cookies", req.cookies);

//     jwt.verify(token, process.env.JWT_SECRET_KEY, async (err, decodedToken) => {
//         if (err) {

//             // Token expired - attempt to refresh using refresh token
//             if (err.name === 'TokenExpiredError') {
//                 try {

//                     // Get refresh token from cookies
//                     const refreshToken = req.cookies.refreshToken;

//                     if (!refreshToken) {
//                         return res.status(401).json({
//                             error: "Refresh token not found",
//                             isExpired: true
//                         });
//                     }

//                     // Verify refresh token
//                     const decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
//                     const user = await CustomerModel.findById(decoded.id);

//                     if (!user || user.refreshToken !== refreshToken) {
//                         return res.status(401).json({
//                             error: "Invalid refresh token",
//                             isExpired: true
//                         });
//                     }

//                     // Generate new access token
//                     const newAccessToken = jwt.sign(
//                         { id: user._id },
//                         process.env.JWT_SECRET_KEY,
//                         { expiresIn: process.env.ACCESS_TOKEN_EXPIRE || '15m' }
//                     );

//                     // Send new access token in response
//                     return res.status(200).json({
//                         message: "Token refreshed",
//                         newAccessToken,
//                         tokenRefreshed: true
//                     });

//                 } catch (error) {
//                     console.error("Token refresh error:", error);
//                     return res.status(401).json({
//                         error: "Token refresh failed",
//                         isExpired: true
//                     });
//                 }
//             }
//             return res.status(401).json({ error: "Invalid token" });
//         }

//         try {
//             const user = await CustomerModel.findById(decodedToken.id);

//             if (!user) {
//                 return res.status(403).json({ error: "User not found" });
//             }

//             if (user?.status === "Blocked") {
//                 return res.status(403).json({
//                     error: "User account is Blocked",
//                     action: "logout"
//                 });
//             }
//             if (user?.status === "UnVerified") {
//                 return res.status(403).json({ error: "Please Verify Your Account" })
//             }

//             req.user = user;
//             next();
//         } catch (error) {
//             console.error("Error finding user:", error);
//             res.status(500).json({ error: "Internal Server Error" });
//         }
//     });
// };

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

const customerVerify = (req, res, next) => {
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

      req.user = user;
      next();
    } catch (error) {
      console.error("Error finding user:", error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  });
};

module.exports = { customerVerify, looseVerify };
