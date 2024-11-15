const express = require("express");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const cors = require("cors");
const customerRoutes = require("./routes/MainRoutes/Customer");
const companyRoutes = require("./routes/MainRoutes/Company");

dotenv.config();
const app = express();
app.use(express.json());
app.use(cors());

app.use("/customer", customerRoutes);
app.use("/company", companyRoutes);

mongoose
  .connect(process.env.MONGO_URL)
  .then(() => console.log("DB Connection Successful"))
  .catch((err) => console.log(err));

app.listen(process.env.PORT, () => {
  console.log("Backend Server is Running");
});
