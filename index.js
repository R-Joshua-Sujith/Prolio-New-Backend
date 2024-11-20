const express = require("express");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const cors = require("cors");
const cookieParser = require("cookie-parser");

const { getServerStatusMessage } = require("./utils/serverStatus");
const customerRoutes = require("./routes/MainRoutes/Customer");
const companyRoutes = require("./routes/MainRoutes/Company");
const adminRoutes = require("./routes/MainRoutes/admin");

dotenv.config();
const app = express();
app.use(express.json());
app.use(cors());
app.use(cookieParser());

app.use("/customer", customerRoutes);
app.use("/company", companyRoutes);
app.use("/admin", adminRoutes);

app.get("/", (req, res) => {
  res.send(getServerStatusMessage());
});
mongoose
  .connect(process.env.MONGO_URL)
  .then(() => console.log("DB Connection Successful"))
  .catch((err) => console.log(err));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Backend Server is Running on Port ${PORT}`);
});
