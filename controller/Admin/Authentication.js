const adminModel = require("../../models/Admin");
const bcrypt = require("bcrypt");
const { validateLoginInput } = require("./Helpers/Authentication");
const jwt = require("jsonwebtoken");
const { sendResponse } = require("../../utils/responseHandler");

// Test Route
exports.test = async (req, res) => {
  try {
    return sendResponse(res, 200, true, "Authentication Success");
  } catch (error) {
    console.error(error);
    return sendResponse(res, 500, false, "Internal Server Error", error);
  }
};

// Registration Route
exports.register = async (req, res) => {
  try {
    const { username, email, password } = req.body;

    const existingEmail = await adminModel.findOne({ email });
    if (existingEmail) {
      return sendResponse(res, 400, false, "Email Already Registered");
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newAdmin = new adminModel({
      username,
      email,
      password: hashedPassword,
      status: "active",
    });

    await newAdmin.save();
    return sendResponse(res, 201, true, "Registration successful");
  } catch (error) {
    console.error("Registration error:", error);
    return sendResponse(res, 500, false, "Registration error", error);
  }
};

// Login Route
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const { errors, isValid } = validateLoginInput(email, password);
    if (!isValid) {
      return sendResponse(res, 400, false, "Validation Error", errors);
    }

    const admin = await adminModel.findOne({ email });
    if (!admin) {
      return sendResponse(res, 401, false, "Admin doesn't exist");
    }
    const isPasswordValid = await bcrypt.compare(password, admin.password);
    if (!isPasswordValid) {
      return sendResponse(res, 401, false, "Invalid password");
    }

    const accessToken = jwt.sign(
      { id: admin._id },
      process.env.JWT_SECRET_KEY,
      { expiresIn: "15m" }
    );

    return sendResponse(res, 200, true, "Login successful", { accessToken });
  } catch (error) {
    console.error("Login error:", error);
    return sendResponse(res, 500, false, "Login error", error);
  }
};

// Refresh Token Route
exports.refreshToken = async (req, res) => {
  try {
    const refreshToken = req.cookies.refreshToken;

    if (!refreshToken) {
      return sendResponse(res, 401, false, "Refresh token not found");
    }

    // Verify refresh token
    const decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
    const admin = await adminModel.findById(decoded.id);

    if (!admin || admin.refreshToken !== refreshToken) {
      return sendResponse(res, 403, false, "Invalid refresh token");
    }

    // Generate new access token
    const accessToken = jwt.sign(
      { id: admin._id },
      process.env.JWT_SECRET_KEY,
      { expiresIn: "15m" }
    );

    return sendResponse(res, 200, true, "Access token refreshed", {
      accessToken,
    });
  } catch (error) {
    console.error("Refresh token error:", error);
    return sendResponse(res, 403, false, "Invalid refresh token", error);
  }
};

// Logout Route
exports.logout = async (req, res) => {
  try {
    const refreshToken = req.cookies.refreshToken;
    if (!refreshToken) {
      return sendResponse(res, 401, false, "Refresh token not found");
    }
    const decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
    const admin = await adminModel.findById(decoded.id);

    if (admin) {
      admin.refreshToken = null;
      await admin.save();
    } else {
      return sendResponse(res, 400, false, "Admin not found");
    }

    // Clear refresh token cookie
    res.clearCookie("refreshToken", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
    });

    return sendResponse(res, 200, true, "Logged out successfully");
  } catch (error) {
    console.error("Logout error:", error);
    return sendResponse(res, 500, false, "Logout error", error);
  }
};
