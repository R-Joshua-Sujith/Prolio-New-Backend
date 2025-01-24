const jwt = require("jsonwebtoken");
const dotenv = require("dotenv");
const CompanyUser = require("../../../models/CompanyUser");

dotenv.config();


const companyUserVerify = (req, res, next) => {
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
            })
        }

        try {
            const user = await CompanyUser.findById(decodedToken.id);
            if (!user) {
                return res.status(403).json({ error: "User Not Found" });
            }

            if (user?.status === "Blocked") {
                return res.status(403).json({ error: "User Account is Blocked", action: "logout" })
            }

            req.user = user;
            req.userType = "CompanyUser"
            next();
        } catch (error) {
            console.error("Error Finding User", error);
            res.status(500).json({ error: "Internal Server Error" })
        }
    })
}

const checkAccess = (resourceType, permission) => {
    return async (req, res, next) => {
        try {
            // Get user ID from request (assuming it's set during authentication)
            const userId = req.user.id; // Adjust according to your auth setup
            if (req.user.userType === "Customer") {
                return next();
            }
            // Fetch the company user with their access permissions
            const user = await CompanyUser.findById(userId);

            if (!user) {
                return res.status(403).json({
                    error: "User not found"
                });
            }

            if (user.status === "Blocked") {
                return res.status(403).json({
                    error: "Your account is blocked"
                });
            }

            // Handle different resource types
            switch (resourceType) {
                case 'product':
                    if (!user.access.productAccess[permission]) {
                        console.log("no access")
                        return res.status(403).json({
                            error: `No ${permission} access for products`
                        });
                    }
                    break;

                case 'enquiry':
                case 'opportunity':
                    const accessKey = `${resourceType}Access`;

                    // Check if user has all access
                    if (user.access[accessKey].allAccess) {
                        break; // Allow access if allAccess is true
                    }

                    // If specific product ID is provided in request
                    const productId = req.params.productId || req.body.productId;
                    if (productId && !user.access[accessKey].productIds.includes(productId)) {
                        return res.status(403).json({
                            error: `No access to this ${resourceType} for the specified product`
                        });
                    }
                    break;

                case 'forum':
                    // Check if user has all forum access
                    if (user.access.forumAccess.allAccess) {
                        break;
                    }

                    // Check specific forum access
                    const forumId = req.params.forumId || req.body.forumId;
                    if (!forumId) {
                        return res.status(400).json({
                            error: "Forum ID is required"
                        });
                    }

                    const forum = user.access.forumAccess.forums.find(
                        f => f.forumId.toString() === forumId
                    );

                    if (!forum || !forum[permission]) {
                        return res.status(403).json({
                            error: `No ${permission} access for this forum`
                        });
                    }
                    break;

                case 'influencer':
                    if (!user.access.influencerAccess[permission]) {
                        return res.status(403).json({
                            error: `No ${permission} access for influencer management`
                        });
                    }
                    break;

                default:
                    return res.status(400).json({
                        error: "Invalid resource type"
                    });
            }

            // If all checks pass, proceed to next middleware/controller
            next();

        } catch (error) {
            console.error('Access check error:', error);
            return res.status(500).json({
                error: "Internal server error during access check"
            });
        }
    };
};


module.exports = { companyUserVerify, checkAccess }