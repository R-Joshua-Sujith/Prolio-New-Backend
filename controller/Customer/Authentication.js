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

// Temporary storage for registration attempts (in production, use Redis or similar)
// Store temporary registration data in memory (use Redis in production)
const registrationAttempts = new Map();

// Step 1: Initial registration and OTP generation
exports.register = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Validate input
    const { errors, isValid } = validateRegistrationInput(
      name,
      email,
      password
    );
    if (!isValid) {
      return res.status(400).json({ success: false, errors });
    }

    // Check if user already exists
    const existingEmail = await Customer.findOne({ email });
    if (existingEmail) {
      return res.status(400).json({
        success: false,
        error: "Email Already Registered",
      });
    }

    // Generate OTP
    const otp = generateOTP();
    const otpExpiry = new Date();
    otpExpiry.setMinutes(otpExpiry.getMinutes() + 15);

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Store registration data temporarily
    registrationAttempts.set(email, {
      name,
      email,
      password: hashedPassword,
      otp,
      otpExpiry,
      createdAt: new Date(),
    });

    // Send OTP email
    const emailPayload = {
      sender: { name: "Prolio", email: "developer@zikrabyte.in" },
      to: [{ email }],
      subject: "Your OTP Verification Code",
      htmlContent: `<p>Your OTP is: ${otp}. This code will expire in 15 minutes.</p>`,
    };

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
    console.error("Registration error:", error);
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// Step 2: Resend OTP if needed
exports.resendOTP = async (req, res) => {
  try {
    const { email } = req.body;

    const registrationData = registrationAttempts.get(email);
    if (!registrationData) {
      return sendResponse(res, 400, false, "No pending registration found");
    }

    // Generate new OTP
    const otp = generateOTP();
    const otpExpiry = new Date();
    otpExpiry.setMinutes(otpExpiry.getMinutes() + 15);

    // Update registration data
    registrationData.otp = otp;
    registrationData.otpExpiry = otpExpiry;
    registrationAttempts.set(email, registrationData);

    // Send new OTP
    const emailPayload = {
      sender: { name: "Prolio", email: "developer@zikrabyte.in" },
      to: [{ email }],
      subject: "New OTP Verification Code",
      htmlContent: `<p>Your new OTP is: ${otp}. This code will expire in 15 minutes.</p>`,
    };

    const response = await axios.post(BREVO_API_URL, emailPayload, {
      headers: {
        "api-key": BREVO_API_KEY,
        accept: "application/json",
        "content-type": "application/json",
      },
    });

    if (response.status === 201) {
      return sendResponse(res, 200, true, "New OTP sent successfully");
    }
  } catch (error) {
    return sendResponse(res, 500, false, error.message);
  }
};

// Step 3: Verify OTP and create user
exports.verifyOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return sendResponse(res, 400, false, "Email and OTP are required");
    }

    const registrationData = registrationAttempts.get(email);
    if (!registrationData) {
      return sendResponse(
        res,
        404,
        false,
        "Registration session not found or expired"
      );
    }

    // Verify OTP
    if (registrationData.otp !== parseInt(otp)) {
      return sendResponse(res, 400, false, "Invalid OTP");
    }

    // Check OTP expiry
    if (new Date() > registrationData.otpExpiry) {
      registrationAttempts.delete(email);
      return sendResponse(res, 400, false, "OTP has expired");
    }

    // Create new user only after OTP verification
    const newCustomer = new Customer({
      name: registrationData.name,
      email: registrationData.email,
      password: registrationData.password,
      status: "Verified",
    });

    await newCustomer.save();

    // Clean up registration data
    registrationAttempts.delete(email);

    return sendResponse(res, 200, true, "Registration completed successfully");
  } catch (error) {
    return sendResponse(res, 500, false, error.message);
  }
};

// Cleanup expired registration attempts periodically
setInterval(() => {
  const now = new Date();
  for (const [email, data] of registrationAttempts.entries()) {
    if (now > data.otpExpiry) {
      registrationAttempts.delete(email);
    }
  }
}, 15 * 60 * 1000); // Run every 15 minutes

// Directly export the verifyOTP function
// exports.verifyOTP = async (req, res) => {
//   try {
//     const { email, otp } = req.body;
//     if (!email || !otp) {
//       return sendResponse(res, 400, false, "Email and OTP are required");
//     }
//     const user = await Customer.findOne({ email });
//     if (!user) {
//       return sendResponse(res, 404, false, "User not found");
//     }
//     // Check if OTP matches
//     const currentTime = new Date();
//     if (user.otp !== parseInt(otp)) {
//       return sendResponse(res, 400, false, "Invalid OTP");
//     }
//     if (!user.otpExpiry || user.otpExpiry < currentTime) {
//       return sendResponse(res, 400, false, "OTP has expired");
//     }

