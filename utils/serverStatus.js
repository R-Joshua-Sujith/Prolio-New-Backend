const getServerStatusMessage = () => {
  return {
    message: "Server is up and running!",
    status: "OK",
    environment: process.env.NODE_ENV || "development",
    version: "1.0.0",
    description: "Welcome to the Prolio server",
  };
};

module.exports = { getServerStatusMessage };
