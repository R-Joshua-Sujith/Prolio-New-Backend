function sendResponse(res, statusCode, success, message, data = null) {
  const response = {
    success,
    message,
  };

  if (data) {
    response.data = data;
  }

  return res.status(statusCode).json(response);
}

module.exports = { sendResponse };