//     // Clear OTP and expiry fields
//     user.otp = undefined;
//     user.otpExpiry = undefined;
//     if (user.status === "UnVerified") {
//       user.status = "Verified";
//     }
//     await user.save();

//     return sendResponse(res, 200, true, "OTP verified successfully");
//   } catch (error) {
//     return sendResponse(res, 500, false, error.message);
//   }
// };

// exports.register = async (req, res) => {
//   try {
//     const { name, email, password } = req.body;
//     const { errors, isValid } = validateRegistrationInput(
//       name,
//       email,
//       password
//     );
//     if (!isValid) {
//       return res.status(400).json({ success: false, errors });
//     }
//     // Check if user already exists with email
//     const existingEmail = await Customer.findOne({ email });
//     if (existingEmail) {
//       return res.status(400).json({
//         success: false,
//         error: "Email Already Registered",
//       });
//     }
//     const hashedPassword = await bcrypt.hash(password, 10);
//     // Create new customer
//     const newCustomer = new Customer({
//       name,
//       email,
//       password: hashedPassword,
//       status: "UnVerified",
//     });
//     await newCustomer.save();
//     return res.status(201).json({
//       success: true,
//       message: "Registration successful",
//     });
//   } catch (error) {
//     console.error("Registration error:", error);
//     return res.status(500).json({
//       success: false,
//       error: error.message,
//     });
//   }
// };

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    console.log(email, password);
    // Validate input
    const { errors, isValid } = validateLoginInput(email, password);
    if (!isValid) {
      return res.status(400).json({ success: false, errors });
    }

    // Check if customer exists
    const customer = await Customer.findOne({ email });
    if (!customer) {
      return res.status(401).json({
        success: false,
        error: "User with this Email doesn't exist.",
      });
    }

    // Validate password
    const isPasswordValid = await bcrypt.compare(password, customer.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        error: "Invalid password.",
      });
    }

    // Generate access token
    const accessToken = jwt.sign(
      {
        id: customer._id,
      },
      process.env.JWT_SECRET_KEY
    );

    return res.status(200).json({
      success: true,
      message: "Login successful.",
      accessToken,
    });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({
      success: false,
      error: "An unexpected error occurred.",
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
    const { isCompany, isInfluencer } = customer;

    // Return the `isCompany` object with statuses
    return res.status(200).json({
      success: true,
      isCompany,
      isInfluencer,
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
// exports.sendOTP = async (req, res) => {
//   console.log("hi");
//   try {
//     const { email } = req.body;
//     if (!email) {
//       return sendResponse(res, 400, false, "Email is required");
//     }

//     const user = await Customer.findOne({ email });
//     if (!user) {
//       return sendResponse(res, 404, false, "User not found");
//     }

//     // Generate OTP and set expiry
//     const otp = generateOTP();
//     const otpExpiry = new Date();
//     otpExpiry.setMinutes(otpExpiry.getMinutes() + 15);
//     user.otp = otp;
//     user.otpExpiry = otpExpiry;
//     await user.save();

//     // Prepare email content
//     const subject = "Your OTP Verification Code";
//     const message = `Your OTP is: ${otp}. This code will expire in 15 minutes.`;
//     const emailPayload = {
//       sender: { name: "Prolio", email: "developer@zikrabyte.in" },
//       to: [{ email }],
//       subject,
//       htmlContent: `<p>${message}</p>`,
//     };

//     console.log("Email payload:", emailPayload);
//     const response = await axios.post(BREVO_API_URL, emailPayload, {
//       headers: {
//         "api-key": BREVO_API_KEY,
//         accept: "application/json",
//         "content-type": "application/json",
//       },
//     });
//     if (response.status === 201) {
//       return sendResponse(res, 200, true, "OTP sent successfully");
//     }
//   } catch (error) {
//     console.error("Error sending OTP:", error.message);
//     return sendResponse(res, 500, false, "Error sending OTP", error.message);
//   }
// };

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
        isGoogleLogin: true,
        profile: {
          url: profile,
          publicId: profile.split("/").pop(),
        },
        status: "Verified",
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

// In-memory storage for OTPs (you can replace this with Redis for production use)
// Temporary storage for forgot password attempts (use Redis in production)
const forgotPasswordAttempts = new Map();

// Step 1: Request to send OTP for password reset
exports.requestPasswordReset = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return sendResponse(res, 400, false, "Email is required");
    }

    // Check if email exists in the database
    const existingUser = await Customer.findOne({ email });
    if (!existingUser) {
      return sendResponse(
        res,
        404,
        false,
        "User with this email does not exist"
      );
    }

    // Generate OTP and expiry time
    const otp = generateOTP();
    const otpExpiry = new Date();
    otpExpiry.setMinutes(otpExpiry.getMinutes() + 15);

    // Store OTP temporarily
    forgotPasswordAttempts.set(email, { otp, otpExpiry });

    // Send OTP via email
    const emailPayload = {
      sender: { name: "Prolio", email: "developer@zikrabyte.in" },
      to: [{ email }],
      subject: "Password Reset OTP",
      htmlContent: `<p>Your password reset OTP is: ${otp}. This code will expire in 15 minutes.</p>`,
    };

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
    console.error("Password reset request error:", error);
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// Step 2: Verify OTP
exports.verifyPasswordResetOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return sendResponse(res, 400, false, "Email and OTP are required");
    }

    const resetData = forgotPasswordAttempts.get(email);

    if (!resetData) {
      return sendResponse(res, 404, false, "Password reset request not found");
    }

    // Validate OTP
    if (resetData.otp !== parseInt(otp)) {
      return sendResponse(res, 400, false, "Invalid OTP");
    }

    // Check OTP expiry
    if (new Date() > resetData.otpExpiry) {
      forgotPasswordAttempts.delete(email);
      return sendResponse(res, 400, false, "OTP has expired");
    }

    return sendResponse(res, 200, true, "OTP verified successfully");
  } catch (error) {
    console.error("OTP verification error:", error);
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// Step 3: Reset password
exports.resetPassword = async (req, res) => {
  try {
    const { email, newPassword, confirmPassword } = req.body;

    // Check if all required fields are present
    if (!email || !newPassword || !confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "All fields are required",
      });
    }

    // Check if passwords match
    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "Passwords do not match",
      });
    }

    // Find user by email
    const existingUser = await Customer.findOne({ email });
    if (!existingUser) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Hash the new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // Update the user's password
    existingUser.password = hashedPassword;
    await existingUser.save();

    // Clean up reset-related data
    forgotPasswordAttempts.delete(email);

    // Send success response
    return res.status(200).json({
      success: true,
      message: "Password reset successfully",
    });
  } catch (error) {
    console.error("Password reset error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// Periodic cleanup of expired reset requests
setInterval(() => {
  const now = new Date();
  for (const [email, data] of forgotPasswordAttempts.entries()) {
    if (now > data.otpExpiry) {
      forgotPasswordAttempts.delete(email);
    }
  }
}, 15 * 60 * 1000); // Run every 15 minutes

// Step 2: Verify OTP
// exports.verifyResetOTP = async (req, res) => {
//   try {
//     const { email, otp } = req.body;

//     if (!email || !otp) {
//       return sendResponse(res, 400, false, "Email and OTP are required");
//     }

//     const resetData = resetAttempts.get(email);
//     if (!resetData) {
//       return sendResponse(
//         res,
//         404,
//         false,
//         "No reset session found for this email"
//       );
//     }

//     if (resetData.otp !== parseInt(otp)) {
//       return sendResponse(res, 400, false, "Invalid OTP");
//     }

//     if (new Date() > resetData.otpExpiry) {
//       resetAttempts.delete(email);
//       return sendResponse(res, 400, false, "OTP has expired");
//     }

//     return sendResponse(res, 200, true, "OTP verified successfully");
//   } catch (error) {
//     return sendResponse(res, 500, false, error.message);
//   }
// };

// // Step 3: Update password
// exports.resetPassword = async (req, res) => {
//   try {
//     const { email, newPassword, confirmPassword } = req.body;

//     if (!email || !newPassword || !confirmPassword) {
//       return sendResponse(
//         res,
//         400,
//         false,
//         "Email, new password, and confirm password are required"
//       );
//     }

//     if (newPassword !== confirmPassword) {
//       return sendResponse(res, 400, false, "Passwords do not match");
//     }

//     const customer = await Customer.findOne({ email });
//     if (!customer) {
//       return sendResponse(res, 404, false, "Customer not found");
//     }

//     // Hash the new password
//     const salt = await bcrypt.genSalt(10);
//     const hashedPassword = await bcrypt.hash(newPassword, salt);

//     customer.password = hashedPassword;
//     await customer.save();

//     // Clean up reset data
//     resetAttempts.delete(email);

//     return sendResponse(res, 200, true, "Password reset successfully");
//   } catch (error) {
//     return sendResponse(res, 500, false, error.message);
//   }
// };

// // Periodic cleanup for expired OTPs
// setInterval(() => {
//   const now = new Date();
//   for (const [email, data] of resetAttempts.entries()) {
//     if (now > data.otpExpiry) {
//       resetAttempts.delete(email);
//     }
//   }
// }, 15 * 60 * 1000); // Run every 15 minutes
