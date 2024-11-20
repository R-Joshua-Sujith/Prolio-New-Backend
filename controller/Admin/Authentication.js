const AdminModel = require("../../models/Admin");
const bcrypt = require("bcrypt");
const { validateLoginInput } = require("./Helpers/Authentication");
const jwt = require("jsonwebtoken");
const { sendResponse } = require("../../utils/responseHandler");

const secretKey = process.env.JWT_SECRET_KEY

// Test Route
exports.test = async (req, res) => {
  try {
    return sendResponse(res, 200, true, "Authentication Success");
  } catch (error) {
    console.error(error);
    return sendResponse(res, 500, false, "Internal Server Error", error);
  }
};

exports.create = async (req, res) => {
  try {
    const { username, password, email } = req.body;

    // Validate required fields
    if (!username || !password || !email) {
      return res.status(400).json({ error: "All fields are required" });
    }

    const existingUser = await AdminModel.findOne({
      $or: [{ username }, { email }],
    });
    if (existingUser) {
      return res
        .status(400)
        .json({ error: "Username or email already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const adminUser = new AdminModel({
      username,
      password: hashedPassword,
      email,
    });

    await adminUser.save();

    res.status(201).json(adminUser);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error creating admin user" });
  }
}

exports.login = async (req, res) => {
  const { email, password } = req.body;
  const userAgent = req.headers["user-agent"];
  const currentTime = new Date().toISOString();

  const deviceID = userAgent + " " + currentTime;
  try {
    const user = await AdminModel.findOne({ email });

    if (!user) {
      return res.status(401).json({ error: "User Not Found" });
    }

    const passwordMatch = await bcrypt.compare(password, user.password);

    if (!passwordMatch) {
      return res.status(401).json({ error: "Invalid Password" });
    }

    user.loggedInDevice.push({
      deviceID,
      date: currentTime,
    });
    await user.save();

    const payload = {
      loggedInDevice: deviceID,
      id: user._id,
    };

    const token = jwt.sign(payload, secretKey);
    res.status(200).json({
      token,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
}


exports.getProfile = async (req, res) => {
  try {
    const { id } = req.user;
    const user = await AdminModel.findOne({ _id: id }).select("email username loggedInDevice ")
    if (!user) {
      return res.status(404).json({ error: "User Not Found" });
    }
    res.status(200).json(user);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
}

exports.removeLoggedInDevice = async (req, res) => {
  const { deviceId } = req.params;
  const { id } = req.user;
  try {
    const user = await AdminModel.findOne({
      _id: id,
      "loggedInDevice._id": deviceId,
    });

    if (!user) {
      return res
        .status(404)
        .json({ message: "User not found with the specified device" });
    }
    user.loggedInDevice.pull({ _id: deviceId });

    await user.save();

    res.json({ message: "Session Removed Successfully" });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Server Error" });
  }
}

exports.logout = async (req, res) => {
  console.log("hi")
  const { id, loggedInDevice } = req.user;
  try {
    const user = await AdminModel.findOne({
      _id: id.toString(),
      "loggedInDevice.deviceID": loggedInDevice,
    });

    if (!user) {
      return res
        .status(404)
        .json({ message: "User not found with the specified device" });
    }
    user.loggedInDevice.pull({ deviceID: loggedInDevice });

    await user.save();

    res.json({ message: "Session Removed Successfully" });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Server Error" });
  }
}


