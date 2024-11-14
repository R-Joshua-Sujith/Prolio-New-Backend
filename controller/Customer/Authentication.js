const Customer = require("../../models/Customer");
const bcrypt = require("bcrypt");
const { validateLoginInput, validateRegistrationInput } = require("./Helpers/Authentication");
const jwt = require("jsonwebtoken")

exports.test = async (req, res) => {
    try {
        res.status(200).json({ message: "Authenticatoin Success" })
    } catch (error) {
        console.error(error)
        res.status(500).json({ error: "Internal Server Error" })
    }
}

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
                error: "User with this Email Dosen't Exist"
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
            process.env.JWT_SECRET_KEY,
        );

    // // Generate refresh token
    // const refreshToken = jwt.sign(
    //     { id: customer._id },
    //     process.env.REFRESH_TOKEN_SECRET,
    //     { expiresIn: '2m' }
    // );

    // // Save refresh token to database
    // customer.refreshToken = refreshToken;
    await customer.save();

    // // Set refresh token in HTTP-only cookie
    // res.cookie('refreshToken', refreshToken, {
    //     httpOnly: true,
    //     secure: process.env.NODE_ENV === 'production',
    //     sameSite: 'strict',
    //     maxAge: 2 * 60 // 7 days
    // });

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

// Logout endpoint to clear refresh token
exports.logout = async (req, res) => {
  try {
    const refreshToken = req.cookies.refreshToken;

    if (!refreshToken) {
      return res.status(401).json({ error: "Refresh token not found" });
    }

    // Verify refresh token
    const decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);

    const customer = await Customer.findById(decoded.id);
    if (customer) {
      customer.refreshToken = null;
      await customer.save();
    } else {
      return res.status(400).json({ error: "Customer Not Found" });
    }

    // Clear refresh token cookie
    res.clearCookie("refreshToken", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
    });

    res.json({ message: "Logged out successfully" });
  } catch (error) {
    console.error("Logout error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
