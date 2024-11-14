const express = require("express");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const cors = require("cors");
const { getServerStatusMessage } = require("./utils/serverStatus");
const customerRoutes = require("./routes/MainRoutes/Customer");

dotenv.config();
const app = express();
app.use(express.json());
app.use(cors());

app.use("/customer", customerRoutes);

app.get("/", (req, res) => {
  res.send(getServerStatusMessage());
});
mongoose
  .connect(process.env.MONGO_URL)
  .then(() => console.log("DB Connection Successful"))
  .catch((err) => console.log(err));

app.listen(process.env.PORT, () => {
  console.log("Backend Server is Running");
});
