const axios = require("axios");
const Customer = require("../../models/Customer");
const bcrypt = require("bcrypt");
const {
  validateLoginInput,
  validateRegistrationInput,
} = require("./Helpers/Authentication");
const jwt = require("jsonwebtoken");
const { sendResponse } = require("../../utils/responseHandler");
const { uploadToS3 } = require("../../utils/s3FileUploader");
const dotenv = require("dotenv");
dotenv.config();

const BREVO_API_KEY = process.env.BREVO_API_KEY;
const BREVO_API_URL = process.env.BREVO_API_URL;

exports.test = async (req, res) => {
  try {
    res.status(200).json({ message: "Authenticatoin Success" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

exports.register = async (req, res) => {
  try {
    const { name, email, password } = req.body;
    const { errors, isValid } = validateRegistrationInput(
      name,
      email,
      password
    );
    if (!isValid) {
      return res.status(400).json({ success: false, errors });
    }
    // Check if user already exists with email
    const existingEmail = await Customer.findOne({ email });
    if (existingEmail) {
      return res.status(400).json({
        success: false,
        error: "Email Already Registered",
      });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    // Create new customer
    const newCustomer = new Customer({
      name,
      email,
      password: hashedPassword,
      status: "UnVerified",
    });
    await newCustomer.save();
    return res.status(201).json({
      success: true,
      message: "Registration successful",
    });
  } catch (error) {
    console.error("Registration error:", error);
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const { errors, isValid } = validateLoginInput(email, password);
    if (!isValid) {
      return res.status(400).json({ success: false, errors });
    }

    const customer = await Customer.findOne({ email });
    if (!customer) {
      return res.status(401).json({
        success: false,
        error: "User with this Email Dosen't Exist",
      });
    }

    const isPasswordValid = bcrypt.compare(password, customer.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        error: "Invalid Password",
      });
    }

    const accessToken = jwt.sign(
      {
        id: customer._id,
      },
      process.env.JWT_SECRET_KEY
    );
    await customer.save();

    return res.status(200).json({
      success: true,
      message: "Login successful",
      accessToken,
    });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

exports.checkVerificationStatus = async (req, res) => {
  try {
    const customerId = req.user?.id;
    if (!customerId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized. User ID not found.",
      });
    }

    // Fetch the customer record by ID
    const customer = await Customer.findById(customerId);
    if (!customer) {
      console.log("Customer not found for ID:", customerId);
      return res.status(404).json({
        success: false,
        message: "Customer not found.",
      });
    }

    // Extract the `isCompany` object
    const { isCompany } = customer;

    // Return the `isCompany` object with statuses
    return res.status(200).json({
      success: true,
      isCompany,
    });
  } catch (error) {
    console.error("Error checking verification status:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error.",
    });
  }
};

exports.refreshToken = async (req, res) => {
  try {
    const refreshToken = req.cookies.refreshToken;

    if (!refreshToken) {
      return res.status(401).json({ error: "Refresh token not found" });
    }

    // Verify refresh token
    const decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
    const customer = await Customer.findById(decoded.id);

    if (!customer || customer.refreshToken !== refreshToken) {
      return res.status(403).json({ error: "Invalid refresh token" });
    }

    // Generate new access token
    const accessToken = jwt.sign(
      { id: customer._id },
      process.env.JWT_SECRET_KEY,
      { expiresIn: "15m" }
    );

    res.json({ accessToken });
  } catch (error) {
    console.error("Refresh token error:", error);
    return res.status(403).json({ error: "Invalid refresh token" });
  }
};

// Logout endpoint
const blacklist = new Set();
exports.logout = async (req, res) => {
  try {
    const cookieToken = req.cookies.accessToken;
    const headerToken = req.headers.authorization?.split(" ")[1];

    const accessToken = cookieToken || headerToken;

    if (!accessToken) {
      return res.status(401).json({ error: "Access token not found" });
    }
    blacklist.add(accessToken);

    // Clear the cookie
    // res.clearCookie("accessToken", {
    //   httpOnly: true,
    //   secure: process.env.NODE_ENV === "production",
    //   sameSite: "strict",
    //   path: "/",
    // });

    return res.status(200).json({ message: "Logged out successfully" });
  } catch (error) {
    console.error("Logout error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Utility function to generate OTP
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000);
};

// Controller: Send OTP
exports.sendOTP = async (req, res) => {
  console.log("hi");
  try {
    const { email } = req.body;
    if (!email) {
      return sendResponse(res, 400, false, "Email is required");
    }

    const user = await Customer.findOne({ email });
    if (!user) {
      return sendResponse(res, 404, false, "User not found");
    }

    // Generate OTP and set expiry
    const otp = generateOTP();
    const otpExpiry = new Date();
    otpExpiry.setMinutes(otpExpiry.getMinutes() + 15);
    user.otp = otp;
    user.otpExpiry = otpExpiry;
    await user.save();

    // Prepare email content
    const subject = "Your OTP Verification Code";
    const message = `Your OTP is: ${otp}. This code will expire in 15 minutes.`;
    const emailPayload = {
      sender: { name: "Prolio", email: "developer@zikrabyte.in" },
      to: [{ email }],
      subject,
      htmlContent: `<p>${message}</p>`,
    };

    console.log("Email payload:", emailPayload);
    const response = await axios.post(BREVO_API_URL, emailPayload, {
      headers: {
        "api-key": BREVO_API_KEY,
        accept: "application/json",
        "content-type": "application/json",
      },
    });
    if (response.status === 201) {
      return sendResponse(res, 200, true, "OTP sent successfully");
    }
  } catch (error) {
    console.error("Error sending OTP:", error.message);
    return sendResponse(res, 500, false, "Error sending OTP", error.message);
  }
};

// Directly export the verifyOTP function
exports.verifyOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) {
      return sendResponse(res, 400, false, "Email and OTP are required");
    }
    const user = await Customer.findOne({ email });
    if (!user) {
      return sendResponse(res, 404, false, "User not found");
    }
    // Check if OTP matches
    const currentTime = new Date();
    if (user.otp !== parseInt(otp)) {
      return sendResponse(res, 400, false, "Invalid OTP");
    }
    if (!user.otpExpiry || user.otpExpiry < currentTime) {
      return sendResponse(res, 400, false, "OTP has expired");
    }

    // Clear OTP and expiry fields
    user.otp = undefined;
    user.otpExpiry = undefined;
    if (user.status === "UnVerified") {
      user.status = "Verified";
    }
    await user.save();

    return sendResponse(res, 200, true, "OTP verified successfully");
  } catch (error) {
    return sendResponse(res, 500, false, error.message);
  }
};

// Backend controller
exports.checkCompanyStatus = async (req, res) => {
  try {
    const userId = req.user.id;

    const user = await Customer.findById(userId).select(
      "isCompany companyDetails.companyInfo.companyName"
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const companyStatus = {
      isApplied: user.isCompany.applied,
      isVerified: user.isCompany.verified,
      isRejected: user.isCompany.rejected,
      companyName: user.companyDetails?.companyInfo?.companyName || null,
      // Remove the getCompanyStatusText call since it's not defined
      status: user.isCompany.verified
        ? "Verified"
        : user.isCompany.rejected
        ? "Rejected"
        : user.isCompany.applied
        ? "Pending"
        : "Not Applied",
    };

    res.status(200).json({
      success: true,
      data: companyStatus,
    });
  } catch (error) {
    console.error("Error checking company status:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

exports.googleLogin = async (req, res) => {
  try {
    const { email, given_name: name, picture: profile } = req.body;

    let user = await Customer.findOne({ email });

    if (!user) {
      // Create a new user if it doesn't exist
      user = new Customer({
        email,
        name,
        isGoogleLogin: true, // Set isGoogleLogin to true for new users
        profile: {
          url: profile,
          publicId: profile.split("/").pop(),
        },
      });
      await user.save();
    } else {
      // Update isGoogleLogin to true for existing users
      if (!user.isGoogleLogin) {
        user.isGoogleLogin = true;
        await user.save();
      }
    }

    const payload = {
      id: user._id,
    };

    // Generate JWT token
    const token = jwt.sign(payload, process.env.JWT_SECRET_KEY, {
      expiresIn: "1d",
    });

    // Send the response with token
    res.status(200).json({ token });
  } catch (error) {
    console.error("Error logging in:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};
